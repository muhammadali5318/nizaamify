-- 0095_v292_column_grant_inventory_batches_cost_per_unit.sql
--
-- v2.9.2 target 3 — close the `inventory_batches.cost_per_unit` raw-API
-- leak using the column-grant pattern from mig 0093 (sale_items).
--
-- NAMING NOTE: Authored as "v2.10b target 2" and APPLIED to production
-- as `0095_v210b_column_grant_inventory_batches_cost_per_unit`. Renamed
-- to v2.9.2 per `decisions/2026-05-13-v292-naming-collision-with-returns-feature.md`.
-- supabase_migrations.schema_migrations retains the v210b name.
-- This is the third and final target of v2.9.2; targets 4 + 5
-- (products/variants cost columns + purchase_items cost columns) are
-- deferred to v2.9.3 post-pilot per `docs/todos.md`.
--
-- BEFORE: a user with view_inventory_batches but not view_batch_cost
-- could `.from('inventory_batches').select('cost_per_unit')` via raw
-- Supabase JS and read per-batch landed cost even though the React UI
-- hid the column.
--
-- AFTER: cost_per_unit is reachable only via `inventory_batches_view`
-- (DEFINER, mig 0074), which projects it conditionally on
-- view_batch_cost.
--
-- HOOK IMPACT (companion change in src/features/batches/hooks.ts):
-- - useActiveBatchesForVariant + useAllBatchesForVariant migrated from
--   `.from('inventory_batches').select(...)` to
--   `.from('inventory_batches_view').select(...)`
-- - BatchPickerRow.cost_per_unit widened to `number | null`
-- - BatchesSection.tsx Row.cost_per_unit widened to `number | null`;
--   cell already gated on view_batch_cost from the v2.9.1 sweep
--
-- The b2/v2.8 alert views (`batches_expiring_soon`,
-- `batches_warranty_expiring_soon`, `batches_already_expired`) are
-- `security_invoker = true` but do NOT select `cost_per_unit`. They are
-- unaffected by the REVOKE.
--
-- MAINTENANCE CONTRACT: any future migration that adds a column to
-- public.inventory_batches MUST also `grant select (<new_col>) on
-- public.inventory_batches to authenticated;`. Baseline below.
--
-- INSERT / UPDATE / DELETE grants untouched. Writes go through
-- record_purchase / writeoff_batch DEFINER RPCs.

begin;

revoke select on public.inventory_batches from authenticated;
revoke select on public.inventory_batches from anon;

grant select (
  id,
  variant_id,
  batch_no,
  purchase_item_id,
  supplier_id,
  qty_received,
  qty_remaining,
  manufactured_date,
  expiry_date,
  supplier_warranty_days,
  warranty_expires_at,
  received_at,
  is_active,
  notes,
  created_at,
  updated_at,
  last_modified_by_user_id
) on public.inventory_batches to authenticated;

commit;
