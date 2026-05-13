
-- v2.9 Phase A migration 0068: permissions_catalog table + invitation_status enum + seed 50 rows
-- Locked design: design/2026-05-13-rbac-model-design.md §B.1, §B.3.1

-- 1. invitation_status enum (guard against re-run)
do $$ begin
  create type public.invitation_status as enum ('pending', 'accepted', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

-- 2. permissions_catalog table (system-managed; Anthropic owns content via migrations)
create table if not exists public.permissions_catalog (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null,
  category text not null check (category in (
    'sales', 'products', 'inventory', 'customers', 'suppliers',
    'financial', 'settings', 'team'
  )),
  preset_owner_default boolean not null default true,
  preset_manager_default boolean not null default false,
  preset_salesperson_default boolean not null default false,
  requires text[] not null default '{}'::text[],
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.permissions_catalog enable row level security;

create policy permissions_catalog_read_all on public.permissions_catalog
  for select to authenticated using (true);

-- 3. Seed 50 catalog rows (matches §B.1.1 exactly)
insert into public.permissions_catalog (key, name, description, category, display_order, preset_owner_default, preset_manager_default, preset_salesperson_default, requires) values
  -- SALES (5)
  ('record_sale', 'Record sale', 'Make a new sale through POS', 'sales', 1, true, true, true, '{}'::text[]),
  ('view_all_sales', 'View all sales', 'See sales recorded by other staff. Without this permission, user sees only sales they personally recorded (filtered by cashier_id = auth.uid()).', 'sales', 2, true, true, false, '{}'::text[]),
  ('view_sale_cost', 'View sale cost', 'See cost_at_sale and absolute gross profit on past sales.', 'sales', 3, true, false, false, '{}'::text[]),
  ('view_profit_margin', 'View profit margin', 'See margin % on sales. Operates without exposing absolute cost or profit.', 'sales', 4, true, false, false, '{}'::text[]),
  ('reprint_receipt', 'Reprint receipt', 'Print receipts for past sales.', 'sales', 5, true, true, true, '{}'::text[]),
  -- PRODUCTS (7)
  ('view_products', 'View products', 'Read product list and detail pages (no cost columns).', 'products', 10, true, true, true, '{}'::text[]),
  ('view_product_cost', 'View product cost', 'Read products.cost / variants.avg_cost / last_purchase_cost.', 'products', 11, true, true, false, array['view_products']),
  ('create_product', 'Create product', 'Create new products and variants.', 'products', 12, true, true, false, array['view_products']),
  ('edit_product', 'Edit product', 'Modify product name, description, price.', 'products', 13, true, true, false, array['view_products']),
  ('archive_product', 'Archive product', 'Toggle product is_active = false.', 'products', 14, true, true, false, array['view_products']),
  ('manage_product_categories', 'Manage product categories', 'Create / edit / deactivate categories.', 'products', 15, true, true, false, '{}'::text[]),
  ('manage_product_packs', 'Manage product packs', 'Create / edit / deactivate UoM packs.', 'products', 16, true, true, false, array['view_products']),
  -- INVENTORY (7)
  ('view_inventory_batches', 'View inventory batches', 'Read batch list (qty_remaining, expiry, batch_no — no cost).', 'inventory', 20, true, true, true, '{}'::text[]),
  ('view_batch_cost', 'View batch cost', 'Read cost_per_unit on batches.', 'inventory', 21, true, true, false, array['view_inventory_batches']),
  ('view_purchases', 'View purchases', 'Read past purchases including their costs (operational data for stock-in).', 'inventory', 22, true, true, false, '{}'::text[]),
  ('record_purchase', 'Record purchase', 'Record a stock-in / purchase.', 'inventory', 23, true, true, false, array['view_products','view_product_cost','view_purchases','view_suppliers','view_inventory_batches']),
  ('writeoff_batch', 'Write off batch', 'Partial or full write-off of a batch.', 'inventory', 24, true, true, false, array['view_inventory_batches','view_batch_cost']),
  ('edit_product_expiry_overrides', 'Edit product expiry overrides', 'Set per-product expiry_alert_days / expired_sale_policy.', 'inventory', 25, true, true, false, array['view_products','edit_product']),
  ('confirm_expired_sale_at_pos', 'Confirm expired sale at POS', 'Accept a warn-policy expired-batch sale at POS. Only meaningful when the shop''s expired_sale_policy is ''warn''; ignored under ''block'' or ''allow''.', 'inventory', 26, true, true, true, '{}'::text[]),
  -- CUSTOMERS (9)
  ('view_customers', 'View customers', 'Read customer name. Phone and address gated by view_customer_contact.', 'customers', 30, true, true, true, '{}'::text[]),
  ('view_customer_contact', 'View customer contact', 'Read customer phone and address fields. Without this permission, list shows name only.', 'customers', 31, true, true, true, array['view_customers']),
  ('view_customer_outstanding', 'View customer outstanding', 'Read customer''s outstanding_balance numeric amount. Without this permission, user sees only a has_khata boolean without the numeric value.', 'customers', 32, true, true, true, array['view_customers']),
  ('create_customer_basic', 'Create customer (basic)', 'Create customer with name + phone only (assigned to shop''s default tier).', 'customers', 33, true, true, true, array['view_customers']),
  ('create_customer_full', 'Create customer (full)', 'Create customer with address, tier_id, notes.', 'customers', 34, true, true, false, array['create_customer_basic','view_customer_contact']),
  ('edit_customer', 'Edit customer', 'Modify existing customer (except tier — separate permission).', 'customers', 35, true, true, false, array['view_customers','view_customer_contact']),
  ('view_customer_khata', 'View customer khata', 'Read full ledger history (debits and credits) for a customer.', 'customers', 36, true, true, false, array['view_customers']),
  ('assign_customer_tier', 'Assign customer tier', 'Change a customer''s tier_id.', 'customers', 37, true, true, false, array['view_customers']),
  ('manage_customer_tiers', 'Manage customer tiers', 'Create / edit / deactivate tier definitions (shop-wide).', 'customers', 38, true, false, false, '{}'::text[]),
  -- SUPPLIERS (2)
  ('view_suppliers', 'View suppliers', 'Read supplier list.', 'suppliers', 40, true, true, false, '{}'::text[]),
  ('manage_suppliers', 'Manage suppliers', 'Create / edit / deactivate suppliers.', 'suppliers', 41, true, true, false, array['view_suppliers']),
  -- FINANCIAL (8)
  ('receive_payment', 'Receive payment', 'Record a customer credit payment. Cap enforced via shops.salesperson_payment_cap_pkr (default 10,000 PKR). Cap and permission are separate gates; both must pass.', 'financial', 50, true, true, true, array['view_customers','view_customer_outstanding']),
  ('reverse_ledger_entry', 'Reverse ledger entry', 'Reverse a non-sale-tied ledger entry.', 'financial', 51, true, true, false, array['view_customer_khata']),
  ('view_expenses', 'View expenses', 'Read expense list.', 'financial', 52, true, true, false, '{}'::text[]),
  ('create_expense', 'Create expense', 'Record a new expense.', 'financial', 53, true, true, false, array['view_expenses']),
  ('edit_expense', 'Edit expense', 'Modify own expense within 24h of creation.', 'financial', 54, true, true, false, array['view_expenses']),
  ('view_monthly_targets', 'View monthly targets', 'Read shop''s target_sale / target_gross_profit / target_net_profit.', 'financial', 55, true, true, false, '{}'::text[]),
  ('manage_monthly_targets', 'Manage monthly targets', 'Set / update monthly targets.', 'financial', 56, true, false, false, array['view_monthly_targets']),
  ('view_reports', 'View reports', 'Access /reports page (data within is gated by other permissions).', 'financial', 57, true, true, false, '{}'::text[]),
  -- SETTINGS (5)
  ('edit_shop_settings', 'Edit shop settings', 'Change shop_name, address, phone, default alert days, default policies.', 'settings', 60, true, false, false, '{}'::text[]),
  ('view_owner_details', 'View owner details', 'Read CNIC / owner PII.', 'settings', 61, true, false, false, '{}'::text[]),
  ('edit_owner_details', 'Edit owner details', 'Modify owner PII.', 'settings', 62, true, false, false, array['view_owner_details']),
  ('manage_units_of_measure', 'Manage units of measure', 'Create new units of measure.', 'settings', 63, true, false, false, '{}'::text[]),
  ('manage_variant_attributes', 'Manage variant attributes', 'Manage shop-wide Color / Size / etc. attribute pool.', 'settings', 64, true, false, false, '{}'::text[]),
  -- TEAM (7)
  ('view_team', 'View team', 'Access /settings/team page (see employee list + their permissions).', 'team', 70, true, false, false, '{}'::text[]),
  ('invite_users', 'Invite users', 'Create invitations.', 'team', 71, true, false, false, array['view_team']),
  ('cancel_invitations', 'Cancel invitations', 'Cancel pending invitations.', 'team', 72, true, false, false, array['view_team']),
  ('modify_user_permissions', 'Modify user permissions', 'Grant / revoke permissions on other users.', 'team', 73, true, false, false, array['view_team']),
  ('modify_user_discount_limits', 'Modify user discount limits', 'Change other users'' discount-limit JSON.', 'team', 74, true, false, false, array['view_team']),
  ('revoke_user_access', 'Revoke user access', 'Remove a user from the shop.', 'team', 75, true, false, false, array['view_team']),
  ('view_user_audit_log', 'View user audit log', 'Read user_shop_permission_audit table.', 'team', 76, true, false, false, array['view_team'])
on conflict (key) do nothing;
