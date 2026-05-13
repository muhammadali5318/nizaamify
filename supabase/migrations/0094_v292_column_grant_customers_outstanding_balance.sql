-- 0094_v292_column_grant_customers_outstanding_balance.sql
--
-- v2.9.2 target 2 — close the `customers.outstanding_balance` raw-API
-- leak using the column-grant pattern proven in mig 0093 (sale_items).
--
-- NAMING NOTE: Authored as "v2.10b target 1" and APPLIED to production
-- as `0094_v210b_column_grant_customers_outstanding_balance`. Renamed
-- to v2.9.2 per `decisions/2026-05-13-v292-naming-collision-with-returns-feature.md`.
-- supabase_migrations.schema_migrations retains the v210b name.
--
-- The "target N" numbering within v2.9.2 went: target 1 = sale_items
-- .cost_at_sale (migs 0092 + 0093); target 2 = customers
-- .outstanding_balance (this mig 0094); target 3 = inventory_batches
-- .cost_per_unit (mig 0095); targets 4 + 5 (products/variants cost +
-- purchase_items cost) deferred to v2.9.3 post-pilot per
-- `docs/todos.md`.
--
-- BEFORE: salesperson with view_all_customers but not
-- view_customer_outstanding could `.from('customers').select('outstanding_balance')`
-- via raw Supabase JS and see the numeric balance even though the React
-- UI rendered "Has khata"/"No khata" boolean fallback after the v2.9.1
-- proactive sweep.
--
-- AFTER: SELECT on the column-level grant excludes outstanding_balance;
-- the column is reachable only via `customers_view` (DEFINER, mig 0074),
-- which projects it conditionally on view_customer_outstanding.
--
-- HOOK IMPACT (companion frontend change):
-- - useCustomer / useCustomers / useCreateCustomer migrated from
--   `.from('customers').select('*')` to `.from('customers_view').select(...)`
--   in src/features/customers/hooks.ts.
-- - Customer TS type widened: outstanding_balance becomes `number | null`
--   (was non-nullable on the table). CustomerDetailPage already
--   null-handles this from the v2.9.1 proactive sweep.
--
-- MAINTENANCE CONTRACT (same as mig 0093 for sale_items):
-- Any future migration that adds a column to public.customers MUST also
-- `grant select (<new_col>) on public.customers to authenticated;` or
-- the column is invisible to the application. The current column
-- inventory below is the baseline as of v2.9.2:
--
--   id, shop_id, name, phone, address, tier_id,
--   [outstanding_balance],
--   is_active, notes, created_at, updated_at,
--   created_by_user_id, updated_by_user_id
--
-- Bracketed column is intentionally excluded.
--
-- INSERT / UPDATE / DELETE grants are untouched. Application writes go
-- through create_customer_full / update_customer DEFINER RPCs.
--
-- NOTE on customer_outstanding view (DEFINER, mig 0074): unaffected —
-- runs as postgres, full grants, projects outstanding conditionally on
-- view_customer_outstanding. Same for customers_view.

begin;

revoke select on public.customers from authenticated;
revoke select on public.customers from anon;

grant select (
  id,
  shop_id,
  name,
  phone,
  address,
  tier_id,
  is_active,
  notes,
  created_at,
  updated_at,
  created_by_user_id,
  updated_by_user_id
) on public.customers to authenticated;

commit;
