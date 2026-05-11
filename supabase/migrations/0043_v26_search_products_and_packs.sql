-- v2.6 §C3 — search_products + pack RPCs operate through variants.
--
-- search_products / _count: same signature + same return shape as v2.5; body
-- now reads through the product_with_default_variant compat view. stock/price/
-- avg_cost/last_purchase_cost come from the default variant. v2.5 callers
-- (hooks.ts → ProductSearchRow) see no change.
--
-- define_pack_inline / update_pack / deactivate_pack: signatures unchanged
-- (p_product_id keeps working). Internally they resolve to the default variant
-- and operate on product_packs.variant_id. v2.7 can add p_variant_id overloads
-- once multi-variant products exist.

-- ===========================================================================
-- search_products  (CREATE OR REPLACE keeps the v2.5 signature/return shape)
-- ===========================================================================

create or replace function public.search_products(
  p_query text default null::text,
  p_limit integer default 50,
  p_offset integer default 0,
  p_only_in_stock boolean default false,
  p_category_id uuid default null
) returns table (
  id uuid,
  name text,
  type text,
  category_id uuid,
  description text,
  price numeric,
  avg_cost numeric,
  last_purchase_cost numeric,
  stock integer,
  is_active boolean,
  relevance real
)
language plpgsql stable security definer
set search_path = public, extensions, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query  text;
begin
  if v_shop_id is null then
    raise exception 'no_shop_for_user';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  return query
  with base as (
    select
      pv.product_id            as id,
      pv.name                  as name,
      pv.legacy_type_column    as type,
      pv.category_id           as category_id,
      pv.description           as description,
      pv.price                 as price,
      pv.avg_cost              as avg_cost,
      pv.last_purchase_cost    as last_purchase_cost,
      pv.stock                 as stock,
      pv.product_is_active     as is_active
    from public.product_with_default_variant pv
    where pv.shop_id = v_shop_id
      and pv.product_is_active
      and (not p_only_in_stock or coalesce(pv.stock, 0) > 0)
      and (p_category_id is null or pv.category_id = p_category_id)
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
    s.id, s.name, s.type, s.category_id, s.description,
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
$$;

revoke execute on function public.search_products(text, integer, integer, boolean, uuid)
  from public, anon;
grant  execute on function public.search_products(text, integer, integer, boolean, uuid)
  to authenticated;

-- ===========================================================================
-- search_products_count  (same signature)
-- ===========================================================================

create or replace function public.search_products_count(
  p_query text default null::text,
  p_only_in_stock boolean default false,
  p_category_id uuid default null
) returns bigint
language plpgsql stable security definer
set search_path = public, extensions, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query  text;
  v_count  bigint;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  if v_query is null then
    select count(*) into v_count
      from public.product_with_default_variant pv
     where pv.shop_id = v_shop_id
       and pv.product_is_active
       and (not p_only_in_stock or coalesce(pv.stock, 0) > 0)
       and (p_category_id is null or pv.category_id = p_category_id);
  else
    select count(*) into v_count
      from public.product_with_default_variant pv
     where pv.shop_id = v_shop_id
       and pv.product_is_active
       and (not p_only_in_stock or coalesce(pv.stock, 0) > 0)
       and (p_category_id is null or pv.category_id = p_category_id)
       and (pv.name ilike '%' || v_query || '%' or pv.name % v_query);
  end if;

  return v_count;
end;
$$;

revoke execute on function public.search_products_count(text, boolean, uuid) from public, anon;
grant  execute on function public.search_products_count(text, boolean, uuid) to authenticated;

-- ===========================================================================
-- define_pack_inline — resolve product_id → default variant_id internally.
--   Signature unchanged. v2.7 will add a p_variant_id overload.
-- ===========================================================================

create or replace function public.define_pack_inline(
  p_product_id uuid,
  p_unit_code text,
  p_unit_name text,
  p_base_qty integer,
  p_is_default_purchase boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_unit_id uuid;
  v_variant_id uuid;
  v_pack_id uuid;
  v_normalized_code text := lower(trim(p_unit_code));
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_base_qty <= 1 then
    raise exception 'base_qty_must_be_greater_than_one'
      using hint = 'Pack must contain at least 2 base units';
  end if;
  if v_normalized_code !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'invalid_unit_code';
  end if;

  perform 1 from public.products
    where id = p_product_id and shop_id = v_shop_id;
  if not found then raise exception 'product_not_in_shop'; end if;

  -- Resolve to the product's default variant (single-variant assumption in v2.6).
  select id into v_variant_id
    from public.product_variants
   where product_id = p_product_id and is_default and is_active;
  if v_variant_id is null then raise exception 'product_has_no_default_variant'; end if;

  -- Resolve or create the UoM scoped to this shop
  select id into v_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id and code = v_normalized_code and is_active = true;
  if v_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, v_normalized_code, coalesce(nullif(trim(p_unit_name), ''), p_unit_code))
    returning id into v_unit_id;
  end if;

  -- Atomically un-default any existing default pack on this variant
  if p_is_default_purchase then
    update public.product_packs
       set is_default_purchase = false, updated_at = now()
     where variant_id = v_variant_id and is_default_purchase and is_active;
  end if;

  insert into public.product_packs (
    variant_id, unit_id, base_qty, is_default_purchase
  ) values (
    v_variant_id, v_unit_id, p_base_qty, coalesce(p_is_default_purchase, false)
  ) returning id into v_pack_id;

  return v_pack_id;
end;
$function$;

revoke execute on function public.define_pack_inline(uuid, text, text, integer, boolean) from public, anon;
grant  execute on function public.define_pack_inline(uuid, text, text, integer, boolean) to authenticated;

-- ===========================================================================
-- update_pack — search by variant_id
-- ===========================================================================

create or replace function public.update_pack(
  p_pack_id uuid,
  p_base_qty integer,
  p_is_default_purchase boolean
) returns void
language plpgsql security definer set search_path = public, pg_catalog as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_variant_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_base_qty <= 1 then
    raise exception 'base_qty_must_be_greater_than_one';
  end if;

  select pp.variant_id into v_variant_id
    from public.product_packs pp
    join public.product_variants v on v.id = pp.variant_id
    join public.products p on p.id = v.product_id
   where pp.id = p_pack_id and p.shop_id = v_shop_id
   for update;
  if v_variant_id is null then raise exception 'pack_not_in_shop'; end if;

  if p_is_default_purchase then
    update public.product_packs
       set is_default_purchase = false, updated_at = now()
     where variant_id = v_variant_id
       and is_default_purchase
       and is_active
       and id <> p_pack_id;
  end if;

  update public.product_packs
     set base_qty = p_base_qty,
         is_default_purchase = p_is_default_purchase,
         updated_at = now()
   where id = p_pack_id;
end;
$function$;

revoke execute on function public.update_pack(uuid, integer, boolean) from public, anon;
grant  execute on function public.update_pack(uuid, integer, boolean) to authenticated;

-- ===========================================================================
-- deactivate_pack — shop guard via variant chain
-- ===========================================================================

create or replace function public.deactivate_pack(p_pack_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_variant_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select pp.variant_id into v_variant_id
    from public.product_packs pp
    join public.product_variants v on v.id = pp.variant_id
    join public.products p on p.id = v.product_id
   where pp.id = p_pack_id and p.shop_id = v_shop_id;
  if v_variant_id is null then raise exception 'pack_not_found_or_not_in_shop'; end if;

  update public.product_packs
     set is_active = false,
         is_default_purchase = false,
         updated_at = now()
   where id = p_pack_id;
end;
$function$;

revoke execute on function public.deactivate_pack(uuid) from public, anon;
grant  execute on function public.deactivate_pack(uuid) to authenticated;
