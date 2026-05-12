-- v2.8.5 — POS batch picker (manual override) needs two new fields on each
-- search result so the cart can render the "Pick batch" link only for
-- batched products and so the picker can query active batches via
-- variant_id (single-variant cart lines today don't carry one).
--
--   §A. product_with_default_variant view gains `has_batches` (appended at
--       end of column list because Postgres views can only ADD columns,
--       not insert mid-list, via CREATE OR REPLACE).
--   §B. search_products RETURNS TABLE gains `has_batches boolean` and
--       `default_variant_id uuid`. The latter is the view's existing
--       `variant_id` surfaced under a clearer name (search_products
--       returns the product id as `id`, so reusing `variant_id`
--       unprefixed would confuse callers).
--   §C. Re-grant (revoke from public, anon; grant to authenticated).
--
-- No backfill, no data change.

-- §A. extend the view by appending has_batches
create or replace view public.product_with_default_variant
with (security_invoker = true)
as
with default_variants as (
  select distinct on (product_id)
    product_id,
    id            as variant_id,
    sku,
    stock,
    price,
    cost,
    avg_cost,
    last_purchase_cost,
    is_active     as variant_is_active
  from public.product_variants
  where is_default = true and is_active = true
  order by product_id, created_at asc, id asc
),
variant_aggregates as (
  select
    p.id as product_id,
    count(pv.*) filter (where pv.is_active) as variant_count,
    coalesce(sum(pv.stock) filter (where pv.is_active), 0)::bigint
      as total_stock_all_variants,
    min(pv.price) filter (where pv.is_active and pv.price is not null) as min_price,
    max(pv.price) filter (where pv.is_active and pv.price is not null) as max_price,
    bool_or(pv.is_active and pv.price is null) as has_null_price_variant
  from public.products p
  left join public.product_variants pv on pv.product_id = p.id
  group by p.id
)
select
  p.id                                  as product_id,
  p.shop_id,
  p.name,
  p.category_id,
  p.description,
  p.type                                as legacy_type_column,
  p.is_scan_only,
  p.is_active                           as product_is_active,
  p.base_unit_id,
  p.created_at                          as product_created_at,
  p.updated_at                          as product_updated_at,
  dv.variant_id,
  dv.sku,
  dv.stock,
  dv.price,
  dv.cost,
  dv.avg_cost,
  dv.last_purchase_cost,
  dv.variant_is_active,
  p.has_variants,
  va.variant_count,
  va.total_stock_all_variants,
  va.min_price,
  va.max_price,
  coalesce(va.has_null_price_variant, false) as has_null_price_variant,
  -- v2.8.5 appended fields
  p.has_batches
from public.products p
left join default_variants dv on dv.product_id = p.id
left join variant_aggregates va on va.product_id = p.id;

-- §B. search_products — add has_batches + default_variant_id (signature change → DROP + CREATE)
drop function if exists public.search_products(text, integer, integer, boolean, uuid, boolean);

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
  has_null_price_variant boolean,
  has_batches boolean,
  default_variant_id uuid
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
      pv.has_null_price_variant as has_null_price_variant,
      pv.has_batches            as has_batches,
      pv.variant_id             as default_variant_id
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
    s.has_null_price_variant,
    s.has_batches,
    s.default_variant_id
  from scored s
  where v_query is null or s.relevance > 0.2
  order by
    case when v_query is null then 0 else 1 end,
    s.relevance desc,
    s.name asc
  limit p_limit offset p_offset;
end;
$$;

-- §C. Re-grant.
revoke all on function public.search_products(text, integer, integer, boolean, uuid, boolean) from public, anon;
grant execute on function public.search_products(text, integer, integer, boolean, uuid, boolean) to authenticated;
