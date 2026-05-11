-- v2.7 §4.2–§4.3 — Multi-variant product creation RPCs.
--
-- create_product_with_variants creates a product + N variants + the
-- attribute-value link rows in a single tx. add_variant_to_product extends
-- an existing multi-variant product (e.g., supplier introduces a new color).

-- ===========================================================================
-- create_product_with_variants
--   p_attribute_ids   : ordered uuid[]  e.g. [color_attr_id, size_attr_id]
--   p_variants        : jsonb[] each:
--     { "attribute_value_ids": [...uuid],
--       "sku": "TS-RED-M",       -- optional
--       "price": 1200,           -- optional, defaults to p_default_price
--       "opening_stock": 0,
--       "opening_cost": null }   -- required iff opening_stock > 0
--   Returns (product_id, variant_ids[])
-- ===========================================================================

create or replace function public.create_product_with_variants(
  p_name text,
  p_category_id uuid,
  p_default_price numeric(12,2),
  p_is_scan_only boolean default false,
  p_base_unit_code text default 'each',
  p_attribute_ids uuid[] default array[]::uuid[],
  p_variants jsonb default '[]'::jsonb,
  p_description text default null
) returns table (product_id uuid, variant_ids uuid[])
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_variant_id uuid;
  v_variant_ids uuid[] := array[]::uuid[];
  v_variant jsonb;
  v_attr_value_id uuid;
  v_base_unit_id uuid;
  v_category_name text;
  v_trimmed_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_n_variants int := coalesce(jsonb_array_length(p_variants), 0);
  v_n_attributes int := coalesce(array_length(p_attribute_ids, 1), 0);
  v_has_variants boolean := v_n_attributes > 0;
  v_variant_price numeric(12,2);
  v_opening_stock int;
  v_opening_cost numeric(12,2);
  v_sku text;
  v_unique_attrs int;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if length(v_trimmed_name) = 0 then raise exception 'name_required'; end if;
  if p_default_price is not null and p_default_price < 0 then
    raise exception 'price_negative';
  end if;
  if v_n_attributes > 3 then
    raise exception 'too_many_attributes' using detail = 'Max 3 attributes per product';
  end if;
  if v_has_variants and v_n_variants < 1 then
    raise exception 'variants_required_when_attributes_set';
  end if;

  -- Validate category belongs to shop
  select name into v_category_name
    from public.product_categories
   where id = p_category_id and shop_id = v_shop_id and is_active;
  if not found then raise exception 'category_not_found'; end if;

  -- Validate every attribute belongs to the shop and is active
  if v_has_variants then
    select count(distinct id) into v_unique_attrs
      from public.variant_attributes
     where shop_id = v_shop_id and is_active and id = any(p_attribute_ids);
    if v_unique_attrs <> v_n_attributes then
      raise exception 'one_or_more_attributes_invalid';
    end if;
  end if;

  -- Resolve / create base unit
  select id into v_base_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id
     and code = lower(coalesce(p_base_unit_code, 'each'))
     and is_active = true;
  if v_base_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, lower(coalesce(p_base_unit_code, 'each')),
                       initcap(coalesce(p_base_unit_code, 'each')))
    returning id into v_base_unit_id;
  end if;

  -- Insert product. has_variants drives the trigger invariant in 0045.
  insert into public.products (
    shop_id, name, type, category_id, description, price, stock, avg_cost, cost,
    base_unit_id, is_scan_only, has_variants
  ) values (
    v_shop_id, v_trimmed_name, v_category_name, p_category_id, p_description,
    p_default_price, 0, 0, 0, v_base_unit_id, coalesce(p_is_scan_only, false),
    v_has_variants
  ) returning id into v_product_id;

  -- Single-variant shortcut: when no attributes are passed, create one
  -- default variant carrying the default price (no opening stock here —
  -- callers should use create_product_with_opening_stock for the legacy flow).
  if not v_has_variants then
    insert into public.product_variants (
      product_id, stock, price, cost, avg_cost, is_default, is_active
    ) values (
      v_product_id, 0, p_default_price, null, 0, true, true
    ) returning id into v_variant_id;
    return query select v_product_id, array[v_variant_id];
    return;
  end if;

  -- Multi-variant: insert each variant + attribute-value links + optional opening stock.
  for v_variant in select * from jsonb_array_elements(p_variants) loop
    -- Each variant must have one value per attribute (UI enforces uniqueness
    -- of (product_id, attribute_value_ids[]) — DB only checks shape here).
    if jsonb_array_length(coalesce(v_variant->'attribute_value_ids', '[]'::jsonb))
       <> v_n_attributes then
      raise exception 'variant_must_have_one_value_per_attribute';
    end if;

    -- Override or default the per-variant price
    v_variant_price := coalesce((v_variant->>'price')::numeric(12,2), p_default_price);
    if v_variant_price is not null and v_variant_price < 0 then
      raise exception 'variant_price_negative';
    end if;

    v_sku := nullif(trim(coalesce(v_variant->>'sku', '')), '');
    v_opening_stock := coalesce((v_variant->>'opening_stock')::int, 0);
    v_opening_cost := (v_variant->>'opening_cost')::numeric(12,2);

    if v_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
    if v_opening_stock > 0 and v_opening_cost is null then
      raise exception 'opening_cost_required_when_stock_positive';
    end if;

    -- is_default = false on multi-variant products (enforced by trigger from 0045)
    insert into public.product_variants (
      product_id, sku, stock, price, cost, avg_cost, is_default, is_active
    ) values (
      v_product_id, v_sku, 0, v_variant_price, null, 0, false, true
    ) returning id into v_variant_id;

    -- Link to attribute values
    for v_attr_value_id in
      select (value::uuid)
        from jsonb_array_elements_text(v_variant->'attribute_value_ids') as t(value)
    loop
      -- Validate the value belongs to one of the chosen attributes in this shop
      perform 1
        from public.variant_attribute_values vv
        join public.variant_attributes a on a.id = vv.attribute_id
       where vv.id = v_attr_value_id
         and a.shop_id = v_shop_id
         and vv.is_active and a.is_active
         and a.id = any(p_attribute_ids);
      if not found then raise exception 'attribute_value_invalid_for_this_product'; end if;

      insert into public.product_variant_attribute_values (variant_id, attribute_value_id)
      values (v_variant_id, v_attr_value_id);
    end loop;

    v_variant_ids := array_append(v_variant_ids, v_variant_id);

    -- Record opening stock for this variant (goes through record_purchase
    -- so avg_cost / last_purchase_cost follow the same path as a normal
    -- stock-in)
    if v_opening_stock > 0 then
      perform public.record_purchase(
        null::uuid,
        current_date,
        'Opening stock',
        jsonb_build_array(jsonb_build_object(
          'variant_id', v_variant_id,
          'qty', v_opening_stock,
          'cost_at_purchase', v_opening_cost
        )),
        '[]'::jsonb,
        true
      );
    end if;
  end loop;

  return query select v_product_id, v_variant_ids;
end;
$$;

revoke execute on function public.create_product_with_variants(text, uuid, numeric, boolean, text, uuid[], jsonb, text)
  from public, anon;
grant  execute on function public.create_product_with_variants(text, uuid, numeric, boolean, text, uuid[], jsonb, text)
  to authenticated;

-- ===========================================================================
-- add_variant_to_product
--   Existing multi-variant product gets a new variant (e.g., a new color).
--   Validates p_attribute_value_ids match the product's existing attribute
--   composition (same attributes, one value each).
-- ===========================================================================

create or replace function public.add_variant_to_product(
  p_product_id uuid,
  p_attribute_value_ids uuid[],
  p_sku text default null,
  p_price numeric(12,2) default null,
  p_opening_stock int default 0,
  p_opening_cost numeric(12,2) default null
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_has_variants boolean;
  v_existing_attrs uuid[];
  v_new_attrs uuid[];
  v_variant_id uuid;
  v_attr_value_id uuid;
  v_sku text := nullif(trim(coalesce(p_sku, '')), '');
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  -- Product must belong to the shop and be flagged has_variants
  select has_variants into v_has_variants
    from public.products
   where id = p_product_id and shop_id = v_shop_id and is_active;
  if not found then raise exception 'product_not_in_shop'; end if;
  if not v_has_variants then
    raise exception 'product_is_single_variant'
      using detail = 'Cannot add variant to a product that does not have_variants';
  end if;

  -- Compute the attribute set of the product's existing variants and the
  -- attribute set of the new variant's values; they must match.
  select array(
    select distinct vv.attribute_id
      from public.product_variant_attribute_values pvav
      join public.variant_attribute_values vv on vv.id = pvav.attribute_value_id
      join public.product_variants v on v.id = pvav.variant_id
     where v.product_id = p_product_id and v.is_active
     order by vv.attribute_id
  ) into v_existing_attrs;

  select array(
    select distinct vv.attribute_id
      from public.variant_attribute_values vv
     where vv.id = any(p_attribute_value_ids)
     order by vv.attribute_id
  ) into v_new_attrs;

  if v_existing_attrs <> v_new_attrs then
    raise exception 'attribute_composition_mismatch';
  end if;
  if array_length(p_attribute_value_ids, 1) <> array_length(v_existing_attrs, 1) then
    raise exception 'variant_must_have_one_value_per_attribute';
  end if;

  -- Reject duplicate (same exact combination) within the product
  if exists (
    select 1
      from public.product_variants v
     where v.product_id = p_product_id and v.is_active
       and array(
         select pvav.attribute_value_id
           from public.product_variant_attribute_values pvav
          where pvav.variant_id = v.id
          order by 1
       ) = (
         select array_agg(x order by x) from unnest(p_attribute_value_ids) as x
       )
  ) then
    raise exception 'duplicate_variant_combination';
  end if;

  if p_opening_stock is null or p_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
  if p_opening_stock > 0 and p_opening_cost is null then
    raise exception 'opening_cost_required_when_stock_positive';
  end if;
  if p_price is not null and p_price < 0 then raise exception 'price_negative'; end if;

  insert into public.product_variants (
    product_id, sku, stock, price, cost, avg_cost, is_default, is_active
  ) values (
    p_product_id, v_sku, 0, p_price, null, 0, false, true
  ) returning id into v_variant_id;

  foreach v_attr_value_id in array p_attribute_value_ids loop
    insert into public.product_variant_attribute_values (variant_id, attribute_value_id)
    values (v_variant_id, v_attr_value_id);
  end loop;

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

  return v_variant_id;
end;
$$;

revoke execute on function public.add_variant_to_product(uuid, uuid[], text, numeric, int, numeric)
  from public, anon;
grant  execute on function public.add_variant_to_product(uuid, uuid[], text, numeric, int, numeric)
  to authenticated;

-- ===========================================================================
-- product_variant_full view — every active variant with its attribute combo
-- ===========================================================================

drop view if exists public.product_variant_full;
create view public.product_variant_full
with (security_invoker = true) as
select
  p.id                  as product_id,
  p.shop_id             as shop_id,
  p.name                as product_name,
  p.category_id         as category_id,
  p.has_variants        as has_variants,
  v.id                  as variant_id,
  v.sku                 as sku,
  v.stock               as stock,
  v.price               as price,
  v.cost                as cost,
  v.avg_cost            as avg_cost,
  v.last_purchase_cost  as last_purchase_cost,
  v.is_default          as is_default,
  v.is_active           as variant_is_active,
  (
    select coalesce(jsonb_object_agg(a.name, vv.value), '{}'::jsonb)
      from public.product_variant_attribute_values pvav
      join public.variant_attribute_values vv on vv.id = pvav.attribute_value_id
      join public.variant_attributes a on a.id = vv.attribute_id
     where pvav.variant_id = v.id
  ) as attributes,
  (
    select string_agg(vv.value, ' / ' order by a.display_order, a.name)
      from public.product_variant_attribute_values pvav
      join public.variant_attribute_values vv on vv.id = pvav.attribute_value_id
      join public.variant_attributes a on a.id = vv.attribute_id
     where pvav.variant_id = v.id
  ) as variant_label
from public.products p
join public.product_variants v on v.product_id = p.id
where p.is_active and v.is_active;

-- ===========================================================================
-- product_with_default_variant — widen with multi-variant aggregates.
--   For has_variants = false: v.* columns populated (existing single-variant path)
--   For has_variants = true:  v.* columns NULL, aggregates populated
--   has_variants exposed on every row so callers can branch.
-- ===========================================================================

-- CREATE OR REPLACE preserves the v2.6 column order and appends has_variants
-- + the multi-variant aggregates. (DROP would cascade-fail through
-- search_products / search_products_count.)
create or replace view public.product_with_default_variant
with (security_invoker = true) as
select
  p.id                  as product_id,
  p.shop_id             as shop_id,
  p.name                as name,
  p.category_id         as category_id,
  p.description         as description,
  p.type                as legacy_type_column,
  p.is_scan_only        as is_scan_only,
  p.is_active           as product_is_active,
  p.base_unit_id        as base_unit_id,
  p.created_at          as product_created_at,
  p.updated_at          as product_updated_at,
  v.id                  as variant_id,
  v.sku                 as sku,
  v.stock               as stock,
  v.price               as price,
  v.cost                as cost,
  v.avg_cost            as avg_cost,
  v.last_purchase_cost  as last_purchase_cost,
  v.is_active           as variant_is_active,
  p.has_variants        as has_variants,
  (
    select count(*) from public.product_variants vc
     where vc.product_id = p.id and vc.is_active
  ) as variant_count,
  (
    select coalesce(sum(vc.stock), 0) from public.product_variants vc
     where vc.product_id = p.id and vc.is_active
  ) as total_stock_all_variants,
  (
    select min(vc.price) from public.product_variants vc
     where vc.product_id = p.id and vc.is_active and vc.price is not null
  ) as min_price,
  (
    select max(vc.price) from public.product_variants vc
     where vc.product_id = p.id and vc.is_active and vc.price is not null
  ) as max_price
from public.products p
left join public.product_variants v
  on v.product_id = p.id and v.is_default and v.is_active;
