-- 0027_v20a_uom_rpcs.sql
-- v2.0 Phase C: pack management RPCs + record_sale / record_purchase rewrites
--   §A assert_product_sellable (internal helper, not RPC-exposed)
--   §B define_pack / update_pack / deactivate_pack
--   §C record_sale rewrite with pack support and pricing-rule enforcement
--   §D record_purchase rewrite (preserves v1.9 supplier + landed-cost flow)
--   §E create_product_with_opening_stock — call assert_product_sellable
--   §F product_stock_display view (security_invoker = true per ADR-0015)
--   §G grant pattern: revoke from public,anon; grant to authenticated
--
-- Notes:
--   The single most important rule (spec §5.3): stock decrements by qty_in_base.
--   Never by qty, never by pack_qty. sale_items.qty stores qty_in_base — this
--   matches pre-v2.0 semantics where qty was already the base-unit count.
--
--   update_pack treats null parameters as "unchanged" (matches spec §5.2).
--   To clear a pack price (move from sellable to stock-in only), deactivate
--   and redefine — captured as a future enhancement.

-- ============================================================================
-- §A. assert_product_sellable — cross-table invariant helper
-- ============================================================================

create or replace function public.assert_product_sellable(p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count
  from (
    select 1 from public.products
      where id = p_product_id and price is not null
    union all
    select 1 from public.product_packs
      where product_id = p_product_id and price is not null and is_active
  ) s;
  if v_count = 0 then
    raise exception 'product_must_have_at_least_one_priced_unit'
      using hint = 'Set a base price or a pack price';
  end if;
end;
$$;

revoke execute on function public.assert_product_sellable(uuid) from public, anon, authenticated;

-- ============================================================================
-- §B. Pack management RPCs
-- ============================================================================

create or replace function public.define_pack(
  p_product_id uuid,
  p_unit_id uuid,
  p_base_qty integer,
  p_price numeric default null,
  p_default_purchase boolean default false,
  p_default_sale boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_pack_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_base_qty is null or p_base_qty <= 1 then
    raise exception 'base_qty_invalid' using hint = 'Pack must contain at least 2 base units';
  end if;
  if p_price is not null and p_price < 0 then
    raise exception 'price_negative';
  end if;
  if p_default_sale and p_price is null then
    raise exception 'default_sale_needs_price';
  end if;

  if not exists (
    select 1 from public.products
     where id = p_product_id and shop_id = v_shop_id
  ) then
    raise exception 'product_not_in_shop';
  end if;

  if not exists (
    select 1 from public.units_of_measure
     where id = p_unit_id and shop_id = v_shop_id and is_active
  ) then
    raise exception 'unit_not_in_shop';
  end if;

  insert into public.product_packs (
    product_id, unit_id, base_qty, price, is_default_purchase, is_default_sale
  ) values (
    p_product_id, p_unit_id, p_base_qty, p_price,
    coalesce(p_default_purchase, false), coalesce(p_default_sale, false)
  ) returning id into v_pack_id;

  perform public.assert_product_sellable(p_product_id);
  return v_pack_id;
end;
$$;

create or replace function public.update_pack(
  p_pack_id uuid,
  p_price numeric default null,
  p_default_purchase boolean default null,
  p_default_sale boolean default null,
  p_is_active boolean default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_pack record;
  v_new_price numeric;
  v_new_default_sale boolean;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select pp.id, pp.product_id, pp.price, pp.is_default_sale, pp.is_active
    into v_pack
    from public.product_packs pp
    join public.products p on p.id = pp.product_id
   where pp.id = p_pack_id and p.shop_id = v_shop_id
   for update;
  if not found then raise exception 'pack_not_found_or_not_in_shop'; end if;

  if p_price is not null and p_price < 0 then
    raise exception 'price_negative';
  end if;

  v_new_price        := coalesce(p_price, v_pack.price);
  v_new_default_sale := coalesce(p_default_sale, v_pack.is_default_sale);

  if v_new_default_sale and v_new_price is null then
    raise exception 'default_sale_needs_price';
  end if;

  update public.product_packs
     set price               = coalesce(p_price, price),
         is_default_purchase = coalesce(p_default_purchase, is_default_purchase),
         is_default_sale     = coalesce(p_default_sale, is_default_sale),
         is_active           = coalesce(p_is_active, is_active),
         updated_at          = now()
   where id = p_pack_id;

  perform public.assert_product_sellable(v_pack.product_id);
end;
$$;

create or replace function public.deactivate_pack(p_pack_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_product_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select pp.product_id into v_product_id
    from public.product_packs pp
    join public.products p on p.id = pp.product_id
   where pp.id = p_pack_id and p.shop_id = v_shop_id;
  if v_product_id is null then raise exception 'pack_not_found_or_not_in_shop'; end if;

  update public.product_packs
     set is_active = false,
         is_default_purchase = false,
         is_default_sale = false,
         updated_at = now()
   where id = p_pack_id;

  perform public.assert_product_sellable(v_product_id);
end;
$$;

-- ============================================================================
-- §C. record_sale rewrite — pack-aware, pricing-rule enforced
-- ============================================================================

create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
  v_invoice_id uuid;
  v_total numeric(12,2) := 0;
  v_credit numeric(12,2);
  v_payment_type text;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12,2);
  v_service numeric(12,2);
  v_pack_id uuid;
  v_pack_qty integer;
  v_pack record;
  v_product record;
  v_qty_in_base integer;
  v_pack_base_qty_snapshot integer;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  v_shop_id := public.current_shop_id();
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  v_service := coalesce(p_service_charge, 0);

  if p_amount_paid is null or p_amount_paid < 0 then
    raise exception 'amount_paid_negative';
  end if;
  if v_service < 0 then raise exception 'service_charge_negative'; end if;

  if jsonb_typeof(p_items) is null then
    p_items := '[]'::jsonb;
  end if;

  if jsonb_array_length(p_items) = 0 and v_service = 0 then
    raise exception 'empty_sale: a sale must have items or a service charge';
  end if;

  -- First pass: validate, compute total. price_at_sale is per chosen unit
  -- (per pack when pack_id is set, per base unit otherwise).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    if v_price is null or v_price < 0 then raise exception 'price must be non-negative'; end if;

    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_qty := (v_item->>'pack_qty')::integer;
      if v_pack_qty is null or v_pack_qty <= 0 then raise exception 'pack_qty must be positive'; end if;
      v_total := v_total + (v_pack_qty * v_price);
    else
      v_qty := (v_item->>'qty')::integer;
      if v_qty is null or v_qty <= 0 then raise exception 'qty must be positive'; end if;
      v_total := v_total + (v_qty * v_price);
    end if;
  end loop;
  v_total := v_total + v_service;

  if p_amount_paid > v_total then
    raise exception 'amount_paid_exceeds_total';
  end if;

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
      select 1 from public.customers
       where id = p_customer_id and shop_id = v_shop_id
    ) then
      raise exception 'customer_not_in_shop';
    end if;
  end if;

  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id
  ) values (
    v_shop_id, p_customer_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id
  ) returning id into v_invoice_id;

  -- Second pass: lock product, resolve pack, enforce pricing rule, snapshot,
  -- decrement stock by qty_in_base (NEVER by qty or pack_qty).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);

    select id, stock, avg_cost, price into v_product
      from public.products
     where id = v_product_id and shop_id = v_shop_id
     for update;
    if not found then raise exception 'product_not_in_shop'; end if;

    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_id := (v_item->>'pack_id')::uuid;
      v_pack_qty := (v_item->>'pack_qty')::integer;

      select id, base_qty, price into v_pack
        from public.product_packs
       where id = v_pack_id and product_id = v_product.id and is_active;
      if not found then raise exception 'pack_not_found_or_inactive'; end if;

      if v_pack.price is null then
        raise exception 'pack_not_sellable: this pack has no sell price set';
      end if;

      v_pack_base_qty_snapshot := v_pack.base_qty;
      v_qty_in_base := v_pack_qty * v_pack_base_qty_snapshot;
    else
      if v_product.price is null then
        raise exception 'base_unit_not_sellable: this product has no base price set';
      end if;
      v_pack_id := null;
      v_pack_qty := null;
      v_pack_base_qty_snapshot := null;
      v_qty_in_base := (v_item->>'qty')::integer;
    end if;

    if v_product.stock < v_qty_in_base then
      raise exception 'insufficient_stock for product %', v_product.id;
    end if;

    insert into public.sale_items (
      invoice_id, product_id, qty, price_at_sale, cost_at_sale,
      pack_id, pack_qty, pack_base_qty_snapshot, qty_in_base
    ) values (
      v_invoice_id, v_product.id, v_qty_in_base, v_price, v_product.avg_cost,
      v_pack_id, v_pack_qty, v_pack_base_qty_snapshot, v_qty_in_base
    );

    update public.products
       set stock = stock - v_qty_in_base, updated_at = now()
     where id = v_product.id;
  end loop;

  if v_credit > 0 then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit');
  end if;

  return v_invoice_id;
end;
$function$;

-- ============================================================================
-- §D. record_purchase rewrite — pack-aware, preserves v1.9 supplier + landed cost
-- ============================================================================

create or replace function public.record_purchase(
  p_supplier_id uuid default null,
  p_purchase_date date default current_date,
  p_note text default null,
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
  v_qty int;
  v_pack_qty int;
  v_pack_id uuid;
  v_pack_base_qty_snapshot int;
  v_qty_in_base int;
  v_cost numeric(12,2);
  v_line_value numeric(12,2);
  v_per_base_unit_cost numeric(12,2);
  v_overhead_share numeric(12,2);
  v_overhead_per_base_unit numeric(12,2);
  v_effective_per_base_cost numeric(12,2);
  v_supplier_name text;
  v_source text;
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
    if not found then
      raise exception 'supplier_not_in_shop' using errcode = 'P0001';
    end if;
  end if;

  -- First pass: validate, compute items_subtotal as sum of line values
  -- (line value is in supplier-quoted units — pack_qty * cost or qty * cost).
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

  v_source := case
    when p_is_opening then 'Opening Stock'
    when p_supplier_id is not null then v_supplier_name
    else 'Direct purchase'
  end;

  insert into public.purchases (
    shop_id, supplier_id, total_cost, items_subtotal, overhead_subtotal,
    source, note, purchase_date, cashier_id, is_opening
  ) values (
    v_shop_id,
    p_supplier_id,
    v_items_subtotal + v_overhead_subtotal,
    v_items_subtotal,
    v_overhead_subtotal,
    v_source,
    nullif(trim(coalesce(p_note,'')),''),
    coalesce(p_purchase_date, current_date),
    v_user_id,
    coalesce(p_is_opening, false)
  ) returning id into v_purchase_id;

  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      insert into public.purchase_overhead_items (purchase_id, category, amount, description)
      values (
        v_purchase_id,
        v_overhead->>'category',
        (v_overhead->>'amount')::numeric(12,2),
        nullif(trim(coalesce(v_overhead->>'description','')),'')
      );
    end loop;
  end if;

  -- Second pass: lock product, resolve pack, compute landed per-base-unit cost,
  -- insert items, update WAC.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);

    select id, stock, avg_cost into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
     for update;
    if not found then
      raise exception 'product_not_in_shop' using errcode = 'P0001';
    end if;

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

    -- Per-base-unit cost is the figure that drives WAC.
    v_per_base_unit_cost := round(v_line_value / v_qty_in_base, 2);

    -- v1.9 overhead allocation, expressed per base unit.
    if v_items_subtotal > 0 then
      v_overhead_share := round(v_overhead_subtotal * v_line_value / v_items_subtotal, 2);
    else
      v_overhead_share := 0;
    end if;
    v_overhead_per_base_unit := case when v_qty_in_base > 0
      then round(v_overhead_share / v_qty_in_base, 2)
      else 0
    end;
    v_effective_per_base_cost := v_per_base_unit_cost + v_overhead_per_base_unit;

    insert into public.purchase_items (
      purchase_id, product_id, qty, qty_in_base,
      cost_at_purchase, overhead_per_unit,
      pack_id, pack_qty, pack_base_qty_snapshot,
      avg_cost_before, avg_cost_after
    ) values (
      v_purchase_id, v_product.id, v_qty_in_base, v_qty_in_base,
      v_cost, v_overhead_per_base_unit,
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
-- §E. create_product_with_opening_stock — call assert_product_sellable
-- ============================================================================

create or replace function public.create_product_with_opening_stock(
  p_name text,
  p_type text,
  p_description text default null::text,
  p_price numeric default 0,
  p_opening_stock integer default 0,
  p_opening_cost numeric default 0
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_purchase_id uuid;
  v_base_unit_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_price < 0 then raise exception 'price_negative'; end if;
  if p_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
  if p_opening_cost < 0 then raise exception 'opening_cost_negative'; end if;

  select id into v_base_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id and code = 'each' and is_active = true;
  if v_base_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, 'each', 'Each')
    returning id into v_base_unit_id;
  end if;

  insert into public.products (shop_id, name, type, description, price, stock, avg_cost, cost, base_unit_id)
  values (v_shop_id, p_name, p_type, p_description, p_price, 0, 0, 0, v_base_unit_id)
  returning id into v_product_id;

  if p_opening_stock > 0 then
    insert into public.purchases (shop_id, total_cost, source, note, purchase_date, cashier_id, is_opening)
    values (v_shop_id, p_opening_stock * p_opening_cost, 'Opening Stock', 'Initial inventory', current_date, v_user_id, true)
    returning id into v_purchase_id;

    insert into public.purchase_items (purchase_id, product_id, qty, cost_at_purchase, qty_in_base)
    values (v_purchase_id, v_product_id, p_opening_stock, p_opening_cost, p_opening_stock);

    update public.products
       set stock = p_opening_stock,
           avg_cost = p_opening_cost,
           last_purchase_cost = p_opening_cost,
           cost = p_opening_cost,
           updated_at = now()
     where id = v_product_id;
  end if;

  perform public.assert_product_sellable(v_product_id);
  return v_product_id;
end;
$function$;

-- ============================================================================
-- §F. product_stock_display view — compound stock rendering helper
-- ============================================================================

drop view if exists public.product_stock_display;
create view public.product_stock_display
with (security_invoker = true) as
select
  p.id              as product_id,
  p.shop_id         as shop_id,
  p.stock           as base_qty,
  bu.code           as base_unit_code,
  bu.name           as base_unit_name,
  p.price           as base_price,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'pack_id',         pk.id,
      'unit_code',       u.code,
      'unit_name',       u.name,
      'base_qty',        pk.base_qty,
      'price',           pk.price,
      'whole_packs',     floor(p.stock::numeric / pk.base_qty)::int,
      'remainder_base',  (p.stock % pk.base_qty)::int,
      'is_sellable',     (pk.price is not null),
      'is_default_sale', pk.is_default_sale,
      'is_default_purchase', pk.is_default_purchase
    ) order by pk.base_qty desc), '[]'::jsonb)
    from public.product_packs pk
    join public.units_of_measure u on u.id = pk.unit_id
    where pk.product_id = p.id and pk.is_active
  ) as pack_breakdown
from public.products p
join public.units_of_measure bu on bu.id = p.base_unit_id;

-- ============================================================================
-- §G. Grants — revoke from public,anon; grant to authenticated
-- ============================================================================

revoke execute on function public.define_pack(uuid,uuid,integer,numeric,boolean,boolean)     from public, anon;
revoke execute on function public.update_pack(uuid,numeric,boolean,boolean,boolean)          from public, anon;
revoke execute on function public.deactivate_pack(uuid)                                      from public, anon;
revoke execute on function public.record_sale(uuid,numeric,numeric,text,jsonb)               from public, anon;
revoke execute on function public.record_purchase(uuid,date,text,jsonb,jsonb,boolean)        from public, anon;
revoke execute on function public.create_product_with_opening_stock(text,text,text,numeric,integer,numeric) from public, anon;

grant execute on function public.define_pack(uuid,uuid,integer,numeric,boolean,boolean)      to authenticated;
grant execute on function public.update_pack(uuid,numeric,boolean,boolean,boolean)           to authenticated;
grant execute on function public.deactivate_pack(uuid)                                       to authenticated;
grant execute on function public.record_sale(uuid,numeric,numeric,text,jsonb)                to authenticated;
grant execute on function public.record_purchase(uuid,date,text,jsonb,jsonb,boolean)         to authenticated;
grant execute on function public.create_product_with_opening_stock(text,text,text,numeric,integer,numeric)  to authenticated;
