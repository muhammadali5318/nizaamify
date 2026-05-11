-- v2.7 polish — search_products: add total_stock_all_variants.
--
-- Multi-variant rows in the POS picker / products list need to surface the
-- total stock across all variants so the user sees inventory at a glance
-- without clicking through to the detail page. variant_count alone tells
-- them "this product has 4 variants" but not "you have 47 units of it
-- across those variants" — that's the number that matters in POS context.
--
-- product_with_default_variant already has total_stock_all_variants; this
-- migration just plumbs it through to search_products' return shape.

drop function if exists public.search_products(text, integer, integer, boolean, uuid);

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
  relevance real,
  has_variants boolean,
  variant_count bigint,
  min_price numeric,
  max_price numeric,
  total_stock_all_variants bigint
)
language plpgsql stable security definer
set search_path = public, extensions, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query  text;
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
      pv.total_stock_all_variants as total_stock
    from public.product_with_default_variant pv
    where pv.shop_id = v_shop_id
      and pv.product_is_active
      and (not p_only_in_stock or
           (not pv.has_variants and coalesce(pv.stock, 0) > 0) or
           (pv.has_variants and coalesce(pv.total_stock_all_variants, 0) > 0))
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
    s.last_purchase_cost::numeric(12,2), s.stock, s.is_active, s.relevance,
    s.has_variants, s.variant_count,
    s.min_price::numeric(12,2), s.max_price::numeric(12,2),
    s.total_stock::bigint
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

revoke execute on function public.search_products(text, integer, integer, boolean, uuid) from public, anon;
grant  execute on function public.search_products(text, integer, integer, boolean, uuid) to authenticated;
