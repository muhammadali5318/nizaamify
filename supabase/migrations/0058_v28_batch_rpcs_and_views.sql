-- v2.8 — Backend RPCs and views for batch tracking.
--
-- §A. suggest_batch_no helper
-- §B. record_purchase rewrite (batches created when product.has_batches)
-- §C. record_sale rewrite (FEFO + override + multi-batch line split)
-- §D. deactivate_batch (manual write-off)
-- §E. batches_expiring_soon + batches_warranty_expiring_soon views
--
-- invoice_financials view from v2.6c is not changed — it already reads
-- sale_items.cost_at_sale directly, and v2.8 ensures cost_at_sale is the
-- specific batch's cost_per_unit (not variant.avg_cost) for batched
-- products, so profit math is automatically accurate.

-- =====================================================================
-- §A. suggest_batch_no — pre-fill UX, user can override
-- =====================================================================
create or replace function public.suggest_batch_no(
  p_variant_id uuid,
  p_received_at date default current_date
) returns text
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_prefix text;
  v_product_prefix text;
  v_date_part text;
  v_sequence int;
begin
  select upper(regexp_replace(s.shop_name, '[^a-zA-Z0-9]', '', 'g'))
    into v_shop_prefix
    from public.shops s
    join public.products p on p.shop_id = s.id
    join public.product_variants v on v.product_id = p.id
   where v.id = p_variant_id;
  v_shop_prefix := substr(coalesce(v_shop_prefix, 'SHOP'), 1, 5);

  select upper(regexp_replace(p.name, '[^a-zA-Z0-9]', '', 'g'))
    into v_product_prefix
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where v.id = p_variant_id;
  v_product_prefix := substr(coalesce(v_product_prefix, 'PROD'), 1, 4);

  v_date_part := to_char(p_received_at, 'YYMMDD');

  select coalesce(max(
    (regexp_match(batch_no, '-(\d+)$'))[1]::int
  ), 0) + 1
    into v_sequence
    from public.inventory_batches
   where variant_id = p_variant_id
     and batch_no like v_shop_prefix || '-' || v_product_prefix || '-' || v_date_part || '-%';

  return v_shop_prefix || '-' || v_product_prefix || '-' || v_date_part || '-' || lpad(v_sequence::text, 3, '0');
end;
$$;

revoke all on function public.suggest_batch_no(uuid, date) from public, anon;
grant execute on function public.suggest_batch_no(uuid, date) to authenticated;

-- =====================================================================
-- §B. record_purchase rewrite — captures batch info when product.has_batches
-- =====================================================================
-- Extension over v2.6c version:
--   * If variant.product.has_batches = true, the item payload MUST carry a
--     `batch` object: { batch_no (required), manufactured_date?, expiry_date?,
--                       supplier_warranty_days? }
--   * Function inserts inventory_batches row with cost_per_unit = effective
--     landed cost (per-base-unit cost + overhead allocation per v2.3 LR math).
--   * purchase_items.batch_id is wired to the new batch.

create or replace function public.record_purchase(
  p_supplier_id uuid default null,
  p_purchase_date date default current_date,
  p_note text default null,
  p_items jsonb default '[]'::jsonb,
  p_overhead_items jsonb default '[]'::jsonb,
  p_is_opening boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_overhead_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_overhead jsonb;
  v_variant record;
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
  v_shares numeric(12,2)[];
  v_resolved_variant_id uuid;
  v_purchase_item_id uuid;
  v_batch jsonb;
  v_batch_id uuid;
  v_batch_no text;
  v_warranty_days int;
  v_warranty_expires date;
  v_expiry_date date;
  v_mfg_date date;
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

  -- Subtotal pass (unchanged)
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

  -- Overhead pass (unchanged)
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

  -- v2.3 largest-remainder overhead allocation (unchanged)
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
      select idx, line_value,
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

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);

    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_resolved_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select id into v_resolved_variant_id
        from public.product_variants
       where product_id = (v_item->>'product_id')::uuid
         and is_default and is_active;
      if v_resolved_variant_id is null then
        raise exception 'product_has_no_default_variant' using errcode = 'P0001';
      end if;
    else
      raise exception 'item_missing_variant_or_product_id' using errcode = 'P0001';
    end if;

    -- v2.8: pull has_batches in addition to existing fields
    select v.id, v.product_id, v.stock, v.avg_cost, p.shop_id, p.has_batches
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_resolved_variant_id and v.is_active
     for update;

    if not found then raise exception 'variant_not_found_or_inactive' using errcode = 'P0001'; end if;
    if v_variant.shop_id <> v_shop_id then raise exception 'variant_not_in_shop' using errcode = 'P0001'; end if;

    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_id := (v_item->>'pack_id')::uuid;
      v_pack_qty := (v_item->>'pack_qty')::int;
      select id, base_qty into v_pack
        from public.product_packs
       where id = v_pack_id and variant_id = v_variant.id and is_active;
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
    v_overhead_per_base_unit := case when v_qty_in_base > 0
      then round(v_line_overhead / v_qty_in_base, 2)
      else 0
    end;
    v_effective_per_base_cost := round(
      v_per_base_unit_cost + (v_line_overhead / nullif(v_qty_in_base, 0)::numeric),
      2
    );

    insert into public.purchase_items (
      purchase_id, variant_id, qty, qty_in_base,
      cost_at_purchase,
      line_overhead_amount, overhead_per_unit,
      pack_id, pack_qty, pack_base_qty_snapshot,
      avg_cost_before, avg_cost_after
    ) values (
      v_purchase_id, v_variant.id, v_qty_in_base, v_qty_in_base,
      v_cost,
      v_line_overhead, v_overhead_per_base_unit,
      v_pack_id, v_pack_qty, v_pack_base_qty_snapshot,
      v_variant.avg_cost,
      case
        when v_variant.stock + v_qty_in_base = 0 then v_variant.avg_cost
        when v_variant.stock <= 0                then v_effective_per_base_cost
        else round(
          (v_variant.stock * v_variant.avg_cost + v_qty_in_base * v_effective_per_base_cost)
          / (v_variant.stock + v_qty_in_base), 2
        )
      end
    ) returning id into v_purchase_item_id;

    -- v2.8: if the product is batched, create the inventory_batches row.
    if v_variant.has_batches then
      v_batch := v_item -> 'batch';
      if v_batch is null or jsonb_typeof(v_batch) <> 'object' then
        raise exception 'batch_info_required_for_batched_product' using errcode = 'P0001';
      end if;

      v_batch_no := nullif(trim(coalesce(v_batch->>'batch_no', '')), '');
      if v_batch_no is null then
        raise exception 'batch_no_required' using errcode = 'P0001';
      end if;

      v_mfg_date := nullif(v_batch->>'manufactured_date', '')::date;
      v_expiry_date := nullif(v_batch->>'expiry_date', '')::date;
      v_warranty_days := nullif(v_batch->>'supplier_warranty_days', '')::int;

      if v_warranty_days is not null and v_warranty_days > 0 then
        v_warranty_expires := coalesce(p_purchase_date, current_date) + v_warranty_days;
      else
        v_warranty_expires := null;
      end if;

      begin
        insert into public.inventory_batches (
          variant_id, batch_no, purchase_item_id, supplier_id,
          qty_received, qty_remaining, cost_per_unit,
          manufactured_date, expiry_date,
          supplier_warranty_days, warranty_expires_at,
          received_at
        ) values (
          v_variant.id, v_batch_no, v_purchase_item_id, p_supplier_id,
          v_qty_in_base, v_qty_in_base, v_effective_per_base_cost,
          v_mfg_date, v_expiry_date,
          v_warranty_days, v_warranty_expires,
          coalesce(p_purchase_date, current_date)
        ) returning id into v_batch_id;
      exception
        when unique_violation then
          raise exception 'duplicate_batch_no' using errcode = 'P0001';
      end;

      update public.purchase_items set batch_id = v_batch_id where id = v_purchase_item_id;
    end if;

    update public.product_variants
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
     where id = v_variant.id;
  end loop;

  return v_purchase_id;
end;
$$;

revoke all on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) to authenticated;

-- =====================================================================
-- §C. record_sale rewrite — FEFO + override + multi-batch line split
-- =====================================================================
-- Non-batched products are unchanged from v2.6c.
-- Batched products:
--   * If item carries batch_id (manual override) — single row, that batch.
--     Validate ownership + active + qty_remaining >= qty.
--   * Else FEFO — walk active batches ordered by (expiry asc nulls last,
--     received_at asc, id asc) allocating qty until cart qty satisfied.
--     Emits multiple sale_items rows for a single cart line if needed.
--   * cost_at_sale on each row is the BATCH's cost_per_unit (not avg_cost).
--   * line_discount_amount is split across rows via largest-remainder by qty
--     so sum matches the original line discount exactly.

create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null,
  p_sale_discount_value numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $$
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
  v_variant record;
  v_resolved_variant_id uuid;
  v_override_batch_id uuid;
  v_batch record;
  v_remaining_qty int;
  v_chunk_qty int;
  v_chunk_idx int;
  v_chunk_count int;
  v_qty_arr int[];
  v_batch_id_arr uuid[];
  v_cost_arr numeric(12,2)[];
  v_discount_alloc numeric(12,2)[];
  v_alloc_sum numeric(12,2);
  v_max_qty_idx int;
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

  if p_customer_id is not null then
    select tier_id into v_customer_tier_id
      from public.customers
     where id = p_customer_id and shop_id = v_shop_id;
  end if;

  -- Subtotal validation pass (unchanged)
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
      if v_line_discount_value is null or v_line_discount_value < 0 or v_line_discount_value > 100 then
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

  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id,
    tier_id,
    sale_discount_type, sale_discount_value,
    sale_discount_percent_snapshot, sale_discount_amount
  ) values (
    v_shop_id, p_customer_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id,
    v_customer_tier_id,
    p_sale_discount_type, p_sale_discount_value,
    v_sale_discount_percent_snapshot, v_sale_discount_amount
  ) returning id into v_invoice_id;

  -- Insertion pass — per cart line
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    v_line_subtotal := v_qty * v_price;

    -- Resolve variant_id (existing logic)
    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_resolved_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select id into v_resolved_variant_id
        from public.product_variants
       where product_id = (v_item->>'product_id')::uuid
         and is_default and is_active;
      if v_resolved_variant_id is null then
        raise exception 'product_has_no_default_variant';
      end if;
    else
      raise exception 'item_missing_variant_or_product_id';
    end if;

    select v.id, v.stock, v.avg_cost, v.price as variant_price, p.shop_id, p.id as product_id, p.has_batches
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_resolved_variant_id and v.is_active
     for update;

    if not found then raise exception 'variant_not_found_or_inactive'; end if;
    if v_variant.shop_id <> v_shop_id then raise exception 'variant_not_in_shop'; end if;
    if v_variant.variant_price is null then raise exception 'variant_not_sellable'; end if;
    if v_variant.stock < v_qty then
      raise exception 'insufficient_stock for variant %', v_variant.id;
    end if;

    -- Re-compute line discount for this row
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

    if not v_variant.has_batches then
      -- ─── Non-batched: unchanged from v2.6c ────────────────────────
      insert into public.sale_items (
        invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
        line_discount_type, line_discount_value, line_discount_amount,
        batch_id
      ) values (
        v_invoice_id, v_variant.id, v_qty, v_price, v_variant.avg_cost,
        v_line_discount_type, v_line_discount_value, v_line_discount_amount,
        null
      );
    else
      -- ─── Batched: FEFO or override ────────────────────────────────
      v_override_batch_id := nullif(v_item->>'batch_id', '')::uuid;

      v_qty_arr := array[]::int[];
      v_batch_id_arr := array[]::uuid[];
      v_cost_arr := array[]::numeric(12,2)[];

      if v_override_batch_id is not null then
        -- Override path: validate batch ownership + qty
        select b.id, b.qty_remaining, b.cost_per_unit
          into v_batch
          from public.inventory_batches b
         where b.id = v_override_batch_id
           and b.variant_id = v_variant.id
           and b.is_active
           for update;
        if not found then raise exception 'batch_not_in_variant_or_inactive'; end if;
        if v_batch.qty_remaining < v_qty then
          raise exception 'selected_batch_insufficient';
        end if;
        v_qty_arr := array[v_qty];
        v_batch_id_arr := array[v_batch.id];
        v_cost_arr := array[v_batch.cost_per_unit];
      else
        -- FEFO walk
        v_remaining_qty := v_qty;
        for v_batch in
          select id, qty_remaining, cost_per_unit
            from public.inventory_batches
           where variant_id = v_variant.id
             and is_active and qty_remaining > 0
           order by expiry_date nulls last, received_at asc, id asc
           for update
        loop
          exit when v_remaining_qty <= 0;
          v_chunk_qty := least(v_batch.qty_remaining, v_remaining_qty);
          v_qty_arr := v_qty_arr || v_chunk_qty;
          v_batch_id_arr := v_batch_id_arr || v_batch.id;
          v_cost_arr := v_cost_arr || v_batch.cost_per_unit;
          v_remaining_qty := v_remaining_qty - v_chunk_qty;
        end loop;
        if v_remaining_qty > 0 then
          -- Stock check passed but no batches cover it — audit invariant breach.
          raise exception 'no_batch_stock_available for variant %', v_variant.id;
        end if;
      end if;

      -- Allocate line_discount_amount across chunks via largest-remainder
      v_chunk_count := array_length(v_qty_arr, 1);
      v_discount_alloc := array[]::numeric(12,2)[];
      v_alloc_sum := 0;
      v_max_qty_idx := 1;
      for v_chunk_idx in 1..v_chunk_count loop
        v_discount_alloc := v_discount_alloc || round(
          v_line_discount_amount * v_qty_arr[v_chunk_idx] / v_qty, 2
        );
        v_alloc_sum := v_alloc_sum + v_discount_alloc[v_chunk_idx];
        if v_qty_arr[v_chunk_idx] > v_qty_arr[v_max_qty_idx] then
          v_max_qty_idx := v_chunk_idx;
        end if;
      end loop;
      -- Apply leftover penny to the largest-qty chunk
      if v_alloc_sum <> v_line_discount_amount then
        v_discount_alloc[v_max_qty_idx] :=
          v_discount_alloc[v_max_qty_idx] + (v_line_discount_amount - v_alloc_sum);
      end if;

      -- Emit one sale_items row per chunk, decrement the batch.
      for v_chunk_idx in 1..v_chunk_count loop
        insert into public.sale_items (
          invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
          line_discount_type, line_discount_value, line_discount_amount,
          batch_id
        ) values (
          v_invoice_id, v_variant.id, v_qty_arr[v_chunk_idx], v_price,
          v_cost_arr[v_chunk_idx],
          v_line_discount_type, v_line_discount_value,
          v_discount_alloc[v_chunk_idx],
          v_batch_id_arr[v_chunk_idx]
        );
        update public.inventory_batches
           set qty_remaining = qty_remaining - v_qty_arr[v_chunk_idx],
               updated_at = now()
         where id = v_batch_id_arr[v_chunk_idx];
      end loop;
    end if;

    -- Always decrement variant.stock by the full qty (unchanged from v2.6).
    update public.product_variants set stock = stock - v_qty, updated_at = now()
     where id = v_variant.id;
  end loop;

  if v_credit > 0 then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit');
  end if;

  return v_invoice_id;
end;
$$;

revoke all on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric) from public, anon;
grant execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric) to authenticated;

-- =====================================================================
-- §D. deactivate_batch — manual write-off
-- =====================================================================
create or replace function public.deactivate_batch(
  p_batch_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_qty_remaining int;
  v_variant_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select b.qty_remaining, b.variant_id
    into v_qty_remaining, v_variant_id
    from public.inventory_batches b
    join public.product_variants v on v.id = b.variant_id
    join public.products p on p.id = v.product_id
   where b.id = p_batch_id and p.shop_id = v_shop_id;

  if not found then raise exception 'batch_not_in_shop'; end if;

  if v_qty_remaining > 0 then
    -- Decrement variant.stock by the qty we're writing off.
    -- v2.10 will replace this with an inventory_adjustments ledger entry.
    update public.product_variants
       set stock = stock - v_qty_remaining, updated_at = now()
     where id = v_variant_id;
  end if;

  update public.inventory_batches
     set is_active = false,
         qty_remaining = 0,
         notes = case
           when p_reason is null then notes
           when notes is null    then 'Deactivated: ' || p_reason
           else notes || E'\n' || 'Deactivated: ' || p_reason
         end
   where id = p_batch_id;
end;
$$;

revoke all on function public.deactivate_batch(uuid, text) from public, anon;
grant execute on function public.deactivate_batch(uuid, text) to authenticated;

-- =====================================================================
-- §E. Alert views
-- =====================================================================
drop view if exists public.batches_expiring_soon cascade;
create view public.batches_expiring_soon
with (security_invoker = true) as
select
  b.id as batch_id,
  b.batch_no,
  b.qty_remaining,
  b.expiry_date,
  (b.expiry_date - current_date) as days_until_expiry,
  v.id as variant_id,
  p.id as product_id,
  p.name as product_name,
  p.shop_id,
  coalesce(p.expiry_alert_days, s.default_expiry_alert_days) as alert_window_days
from public.inventory_batches b
join public.product_variants v on v.id = b.variant_id
join public.products p on p.id = v.product_id
join public.shops s on s.id = p.shop_id
where b.is_active
  and b.qty_remaining > 0
  and b.expiry_date is not null
  and b.expiry_date - current_date <= coalesce(p.expiry_alert_days, s.default_expiry_alert_days);

drop view if exists public.batches_warranty_expiring_soon cascade;
create view public.batches_warranty_expiring_soon
with (security_invoker = true) as
select
  b.id as batch_id,
  b.batch_no,
  b.qty_remaining,
  b.warranty_expires_at,
  (b.warranty_expires_at - current_date) as days_until_warranty_expires,
  b.supplier_id,
  sup.name as supplier_name,
  v.id as variant_id,
  p.id as product_id,
  p.name as product_name,
  p.shop_id,
  coalesce(p.warranty_alert_days, sh.default_warranty_alert_days) as alert_window_days
from public.inventory_batches b
join public.product_variants v on v.id = b.variant_id
join public.products p on p.id = v.product_id
join public.shops sh on sh.id = p.shop_id
left join public.suppliers sup on sup.id = b.supplier_id
where b.is_active
  and b.qty_remaining > 0
  and b.warranty_expires_at is not null
  and b.warranty_expires_at - current_date <= coalesce(p.warranty_alert_days, sh.default_warranty_alert_days)
  and b.warranty_expires_at >= current_date;
