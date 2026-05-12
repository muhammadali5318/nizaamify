-- v2.8.1 — decouple pricing/stock from product creation.
--
-- The product create RPCs (`create_product_with_opening_stock` and
-- `create_product_with_variants`) used to require a selling price and
-- pack the synthetic "opening stock" purchase row inside one mega-RPC.
-- That coupling created friction with v2.8's has_batches toggle (which
-- requires variant.stock = 0 to enable) and blocked bulk product
-- imports — shop owners don't know cost-of-goods at upload time.
--
-- Changes:
--   * `p_price` / `p_default_price` become nullable. New products may
--     ship without a selling price; record_sale's existing
--     `variant_not_sellable` guard rejects sales of null-price variants.
--   * New params `p_has_batches`, `p_expiry_alert_days`,
--     `p_warranty_alert_days` so the create form can flip batch tracking
--     on at create time (was edit-only in v2.8).
--   * Raise `cannot_seed_opening_stock_for_batched_product` if
--     `has_batches = true` AND `opening_stock > 0` — opening stock for
--     batched products must go through stock-in so the batch row is
--     captured properly.
--
-- DROP + CREATE is required because we're adding new parameters
-- (CREATE OR REPLACE can't change a function's argument list).
-- The new signatures are back-compat with positional+named-arg callers
-- because all new params have defaults.

-- §A. create_product_with_opening_stock
drop function if exists public.create_product_with_opening_stock(
  text, uuid, numeric, integer, numeric, boolean, text, text
);

create or replace function public.create_product_with_opening_stock(
  p_name text,
  p_category_id uuid,
  p_price numeric default null,
  p_opening_stock integer default 0,
  p_opening_cost numeric default null,
  p_is_scan_only boolean default false,
  p_base_unit_code text default 'each',
  p_description text default null,
  p_has_batches boolean default false,
  p_expiry_alert_days integer default null,
  p_warranty_alert_days integer default null
) returns table(product_id uuid, variant_id uuid)
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
  if coalesce(p_has_batches, false) = true and p_opening_stock > 0 then
    raise exception 'cannot_seed_opening_stock_for_batched_product';
  end if;
  if p_expiry_alert_days is not null and p_expiry_alert_days <= 0 then
    raise exception 'expiry_alert_days_must_be_positive';
  end if;
  if p_warranty_alert_days is not null and p_warranty_alert_days <= 0 then
    raise exception 'warranty_alert_days_must_be_positive';
  end if;

  select name into v_category_name
    from public.product_categories
   where id = p_category_id and shop_id = v_shop_id and is_active;
  if not found then raise exception 'category_not_found'; end if;

  select id into v_base_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id and code = lower(coalesce(p_base_unit_code, 'each')) and is_active = true;
  if v_base_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, lower(coalesce(p_base_unit_code, 'each')), initcap(coalesce(p_base_unit_code, 'each')))
    returning id into v_base_unit_id;
  end if;

  insert into public.products (
    shop_id, name, type, category_id, description, price, stock, avg_cost, cost,
    base_unit_id, is_scan_only,
    has_batches, expiry_alert_days, warranty_alert_days
  ) values (
    v_shop_id, v_trimmed_name, v_category_name, p_category_id, p_description,
    p_price, 0, 0, 0, v_base_unit_id, coalesce(p_is_scan_only, false),
    coalesce(p_has_batches, false), p_expiry_alert_days, p_warranty_alert_days
  ) returning id into v_product_id;

  insert into public.product_variants (
    product_id, stock, price, cost, avg_cost, is_default, is_active
  ) values (
    v_product_id, 0, p_price, null, 0, true, true
  ) returning id into v_variant_id;

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

revoke all on function public.create_product_with_opening_stock(
  text, uuid, numeric, integer, numeric, boolean, text, text, boolean, integer, integer
) from public, anon;
grant execute on function public.create_product_with_opening_stock(
  text, uuid, numeric, integer, numeric, boolean, text, text, boolean, integer, integer
) to authenticated;

-- §B. create_product_with_variants
drop function if exists public.create_product_with_variants(
  text, uuid, numeric, boolean, text, uuid[], jsonb, text
);

create or replace function public.create_product_with_variants(
  p_name text,
  p_category_id uuid,
  p_default_price numeric default null,
  p_is_scan_only boolean default false,
  p_base_unit_code text default 'each',
  p_attribute_ids uuid[] default array[]::uuid[],
  p_variants jsonb default '[]'::jsonb,
  p_description text default null,
  p_has_batches boolean default false,
  p_expiry_alert_days integer default null,
  p_warranty_alert_days integer default null
) returns table(product_id uuid, variant_ids uuid[])
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
  if p_default_price is not null and p_default_price < 0 then raise exception 'price_negative'; end if;
  if v_n_attributes > 3 then raise exception 'too_many_attributes' using detail = 'Max 3 attributes per product'; end if;
  if v_has_variants and v_n_variants < 1 then raise exception 'variants_required_when_attributes_set'; end if;
  if p_expiry_alert_days is not null and p_expiry_alert_days <= 0 then
    raise exception 'expiry_alert_days_must_be_positive';
  end if;
  if p_warranty_alert_days is not null and p_warranty_alert_days <= 0 then
    raise exception 'warranty_alert_days_must_be_positive';
  end if;

  select name into v_category_name
    from public.product_categories
   where id = p_category_id and shop_id = v_shop_id and is_active;
  if not found then raise exception 'category_not_found'; end if;

  if v_has_variants then
    select count(distinct id) into v_unique_attrs
      from public.variant_attributes
     where shop_id = v_shop_id and is_active and id = any(p_attribute_ids);
    if v_unique_attrs <> v_n_attributes then raise exception 'one_or_more_attributes_invalid'; end if;
  end if;

  select id into v_base_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id and code = lower(coalesce(p_base_unit_code, 'each')) and is_active = true;
  if v_base_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, lower(coalesce(p_base_unit_code, 'each')), initcap(coalesce(p_base_unit_code, 'each')))
    returning id into v_base_unit_id;
  end if;

  insert into public.products (
    shop_id, name, type, category_id, description, price, stock, avg_cost, cost,
    base_unit_id, is_scan_only, has_variants,
    has_batches, expiry_alert_days, warranty_alert_days
  ) values (
    v_shop_id, v_trimmed_name, v_category_name, p_category_id, p_description,
    p_default_price, 0, 0, 0, v_base_unit_id, coalesce(p_is_scan_only, false), v_has_variants,
    coalesce(p_has_batches, false), p_expiry_alert_days, p_warranty_alert_days
  ) returning id into v_product_id;

  if not v_has_variants then
    insert into public.product_variants (
      product_id, stock, price, cost, avg_cost, is_default, is_active
    ) values (v_product_id, 0, p_default_price, null, 0, true, true)
    returning id into v_variant_id;
    return query select v_product_id, array[v_variant_id];
    return;
  end if;

  for v_variant in select * from jsonb_array_elements(p_variants) loop
    if jsonb_array_length(coalesce(v_variant->'attribute_value_ids', '[]'::jsonb)) <> v_n_attributes then
      raise exception 'variant_must_have_one_value_per_attribute';
    end if;
    v_variant_price := coalesce((v_variant->>'price')::numeric(12,2), p_default_price);
    if v_variant_price is not null and v_variant_price < 0 then raise exception 'variant_price_negative'; end if;
    v_sku := nullif(trim(coalesce(v_variant->>'sku', '')), '');
    v_opening_stock := coalesce((v_variant->>'opening_stock')::int, 0);
    v_opening_cost := (v_variant->>'opening_cost')::numeric(12,2);
    if v_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
    if v_opening_stock > 0 and v_opening_cost is null then raise exception 'opening_cost_required_when_stock_positive'; end if;
    if coalesce(p_has_batches, false) = true and v_opening_stock > 0 then
      raise exception 'cannot_seed_opening_stock_for_batched_product';
    end if;

    insert into public.product_variants (
      product_id, sku, stock, price, cost, avg_cost, is_default, is_active
    ) values (v_product_id, v_sku, 0, v_variant_price, null, 0, false, true)
    returning id into v_variant_id;

    for v_attr_value_id in
      select (value::uuid) from jsonb_array_elements_text(v_variant->'attribute_value_ids') as t(value)
    loop
      perform 1
        from public.variant_attribute_values vv
        join public.variant_attributes a on a.id = vv.attribute_id
       where vv.id = v_attr_value_id
         and a.shop_id = v_shop_id and vv.is_active and a.is_active
         and a.id = any(p_attribute_ids);
      if not found then raise exception 'attribute_value_invalid_for_this_product'; end if;

      insert into public.product_variant_attribute_values (variant_id, attribute_value_id)
      values (v_variant_id, v_attr_value_id);
    end loop;

    v_variant_ids := array_append(v_variant_ids, v_variant_id);

    if v_opening_stock > 0 then
      perform public.record_purchase(
        null::uuid, current_date, 'Opening stock',
        jsonb_build_array(jsonb_build_object(
          'variant_id', v_variant_id,
          'qty', v_opening_stock,
          'cost_at_purchase', v_opening_cost
        )),
        '[]'::jsonb, true
      );
    end if;
  end loop;

  return query select v_product_id, v_variant_ids;
end;
$$;

revoke all on function public.create_product_with_variants(
  text, uuid, numeric, boolean, text, uuid[], jsonb, text, boolean, integer, integer
) from public, anon;
grant execute on function public.create_product_with_variants(
  text, uuid, numeric, boolean, text, uuid[], jsonb, text, boolean, integer, integer
) to authenticated;
