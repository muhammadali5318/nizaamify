# 2026-05-13 — 50-permission catalog across 8 categories

## Context

After the pivot to permission-based RBAC ([[2026-05-13-rbac-permission-model-over-roles]]),
the catalog size and shape needed to be locked. User direction
("medium granularity, 40-60 permissions, split read from write per
resource") set the target range.

## Decision

50 permissions across 8 UI-grouped categories:

- SALES (5): record_sale, view_all_sales, view_sale_cost,
  view_profit_margin, reprint_receipt
- PRODUCTS (7): view_products, view_product_cost, create_product,
  edit_product, archive_product, manage_product_categories,
  manage_product_packs
- INVENTORY (7): view_inventory_batches, view_batch_cost,
  view_purchases, record_purchase, writeoff_batch,
  edit_product_expiry_overrides, confirm_expired_sale_at_pos
- CUSTOMERS (9): view_customers, view_customer_contact,
  view_customer_outstanding, create_customer_basic,
  create_customer_full, edit_customer, view_customer_khata,
  assign_customer_tier, manage_customer_tiers
- SUPPLIERS (2): view_suppliers, manage_suppliers
- FINANCIAL (8): receive_payment, reverse_ledger_entry,
  view_expenses, create_expense, edit_expense, view_monthly_targets,
  manage_monthly_targets, view_reports
- SETTINGS (5): edit_shop_settings, view_owner_details,
  edit_owner_details, manage_units_of_measure,
  manage_variant_attributes
- TEAM (7): view_team, invite_users, cancel_invitations,
  modify_user_permissions, modify_user_discount_limits,
  revoke_user_access, view_user_audit_log

## Alternatives considered

1. **Finer granularity (~100 permissions, split per RPC).** Considered.
   Owners would face a wall of toggles per user. Rejected for UX.
2. **Coarser (~20 permissions, action-bundles).** Considered. Loses
   the "view_sale_cost vs view_profit_margin" distinction that
   real shops asked for. Rejected.
3. **Different category groupings.** Considered. The 8-category
   grouping matches the existing app navigation (sales, products,
   inventory, customers, suppliers, financial-reports, settings,
   team-management). Aligning permissions UI to nav reduces cognitive
   load.

## Consequences

- Each permission is a row in `permissions_catalog` table.
- Per-preset defaults are columns on the catalog row
  (`preset_owner_default`, `preset_manager_default`,
  `preset_salesperson_default`).
- Owner preset: all 50 ✓ (informational; implicit shortcut applies).
- Manager preset: 32 ✓ / 18 ·.
- Salesperson preset: 10 ✓ / 40 ·.
- 29 dependency rules declared in `requires text[]` column (see
  [[2026-05-13-rbac-dependency-rules-grant-time]]).
- 5 permissions whose existence was considered but deferred to v2.10+:
  void_sale, edit_sale_notes, apply_discount_above_limit, and 2
  others; documented in v29-rbac-INDEX.md.

Related: [[2026-05-13-rbac-permission-model-over-roles]],
[[2026-05-13-rbac-presets-as-templates]],
[[2026-05-13-rbac-dependency-rules-grant-time]].
