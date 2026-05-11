-- v2.6 §C2 — record_purchase + create_product_with_opening_stock rewrites.
--
-- record_purchase: same signature (DROP not needed). Per-item resolution
-- now accepts variant_id (preferred) or product_id (legacy → default variant).
-- Stock/avg_cost are read from product_variants; pack lookups by variant_id.
-- v2.3 largest-remainder overhead allocation is byte-equivalent in math.
-- The legacy products.{stock, avg_cost, last_purchase_cost, cost} columns are
-- NOT touched anymore — variants are the source of truth.
--
-- create_product_with_opening_stock: signature changes (params reorder, return
-- type changes), so DROP + CREATE. Always creates a product + default variant
-- in one tx; opening stock (when supplied) goes through record_purchase against
-- the new variant.

-- ===========================================================================
-- record_purchase — variant-aware
-- ===========================================================================

create or replace function public.record_purchase(
  p_supplier_id uuid default null::uuid,
  p_purchase_date date default current_date,
  p_note text default null::text,
  p_items jsonb default '[]'::jsonb,
  p_overhead_items jsonb default '[]'::jsonb,
  p_is_opening boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $function$
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

  -- ---- Pass 1: validate items, accumulate items_subtotal (v2.3 math) ----
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

  -- ---- Overhead totals (unchanged) ----
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

  -- ---- v2.3 largest-remainder allocation (unchanged math) ----
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

  -- ---- Purchase header (unchanged) ----
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

  -- ---- Pass 2: lock variants, write purchase_items, update variant stock/avg_cost ----
  v_idx := 0;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);

    -- Variant resolution: prefer variant_id, fall back to product_id → default
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

    select v.id, v.product_id, v.stock, v.avg_cost, p.shop_id
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_resolved_variant_id and v.is_active
     for update;

    if not found then raise exception 'variant_not_found_or_inactive' using errcode = 'P0001'; end if;
    if v_variant.shop_id <> v_shop_id then raise exception 'variant_not_in_shop' using errcode = 'P0001'; end if;

    -- Pack resolution by variant_id (was product_id pre-v2.6)
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

    -- Insert purchase_items with variant_id; sync trigger fills product_id.
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
    );

    -- THE critical update of v2.6: stock + avg_cost + last_purchase_cost on
    -- product_variants, not products.
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
$function$;

revoke execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) from public, anon;
grant  execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) to authenticated;

-- ===========================================================================
-- create_product_with_opening_stock — variant-aware rewrite.
--   Returns (product_id, variant_id). v2.5's signature took p_category_id and
--   a legacy p_type fallback; v2.6 drops the legacy fallback because category
--   is now the only naming path (v2.5 §H confirmed). Adds is_scan_only +
--   base_unit_code per spec §3.3.
-- ===========================================================================

drop function if exists public.create_product_with_opening_stock(text, uuid, text, numeric, integer, numeric, text);

create or replace function public.create_product_with_opening_stock(
  p_name text,
  p_category_id uuid,
  p_price numeric(12,2),
  p_opening_stock int default 0,
  p_opening_cost numeric(12,2) default null,
  p_is_scan_only boolean default false,
  p_base_unit_code text default 'each',
  p_description text default null
) returns table (product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_base_unit_id uuid;
  v_category_name text;
  v_product_id uuid;
  v_variant_id uuid;
  v_trimmed_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if length(v_trimmed_name) = 0 then raise exception 'name_required'; end if;
  if p_price is not null and p_price < 0 then raise exception 'price_negative'; end if;
  if p_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
  if p_opening_cost is not null and p_opening_cost < 0 then raise exception 'opening_cost_negative'; end if;
  if p_opening_stock > 0 and p_opening_cost is null then
    raise exception 'opening_cost_required_when_stock_positive';
  end if;

  -- Validate category belongs to shop
  select name into v_category_name
    from public.product_categories
   where id = p_category_id and shop_id = v_shop_id and is_active;
  if not found then raise exception 'category_not_found'; end if;

  -- Resolve or create the base unit
  select id into v_base_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id and code = lower(coalesce(p_base_unit_code, 'each')) and is_active = true;
  if v_base_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, lower(coalesce(p_base_unit_code, 'each')), initcap(coalesce(p_base_unit_code, 'each')))
    returning id into v_base_unit_id;
  end if;

  -- Create product (no stock/price/cost on products in v2.6+)
  insert into public.products (
    shop_id, name, type, category_id, description, price, stock, avg_cost, cost,
    base_unit_id, is_scan_only
  ) values (
    v_shop_id, v_trimmed_name, v_category_name, p_category_id, p_description,
    p_price, 0, 0, 0, v_base_unit_id, coalesce(p_is_scan_only, false)
  ) returning id into v_product_id;

  -- Create the synthetic default variant carrying the sale price (stock and
  -- avg_cost start at 0; opening stock comes through record_purchase below).
  insert into public.product_variants (
    product_id, stock, price, cost, avg_cost, is_default, is_active
  ) values (
    v_product_id, 0, p_price, null, 0, true, true
  ) returning id into v_variant_id;

  -- Opening stock goes through record_purchase so avg_cost / last_purchase_cost
  -- follow the same path as any other stock-in (avoid divergent math).
  if p_opening_stock > 0 then
    perform public.record_purchase(
      null::uuid,
      current_date,
      'Opening stock',
      jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant_id,
        'qty', p_opening_stock,
        'cost_at_purchase', p_opening_cost
      )),
      '[]'::jsonb,
      true
    );
  end if;

  return query select v_product_id, v_variant_id;
end;
$$;

revoke execute on function public.create_product_with_opening_stock(text, uuid, numeric, integer, numeric, boolean, text, text)
  from public, anon;
grant  execute on function public.create_product_with_opening_stock(text, uuid, numeric, integer, numeric, boolean, text, text)
  to authenticated;
