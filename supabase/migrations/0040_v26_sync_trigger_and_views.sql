-- v2.6 §B4 — Last piece of v2.6's schema slice.
--   1. Swap product_packs unique indexes (product_id → variant_id)
--   2. Install sync_product_id_from_variant() so writers can keep passing
--      variant_id only; product_id stays accurate for legacy report SQL
--   3. Create product_with_default_variant compat view (single-variant shape)
--   4. Rewrite product_stock_display to be keyed on variant_id

-- ===========================================================================
-- 1. product_packs unique-index swap
--    Old: (product_id, unit_id) WHERE is_active
--         (product_id)           WHERE is_default_purchase AND is_active
--    New: (variant_id, unit_id) WHERE is_active
--         (variant_id)           WHERE is_default_purchase AND is_active
--    Backward compat for single-variant products is preserved by §2's
--    one-to-one product↔variant relationship.
-- ===========================================================================

drop index if exists public.uq_pack_product_unit;
drop index if exists public.uq_pack_default_purchase;

create unique index if not exists uq_pack_variant_unit
  on public.product_packs (variant_id, unit_id) where is_active;

create unique index if not exists uq_pack_default_purchase
  on public.product_packs (variant_id) where is_default_purchase and is_active;

-- ===========================================================================
-- 2. sync_product_id_from_variant trigger.
--    Writers can pass variant_id only; product_id is kept in sync.
--    Legacy reports that still SELECT product_id keep working.
--
--    SECURITY DEFINER so the trigger can SELECT product_variants regardless
--    of the caller's role. Strictly read-only on product_variants — only
--    sets NEW.product_id from the row's own variant_id.
-- ===========================================================================

create or replace function public.sync_product_id_from_variant() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_resolved uuid;
begin
  if NEW.variant_id is null then
    return NEW;
  end if;
  select product_id into v_resolved
    from public.product_variants where id = NEW.variant_id;
  if v_resolved is null then
    raise exception 'sync_product_id_from_variant: variant % not found', NEW.variant_id;
  end if;
  NEW.product_id := v_resolved;
  return NEW;
end;
$$;

revoke execute on function public.sync_product_id_from_variant() from public, anon;

-- Wire the trigger to all three transaction tables.
drop trigger if exists sale_items_sync_product_id on public.sale_items;
create trigger sale_items_sync_product_id
  before insert or update on public.sale_items
  for each row execute function public.sync_product_id_from_variant();

drop trigger if exists purchase_items_sync_product_id on public.purchase_items;
create trigger purchase_items_sync_product_id
  before insert or update on public.purchase_items
  for each row execute function public.sync_product_id_from_variant();

drop trigger if exists product_packs_sync_product_id on public.product_packs;
create trigger product_packs_sync_product_id
  before insert or update on public.product_packs
  for each row execute function public.sync_product_id_from_variant();

-- ===========================================================================
-- 3. product_with_default_variant compat view.
--    Returns one row per product with the default variant's stock/price/cost
--    hoisted to the top. v2.5 reads (search_products, product detail) consume
--    this view in §C of v2.6.
-- ===========================================================================

drop view if exists public.product_with_default_variant;
create view public.product_with_default_variant
with (security_invoker = true) as
select
  p.id              as product_id,
  p.shop_id         as shop_id,
  p.name            as name,
  p.category_id     as category_id,
  p.description     as description,
  p.type            as legacy_type_column,
  p.is_scan_only    as is_scan_only,
  p.is_active       as product_is_active,
  p.base_unit_id    as base_unit_id,
  p.created_at      as product_created_at,
  p.updated_at      as product_updated_at,
  v.id              as variant_id,
  v.sku             as sku,
  v.stock           as stock,
  v.price           as price,
  v.cost            as cost,
  v.avg_cost        as avg_cost,
  v.last_purchase_cost as last_purchase_cost,
  v.is_active       as variant_is_active
from public.products p
left join public.product_variants v
  on v.product_id = p.id and v.is_default and v.is_active;

-- ===========================================================================
-- 4. product_stock_display — rewrite to read stock from variants.
--    Keyed on variant_id now (variant is the row identity); product_id is
--    exposed for legacy callers that still join on it.
-- ===========================================================================

drop view if exists public.product_stock_display;
create view public.product_stock_display
with (security_invoker = true) as
select
  v.id              as variant_id,
  p.id              as product_id,
  p.shop_id         as shop_id,
  v.stock           as base_qty,
  bu.code           as base_unit_code,
  bu.name           as base_unit_name,
  p.is_scan_only    as is_scan_only,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'pack_id',           pk.id,
      'unit_code',         u.code,
      'unit_name',         u.name,
      'base_qty',          pk.base_qty,
      'whole_packs',       floor(v.stock::numeric / pk.base_qty)::int,
      'remainder_base',    (v.stock - floor(v.stock::numeric / pk.base_qty)::int * pk.base_qty)::int,
      'is_default_purchase', pk.is_default_purchase
    ) order by pk.base_qty desc), '[]'::jsonb)
    from public.product_packs pk
    join public.units_of_measure u on u.id = pk.unit_id
    where pk.variant_id = v.id and pk.is_active
  ) as pack_breakdown
from public.product_variants v
join public.products p on p.id = v.product_id
join public.units_of_measure bu on bu.id = p.base_unit_id
where v.is_active;
