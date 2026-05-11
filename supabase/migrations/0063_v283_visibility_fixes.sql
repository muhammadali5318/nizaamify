-- v2.8.3 — visibility fixes for two silent failure modes.
--   §A. New view batches_already_expired — surfaces batches past expiry
--       with qty_remaining > 0. The v2.8 alert widget hid these the day
--       they expired; this is the catch-up surface.
--   §B. product_with_default_variant gains has_null_price_variant
--       boolean — exists() over variants where price IS NULL.
--   §C. search_products + search_products_count gain p_needs_pricing
--       param. Append-only signature change with default false →
--       back-compat with existing callers.

-- §A. batches_already_expired view
drop view if exists public.batches_already_expired cascade;
create view public.batches_already_expired
with (security_invoker = true) as
select
  b.id as batch_id,
  b.batch_no,
  b.qty_remaining,
  b.expiry_date,
  (current_date - b.expiry_date) as days_since_expired,
  v.id as variant_id,
  p.id as product_id,
  p.name as product_name,
  p.shop_id
from public.inventory_batches b
join public.product_variants v on v.id = b.variant_id
join public.products p on p.id = v.product_id
where b.is_active
  and b.qty_remaining > 0
  and b.expiry_date is not null
  and b.expiry_date < current_date;

-- §B. product_with_default_variant gains has_null_price_variant
create or replace view public.product_with_default_variant as
select
  p.id as product_id,
  p.shop_id,
  p.name,
  p.category_id,
  p.description,
  p.type as legacy_type_column,
  p.is_scan_only,
  p.is_active as product_is_active,
  p.base_unit_id,
  p.created_at as product_created_at,
  p.updated_at as product_updated_at,
  v.id as variant_id,
  v.sku,
  v.stock,
  v.price,
  v.cost,
  v.avg_cost,
  v.last_purchase_cost,
  v.is_active as variant_is_active,
  p.has_variants,
  (select count(*) from public.product_variants vc
    where vc.product_id = p.id and vc.is_active) as variant_count,
  (select coalesce(sum(vc.stock), 0::bigint) from public.product_variants vc
    where vc.product_id = p.id and vc.is_active) as total_stock_all_variants,
  (select min(vc.price) from public.product_variants vc
    where vc.product_id = p.id and vc.is_active and vc.price is not null) as min_price,
  (select max(vc.price) from public.product_variants vc
    where vc.product_id = p.id and vc.is_active and vc.price is not null) as max_price,
  exists(
    select 1 from public.product_variants vc
    where vc.product_id = p.id and vc.is_active and vc.price is null
  ) as has_null_price_variant
from public.products p
left join public.product_variants v
  on v.product_id = p.id and v.is_default and v.is_active;

-- §C. search_products + search_products_count gain p_needs_pricing
drop function if exists public.search_products(text, integer, integer, boolean, uuid);

create or replace function public.search_products(
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_only_in_stock boolean default false,
  p_category_id uuid default null,
  p_needs_pricing boolean default false
) returns table(
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
  relevance real,
  has_variants boolean,
  variant_count bigint,
  min_price numeric,
  max_price numeric,
  total_stock_all_variants bigint,
  has_null_price_variant boolean
)
language plpgsql stable security definer
set search_path to 'public', 'extensions', 'pg_catalog' as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  return query
  with base as (
    select
      pv.product_id             as id,
      pv.name                   as name,
      pv.legacy_type_column     as type,
      pv.category_id            as category_id,
      pv.description            as description,
      pv.price                  as price,
      pv.avg_cost               as avg_cost,
      pv.last_purchase_cost     as last_purchase_cost,
      pv.stock                  as stock,
      pv.product_is_active      as is_active,
      pv.has_variants           as has_variants,
      pv.variant_count          as variant_count,
      pv.min_price              as min_price,
      pv.max_price              as max_price,
      pv.total_stock_all_variants as total_stock,
      pv.has_null_price_variant as has_null_price_variant
    from public.product_with_default_variant pv
    where pv.shop_id = v_shop_id
      and pv.product_is_active
      and (not p_only_in_stock or
           (not pv.has_variants and coalesce(pv.stock, 0) > 0) or
           (pv.has_variants and coalesce(pv.total_stock_all_variants, 0) > 0))
      and (p_category_id is null or pv.category_id = p_category_id)
      and (not p_needs_pricing or pv.has_null_price_variant)
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
    s.last_purchase_cost::numeric(12,2), s.stock, s.is_active, s.relevance,
    s.has_variants, s.variant_count,
    s.min_price::numeric(12,2), s.max_price::numeric(12,2),
    s.total_stock::bigint,
    s.has_null_price_variant
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

revoke all on function public.search_products(text, integer, integer, boolean, uuid, boolean) from public, anon;
grant execute on function public.search_products(text, integer, integer, boolean, uuid, boolean) to authenticated;

drop function if exists public.search_products_count(text, boolean, uuid);

create or replace function public.search_products_count(
  p_query text default null,
  p_only_in_stock boolean default false,
  p_category_id uuid default null,
  p_needs_pricing boolean default false
) returns bigint
language plpgsql stable security definer
set search_path to 'public', 'extensions', 'pg_catalog' as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
  v_count bigint;
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
       and (p_category_id is null or pv.category_id = p_category_id)
       and (not p_needs_pricing or pv.has_null_price_variant);
  else
    select count(*) into v_count
      from public.product_with_default_variant pv
     where pv.shop_id = v_shop_id
       and pv.product_is_active
       and (not p_only_in_stock or coalesce(pv.stock, 0) > 0)
       and (p_category_id is null or pv.category_id = p_category_id)
       and (not p_needs_pricing or pv.has_null_price_variant)
       and (pv.name ilike '%' || v_query || '%' or pv.name % v_query);
  end if;

  return v_count;
end;
$$;

revoke all on function public.search_products_count(text, boolean, uuid, boolean) from public, anon;
grant execute on function public.search_products_count(text, boolean, uuid, boolean) to authenticated;
