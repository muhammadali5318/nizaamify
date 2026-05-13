
-- v2.9 Phase B migration 0073: new permission-based RLS policies (ADDITIVE)
-- New policies coexist with existing v2.8.5 *_shop_all policies; old ones
-- are dropped in 0077 after stabilization. Deny-wins safety: existing
-- current_shop_id() body returns NULL for non-owners, so old policies are
-- a no-op during stabilization. New policies are the only gate that can
-- permit non-owner users.
--
-- Performance pattern: all helper calls wrapped in (select helper(...))
-- subqueries so Postgres memoizes once per query (not per row).

-- ============================================================================
-- IDENTITY
-- ============================================================================

-- profiles: add team-read (owners read profiles of users in their shops)
create policy v29_profiles_team_read on public.profiles
  for select using (
    exists (
      select 1 from public.user_shop_access usa_target
      join public.user_shop_access usa_caller on usa_caller.shop_id = usa_target.shop_id
      where usa_target.user_id = profiles.id
        and usa_caller.user_id = (select auth.uid())
        and usa_caller.is_owner = true
    )
  );

-- ============================================================================
-- SHOPS + OWNER DETAILS
-- ============================================================================

-- shops: any member can read (replaces owner-only access for non-owner members)
create policy v29_shops_member_read on public.shops
  for select using ((select public.user_has_shop_access(id)));

-- shop_owner_details: owner-only read (gated by view_owner_details permission)
create policy v29_owner_details_owner_read on public.shop_owner_details
  for select using (
    (select public.user_has_permission(shop_id, 'view_owner_details'))
  );

-- ============================================================================
-- CATALOG (Class 2 — all-members read)
-- ============================================================================

create policy v29_categories_members_read on public.product_categories
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_shop_access(shop_id))
  );

create policy v29_packs_members_read on public.product_packs
  for select using (
    exists (select 1 from public.products p
      where p.id = product_packs.product_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_shop_access(p.shop_id)))
  );

create policy v29_variant_attr_members_read on public.variant_attributes
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_shop_access(shop_id))
  );

create policy v29_variant_values_members_read on public.variant_attribute_values
  for select using (
    exists (select 1 from public.variant_attributes a
      where a.id = variant_attribute_values.attribute_id
        and a.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_shop_access(a.shop_id)))
  );

create policy v29_pvav_members_read on public.product_variant_attribute_values
  for select using (
    exists (select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = product_variant_attribute_values.variant_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_shop_access(p.shop_id)))
  );

create policy v29_uom_members_read on public.units_of_measure
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_shop_access(shop_id))
  );

create policy v29_tiers_members_read on public.customer_tiers
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_shop_access(shop_id))
  );

-- ============================================================================
-- PRODUCTS + VARIANTS (Class 4 — cost-bearing)
-- ============================================================================

-- Raw read requires view_product_cost; salesperson reads via products_view
create policy v29_products_cost_read on public.products
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'view_product_cost'))
  );

-- INSERT/UPDATE for those with create/edit permissions
create policy v29_products_write_create on public.products
  for insert with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'create_product'))
  );

create policy v29_products_write_edit on public.products
  for update using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'edit_product'))
  ) with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'edit_product'))
  );

-- Same shape for product_variants (joined through products)
create policy v29_variants_cost_read on public.product_variants
  for select using (
    exists (select 1 from public.products p
      where p.id = product_variants.product_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'view_product_cost')))
  );

create policy v29_variants_write_create on public.product_variants
  for insert with check (
    exists (select 1 from public.products p
      where p.id = product_variants.product_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'create_product')))
  );

create policy v29_variants_write_edit on public.product_variants
  for update using (
    exists (select 1 from public.products p
      where p.id = product_variants.product_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'edit_product')))
  ) with check (
    exists (select 1 from public.products p
      where p.id = product_variants.product_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'edit_product')))
  );

-- ============================================================================
-- INVENTORY (Class 4 — cost-bearing batches)
-- ============================================================================

create policy v29_batches_cost_read on public.inventory_batches
  for select using (
    exists (select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory_batches.variant_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'view_batch_cost')))
  );

-- INSERT via record_purchase (DEFINER bypasses RLS), but RLS gate as defense
create policy v29_batches_write on public.inventory_batches
  for insert with check (
    exists (select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory_batches.variant_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'record_purchase')))
  );

-- UPDATE limited to notes/qty_remaining/is_active (immutability trigger blocks others)
-- Manager+ writeoff_batch is the effective gate
create policy v29_batches_update on public.inventory_batches
  for update using (
    exists (select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory_batches.variant_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'writeoff_batch')))
  ) with check (
    exists (select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory_batches.variant_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'writeoff_batch')))
  );

-- ============================================================================
-- SUPPLIERS (Class 3 — manager+ only)
-- ============================================================================

create policy v29_suppliers_read on public.suppliers
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'view_suppliers'))
  );

create policy v29_suppliers_write on public.suppliers
  for insert with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_suppliers'))
  );

create policy v29_suppliers_update on public.suppliers
  for update using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_suppliers'))
  ) with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_suppliers'))
  );

-- ============================================================================
-- CUSTOMERS (Class 5)
-- ============================================================================

-- Raw read requires view_customer_contact (phone/address are the gated bits)
create policy v29_customers_read on public.customers
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'view_customer_contact'))
  );

-- Direct INSERT is denied for v2.9; route via create_customer_basic / create_customer_full RPCs
-- (no INSERT policy added; DEFINER RPCs bypass RLS)

-- Direct UPDATE gated by edit_customer
create policy v29_customers_update on public.customers
  for update using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'edit_customer'))
  ) with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'edit_customer'))
  );

-- ============================================================================
-- SALES (Class 4 — invoices + sale_items)
-- ============================================================================

-- Raw read requires view_sale_cost
create policy v29_invoices_cost_read on public.invoices
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'view_sale_cost'))
  );

create policy v29_sale_items_cost_read on public.sale_items
  for select using (
    exists (select 1 from public.invoices i
      where i.id = sale_items.invoice_id
        and i.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(i.shop_id, 'view_sale_cost')))
  );

-- ============================================================================
-- PURCHASES (Class 3 — manager+ only)
-- ============================================================================

create policy v29_purchases_read on public.purchases
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'view_purchases'))
  );

create policy v29_purchase_items_read on public.purchase_items
  for select using (
    exists (select 1 from public.purchases p
      where p.id = purchase_items.purchase_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'view_purchases')))
  );

create policy v29_purchase_overhead_read on public.purchase_overhead_items
  for select using (
    exists (select 1 from public.purchases p
      where p.id = purchase_overhead_items.purchase_id
        and p.shop_id = (select public.current_active_shop_id())
        and (select public.user_has_permission(p.shop_id, 'view_purchases')))
  );

-- ============================================================================
-- LEDGER (Class 7)
-- ============================================================================

create policy v29_ledger_read on public.ledger_entries
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'view_customer_khata'))
  );

-- INSERT via record_sale / receive_payment / reverse_ledger_entry DEFINER RPCs only
-- (no INSERT policy added)

-- ============================================================================
-- EXPENSES (Class 8)
-- ============================================================================

create policy v29_expenses_read on public.expenses
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'view_expenses'))
  );

create policy v29_expenses_create on public.expenses
  for insert with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'create_expense'))
  );

-- UPDATE via update_expense RPC (24h + creator check); no direct UPDATE policy

-- ============================================================================
-- MONTHLY TARGETS (Class 6 — owner write, manager+ read)
-- ============================================================================

create policy v29_monthly_targets_read on public.monthly_targets
  for select using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'view_monthly_targets'))
  );

create policy v29_monthly_targets_write on public.monthly_targets
  for insert with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_monthly_targets'))
  );

create policy v29_monthly_targets_update on public.monthly_targets
  for update using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_monthly_targets'))
  ) with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_monthly_targets'))
  );

-- ============================================================================
-- TRIGGER GATES (F-PD-11, F-PD-12-style enforcement at column-mutation level)
-- ============================================================================

-- archive_product permission gates is_active flip on products/variants
create or replace function public.check_product_archive_gate()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if OLD.is_active is distinct from NEW.is_active then
    if not public.user_has_permission(NEW.shop_id, 'archive_product') then
      raise exception 'insufficient_permissions'
        using errcode = 'P0001',
              detail = 'is_active toggle requires archive_product permission';
    end if;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.check_product_archive_gate() from public, anon, authenticated;

create trigger v29_products_archive_gate
  before update of is_active on public.products
  for each row execute function public.check_product_archive_gate();

-- assign_customer_tier permission gates tier_id changes on customers
create or replace function public.check_customer_tier_change_gate()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if OLD.tier_id is distinct from NEW.tier_id then
    if not public.user_has_permission(NEW.shop_id, 'assign_customer_tier') then
      raise exception 'insufficient_permissions'
        using errcode = 'P0001',
              detail = 'tier_id change requires assign_customer_tier permission';
    end if;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.check_customer_tier_change_gate() from public, anon, authenticated;

create trigger v29_customers_tier_change_gate
  before update of tier_id on public.customers
  for each row execute function public.check_customer_tier_change_gate();

-- Defense in depth per F-PD-07
revoke update (is_owner) on public.user_shop_access from authenticated;
revoke update (owner_user_id) on public.shops from authenticated;
