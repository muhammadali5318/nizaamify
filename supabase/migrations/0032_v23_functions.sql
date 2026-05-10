-- 0032_v23_functions.sql
-- v2.3 Phase C — function + view rewrites
--   §A record_purchase   — largest-remainder overhead allocation, store
--                          line_overhead_amount as source of truth, populate
--                          legacy overhead_per_unit for back-compat
--   §B record_sale       — drop tier auto-discount, accept p_sale_discount_*,
--                          snapshot customer.tier_id for categorization only.
--                          Signature changes → DROP + CREATE.
--   §C search_products   — name-only matching (drop type clauses).
--                          Signature preserved (relevance, p_only_in_stock).
--   §D search_products_count — same name-only treatment.
--   §E invoice_with_discount_detail — drop + recreate with renamed columns.
--
-- Grants follow the v1.8 pattern: revoke from public, anon; grant to
-- authenticated.

-- ============================================================================
-- §A. record_purchase — largest-remainder overhead allocation
-- ============================================================================

create or replace function public.record_purchase(
  p_supplier_id uuid default null::uuid,
  p_purchase_date date default current_date,
  p_note text default null::text,
  p_items jsonb default '[]'::jsonb,
  p_overhead_items jsonb default '[]'::jsonb,
  p_is_opening boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_overhead_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_overhead jsonb;
  v_product record;
  v_pack record;
  v_idx int := 0;
  v_qty int;
  v_pack_qty int;
  v_pack_id uuid;
  v_pack_base_qty_snapshot int;
  v_qty_in_base int;
  v_cost numeric(12,2);
  v_line_value numeric(12,2);
  v_per_base_unit_cost numeric(12,2);
  v_line_overhead numeric(12,2);
  v_overhead_per_base_unit numeric(12,2);
  v_effective_per_base_cost numeric(12,2);
  v_supplier_name text;
  v_source text;
  -- v2.3: per-line overhead amounts pre-computed via largest-remainder so the
  -- sum equals overhead_subtotal exactly. Indexed 1..N matching p_items.
  v_shares numeric(12,2)[];
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_purchase' using errcode = 'P0001';
  end if;

  if p_supplier_id is not null then
    select name into v_supplier_name
      from public.suppliers
     where id = p_supplier_id and shop_id = v_shop_id and is_active = true;
    if not found then raise exception 'supplier_not_in_shop' using errcode = 'P0001'; end if;
  end if;

  -- ---- Pass 1: validate items, accumulate items_subtotal ----
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);
    if v_cost is null or v_cost < 0 then
      raise exception 'cost_must_be_non_negative' using errcode = 'P0001';
    end if;
    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_qty := (v_item->>'pack_qty')::int;
      if v_pack_qty is null or v_pack_qty <= 0 then
        raise exception 'pack_qty_must_be_positive' using errcode = 'P0001';
      end if;
      v_items_subtotal := v_items_subtotal + (v_pack_qty * v_cost);
    else
      v_qty := (v_item->>'qty')::int;
      if v_qty is null or v_qty <= 0 then
        raise exception 'qty_must_be_positive' using errcode = 'P0001';
      end if;
      v_items_subtotal := v_items_subtotal + (v_qty * v_cost);
    end if;
  end loop;

  -- ---- Validate + accumulate overhead_subtotal ----
  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      if (v_overhead->>'category') not in ('delivery','labor','customs','packaging','other') then
        raise exception 'invalid_overhead_category' using errcode = 'P0001';
      end if;
      if ((v_overhead->>'amount')::numeric(12,2)) <= 0 then
        raise exception 'overhead_amount_must_be_positive' using errcode = 'P0001';
      end if;
      v_overhead_subtotal := v_overhead_subtotal + (v_overhead->>'amount')::numeric(12,2);
    end loop;
  end if;

  -- ---- Largest-remainder allocation (the v2.3 fix) ----
  -- For each line, raw_share = round(overhead × line_value / items_subtotal, 2).
  -- The sum of rounded shares may drift by a few paisa from overhead_subtotal;
  -- the line with the largest line_value absorbs the correction. Result:
  -- sum(line_overhead_amount) = overhead_subtotal exactly, every time.
  if v_overhead_subtotal > 0 and v_items_subtotal > 0 then
    with input_lines as (
      select
        elem.idx::int as idx,
        case
          when (elem.row->>'pack_id') is not null
            then (elem.row->>'pack_qty')::int * (elem.row->>'cost_at_purchase')::numeric
          else (elem.row->>'qty')::int * (elem.row->>'cost_at_purchase')::numeric
        end as line_value
      from jsonb_array_elements(p_items) with ordinality as elem(row, idx)
    ),
    raw_shares as (
      select
        idx,
        line_value,
        round(v_overhead_subtotal * line_value / v_items_subtotal, 2) as raw,
        row_number() over (order by line_value desc, idx) as rk
      from input_lines
    ),
    delta as (
      select v_overhead_subtotal - coalesce(sum(raw), 0) as d from raw_shares
    )
    select array_agg(
      case when rs.rk = 1 then rs.raw + d.d else rs.raw end
      order by rs.idx
    )
      into v_shares
      from raw_shares rs cross join delta d;
  end if;

  -- ---- Insert purchase header ----
  v_source := case
    when p_is_opening then 'Opening Stock'
    when p_supplier_id is not null then v_supplier_name
    else 'Direct purchase'
  end;
  insert into public.purchases (
    shop_id, supplier_id, total_cost, items_subtotal, overhead_subtotal,
    source, note, purchase_date, cashier_id, is_opening
  ) values (
    v_shop_id, p_supplier_id,
    v_items_subtotal + v_overhead_subtotal,
    v_items_subtotal, v_overhead_subtotal,
    v_source,
    nullif(trim(coalesce(p_note,'')),''),
    coalesce(p_purchase_date, current_date),
    v_user_id, coalesce(p_is_opening, false)
  ) returning id into v_purchase_id;

  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      insert into public.purchase_overhead_items (purchase_id, category, amount, description)
      values (
        v_purchase_id, v_overhead->>'category',
        (v_overhead->>'amount')::numeric(12,2),
        nullif(trim(coalesce(v_overhead->>'description','')),'')
      );
    end loop;
  end if;

  -- ---- Pass 2: lock products, write items ----
  v_idx := 0;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);

    select id, stock, avg_cost into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
     for update;
    if not found then raise exception 'product_not_in_shop' using errcode = 'P0001'; end if;

    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_id := (v_item->>'pack_id')::uuid;
      v_pack_qty := (v_item->>'pack_qty')::int;
      select id, base_qty into v_pack
        from public.product_packs
       where id = v_pack_id and product_id = v_product.id and is_active;
      if not found then raise exception 'pack_not_found_or_inactive' using errcode = 'P0001'; end if;
      v_pack_base_qty_snapshot := v_pack.base_qty;
      v_qty_in_base := v_pack_qty * v_pack_base_qty_snapshot;
      v_line_value := v_pack_qty * v_cost;
    else
      v_pack_id := null;
      v_pack_qty := null;
      v_pack_base_qty_snapshot := null;
      v_qty_in_base := (v_item->>'qty')::int;
      v_line_value := v_qty_in_base * v_cost;
    end if;

    v_per_base_unit_cost := round(v_line_value / v_qty_in_base, 2);
    v_line_overhead := coalesce(v_shares[v_idx], 0);
    -- Legacy column kept for back-compat (deprecated; drop in future cleanup):
    v_overhead_per_base_unit := case when v_qty_in_base > 0
      then round(v_line_overhead / v_qty_in_base, 2)
      else 0
    end;
    -- Effective per-base cost adds the unrounded overhead-per-base before the
    -- final 2dp round. Avoids the double-rounding that v2.2/v2.1 had.
    v_effective_per_base_cost := round(
      v_per_base_unit_cost + (v_line_overhead / nullif(v_qty_in_base, 0)::numeric),
      2
    );

    insert into public.purchase_items (
      purchase_id, product_id, qty, qty_in_base,
      cost_at_purchase,
      line_overhead_amount,         -- v2.3: source of truth
      overhead_per_unit,            -- legacy back-compat
      pack_id, pack_qty, pack_base_qty_snapshot,
      avg_cost_before, avg_cost_after
    ) values (
      v_purchase_id, v_product.id, v_qty_in_base, v_qty_in_base,
      v_cost,
      v_line_overhead,
      v_overhead_per_base_unit,
      v_pack_id, v_pack_qty, v_pack_base_qty_snapshot,
      v_product.avg_cost,
      case
        when v_product.stock + v_qty_in_base = 0 then v_product.avg_cost
        when v_product.stock <= 0                then v_effective_per_base_cost
        else round(
          (v_product.stock * v_product.avg_cost + v_qty_in_base * v_effective_per_base_cost)
          / (v_product.stock + v_qty_in_base), 2
        )
      end
    );

    update public.products
       set stock = stock + v_qty_in_base,
           avg_cost = case
             when stock + v_qty_in_base = 0 then avg_cost
             when stock <= 0                then v_effective_per_base_cost
             else round(
               (stock * avg_cost + v_qty_in_base * v_effective_per_base_cost)
               / (stock + v_qty_in_base), 2
             )
           end,
           last_purchase_cost = v_cost,
           cost = case when stock <= 0 then v_cost else cost end,
           updated_at = now()
     where id = v_product.id;
  end loop;

  return v_purchase_id;
end;
$function$;

-- ============================================================================
-- §B. record_sale — drop tier auto-discount, accept p_sale_discount_*
--      Signature changes (param renames), so DROP + CREATE.
-- ============================================================================

drop function if exists public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric);

create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null,
  p_sale_discount_value numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_sale_discount_percent_snapshot numeric(5,2);
  v_sale_discount_amount numeric(12,2) := 0;
  v_total numeric(12,2);
  v_credit numeric(12,2);
  v_payment_type text;
  v_service numeric(12,2);
  v_customer_tier_id uuid;
  v_item jsonb;
  v_qty int;
  v_price numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_discount_type text;
  v_line_discount_value numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_product record;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  v_service := coalesce(p_service_charge, 0);
  if p_amount_paid is null or p_amount_paid < 0 then raise exception 'amount_paid_negative'; end if;
  if v_service < 0 then raise exception 'service_charge_negative'; end if;

  if jsonb_typeof(p_items) is null then p_items := '[]'::jsonb; end if;
  if jsonb_array_length(p_items) = 0 and v_service = 0 then
    raise exception 'empty_sale: a sale must have items or a service charge';
  end if;

  -- Sale-level discount params (renamed from p_tier_override_*).
  -- Both set or both null. Tier categorization is independent now.
  if (p_sale_discount_type is null) <> (p_sale_discount_value is null) then
    raise exception 'sale_discount_type_and_value_must_both_be_set_or_neither';
  end if;
  if p_sale_discount_type is not null
     and p_sale_discount_type not in ('percent', 'fixed') then
    raise exception 'invalid_sale_discount_type';
  end if;
  if p_sale_discount_type = 'percent'
     and (p_sale_discount_value < 0 or p_sale_discount_value > 100) then
    raise exception 'sale_discount_percent_out_of_range';
  end if;
  if p_sale_discount_type = 'fixed' and p_sale_discount_value < 0 then
    raise exception 'sale_discount_fixed_negative';
  end if;

  -- Snapshot the customer's tier for categorization on the invoice.
  -- v2.3: this no longer drives any pricing — tiers are pure categories.
  if p_customer_id is not null then
    select tier_id into v_customer_tier_id
      from public.customers
     where id = p_customer_id and shop_id = v_shop_id;
  end if;

  -- ---- Pass 1: line totals (with line discounts) ----
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    if v_qty is null or v_qty <= 0 then raise exception 'qty must be positive'; end if;
    if v_price is null or v_price < 0 then raise exception 'price must be non-negative'; end if;
    v_line_subtotal := v_qty * v_price;

    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    if v_item->>'line_discount_value' is null then
      v_line_discount_value := null;
    else
      v_line_discount_value := (v_item->>'line_discount_value')::numeric(12,2);
    end if;

    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      if v_line_discount_value is null
         or v_line_discount_value < 0
         or v_line_discount_value > 100 then
        raise exception 'line_discount_percent_out_of_range';
      end if;
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    elsif v_line_discount_type = 'fixed' then
      if v_line_discount_value is null or v_line_discount_value < 0 then
        raise exception 'line_discount_fixed_negative';
      end if;
      if v_line_discount_value > v_line_subtotal then
        raise exception 'line_discount_exceeds_line_subtotal';
      end if;
      v_line_discount_amount := v_line_discount_value;
    else
      raise exception 'invalid_line_discount_type';
    end if;

    v_line_total := v_line_subtotal - v_line_discount_amount;
    v_items_subtotal := v_items_subtotal + v_line_total;
  end loop;

  -- ---- Apply sale-level discount (no auto-tier; only what was passed) ----
  if p_sale_discount_type = 'percent' then
    v_sale_discount_percent_snapshot := p_sale_discount_value;
    v_sale_discount_amount := round(v_items_subtotal * p_sale_discount_value / 100, 2);
  elsif p_sale_discount_type = 'fixed' then
    v_sale_discount_percent_snapshot := null;
    if p_sale_discount_value > v_items_subtotal then
      raise exception 'sale_discount_fixed_exceeds_items_subtotal';
    end if;
    v_sale_discount_amount := p_sale_discount_value;
  else
    v_sale_discount_percent_snapshot := null;
    v_sale_discount_amount := 0;
  end if;

  v_total := (v_items_subtotal - v_sale_discount_amount) + v_service;

  -- ---- Payment / customer guards (v1.6 logic) ----
  if p_amount_paid > v_total then raise exception 'amount_paid_exceeds_total'; end if;
  v_credit := v_total - p_amount_paid;
  v_payment_type := case
    when v_credit = 0 then 'cash'
    when p_amount_paid = 0 then 'credit'
    else 'partial'
  end;
  if v_credit > 0 and p_customer_id is null then
    raise exception 'customer_required_for_credit';
  end if;
  if p_customer_id is not null then
    if not exists (
      select 1 from public.customers where id = p_customer_id and shop_id = v_shop_id
    ) then raise exception 'customer_not_in_shop'; end if;
  end if;

  -- ---- Insert invoice ----
  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id,
    tier_id,                                -- v2.3: categorization snapshot only
    sale_discount_type, sale_discount_value,
    sale_discount_percent_snapshot, sale_discount_amount
  ) values (
    v_shop_id, p_customer_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id,
    v_customer_tier_id,
    p_sale_discount_type, p_sale_discount_value,
    v_sale_discount_percent_snapshot, v_sale_discount_amount
  ) returning id into v_invoice_id;

  -- ---- Pass 2: lock products, decrement stock, write sale_items ----
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    v_line_subtotal := v_qty * v_price;

    select id, stock, avg_cost into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
     for update;
    if not found then raise exception 'product_not_in_shop'; end if;
    if v_product.stock < v_qty then
      raise exception 'insufficient_stock for product %', v_product.id;
    end if;

    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    if v_item->>'line_discount_value' is null then
      v_line_discount_value := null;
    else
      v_line_discount_value := (v_item->>'line_discount_value')::numeric(12,2);
    end if;
    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    else
      v_line_discount_amount := v_line_discount_value;
    end if;

    insert into public.sale_items (
      invoice_id, product_id, qty, price_at_sale, cost_at_sale,
      line_discount_type, line_discount_value, line_discount_amount
    ) values (
      v_invoice_id, v_product.id, v_qty, v_price, v_product.avg_cost,
      v_line_discount_type, v_line_discount_value, v_line_discount_amount
    );

    update public.products set stock = stock - v_qty, updated_at = now()
     where id = v_product.id;
  end loop;

  -- ---- Ledger entry on credit/partial (v1.6 logic, post-discount total) ----
  if v_credit > 0 then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit');
  end if;

  return v_invoice_id;
end;
$function$;

-- ============================================================================
-- §C. search_products — name-only matching
--      Signature preserved (relevance, p_only_in_stock).
-- ============================================================================

create or replace function public.search_products(
  p_query text default null::text,
  p_limit integer default 50,
  p_offset integer default 0,
  p_only_in_stock boolean default false
) returns table (
  id uuid,
  name text,
  type text,
  description text,
  price numeric,
  avg_cost numeric,
  last_purchase_cost numeric,
  stock integer,
  is_active boolean,
  relevance real
)
language plpgsql stable security definer
set search_path to 'public', 'extensions', 'pg_catalog' as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
begin
  if v_shop_id is null then
    raise exception 'no_shop_for_user';
  end if;

  -- v2.3: search by NAME only. The type field is too generic (electronics,
  -- mobile, etc.) to be useful in fuzzy match. trim() handles whitespace.
  v_query := nullif(trim(coalesce(p_query, '')), '');

  perform set_limit(0.2);

  return query
  with base as (
    select p.*
      from public.products p
     where p.shop_id = v_shop_id
       and p.is_active = true
       and (not p_only_in_stock or p.stock > 0)
  ),
  scored as (
    select
      b.*,
      case
        when v_query is null then 0::real
        else greatest(
          case when b.name ilike v_query || '%' then 1.0::real else 0.0::real end,
          case when b.name ilike '%' || v_query || '%' then 0.8::real else 0.0::real end,
          similarity(b.name, v_query)
        )
      end as relevance
    from base b
  )
  select
    s.id, s.name, s.type, s.description,
    s.price::numeric(12,2), s.avg_cost::numeric(12,2),
    s.last_purchase_cost::numeric(12,2), s.stock, s.is_active, s.relevance
  from scored s
  where v_query is null or s.relevance > 0.2
  order by
    case when v_query is null then 0 else 1 end,
    s.relevance desc,
    s.name asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$function$;

-- ============================================================================
-- §D. search_products_count — name-only matching
-- ============================================================================

create or replace function public.search_products_count(
  p_query text default null::text,
  p_only_in_stock boolean default false
) returns bigint
language plpgsql stable security definer
set search_path to 'public', 'extensions', 'pg_catalog' as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
  v_count bigint;
begin
  if v_shop_id is null then
    raise exception 'no_shop_for_user';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  if v_query is null then
    select count(*) into v_count
      from public.products p
     where p.shop_id = v_shop_id
       and p.is_active = true
       and (not p_only_in_stock or p.stock > 0);
  else
    select count(*) into v_count
      from public.products p
     where p.shop_id = v_shop_id
       and p.is_active = true
       and (not p_only_in_stock or p.stock > 0)
       and (
         p.name ilike '%' || v_query || '%'
         or p.name % v_query
       );
  end if;

  return v_count;
end;
$function$;

-- ============================================================================
-- §E. invoice_with_discount_detail view — recreate with renamed columns
-- ============================================================================

drop view if exists public.invoice_with_discount_detail;
create view public.invoice_with_discount_detail
with (security_invoker = true) as
select
  i.*,
  t.name as tier_name,
  -- Pre-discount items subtotal: total = items_subtotal_post_line - sale_discount + service.
  -- Reverse: items_subtotal_post_line = total + sale_discount - service.
  (i.total + i.sale_discount_amount - i.service_charge)
    as items_subtotal_post_line_discounts,
  case
    when i.sale_discount_type = 'percent' then 'sale_discount_percent'
    when i.sale_discount_type = 'fixed'   then 'sale_discount_fixed'
    else                                       'no_discount'
  end as discount_source
from public.invoices i
left join public.customer_tiers t on t.id = i.tier_id;

-- ============================================================================
-- §F. Grants
-- ============================================================================

revoke execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) from public, anon;
grant  execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) to authenticated;

revoke execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric) from public, anon;
grant  execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric) to authenticated;

revoke execute on function public.search_products(text, integer, integer, boolean) from public, anon;
grant  execute on function public.search_products(text, integer, integer, boolean) to authenticated;

revoke execute on function public.search_products_count(text, boolean) from public, anon;
grant  execute on function public.search_products_count(text, boolean) to authenticated;
