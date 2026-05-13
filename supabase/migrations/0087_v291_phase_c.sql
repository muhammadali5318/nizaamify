-- 0087_v291_phase_c.sql
--
-- v2.9.1 Phase C — schema + 11 new RPCs + AQ-24 documentation.
--
-- Closes the remaining v2.9 audit-coverage gap. The 11 RPCs:
--   1.  update_customer            (gated edit_customer; tier change gated assign_customer_tier)
--   2.  update_product             (gated edit_product; expiry overrides gated edit_product_expiry_overrides)
--   3.  archive_product            (gated archive_product; cascades to variants)
--   4.  update_variant_inline      (gated edit_product for sku/price, archive_product for is_active)
--   5.  update_supplier            (gated manage_suppliers)
--   6.  archive_supplier           (gated manage_suppliers)
--   7.  get_active_shop            (returns id + name + is_owner; replaces useShop() owner-only filter)
--   8.  get_shop_settings          (operational defaults; excludes salesperson_payment_cap_pkr per D.3)
--   9.  list_pending_invitations_for_shop  (gated view_team; closes RLS-vs-catalog gap from Phase A.2 §8.1)
--  10.  list_permission_audit_for_shop     (gated view_user_audit_log; full JSONB per D.4)
--  11.  get_team_member_profiles   (gated view_team; DEFINER helper; replaces 0083-dropped inline EXISTS)
--
-- Per design/2026-05-13-v291-page-permission-map.md §5 + Phase A.5 commitments.
-- Per ADR rule: each RPC carries P1 (not_authenticated) + P2 (no_shop_for_user)
-- + P3 (user_has_permission) gates so AQ-23 conformance is preserved.
--
-- Schema additive (one column): customers.updated_by_user_id — the v2.9 migration
-- 0072 added _by_user_id columns to most tables but missed customers. Adding it
-- here so update_customer writes a complete audit trail. Idempotent.
--
-- AQ-24 audit query — authoritative version lives in
--   design/2026-05-13-rbac-attack-surface.md §C.3 (added post-apply 2026-05-13).
--   Baseline allowlist: 38 _v28 inner functions (ADR rule preserves bodies) +
--   2 pre-v2.9 views (daily_sales_7, expenses_by_category_mtd — v2.10 cleanup).
--   Any NEW SQL outside the allowlist that references current_shop_id() is a
--   discipline violation; v2.9.1+ code must call current_active_shop_id().

begin;

-- =====================================================================
-- Section 1 — Schema additive
-- =====================================================================

alter table public.customers
  add column if not exists updated_by_user_id uuid
    references auth.users(id) on delete restrict;

comment on column public.customers.updated_by_user_id is
  'v2.9.1 Phase C (mig 0087) — last user who modified this row via update_customer RPC.';

-- =====================================================================
-- Section 2 — UPDATE wrappers (5 functions)
-- =====================================================================

-- 2.1 update_customer ---------------------------------------------------
create or replace function public.update_customer(
  p_id uuid,
  p_name text default null,
  p_phone text default null,
  p_address text default null,
  p_notes text default null,
  p_tier_id uuid default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_cust_shop uuid;
  v_current_tier uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'edit_customer') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: edit_customer';
  end if;

  select shop_id, tier_id into v_cust_shop, v_current_tier
    from public.customers where id = p_id for update;
  if not found then raise exception 'customer_not_found' using errcode = 'P0001'; end if;
  if v_cust_shop <> v_shop_id then raise exception 'customer_not_in_shop' using errcode = 'P0001'; end if;

  -- Tier change requires assign_customer_tier; null = no change
  if p_tier_id is not null and p_tier_id is distinct from v_current_tier
     and not public.user_has_permission(v_shop_id, 'assign_customer_tier') then
    raise exception 'insufficient_permissions' using errcode = 'P0001',
      detail = 'Required: assign_customer_tier (to change tier_id)';
  end if;
  if p_tier_id is not null and p_tier_id is distinct from v_current_tier and not exists (
    select 1 from public.customer_tiers where id = p_tier_id and shop_id = v_shop_id and is_active
  ) then raise exception 'tier_not_in_shop' using errcode = 'P0001'; end if;

  if coalesce(trim(p_name), '') = '' and p_name is not null then
    raise exception 'name_required' using errcode = 'P0001'; end if;
  if coalesce(trim(p_phone), '') = '' and p_phone is not null then
    raise exception 'phone_required' using errcode = 'P0001'; end if;

  begin
    update public.customers set
      name = coalesce(nullif(trim(p_name), ''), name),
      phone = coalesce(nullif(trim(p_phone), ''), phone),
      address = case when p_address is not null then nullif(trim(p_address), '') else address end,
      notes = case when p_notes is not null then nullif(trim(p_notes), '') else notes end,
      tier_id = coalesce(p_tier_id, tier_id),
      updated_at = now(),
      updated_by_user_id = auth.uid()
     where id = p_id;
  exception when unique_violation then
    raise exception 'duplicate_phone_in_shop' using errcode = 'P0001';
  end;
end;
$fn$;

revoke execute on function public.update_customer(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.update_customer(uuid, text, text, text, text, uuid) to authenticated;

-- 2.2 update_product ----------------------------------------------------
-- Per D.1: handles header + default variant price atomically when has_variants=false.
-- Raises multi_variant_price_split if has_variants=true AND p_price_for_default_variant is set.
create or replace function public.update_product(
  p_id uuid,
  p_name text default null,
  p_description text default null,
  p_category_id uuid default null,
  p_price_for_default_variant numeric(12,2) default null,
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
  v_overrides_changing boolean := false;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'edit_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: edit_product';
  end if;

  select shop_id, has_variants
    into v_prod_shop, v_has_variants
    from public.products where id = p_id for update;
  if not found then raise exception 'product_not_found' using errcode = 'P0001'; end if;
  if v_prod_shop <> v_shop_id then raise exception 'product_not_in_shop' using errcode = 'P0001'; end if;

  if p_price_for_default_variant is not null and v_has_variants then
    raise exception 'multi_variant_price_split' using errcode = 'P0001',
      detail = 'product has variants; update each variant via update_variant_inline';
  end if;

  -- Category check (if changing): must belong to shop
  if p_category_id is not null and not exists (
    select 1 from public.product_categories where id = p_category_id and shop_id = v_shop_id and is_active
  ) then raise exception 'category_not_in_shop' using errcode = 'P0001'; end if;

  -- Expiry/policy overrides require edit_product_expiry_overrides (if any value provided)
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

  update public.products set
    name = coalesce(nullif(trim(p_name), ''), name),
    description = case when p_description is not null then nullif(trim(p_description), '') else description end,
    category_id = coalesce(p_category_id, category_id),
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

revoke execute on function public.update_product(uuid, text, text, uuid, numeric, int, int, public.expired_sale_policy) from public, anon;
grant execute on function public.update_product(uuid, text, text, uuid, numeric, int, int, public.expired_sale_policy) to authenticated;

-- 2.3 archive_product ---------------------------------------------------
-- Per D.2: cascades to all variants of this product.
create or replace function public.archive_product(
  p_id uuid,
  p_is_active boolean
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_prod_shop uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'archive_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: archive_product';
  end if;
  if p_is_active is null then raise exception 'is_active_required' using errcode = 'P0001'; end if;

  select shop_id into v_prod_shop from public.products where id = p_id for update;
  if not found then raise exception 'product_not_found' using errcode = 'P0001'; end if;
  if v_prod_shop <> v_shop_id then raise exception 'product_not_in_shop' using errcode = 'P0001'; end if;

  update public.products set
    is_active = p_is_active,
    updated_at = now(),
    updated_by_user_id = auth.uid()
   where id = p_id;

  -- Cascade to all variants
  update public.product_variants set
    is_active = p_is_active,
    updated_at = now(),
    updated_by_user_id = auth.uid()
   where product_id = p_id;
end;
$fn$;

revoke execute on function public.archive_product(uuid, boolean) from public, anon;
grant execute on function public.archive_product(uuid, boolean) to authenticated;

-- 2.4 update_variant_inline ---------------------------------------------
-- Per page audit: split between edit_product (sku/price) + archive_product (is_active).
create or replace function public.update_variant_inline(
  p_variant_id uuid,
  p_sku text default null,
  p_price numeric(12,2) default null,
  p_is_active boolean default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_variant_shop uuid;
  v_current_is_active boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;

  select p.shop_id, v.is_active
    into v_variant_shop, v_current_is_active
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where v.id = p_variant_id for update of v;
  if not found then raise exception 'variant_not_found' using errcode = 'P0001'; end if;
  if v_variant_shop <> v_shop_id then raise exception 'variant_not_in_shop' using errcode = 'P0001'; end if;

  -- sku/price change requires edit_product
  if (p_sku is not null or p_price is not null)
     and not public.user_has_permission(v_shop_id, 'edit_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: edit_product';
  end if;
  -- is_active change requires archive_product
  if p_is_active is not null and p_is_active is distinct from v_current_is_active
     and not public.user_has_permission(v_shop_id, 'archive_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: archive_product';
  end if;

  update public.product_variants set
    sku = case when p_sku is not null then nullif(trim(p_sku), '') else sku end,
    price = case when p_price is not null then p_price else price end,
    is_active = coalesce(p_is_active, is_active),
    updated_at = now(),
    updated_by_user_id = auth.uid()
   where id = p_variant_id;
end;
$fn$;

revoke execute on function public.update_variant_inline(uuid, text, numeric, boolean) from public, anon;
grant execute on function public.update_variant_inline(uuid, text, numeric, boolean) to authenticated;

-- 2.5 update_supplier ---------------------------------------------------
create or replace function public.update_supplier(
  p_id uuid,
  p_name text default null,
  p_contact text default null,
  p_address text default null,
  p_notes text default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_sup_shop uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_suppliers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_suppliers';
  end if;

  select shop_id into v_sup_shop from public.suppliers where id = p_id for update;
  if not found then raise exception 'supplier_not_found' using errcode = 'P0001'; end if;
  if v_sup_shop <> v_shop_id then raise exception 'supplier_not_in_shop' using errcode = 'P0001'; end if;

  if coalesce(trim(p_name), '') = '' and p_name is not null then
    raise exception 'name_required' using errcode = 'P0001'; end if;

  begin
    update public.suppliers set
      name = coalesce(nullif(trim(p_name), ''), name),
      contact = case when p_contact is not null then nullif(trim(p_contact), '') else contact end,
      address = case when p_address is not null then nullif(trim(p_address), '') else address end,
      notes = case when p_notes is not null then nullif(trim(p_notes), '') else notes end,
      updated_at = now(),
      updated_by_user_id = auth.uid()
     where id = p_id;
  exception when unique_violation then
    raise exception 'duplicate_supplier_name_contact' using errcode = 'P0001';
  end;
end;
$fn$;

revoke execute on function public.update_supplier(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_supplier(uuid, text, text, text, text) to authenticated;

-- 2.6 archive_supplier --------------------------------------------------
create or replace function public.archive_supplier(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_sup_shop uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_suppliers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_suppliers';
  end if;

  select shop_id into v_sup_shop from public.suppliers where id = p_id for update;
  if not found then raise exception 'supplier_not_found' using errcode = 'P0001'; end if;
  if v_sup_shop <> v_shop_id then raise exception 'supplier_not_in_shop' using errcode = 'P0001'; end if;

  update public.suppliers set
    is_active = false,
    updated_at = now(),
    updated_by_user_id = auth.uid()
   where id = p_id;
end;
$fn$;

revoke execute on function public.archive_supplier(uuid) from public, anon;
grant execute on function public.archive_supplier(uuid) to authenticated;

-- =====================================================================
-- Section 3 — Read helpers
-- =====================================================================

-- 3.1 get_active_shop ---------------------------------------------------
-- Returns id + name + is_owner for the active shop. Replaces useShop()'s
-- broken owner_user_id filter (silent break for non-owner team members).
-- No permission gate beyond shop access — every authenticated team member
-- needs to know which shop they're viewing.
create or replace function public.get_active_shop()
returns table(shop_id uuid, shop_name text, is_owner boolean)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  return query
    select s.id, s.shop_name, usa.is_owner
      from public.shops s
      join public.user_shop_access usa
        on usa.shop_id = s.id and usa.user_id = auth.uid()
     where s.id = v_shop_id;
end;
$fn$;

revoke execute on function public.get_active_shop() from public, anon;
grant execute on function public.get_active_shop() to authenticated;

-- 3.2 get_shop_settings -------------------------------------------------
-- Per D.3: operational defaults only. salesperson_payment_cap_pkr is NOT
-- included here — it's a staff-management setting (Settings → Team → Shop
-- defaults per B.8). No permission gate; every team member who uses
-- batch features needs to read shop alert windows.
create or replace function public.get_shop_settings()
returns table(
  default_expiry_alert_days int,
  default_warranty_alert_days int,
  default_expired_sale_policy public.expired_sale_policy,
  expired_sale_receipt_disclaimer boolean
)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  return query
    select s.default_expiry_alert_days, s.default_warranty_alert_days,
           s.default_expired_sale_policy, s.expired_sale_receipt_disclaimer
      from public.shops s where s.id = v_shop_id;
end;
$fn$;

revoke execute on function public.get_shop_settings() from public, anon;
grant execute on function public.get_shop_settings() to authenticated;

-- =====================================================================
-- Section 4 — Team list RPCs (closes Phase A.2 §8.1 catalog-vs-RLS gap)
-- =====================================================================

-- 4.1 list_pending_invitations_for_shop ---------------------------------
-- Catalog says view_team should suffice; pending_invitations RLS is
-- owner-only (defense in depth). This DEFINER wrapper bridges the gap.
-- Projects: identifier columns + invited_by_email; does NOT project
-- confirmation_code (sensitive — only the invitee's accept flow uses it).
-- Does NOT project permissions JSONB (resolved at accept time).
create or replace function public.list_pending_invitations_for_shop()
returns table(
  id uuid,
  email text,
  preset_applied text,
  invited_by_user_id uuid,
  invited_by_email text,
  status public.invitation_status,
  failed_attempts int,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_team') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_team';
  end if;
  return query
    select pi.id, pi.email, pi.preset_applied, pi.invited_by_user_id,
           p.email, pi.status, pi.failed_attempts, pi.expires_at, pi.created_at
      from public.pending_invitations pi
      left join public.profiles p on p.id = pi.invited_by_user_id
     where pi.shop_id = v_shop_id
     order by pi.created_at desc;
end;
$fn$;

revoke execute on function public.list_pending_invitations_for_shop() from public, anon;
grant execute on function public.list_pending_invitations_for_shop() to authenticated;

-- 4.2 list_permission_audit_for_shop ------------------------------------
-- Gated on view_user_audit_log. Projects full JSONB diff per D.4.
-- Paginated; default 100/page.
create or replace function public.list_permission_audit_for_shop(
  p_limit int default 100,
  p_offset int default 0
) returns table(
  id uuid,
  target_user_id uuid,
  target_email text,
  actor_user_id uuid,
  actor_email text,
  permission_key text,
  old_granted boolean,
  new_granted boolean,
  old_value jsonb,
  new_value jsonb,
  action text,
  reason text,
  changed_at timestamptz
)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_user_audit_log') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_user_audit_log';
  end if;
  if p_limit is null or p_limit <= 0 or p_limit > 500 then
    raise exception 'limit_out_of_range' using errcode = 'P0001', detail = 'limit must be 1..500';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset_invalid' using errcode = 'P0001'; end if;
  return query
    select uspa.id, uspa.target_user_id, pt.email, uspa.actor_user_id, pa.email,
           uspa.permission_key, uspa.old_granted, uspa.new_granted,
           uspa.old_value, uspa.new_value, uspa.action, uspa.reason, uspa.changed_at
      from public.user_shop_permission_audit uspa
      left join public.profiles pt on pt.id = uspa.target_user_id
      left join public.profiles pa on pa.id = uspa.actor_user_id
     where uspa.shop_id = v_shop_id
     order by uspa.changed_at desc
     limit p_limit offset p_offset;
end;
$fn$;

revoke execute on function public.list_permission_audit_for_shop(int, int) from public, anon;
grant execute on function public.list_permission_audit_for_shop(int, int) to authenticated;

-- =====================================================================
-- Section 5 — Team-read DEFINER helper (closes 0083 backlog)
-- =====================================================================

-- 5.1 get_team_member_profiles ------------------------------------------
-- Returns profile rows for the active shop's team only. Silently filters
-- out any user_id not in user_shop_access for this shop (don't reveal
-- cross-shop or non-team identities). Replaces the dropped inline EXISTS
-- v29_profiles_team_read policy from migration 0083.
create or replace function public.get_team_member_profiles(p_user_ids uuid[])
returns table(id uuid, email text, preferred_language text)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_team') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_team';
  end if;
  if p_user_ids is null then return; end if;
  return query
    select p.id, p.email, p.preferred_language
      from public.profiles p
     where p.id = any(p_user_ids)
       and exists (
         select 1 from public.user_shop_access usa
          where usa.user_id = p.id and usa.shop_id = v_shop_id
       );
end;
$fn$;

revoke execute on function public.get_team_member_profiles(uuid[]) from public, anon;
grant execute on function public.get_team_member_profiles(uuid[]) to authenticated;

commit;

-- =====================================================================
-- POST-APPLY VERIFICATION (run via MCP after migration applies)
-- =====================================================================
--
-- 1. Re-run AQ-01..AQ-23 — all must return 0.
-- 2. Run AQ-24 (above) — must return 0.
-- 3. Run new conformance check on the 11 new RPCs:
--      WITH new_rpcs(name) AS (VALUES
--        ('update_customer'),('update_product'),('archive_product'),
--        ('update_variant_inline'),('update_supplier'),('archive_supplier'),
--        ('get_active_shop'),('get_shop_settings'),
--        ('list_pending_invitations_for_shop'),
--        ('list_permission_audit_for_shop'),
--        ('get_team_member_profiles')
--      )
--      SELECT n.name,
--             body ~ 'not_authenticated' AS has_p1,
--             body ~ 'no_shop_for_user'  AS has_p2,
--             body ~ 'user_has_permission' AS has_p3
--        FROM new_rpcs n
--        JOIN pg_proc p ON p.proname = n.name
--        CROSS JOIN LATERAL (SELECT pg_get_functiondef(p.oid) AS body) b
--       WHERE NOT (body ~ 'not_authenticated' AND body ~ 'no_shop_for_user'
--                  AND body ~ 'user_has_permission');
--      -- Should return 0 rows — except get_active_shop and get_shop_settings
--      -- which intentionally lack the user_has_permission gate (they're
--      -- shop-membership-gated, not permission-gated).
-- 4. Regenerate src/types/database.ts via mcp__supabase__generate_typescript_types
-- 5. mcp__supabase__get_advisors(type='security') — only the documented
--    ADR-0011 warnings should appear; anything new merits investigation.
