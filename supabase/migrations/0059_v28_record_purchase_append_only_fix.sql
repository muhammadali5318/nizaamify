-- v2.8.1 — record_purchase append-only fix.
--
-- The v2.8 record_purchase rewrite (migration 0058) inserted purchase_items
-- first then UPDATE'd purchase_items.batch_id with the new batch's id.
-- That UPDATE trips the v1.8 `purchase_items_no_modify` append-only trigger
-- ("purchase_items are append-only — record a corrective entry instead").
--
-- Fix: reorder. INSERT inventory_batches first WITHOUT purchase_item_id;
-- INSERT purchase_items WITH batch_id already set; finally UPDATE
-- inventory_batches.purchase_item_id to point back.
--
-- Side effect: the batch_immutable_fields trigger needs to permit a
-- one-time NULL → non-null transition on purchase_item_id (the back-fill
-- step). Block any later re-pointing. Once the back-reference exists it
-- can't be rewritten — auditability preserved.

-- §A. Relax batch immutability for the purchase_item_id back-reference
create or replace function public.batch_immutable_fields() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if old.id is distinct from new.id then raise exception 'batch_id_immutable'; end if;
  if old.variant_id is distinct from new.variant_id then raise exception 'batch_variant_immutable'; end if;
  if lower(trim(old.batch_no)) is distinct from lower(trim(new.batch_no))
    then raise exception 'batch_no_immutable'; end if;
  if old.qty_received is distinct from new.qty_received then raise exception 'batch_qty_received_immutable'; end if;
  if old.cost_per_unit is distinct from new.cost_per_unit then raise exception 'batch_cost_immutable'; end if;
  if old.manufactured_date is distinct from new.manufactured_date then raise exception 'batch_mfg_date_immutable'; end if;
  if old.expiry_date is distinct from new.expiry_date then raise exception 'batch_expiry_immutable'; end if;
  if old.supplier_warranty_days is distinct from new.supplier_warranty_days then raise exception 'batch_warranty_days_immutable'; end if;
  if old.warranty_expires_at is distinct from new.warranty_expires_at then raise exception 'batch_warranty_date_immutable'; end if;
  if old.received_at is distinct from new.received_at then raise exception 'batch_received_at_immutable'; end if;
  -- v2.8.1: allow NULL → non-null one-time set; block re-pointing.
  if old.purchase_item_id is not null
     and new.purchase_item_id is distinct from old.purchase_item_id then
    raise exception 'batch_purchase_item_immutable';
  end if;
  if old.supplier_id is distinct from new.supplier_id then raise exception 'batch_supplier_immutable'; end if;
  return new;
end;
$$;

-- §B. record_purchase rewrite — sets purchase_items.batch_id at INSERT time
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

    -- v2.8.1: insert batch FIRST (without purchase_item_id), so the
    -- batch_id is known when purchase_items is inserted. Avoids the
    -- post-insert UPDATE that would hit the v1.8 append-only trigger.
    v_batch_id := null;
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
          variant_id, batch_no, supplier_id,
          qty_received, qty_remaining, cost_per_unit,
          manufactured_date, expiry_date,
          supplier_warranty_days, warranty_expires_at,
          received_at
        ) values (
          v_variant.id, v_batch_no, p_supplier_id,
          v_qty_in_base, v_qty_in_base, v_effective_per_base_cost,
          v_mfg_date, v_expiry_date,
          v_warranty_days, v_warranty_expires,
          coalesce(p_purchase_date, current_date)
        ) returning id into v_batch_id;
      exception
        when unique_violation then
          raise exception 'duplicate_batch_no' using errcode = 'P0001';
      end;
    end if;

    insert into public.purchase_items (
      purchase_id, variant_id, qty, qty_in_base,
      cost_at_purchase,
      line_overhead_amount, overhead_per_unit,
      pack_id, pack_qty, pack_base_qty_snapshot,
      avg_cost_before, avg_cost_after,
      batch_id
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
      end,
      v_batch_id
    ) returning id into v_purchase_item_id;

    -- v2.8.1: set the back-reference on the batch (NULL → non-null,
    -- permitted exactly once by the updated immutability trigger).
    if v_batch_id is not null then
      update public.inventory_batches
         set purchase_item_id = v_purchase_item_id
       where id = v_batch_id;
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
