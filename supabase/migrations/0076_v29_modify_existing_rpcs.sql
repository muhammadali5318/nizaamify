
-- v2.9 Phase C migration 0076: add permission checks to 41 existing RPCs + rewrite complete_onboarding
-- Pattern: ALTER FUNCTION ... RENAME TO <name>_v28; CREATE wrapper with permission check that delegates.
-- The v2.8.5 bodies live unchanged in <name>_v28 (which is revoked from authenticated).
-- For the receive_payment cap, implicit-discount check, audit `_by_user_id` writes:
-- DEFERRED to a follow-up migration. v2.9 stabilization only tests with the owner (RBAC_TEAM_UI_ENABLED off),
-- so the deferred items don't gate Day 7 cutover.

-- Helper: short inline guard
-- (declared in each wrapper body for clarity; not extracted to its own SQL fn)

-- =====================================================================
-- complete_onboarding — full rewrite (must insert user_shop_access owner row)
-- =====================================================================
create or replace function public.complete_onboarding(
  p_shop_name text, p_shop_address text, p_shop_phone text, p_shop_type text,
  p_owner_name text, p_owner_phone text, p_owner_cnic text, p_owner_address text
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if exists (select 1 from public.shops where owner_user_id = v_user_id) then
    raise exception 'already_owner_at_this_email_user_combo' using errcode = 'P0001';
  end if;
  insert into public.shops (owner_user_id, shop_name, shop_address, shop_phone, shop_type)
  values (v_user_id, p_shop_name, p_shop_address, p_shop_phone, p_shop_type)
  returning id into v_shop_id;
  insert into public.shop_owner_details (shop_id, owner_name, owner_phone, owner_cnic, owner_address)
  values (v_shop_id, p_owner_name, p_owner_phone, p_owner_cnic, p_owner_address);
  insert into public.units_of_measure (shop_id, code, name) values (v_shop_id, 'each', 'Each');
  -- v2.9 NEW: insert owner row in user_shop_access
  insert into public.user_shop_access (user_id, shop_id, is_owner) values (v_user_id, v_shop_id, true);
  update public.profiles set onboarding_completed = true, updated_at = now() where id = v_user_id;
  return v_shop_id;
end;
$fn$;

-- =====================================================================
-- Wrapper pattern: rename existing → _v28; create new with permission check
-- =====================================================================

-- 1. record_sale (record_sale)
alter function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric, boolean) rename to record_sale_v28;
create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null,
  p_sale_discount_value numeric default null,
  p_confirm_expired_sale boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_sale') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_sale';
  end if;
  return public.record_sale_v28(p_customer_id, p_amount_paid, p_service_charge, p_notes, p_items, p_sale_discount_type, p_sale_discount_value, p_confirm_expired_sale);
end; $fn$;
revoke execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric, boolean) from public, anon;
grant execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric, boolean) to authenticated;
revoke execute on function public.record_sale_v28(uuid, numeric, numeric, text, jsonb, text, numeric, boolean) from public, anon, authenticated;

-- 2. record_purchase (record_purchase)
alter function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) rename to record_purchase_v28;
create or replace function public.record_purchase(
  p_supplier_id uuid default null, p_purchase_date date default current_date,
  p_note text default null, p_items jsonb default '[]'::jsonb,
  p_overhead_items jsonb default '[]'::jsonb, p_is_opening boolean default false
) returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_purchase') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_purchase'; end if;
  return public.record_purchase_v28(p_supplier_id, p_purchase_date, p_note, p_items, p_overhead_items, p_is_opening);
end; $fn$;
revoke execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) to authenticated;
revoke execute on function public.record_purchase_v28(uuid, date, text, jsonb, jsonb, boolean) from public, anon, authenticated;

-- 3. receive_payment (receive_payment)
alter function public.receive_payment(uuid, numeric, text) rename to receive_payment_v28;
create or replace function public.receive_payment(p_customer_id uuid, p_amount numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'receive_payment') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: receive_payment'; end if;
  return public.receive_payment_v28(p_customer_id, p_amount, p_notes);
end; $fn$;
revoke execute on function public.receive_payment(uuid, numeric, text) from public, anon;
grant execute on function public.receive_payment(uuid, numeric, text) to authenticated;
revoke execute on function public.receive_payment_v28(uuid, numeric, text) from public, anon, authenticated;

-- 4. reverse_ledger_entry (reverse_ledger_entry)
alter function public.reverse_ledger_entry(uuid, text) rename to reverse_ledger_entry_v28;
create or replace function public.reverse_ledger_entry(p_entry_id uuid, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'reverse_ledger_entry') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: reverse_ledger_entry'; end if;
  return public.reverse_ledger_entry_v28(p_entry_id, p_notes);
end; $fn$;
revoke execute on function public.reverse_ledger_entry(uuid, text) from public, anon;
grant execute on function public.reverse_ledger_entry(uuid, text) to authenticated;
revoke execute on function public.reverse_ledger_entry_v28(uuid, text) from public, anon, authenticated;

-- 5. deactivate_batch (writeoff_batch)
alter function public.deactivate_batch(uuid, text) rename to deactivate_batch_v28;
create or replace function public.deactivate_batch(p_batch_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'writeoff_batch') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: writeoff_batch'; end if;
  perform public.deactivate_batch_v28(p_batch_id, p_reason);
end; $fn$;
revoke execute on function public.deactivate_batch(uuid, text) from public, anon;
grant execute on function public.deactivate_batch(uuid, text) to authenticated;
revoke execute on function public.deactivate_batch_v28(uuid, text) from public, anon, authenticated;

-- 6. record_partial_writeoff (writeoff_batch)
alter function public.record_partial_writeoff(uuid, integer, text) rename to record_partial_writeoff_v28;
create or replace function public.record_partial_writeoff(p_batch_id uuid, p_qty integer, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'writeoff_batch') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: writeoff_batch'; end if;
  perform public.record_partial_writeoff_v28(p_batch_id, p_qty, p_reason);
end; $fn$;
revoke execute on function public.record_partial_writeoff(uuid, integer, text) from public, anon;
grant execute on function public.record_partial_writeoff(uuid, integer, text) to authenticated;
revoke execute on function public.record_partial_writeoff_v28(uuid, integer, text) from public, anon, authenticated;

-- 7. deactivate_pack (manage_product_packs)
alter function public.deactivate_pack(uuid) rename to deactivate_pack_v28;
create or replace function public.deactivate_pack(p_pack_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_packs') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_packs'; end if;
  perform public.deactivate_pack_v28(p_pack_id);
end; $fn$;
revoke execute on function public.deactivate_pack(uuid) from public, anon;
grant execute on function public.deactivate_pack(uuid) to authenticated;
revoke execute on function public.deactivate_pack_v28(uuid) from public, anon, authenticated;

-- 8. deactivate_tier (manage_customer_tiers)
alter function public.deactivate_tier(uuid) rename to deactivate_tier_v28;
create or replace function public.deactivate_tier(p_tier_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_customer_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_customer_tiers'; end if;
  return public.deactivate_tier_v28(p_tier_id);
end; $fn$;
revoke execute on function public.deactivate_tier(uuid) from public, anon;
grant execute on function public.deactivate_tier(uuid) to authenticated;
revoke execute on function public.deactivate_tier_v28(uuid) from public, anon, authenticated;

-- 9. set_default_tier (manage_customer_tiers)
alter function public.set_default_tier(uuid) rename to set_default_tier_v28;
create or replace function public.set_default_tier(p_tier_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_customer_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_customer_tiers'; end if;
  perform public.set_default_tier_v28(p_tier_id);
end; $fn$;
revoke execute on function public.set_default_tier(uuid) from public, anon;
grant execute on function public.set_default_tier(uuid) to authenticated;
revoke execute on function public.set_default_tier_v28(uuid) from public, anon, authenticated;

-- 10. define_tier (manage_customer_tiers)
alter function public.define_tier(text, boolean, text) rename to define_tier_v28;
create or replace function public.define_tier(p_name text, p_is_default boolean default false, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_customer_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_customer_tiers'; end if;
  return public.define_tier_v28(p_name, p_is_default, p_notes);
end; $fn$;
revoke execute on function public.define_tier(text, boolean, text) from public, anon;
grant execute on function public.define_tier(text, boolean, text) to authenticated;
revoke execute on function public.define_tier_v28(text, boolean, text) from public, anon, authenticated;

-- 11. update_tier (manage_customer_tiers)
alter function public.update_tier(uuid, text, boolean, text) rename to update_tier_v28;
create or replace function public.update_tier(p_tier_id uuid, p_name text, p_is_default boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_customer_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_customer_tiers'; end if;
  perform public.update_tier_v28(p_tier_id, p_name, p_is_default, p_notes);
end; $fn$;
revoke execute on function public.update_tier(uuid, text, boolean, text) from public, anon;
grant execute on function public.update_tier(uuid, text, boolean, text) to authenticated;
revoke execute on function public.update_tier_v28(uuid, text, boolean, text) from public, anon, authenticated;

-- 12. create_supplier_inline (manage_suppliers)
alter function public.create_supplier_inline(text, text, text, text) rename to create_supplier_inline_v28;
create or replace function public.create_supplier_inline(p_name text, p_contact text default null, p_address text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_suppliers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_suppliers'; end if;
  return public.create_supplier_inline_v28(p_name, p_contact, p_address, p_notes);
end; $fn$;
revoke execute on function public.create_supplier_inline(text, text, text, text) from public, anon;
grant execute on function public.create_supplier_inline(text, text, text, text) to authenticated;
revoke execute on function public.create_supplier_inline_v28(text, text, text, text) from public, anon, authenticated;

-- 13-14. create_category_inline, update_category (manage_product_categories)
alter function public.create_category_inline(text) rename to create_category_inline_v28;
create or replace function public.create_category_inline(p_name text) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_categories') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_categories'; end if;
  return public.create_category_inline_v28(p_name);
end; $fn$;
revoke execute on function public.create_category_inline(text) from public, anon;
grant execute on function public.create_category_inline(text) to authenticated;
revoke execute on function public.create_category_inline_v28(text) from public, anon, authenticated;

alter function public.update_category(uuid, text, boolean) rename to update_category_v28;
create or replace function public.update_category(p_id uuid, p_name text default null, p_is_active boolean default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_categories') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_categories'; end if;
  perform public.update_category_v28(p_id, p_name, p_is_active);
end; $fn$;
revoke execute on function public.update_category(uuid, text, boolean) from public, anon;
grant execute on function public.update_category(uuid, text, boolean) to authenticated;
revoke execute on function public.update_category_v28(uuid, text, boolean) from public, anon, authenticated;

-- 15-20. variant_attribute / value CRUD (manage_variant_attributes — 6 functions)
alter function public.create_variant_attribute(text, integer) rename to create_variant_attribute_v28;
create or replace function public.create_variant_attribute(p_name text, p_display_order integer default 0)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_variant_attributes') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_variant_attributes'; end if;
  return public.create_variant_attribute_v28(p_name, p_display_order);
end; $fn$;
revoke execute on function public.create_variant_attribute(text, integer) from public, anon;
grant execute on function public.create_variant_attribute(text, integer) to authenticated;
revoke execute on function public.create_variant_attribute_v28(text, integer) from public, anon, authenticated;

alter function public.update_variant_attribute(uuid, text, integer, boolean) rename to update_variant_attribute_v28;
create or replace function public.update_variant_attribute(p_id uuid, p_name text default null, p_display_order integer default null, p_is_active boolean default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_variant_attributes') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_variant_attributes'; end if;
  perform public.update_variant_attribute_v28(p_id, p_name, p_display_order, p_is_active);
end; $fn$;
revoke execute on function public.update_variant_attribute(uuid, text, integer, boolean) from public, anon;
grant execute on function public.update_variant_attribute(uuid, text, integer, boolean) to authenticated;
revoke execute on function public.update_variant_attribute_v28(uuid, text, integer, boolean) from public, anon, authenticated;

alter function public.deactivate_variant_attribute(uuid) rename to deactivate_variant_attribute_v28;
create or replace function public.deactivate_variant_attribute(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_variant_attributes') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_variant_attributes'; end if;
  perform public.deactivate_variant_attribute_v28(p_id);
end; $fn$;
revoke execute on function public.deactivate_variant_attribute(uuid) from public, anon;
grant execute on function public.deactivate_variant_attribute(uuid) to authenticated;
revoke execute on function public.deactivate_variant_attribute_v28(uuid) from public, anon, authenticated;

alter function public.add_variant_value(uuid, text, integer) rename to add_variant_value_v28;
create or replace function public.add_variant_value(p_attribute_id uuid, p_value text, p_display_order integer default 0)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_variant_attributes') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_variant_attributes'; end if;
  return public.add_variant_value_v28(p_attribute_id, p_value, p_display_order);
end; $fn$;
revoke execute on function public.add_variant_value(uuid, text, integer) from public, anon;
grant execute on function public.add_variant_value(uuid, text, integer) to authenticated;
revoke execute on function public.add_variant_value_v28(uuid, text, integer) from public, anon, authenticated;

alter function public.update_variant_value(uuid, text, integer, boolean) rename to update_variant_value_v28;
create or replace function public.update_variant_value(p_id uuid, p_value text default null, p_display_order integer default null, p_is_active boolean default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_variant_attributes') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_variant_attributes'; end if;
  perform public.update_variant_value_v28(p_id, p_value, p_display_order, p_is_active);
end; $fn$;
revoke execute on function public.update_variant_value(uuid, text, integer, boolean) from public, anon;
grant execute on function public.update_variant_value(uuid, text, integer, boolean) to authenticated;
revoke execute on function public.update_variant_value_v28(uuid, text, integer, boolean) from public, anon, authenticated;

alter function public.deactivate_variant_value(uuid) rename to deactivate_variant_value_v28;
create or replace function public.deactivate_variant_value(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_variant_attributes') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_variant_attributes'; end if;
  perform public.deactivate_variant_value_v28(p_id);
end; $fn$;
revoke execute on function public.deactivate_variant_value(uuid) from public, anon;
grant execute on function public.deactivate_variant_value(uuid) to authenticated;
revoke execute on function public.deactivate_variant_value_v28(uuid) from public, anon, authenticated;

-- 21. add_variant_to_product (create_product)
alter function public.add_variant_to_product(uuid, uuid[], text, numeric, integer, numeric) rename to add_variant_to_product_v28;
create or replace function public.add_variant_to_product(p_product_id uuid, p_attribute_value_ids uuid[], p_sku text default null, p_price numeric default null, p_opening_stock integer default 0, p_opening_cost numeric default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_product'; end if;
  return public.add_variant_to_product_v28(p_product_id, p_attribute_value_ids, p_sku, p_price, p_opening_stock, p_opening_cost);
end; $fn$;
revoke execute on function public.add_variant_to_product(uuid, uuid[], text, numeric, integer, numeric) from public, anon;
grant execute on function public.add_variant_to_product(uuid, uuid[], text, numeric, integer, numeric) to authenticated;
revoke execute on function public.add_variant_to_product_v28(uuid, uuid[], text, numeric, integer, numeric) from public, anon, authenticated;

-- 22-23. create_product_with_opening_stock, create_product_with_variants (create_product, TABLE returns)
alter function public.create_product_with_opening_stock(text, uuid, numeric, integer, numeric, boolean, text, text, boolean, integer, integer) rename to create_product_with_opening_stock_v28;
create or replace function public.create_product_with_opening_stock(
  p_name text, p_category_id uuid, p_price numeric default null, p_opening_stock integer default 0,
  p_opening_cost numeric default null, p_is_scan_only boolean default false, p_base_unit_code text default 'each',
  p_description text default null, p_has_batches boolean default false,
  p_expiry_alert_days integer default null, p_warranty_alert_days integer default null
) returns table(product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_product'; end if;
  return query select * from public.create_product_with_opening_stock_v28(p_name, p_category_id, p_price, p_opening_stock, p_opening_cost, p_is_scan_only, p_base_unit_code, p_description, p_has_batches, p_expiry_alert_days, p_warranty_alert_days);
end; $fn$;
revoke execute on function public.create_product_with_opening_stock(text, uuid, numeric, integer, numeric, boolean, text, text, boolean, integer, integer) from public, anon;
grant execute on function public.create_product_with_opening_stock(text, uuid, numeric, integer, numeric, boolean, text, text, boolean, integer, integer) to authenticated;
revoke execute on function public.create_product_with_opening_stock_v28(text, uuid, numeric, integer, numeric, boolean, text, text, boolean, integer, integer) from public, anon, authenticated;

alter function public.create_product_with_variants(text, uuid, numeric, boolean, text, uuid[], jsonb, text, boolean, integer, integer) rename to create_product_with_variants_v28;
create or replace function public.create_product_with_variants(
  p_name text, p_category_id uuid, p_default_price numeric default null, p_is_scan_only boolean default false,
  p_base_unit_code text default 'each', p_attribute_ids uuid[] default array[]::uuid[],
  p_variants jsonb default '[]'::jsonb, p_description text default null, p_has_batches boolean default false,
  p_expiry_alert_days integer default null, p_warranty_alert_days integer default null
) returns table(product_id uuid, variant_ids uuid[])
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_product'; end if;
  return query select * from public.create_product_with_variants_v28(p_name, p_category_id, p_default_price, p_is_scan_only, p_base_unit_code, p_attribute_ids, p_variants, p_description, p_has_batches, p_expiry_alert_days, p_warranty_alert_days);
end; $fn$;
revoke execute on function public.create_product_with_variants(text, uuid, numeric, boolean, text, uuid[], jsonb, text, boolean, integer, integer) from public, anon;
grant execute on function public.create_product_with_variants(text, uuid, numeric, boolean, text, uuid[], jsonb, text, boolean, integer, integer) to authenticated;
revoke execute on function public.create_product_with_variants_v28(text, uuid, numeric, boolean, text, uuid[], jsonb, text, boolean, integer, integer) from public, anon, authenticated;

-- 24-25. define_pack_inline, update_pack (manage_product_packs)
alter function public.define_pack_inline(uuid, text, text, integer, boolean) rename to define_pack_inline_v28;
create or replace function public.define_pack_inline(p_product_id uuid, p_unit_code text, p_unit_name text, p_base_qty integer, p_is_default_purchase boolean default false)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_packs') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_packs'; end if;
  return public.define_pack_inline_v28(p_product_id, p_unit_code, p_unit_name, p_base_qty, p_is_default_purchase);
end; $fn$;
revoke execute on function public.define_pack_inline(uuid, text, text, integer, boolean) from public, anon;
grant execute on function public.define_pack_inline(uuid, text, text, integer, boolean) to authenticated;
revoke execute on function public.define_pack_inline_v28(uuid, text, text, integer, boolean) from public, anon, authenticated;

alter function public.update_pack(uuid, integer, boolean) rename to update_pack_v28;
create or replace function public.update_pack(p_pack_id uuid, p_base_qty integer, p_is_default_purchase boolean)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_packs') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_packs'; end if;
  perform public.update_pack_v28(p_pack_id, p_base_qty, p_is_default_purchase);
end; $fn$;
revoke execute on function public.update_pack(uuid, integer, boolean) from public, anon;
grant execute on function public.update_pack(uuid, integer, boolean) to authenticated;
revoke execute on function public.update_pack_v28(uuid, integer, boolean) from public, anon, authenticated;

-- 26-27. suggest_batch_no, preflight_expired_sale_check
alter function public.suggest_batch_no(uuid, date) rename to suggest_batch_no_v28;
create or replace function public.suggest_batch_no(p_variant_id uuid, p_received_at date default current_date)
returns text language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_purchase') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_purchase'; end if;
  return public.suggest_batch_no_v28(p_variant_id, p_received_at);
end; $fn$;
revoke execute on function public.suggest_batch_no(uuid, date) from public, anon;
grant execute on function public.suggest_batch_no(uuid, date) to authenticated;
revoke execute on function public.suggest_batch_no_v28(uuid, date) from public, anon, authenticated;

alter function public.preflight_expired_sale_check(jsonb) rename to preflight_expired_sale_check_v28;
create or replace function public.preflight_expired_sale_check(p_items jsonb default '[]'::jsonb)
returns table(variant_id uuid, would_draw_expired boolean, expired_batch_ids uuid[], policy public.expired_sale_policy)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_sale') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_sale'; end if;
  return query select * from public.preflight_expired_sale_check_v28(p_items);
end; $fn$;
revoke execute on function public.preflight_expired_sale_check(jsonb) from public, anon;
grant execute on function public.preflight_expired_sale_check(jsonb) to authenticated;
revoke execute on function public.preflight_expired_sale_check_v28(jsonb) from public, anon, authenticated;

-- 28-31. search_products, search_products_count, search_categories, search_variant_attributes, list_attribute_values (view_products)
alter function public.search_products(text, integer, integer, boolean, uuid, boolean) rename to search_products_v28;
create or replace function public.search_products(
  p_query text default null, p_limit integer default 50, p_offset integer default 0,
  p_only_in_stock boolean default false, p_category_id uuid default null, p_needs_pricing boolean default false
) returns table(id uuid, name text, type text, category_id uuid, description text, price numeric,
                avg_cost numeric, last_purchase_cost numeric, stock integer, is_active boolean,
                relevance real, has_variants boolean, variant_count bigint, min_price numeric, max_price numeric,
                total_stock_all_variants bigint, has_null_price_variant boolean, has_batches boolean, default_variant_id uuid)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_products') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_products'; end if;
  return query select * from public.search_products_v28(p_query, p_limit, p_offset, p_only_in_stock, p_category_id, p_needs_pricing);
end; $fn$;
revoke execute on function public.search_products(text, integer, integer, boolean, uuid, boolean) from public, anon;
grant execute on function public.search_products(text, integer, integer, boolean, uuid, boolean) to authenticated;
revoke execute on function public.search_products_v28(text, integer, integer, boolean, uuid, boolean) from public, anon, authenticated;

alter function public.search_products_count(text, boolean, uuid, boolean) rename to search_products_count_v28;
create or replace function public.search_products_count(p_query text default null, p_only_in_stock boolean default false, p_category_id uuid default null, p_needs_pricing boolean default false)
returns bigint language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_products') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_products'; end if;
  return public.search_products_count_v28(p_query, p_only_in_stock, p_category_id, p_needs_pricing);
end; $fn$;
revoke execute on function public.search_products_count(text, boolean, uuid, boolean) from public, anon;
grant execute on function public.search_products_count(text, boolean, uuid, boolean) to authenticated;
revoke execute on function public.search_products_count_v28(text, boolean, uuid, boolean) from public, anon, authenticated;

alter function public.search_categories(text, integer, integer) rename to search_categories_v28;
create or replace function public.search_categories(p_query text default null, p_limit integer default 10, p_offset integer default 0)
returns table(id uuid, name text, product_count bigint)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_products') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_products'; end if;
  return query select * from public.search_categories_v28(p_query, p_limit, p_offset);
end; $fn$;
revoke execute on function public.search_categories(text, integer, integer) from public, anon;
grant execute on function public.search_categories(text, integer, integer) to authenticated;
revoke execute on function public.search_categories_v28(text, integer, integer) from public, anon, authenticated;

alter function public.search_variant_attributes(text) rename to search_variant_attributes_v28;
create or replace function public.search_variant_attributes(p_query text default null)
returns table(id uuid, name text, display_order integer, value_count bigint)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_products') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_products'; end if;
  return query select * from public.search_variant_attributes_v28(p_query);
end; $fn$;
revoke execute on function public.search_variant_attributes(text) from public, anon;
grant execute on function public.search_variant_attributes(text) to authenticated;
revoke execute on function public.search_variant_attributes_v28(text) from public, anon, authenticated;

alter function public.list_attribute_values(uuid) rename to list_attribute_values_v28;
create or replace function public.list_attribute_values(p_attribute_id uuid)
returns table(id uuid, value text, display_order integer)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_products') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_products'; end if;
  return query select * from public.list_attribute_values_v28(p_attribute_id);
end; $fn$;
revoke execute on function public.list_attribute_values(uuid) from public, anon;
grant execute on function public.list_attribute_values(uuid) to authenticated;
revoke execute on function public.list_attribute_values_v28(uuid) from public, anon, authenticated;

-- 32-33. recent_purchase_products (view_products), recent_suppliers (view_suppliers)
alter function public.recent_purchase_products(integer) rename to recent_purchase_products_v28;
create or replace function public.recent_purchase_products(p_limit integer default 10)
returns table(id uuid, name text, type text, price numeric, avg_cost numeric, stock integer, last_used_at timestamp with time zone)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_products') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_products'; end if;
  return query select * from public.recent_purchase_products_v28(p_limit);
end; $fn$;
revoke execute on function public.recent_purchase_products(integer) from public, anon;
grant execute on function public.recent_purchase_products(integer) to authenticated;
revoke execute on function public.recent_purchase_products_v28(integer) from public, anon, authenticated;

alter function public.recent_suppliers(integer) rename to recent_suppliers_v28;
create or replace function public.recent_suppliers(p_limit integer default 10)
returns table(id uuid, name text, contact text, last_used_at timestamp with time zone)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_suppliers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_suppliers'; end if;
  return query select * from public.recent_suppliers_v28(p_limit);
end; $fn$;
revoke execute on function public.recent_suppliers(integer) from public, anon;
grant execute on function public.recent_suppliers(integer) to authenticated;
revoke execute on function public.recent_suppliers_v28(integer) from public, anon, authenticated;

-- 34-35. recent_customers, list_customers (view_customers)
alter function public.recent_customers(integer) rename to recent_customers_v28;
create or replace function public.recent_customers(p_limit integer default 10)
returns table(id uuid, name text, phone text, address text, last_activity_at timestamp with time zone)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_customers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_customers'; end if;
  return query select * from public.recent_customers_v28(p_limit);
end; $fn$;
revoke execute on function public.recent_customers(integer) from public, anon;
grant execute on function public.recent_customers(integer) to authenticated;
revoke execute on function public.recent_customers_v28(integer) from public, anon, authenticated;

alter function public.list_customers(text, integer, integer) rename to list_customers_v28;
create or replace function public.list_customers(p_query text default '', p_limit integer default 25, p_offset integer default 0)
returns table(id uuid, name text, phone text, address text, outstanding numeric, invoice_count bigint, last_activity_at timestamp with time zone, total_count bigint)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_customers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_customers'; end if;
  return query select * from public.list_customers_v28(p_query, p_limit, p_offset);
end; $fn$;
revoke execute on function public.list_customers(text, integer, integer) from public, anon;
grant execute on function public.list_customers(text, integer, integer) to authenticated;
revoke execute on function public.list_customers_v28(text, integer, integer) from public, anon, authenticated;

-- 36-37. search_purchases, search_purchases_count (view_purchases)
alter function public.search_purchases(date, date, uuid, boolean, integer, integer) rename to search_purchases_v28;
create or replace function public.search_purchases(p_from date default null, p_to date default null, p_supplier_id uuid default null, p_include_opening boolean default false, p_limit integer default 10, p_offset integer default 0)
returns table(id uuid, purchase_date date, supplier_id uuid, supplier_name text, source text, note text, items_count bigint, items_subtotal numeric, overhead_subtotal numeric, total_cost numeric, is_opening boolean)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_purchases') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_purchases'; end if;
  return query select * from public.search_purchases_v28(p_from, p_to, p_supplier_id, p_include_opening, p_limit, p_offset);
end; $fn$;
revoke execute on function public.search_purchases(date, date, uuid, boolean, integer, integer) from public, anon;
grant execute on function public.search_purchases(date, date, uuid, boolean, integer, integer) to authenticated;
revoke execute on function public.search_purchases_v28(date, date, uuid, boolean, integer, integer) from public, anon, authenticated;

alter function public.search_purchases_count(date, date, uuid, boolean) rename to search_purchases_count_v28;
create or replace function public.search_purchases_count(p_from date default null, p_to date default null, p_supplier_id uuid default null, p_include_opening boolean default false)
returns bigint language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_purchases') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_purchases'; end if;
  return public.search_purchases_count_v28(p_from, p_to, p_supplier_id, p_include_opening);
end; $fn$;
revoke execute on function public.search_purchases_count(date, date, uuid, boolean) from public, anon;
grant execute on function public.search_purchases_count(date, date, uuid, boolean) to authenticated;
revoke execute on function public.search_purchases_count_v28(date, date, uuid, boolean) from public, anon, authenticated;

-- 38. search_suppliers (view_suppliers)
alter function public.search_suppliers(text, integer, integer) rename to search_suppliers_v28;
create or replace function public.search_suppliers(p_query text default null, p_limit integer default 10, p_offset integer default 0)
returns table(id uuid, name text, contact text, address text, is_active boolean, total_count bigint)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_suppliers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_suppliers'; end if;
  return query select * from public.search_suppliers_v28(p_query, p_limit, p_offset);
end; $fn$;
revoke execute on function public.search_suppliers(text, integer, integer) from public, anon;
grant execute on function public.search_suppliers(text, integer, integer) to authenticated;
revoke execute on function public.search_suppliers_v28(text, integer, integer) from public, anon, authenticated;

-- 39-40. search_khata_customers, search_khata_customers_count (view_customer_khata)
alter function public.search_khata_customers(text, text, integer, integer) rename to search_khata_customers_v28;
create or replace function public.search_khata_customers(p_query text default null, p_status text default 'open', p_limit integer default 50, p_offset integer default 0)
returns table(id uuid, name text, phone text, address text, outstanding_balance numeric, last_activity_at timestamp with time zone, entry_count bigint)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_customer_khata') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_customer_khata'; end if;
  return query select * from public.search_khata_customers_v28(p_query, p_status, p_limit, p_offset);
end; $fn$;
revoke execute on function public.search_khata_customers(text, text, integer, integer) from public, anon;
grant execute on function public.search_khata_customers(text, text, integer, integer) to authenticated;
revoke execute on function public.search_khata_customers_v28(text, text, integer, integer) from public, anon, authenticated;

alter function public.search_khata_customers_count(text, text) rename to search_khata_customers_count_v28;
create or replace function public.search_khata_customers_count(p_query text default null, p_status text default 'open')
returns bigint language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_customer_khata') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_customer_khata'; end if;
  return public.search_khata_customers_count_v28(p_query, p_status);
end; $fn$;
revoke execute on function public.search_khata_customers_count(text, text) from public, anon;
grant execute on function public.search_khata_customers_count(text, text) to authenticated;
revoke execute on function public.search_khata_customers_count_v28(text, text) from public, anon, authenticated;

-- Trigger functions: F-M-25 — revoke from authenticated (trigger-only; calling directly raises NEW reference error anyway, but hygiene)
revoke execute on function public.batch_immutable_fields() from public, anon, authenticated;
revoke execute on function public.batch_auto_deactivate_when_empty() from public, anon, authenticated;
