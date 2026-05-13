-- 0089_v291_update_product_extended.sql
--
-- v2.9.1 cleanup (task #23) — extends update_product RPC to close the
-- last audit-coverage gap before RBAC_TEAM_UI_ENABLED flips for the pilot.
--
-- Phase D cluster 6 deferred useUpdateProduct migration because the hook
-- entangled three responsibilities the 0087 RPC didn't cover:
--   1. is_scan_only flag (product configuration)
--   2. has_batches toggle with cannot_enable_with_stock /
--      cannot_disable_with_active_batches guard rails
--   3. legacy products.type sync from category name (ADR-0019)
--
-- This migration moves all three server-side. Archive concerns
-- (`is_active`) intentionally stay out of update_product per the
-- "archive vs. edit semantics separated" rule — callers use the
-- existing archive_product RPC (mig 0087 §2.3) when they want to
-- toggle is_active.
--
-- Per-row locking: the products row is locked for update at the start
-- of the function. The variant.price write inside the same transaction
-- inherits the lock. Postgres function = single implicit transaction;
-- any RAISE inside rolls back the entire call (atomicity per D.6 spec).
--
-- AQ-23 conformance preserved: P1 not_authenticated, P2 no_shop_for_user,
-- P3 user_has_permission('edit_product'). Additional gates on
-- edit_product_expiry_overrides (when expiry/policy overrides change)
-- are layered atop, not replacing, the base gate.

begin;

drop function if exists public.update_product(
  uuid, text, text, uuid, numeric, int, int, public.expired_sale_policy
);

create or replace function public.update_product(
  p_id uuid,
  p_name text default null,
  p_description text default null,
  p_category_id uuid default null,
  p_price_for_default_variant numeric(12,2) default null,
  p_is_scan_only boolean default null,
  p_has_batches boolean default null,
  p_expiry_alert_days int default null,
  p_warranty_alert_days int default null,
  p_expired_sale_policy public.expired_sale_policy default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_prod_shop uuid;
  v_has_variants boolean;
  v_current_has_batches boolean;
  v_overrides_changing boolean := false;
  v_new_category_name text;
  v_stock_count int;
  v_active_batch_count int;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'edit_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: edit_product';
  end if;

  -- Lock the product row; subsequent variant/batch reads see consistent state
  select shop_id, has_variants, has_batches
    into v_prod_shop, v_has_variants, v_current_has_batches
    from public.products where id = p_id for update;
  if not found then raise exception 'product_not_found' using errcode = 'P0001'; end if;
  if v_prod_shop <> v_shop_id then raise exception 'product_not_in_shop' using errcode = 'P0001'; end if;

  -- Multi-variant products write prices per variant via update_variant_inline
  if p_price_for_default_variant is not null and v_has_variants then
    raise exception 'multi_variant_price_split' using errcode = 'P0001',
      detail = 'product has variants; update each variant via update_variant_inline';
  end if;

  -- Category check + capture name for products.type sync (ADR-0019)
  if p_category_id is not null then
    select name into v_new_category_name
      from public.product_categories
     where id = p_category_id and shop_id = v_shop_id and is_active;
    if v_new_category_name is null then
      raise exception 'category_not_in_shop' using errcode = 'P0001';
    end if;
  end if;

  -- Expiry/policy overrides require additional permission
  v_overrides_changing := (
    p_expiry_alert_days is not null or
    p_warranty_alert_days is not null or
    p_expired_sale_policy is not null
  );
  if v_overrides_changing
     and not public.user_has_permission(v_shop_id, 'edit_product_expiry_overrides') then
    raise exception 'insufficient_permissions' using errcode = 'P0001',
      detail = 'Required: edit_product_expiry_overrides';
  end if;

  if coalesce(trim(p_name), '') = '' and p_name is not null then
    raise exception 'name_required' using errcode = 'P0001'; end if;

  -- has_batches guard rails (moved server-side from useUpdateProduct hook)
  if p_has_batches is not null and p_has_batches is distinct from v_current_has_batches then
    if p_has_batches then
      -- false → true: every variant must have stock = 0
      select count(*) into v_stock_count
        from public.product_variants
       where product_id = p_id and stock > 0;
      if v_stock_count > 0 then
        raise exception 'cannot_enable_batches_with_stock' using errcode = 'P0001';
      end if;
    else
      -- true → false: no active batches on any variant
      select count(*) into v_active_batch_count
        from public.inventory_batches b
        join public.product_variants v on v.id = b.variant_id
       where v.product_id = p_id and b.is_active;
      if v_active_batch_count > 0 then
        raise exception 'cannot_disable_batches_with_active_batches' using errcode = 'P0001';
      end if;
    end if;
  end if;

  update public.products set
    name = coalesce(nullif(trim(p_name), ''), name),
    description = case when p_description is not null then nullif(trim(p_description), '') else description end,
    category_id = coalesce(p_category_id, category_id),
    -- ADR-0019: keep legacy products.type in sync with category name
    type = case when v_new_category_name is not null then v_new_category_name else type end,
    is_scan_only = coalesce(p_is_scan_only, is_scan_only),
    has_batches = coalesce(p_has_batches, has_batches),
    expiry_alert_days = case when p_expiry_alert_days is not null then p_expiry_alert_days else expiry_alert_days end,
    warranty_alert_days = case when p_warranty_alert_days is not null then p_warranty_alert_days else warranty_alert_days end,
    expired_sale_policy = case when p_expired_sale_policy is not null then p_expired_sale_policy else expired_sale_policy end,
    updated_at = now(),
    updated_by_user_id = auth.uid()
   where id = p_id;

  if p_price_for_default_variant is not null then
    -- has_variants=false guaranteed by raise above; write default variant price
    update public.product_variants set
      price = p_price_for_default_variant,
      updated_at = now(),
      updated_by_user_id = auth.uid()
     where product_id = p_id and is_default and is_active;
    if not found then
      raise exception 'default_variant_missing' using errcode = 'P0001',
        detail = 'product has no active default variant';
    end if;
  end if;
end;
$fn$;

revoke execute on function public.update_product(
  uuid, text, text, uuid, numeric, boolean, boolean, int, int, public.expired_sale_policy
) from public, anon;

grant execute on function public.update_product(
  uuid, text, text, uuid, numeric, boolean, boolean, int, int, public.expired_sale_policy
) to authenticated;

commit;

-- POST-APPLY VERIFICATION
--   1. AQ-23 must return 0 (new signature still has P1+P2+P3 gates).
--   2. AQ-01..AQ-22, AQ-24, INV-ledger-0086 must still return 0.
--   3. Regenerate src/types/database.ts so the new signature is in TS.
