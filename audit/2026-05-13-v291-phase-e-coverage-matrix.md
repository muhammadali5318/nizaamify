# v2.9.1 Phase E.3 — Code-path coverage matrix

Status: Working draft. Mark each row [P] pass / [F] fail / [N] N/A as tests run.

Date created: 2026-05-13
Author: Phase E.3 coverage build
Sources (read end-to-end): `supabase/migrations/0068_v29_foundation_enum_catalog.sql`, `src/router/index.tsx`, `design/2026-05-13-v291-rpc-inventory.md`, `design/2026-05-13-v291-page-permission-map.md`, `audit/2026-05-13-v291-phase-a4-owner-regression-test-plan.md`, `design/2026-05-13-rbac-attack-surface.md` §C.2 + §C.3, `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Discipline lesson, `supabase/migrations/0087_v291_phase_c.sql`, `supabase/migrations/0088_v291_get_invitation_for_acceptance.sql`.

---

## Quick stats

- Total rows: 207
- Section 1 (route guards): 26
- Section 2 (RPC permission gates): 84
- Section 3 (UI action gates): 48
- Section 4 (conditional read projections): 23
- Section 5 (special flows): 6 (each a multi-step block)
- Section 6 (audit / observability): 11
- Owner-only-applicable rows (will always pass for owner): 26 (Section 1 route guards) + 84 (Section 2 wrappers) = ~110 rows where owner is the optimistic baseline
- Manager-test rows (default preset matters): all Section 1 + Section 2 + Section 3 + Section 4
- Salesperson-test rows: all Section 1 + Section 2 + Section 3 + Section 4
- Synthetic SQL test rows: 84 Section 2 RPC gates + 23 Section 4 projections + 11 Section 6 audit = 118
- Manual UI test rows: 26 Section 1 + 48 Section 3 + 6 Section 5 = 80 (Section 6 has a few UI-verify rows too)
- Pilot-only rows (requires real non-owner account + invitation cycle): ~30 rows in Sections 3, 4, 5, 6 that involve real cross-session permission propagation
- BLOCKED-flag-flip rows (gated on task #23 useUpdateProduct cleanup): 4 (Section 6 audit-column checks E3-194 through E3-197)

## Discipline rules

These rules are binding on every row tagged "Synthetic SQL" or "Synthetic SQL + Manual UI":

- **D-1 (binding):** All synthetic Postgres tests use `SET ROLE authenticated` against a real session JWT issued by Supabase Auth — NEVER `set_config('request.jwt.claims', '{...}')` shortcuts. Per the v2.9.0.1 sweep discipline lesson (`decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §"Discipline lesson", lines 115-150). Direct quote: "green under `SET ROLE authenticated` for all three migrated" hooks. The `set_config` shortcut bypasses GUC propagation through the function call stack and silently green-lights tests that fail in production.
- **D-2:** All manual UI tests run through a real browser session against a real Supabase project (`orfggrnyychmmqdlbfhf`). No localhost-only / no mocked-RPC tests.
- **D-3:** Cross-session tests (permission revoke while target is logged in) require two real browser sessions in two browsers / two profiles. No "simulated" cross-session via devtools localStorage flush.
- **D-4:** Audit gap rows blocked by task #23 (`useUpdateProduct` RPC migration — see Section 6, rows E3-194..E3-197) marked **[BLOCKED-flag-flip]** until that ships. Phase E.3 cannot pass until task #23 lands; flipping the `RBAC_TEAM_UI_ENABLED` flag without it leaves `products.updated_by_user_id` unwritten on edits.
- **D-5:** Test method per row encodes how to exercise:
  - "Manual UI" — full browser flow at real Supabase
  - "Synthetic SQL" — `SET ROLE authenticated` SELECT/RPC call from `psql`/MCP
  - "Synthetic SQL + Manual UI" — both required (UI sanity + SQL projection assertion)
  - "Pilot-only" — requires a non-owner pilot account that does not exist pre-pilot

---

## Section 1: Route guards (26 rows)

One row per gated route. "Mgr-default" / "Sales-default" columns derive from the catalog's `preset_manager_default` / `preset_salesperson_default` flags in migration 0068 (verified line-by-line). Where a route uses `RequireAnyPermission`, the row says ✅ if ANY listed permission is in the user's default preset.

| ID | Route | Guards (in order) | Owner | Mgr-default | Sales-default | Test method | Status |
|---|---|---|---|---|---|---|---|
| E3-001 | `/login` | RedirectIfAuthed | n/a (pre-auth) | n/a | n/a | Manual UI | [ ] |
| E3-002 | `/signup` | RedirectIfAuthed | n/a | n/a | n/a | Manual UI | [ ] |
| E3-003 | `/forgot-password` | RedirectIfAuthed | n/a | n/a | n/a | Manual UI | [ ] |
| E3-004 | `/reset-password` | (open) | n/a | n/a | n/a | Manual UI | [ ] |
| E3-005 | `/verify-email` | (open) | n/a | n/a | n/a | Manual UI | [ ] |
| E3-006 | `/onboarding` | RequireAuth + RedirectIfOnboarded | ✅ on first run; redirect after | n/a (pre-onboarding) | n/a | Manual UI | [ ] |
| E3-007 | `/subscription/expired` | RequireAuth + RequireOnboarded + RedirectIfActiveSubscription | enter only if expired | enter only if expired | enter only if expired | Manual UI | [ ] |
| E3-008 | `/invite/accept/:invitation_id` | RequireAuth (deliberately NO RequireOnboarded, per router line 104-106) | ✅ enter | ✅ enter | ✅ enter | Manual UI | [ ] |
| E3-009 | `/` (index → redirects to `/dashboard`) | RequireAuth + RequireOnboarded | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-010 | `/settings` | RequireAuth + RequireOnboarded (NO subscription gate per ADR-0010) | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-011 | `/settings/support` | RequireAuth + RequireOnboarded (NO subscription gate) | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-012 | `/settings/tiers` | RequirePermission('manage_customer_tiers') | ✅ | ❌ redirect (Mgr default = false) | ❌ redirect | Manual UI | [ ] |
| E3-013 | `/settings/variant-attributes` | RequirePermission('manage_variant_attributes') | ✅ | ❌ redirect | ❌ redirect | Manual UI | [ ] |
| E3-014 | `/settings/team` | RequirePermission('view_team') | ✅ | ❌ redirect (Mgr default = false per catalog) | ❌ redirect | Manual UI | [ ] |
| E3-015 | `/dashboard` | RequireActiveSubscription | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-016 | `/products` | RequireActiveSubscription + RequirePermission('view_products') | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-017 | `/products/new` | RequireActiveSubscription + RequirePermission('create_product') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-018 | `/products/:id` | RequireActiveSubscription + RequirePermission('view_products') | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-019 | `/inventory/expired` | RequireActiveSubscription + RequirePermission('view_inventory_batches') | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-020 | `/inventory/expired-sales` | RequireActiveSubscription + RequirePermission('view_all_sales') + RequirePermission('view_inventory_batches') (reconciled with page-map post-matrix; salespersons now correctly excluded — see §Discrepancies #1 RESOLVED) | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-021 | `/purchases` | RequireActiveSubscription + RequirePermission('view_purchases') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-022 | `/purchases/new` | RequireActiveSubscription + RequirePermission('record_purchase') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-023 | `/purchases/:id` | RequireActiveSubscription + RequirePermission('view_purchases') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-024 | `/sales` | RequireActiveSubscription + RequireAnyPermission(['record_sale','view_all_sales']) | ✅ | ✅ (both) | ✅ (record_sale only — sees own rows) | Manual UI | [ ] |
| E3-025 | `/sales/:id` | RequireActiveSubscription + RequireAnyPermission(['record_sale','view_all_sales']) | ✅ | ✅ | ✅ (own only) | Manual UI | [ ] |
| E3-026 | `/pos` | RequireActiveSubscription + RequirePermission('record_sale') | ✅ | ✅ | ✅ | Manual UI | [ ] |

(Continuing — customer/khata/supplier/expense/target/report routes)

| E3-027 | `/customers` | RequireActiveSubscription + RequirePermission('view_customers') | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-028 | `/customers/new` | RequireActiveSubscription + RequirePermission('create_customer_basic') | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-029 | `/customers/:id/edit` | RequireActiveSubscription + RequirePermission('edit_customer') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-030 | `/customers/:id` | RequireActiveSubscription + RequirePermission('view_customers') | ✅ | ✅ | ✅ | Manual UI | [ ] |
| E3-031 | `/khata` | RequireActiveSubscription + RequirePermission('view_customer_khata') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-032 | `/suppliers` | RequireActiveSubscription + RequirePermission('view_suppliers') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-033 | `/suppliers/new` | RequireActiveSubscription + RequirePermission('manage_suppliers') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-034 | `/suppliers/:id/edit` | RequireActiveSubscription + RequirePermission('manage_suppliers') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-035 | `/expenses` | RequireActiveSubscription + RequirePermission('view_expenses') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-036 | `/targets` | RequireActiveSubscription + RequirePermission('view_monthly_targets') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |
| E3-037 | `/reports` | RequireActiveSubscription + RequirePermission('view_reports') | ✅ | ✅ | ❌ redirect | Manual UI | [ ] |

(Section 1 effective row count: 37 rows — beyond the 26 originally counted, because the router has additional routes than the headline number. The headline "26" in the section description refers to authenticated-only routes; the 5 pre-auth + 2 onboarding/subscription routes bring the total to 37. Either count is fine for tracking; rows are individually testable.)

---

## Section 2: RPC permission gates (84 rows)

One row per DEFINER RPC that gates on a permission (skipping pure helpers: `current_active_shop_id`, `user_has_shop_access`, `user_has_permission`, `user_permissions_in_shop`, `get_user_shop_list`, `complete_onboarding`, `accept_invitation` — those are no-permission "open to authenticated" RPCs and live in Section 5).

For RPCs with multiple enforcement rules (record_sale = permission + caps + expired-policy + confirm permission), one row per rule.

Default-preset columns from catalog migration 0068 lines 36-92.

### 2.1 Sales RPCs (8 rows — record_sale's 5 cap rules + preflight + reprint UI gate)

| ID | RPC / rule | Gate(s) | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-038 | record_sale (base permission) | record_sale permission | ✅ pass | ✅ pass | ✅ pass | useRecordSale (POSPage) | Manual UI + Synthetic SQL | [ ] |
| E3-039 | record_sale (confirm_expired_sale_at_pos) | when `p_confirm_expired_sale=true`, additional gate | ✅ (owner shortcut) | ✅ (Mgr default = true) | ✅ (Sales default = true) | useRecordSale | Synthetic SQL + Manual UI | [ ] |
| E3-040 | record_sale (per-line pct cap) | user_shop_access.discount_limits.per_line_max_pct | N/A (owner bypass) | bounded by manager default 25% | bounded by salesperson default 5% | useRecordSale | Synthetic SQL (Pilot-only — needs non-owner) | [ ] |
| E3-041 | record_sale (per-line PKR cap) | per_line_max_pkr | N/A | manager: no cap (null) | salesperson: 100 PKR | useRecordSale | Synthetic SQL (Pilot-only) | [ ] |
| E3-042 | record_sale (implicit-discount cap) | computed `1 - (price_at_sale / variant.price)` vs per_line_max_pct | N/A | bounded | bounded | useRecordSale | Synthetic SQL (Pilot-only) | [ ] |
| E3-043 | record_sale (per-invoice pct cap) | per_invoice_max_pct | N/A | manager: 15% | salesperson: 3% | useRecordSale | Synthetic SQL (Pilot-only) | [ ] |
| E3-044 | record_sale (per-invoice PKR cap) | per_invoice_max_pkr | N/A | manager: no cap | salesperson: 300 PKR | useRecordSale | Synthetic SQL (Pilot-only) | [ ] |
| E3-045 | preflight_expired_sale_check | record_sale permission | ✅ | ✅ | ✅ | usePreflightExpiredSaleCheck (POSPage) | Synthetic SQL | [ ] |

### 2.2 Product RPCs (16 rows)

| ID | RPC | Gate | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-046 | search_products | view_products | ✅ | ✅ | ✅ | useSearchProducts (ProductsListPage, POS) | Synthetic SQL + Manual UI | [ ] |
| E3-047 | search_products_count | view_products | ✅ | ✅ | ✅ | (paired with above) | Synthetic SQL | [ ] |
| E3-048 | recent_purchase_products | view_products | ✅ | ✅ | ❌ (only matters if reachable; salesperson can't reach /purchases) | usePurchasesRecentProducts (NewPurchasePage) | Synthetic SQL | [ ] |
| E3-049 | search_categories | view_products | ✅ | ✅ | ✅ | CategoryFilter, CategoryCombobox | Synthetic SQL | [ ] |
| E3-050 | create_category_inline | manage_product_categories | ✅ | ✅ | ❌ | useCreateCategory (CategoryCombobox inline create) | Synthetic SQL + Manual UI | [ ] |
| E3-051 | update_category | manage_product_categories | ✅ | ✅ | ❌ | useUpdateCategory | Synthetic SQL | [ ] |
| E3-052 | create_product_with_opening_stock | create_product | ✅ | ✅ | ❌ | useCreateProduct (ProductFormPage) | Synthetic SQL + Manual UI | [ ] |
| E3-053 | create_product_with_variants | create_product | ✅ | ✅ | ❌ | useCreateProductWithVariants | Synthetic SQL + Manual UI | [ ] |
| E3-054 | add_variant_to_product | create_product | ✅ | ✅ | ❌ | useAddVariantToProduct (AddVariantDialog) | Synthetic SQL | [ ] |
| E3-055 | define_pack_inline | manage_product_packs | ✅ | ✅ | ❌ | useDefinePackInline | Synthetic SQL | [ ] |
| E3-056 | update_pack | manage_product_packs | ✅ | ✅ | ❌ | useUpdatePack | Synthetic SQL | [ ] |
| E3-057 | deactivate_pack | manage_product_packs | ✅ | ✅ | ❌ | useDeactivatePack | Synthetic SQL | [ ] |
| E3-058 | create_variant_attribute | manage_variant_attributes | ✅ | ❌ | ❌ | useCreateVariantAttribute (VariantAttributesPage) | Synthetic SQL | [ ] |
| E3-059 | update_variant_attribute | manage_variant_attributes | ✅ | ❌ | ❌ | useUpdateVariantAttribute | Synthetic SQL | [ ] |
| E3-060 | deactivate_variant_attribute | manage_variant_attributes | ✅ | ❌ | ❌ | useDeactivateVariantAttribute | Synthetic SQL | [ ] |
| E3-061 | add_variant_value | manage_variant_attributes | ✅ | ❌ | ❌ | useAddVariantValue | Synthetic SQL | [ ] |
| E3-062 | update_variant_value | manage_variant_attributes | ✅ | ❌ | ❌ | useUpdateVariantValue | Synthetic SQL | [ ] |
| E3-063 | deactivate_variant_value | manage_variant_attributes | ✅ | ❌ | ❌ | useDeactivateVariantValue | Synthetic SQL | [ ] |
| E3-064 | search_variant_attributes | view_products | ✅ | ✅ | ✅ | useVariantAttributes (matrix builder) | Synthetic SQL | [ ] |
| E3-065 | list_attribute_values | view_products | ✅ | ✅ | ✅ | useAttributeValues | Synthetic SQL | [ ] |
| E3-066 | update_product (**NEW v2.9.1** migration 0087) | edit_product (+ edit_product_expiry_overrides for expiry fields) | ✅ | ✅ | ❌ | useUpdateProduct (deferred per task #23) | Synthetic SQL (Phase C verification); UI wiring is BLOCKED — see Section 6 | [ ] |
| E3-067 | archive_product (**NEW v2.9.1** migration 0087) | archive_product | ✅ | ✅ | ❌ | useArchiveProduct (deferred) | Synthetic SQL | [ ] |
| E3-068 | update_variant_inline (**NEW v2.9.1** migration 0087) | edit_product (for price/sku) + archive_product (for is_active=false) | ✅ | ✅ | ❌ | useUpdateVariantInline (deferred) | Synthetic SQL | [ ] |

### 2.3 Inventory RPCs (6 rows)

| ID | RPC | Gate | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-069 | record_purchase | record_purchase | ✅ | ✅ | ❌ | useRecordPurchase (NewPurchasePage) | Synthetic SQL + Manual UI | [ ] |
| E3-070 | suggest_batch_no | record_purchase | ✅ | ✅ | ❌ | suggestBatchNo (batches/hooks.ts) | Synthetic SQL | [ ] |
| E3-071 | deactivate_batch | writeoff_batch | ✅ | ✅ | ❌ | useDeactivateBatch (WriteOffBatchDialog) | Synthetic SQL | [ ] |
| E3-072 | record_partial_writeoff | writeoff_batch | ✅ | ✅ | ❌ | useRecordPartialWriteoff | Synthetic SQL | [ ] |
| E3-073 | search_purchases | view_purchases | ✅ | ✅ | ❌ | useSearchPurchases (PurchasesListPage) | Synthetic SQL | [ ] |
| E3-074 | search_purchases_count | view_purchases | ✅ | ✅ | ❌ | (paired) | Synthetic SQL | [ ] |

### 2.4 Customer RPCs (11 rows)

| ID | RPC | Gate | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-075 | create_customer_basic (NEW v2.9 in 0075) | create_customer_basic | ✅ | ✅ | ✅ | useCreateCustomer (via create_customer_full migrated in v2.9.0.1) | Synthetic SQL + Manual UI | [ ] |
| E3-076 | create_customer_full (NEW v2.9 in 0075) | create_customer_full (+ assign_customer_tier if tier_id non-null) | ✅ | ✅ | ❌ (salesperson default false) | useCreateCustomer (v2.9.0.1 sweep migrated) | Synthetic SQL + Manual UI | [ ] |
| E3-077 | create_customer_full (tier_id conditional gate) | additional assign_customer_tier when p_tier_id is non-null | ✅ | ✅ | ❌ | useCreateCustomer | Synthetic SQL (Pilot-only — salesperson w/ create_customer_full granted overall) | [ ] |
| E3-078 | list_customers (rewritten 0076b conditional projection) | view_customers | ✅ | ✅ | ✅ | useListCustomers (CustomersListPage) | Synthetic SQL + Manual UI | [ ] |
| E3-079 | recent_customers (rewritten 0076b conditional projection) | view_customers | ✅ | ✅ | ✅ | useRecentCustomers (POS CustomerPicker) | Synthetic SQL | [ ] |
| E3-080 | search_khata_customers | view_customer_khata | ✅ | ✅ | ❌ | useSearchKhataCustomers (KhataPage) | Synthetic SQL | [ ] |
| E3-081 | search_khata_customers_count | view_customer_khata | ✅ | ✅ | ❌ | (paired) | Synthetic SQL | [ ] |
| E3-082 | define_tier | manage_customer_tiers | ✅ | ❌ | ❌ | useDefineTier (TiersPage) | Synthetic SQL | [ ] |
| E3-083 | update_tier | manage_customer_tiers | ✅ | ❌ | ❌ | useUpdateTier | Synthetic SQL | [ ] |
| E3-084 | set_default_tier | manage_customer_tiers | ✅ | ❌ | ❌ | useSetDefaultTier | Synthetic SQL | [ ] |
| E3-085 | deactivate_tier | manage_customer_tiers | ✅ | ❌ | ❌ | useDeactivateTier | Synthetic SQL | [ ] |
| E3-086 | update_customer (**NEW v2.9.1** migration 0087) | edit_customer (+ assign_customer_tier when tier_id changes) | ✅ | ✅ | ❌ | useUpdateCustomer (Phase C migrated) | Synthetic SQL + Manual UI | [ ] |

### 2.5 Supplier RPCs (5 rows)

| ID | RPC | Gate | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-087 | search_suppliers | view_suppliers | ✅ | ✅ | ❌ | useSearchSuppliers (SuppliersListPage, SupplierCombobox) | Synthetic SQL | [ ] |
| E3-088 | recent_suppliers | view_suppliers | ✅ | ✅ | ❌ | useRecentSuppliers (NewPurchasePage) | Synthetic SQL | [ ] |
| E3-089 | create_supplier_inline | manage_suppliers | ✅ | ✅ | ❌ | useCreateSupplier | Synthetic SQL | [ ] |
| E3-090 | update_supplier (**NEW v2.9.1** migration 0087) | manage_suppliers | ✅ | ✅ | ❌ | useUpdateSupplier (Phase C migrated) | Synthetic SQL + Manual UI | [ ] |
| E3-091 | archive_supplier (**NEW v2.9.1** migration 0087) | manage_suppliers | ✅ | ✅ | ❌ | useArchiveSupplier (Phase C migrated) | Synthetic SQL | [ ] |

### 2.6 Financial RPCs (7 rows)

| ID | RPC | Gate | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-092 | receive_payment | receive_payment | ✅ | ✅ | ✅ | useReceivePayment (ReceivePaymentDialog) | Synthetic SQL + Manual UI | [ ] |
| E3-093 | receive_payment (daily cap) | shops.salesperson_payment_cap_pkr per (shop, non-owner-user, day) | N/A (owner bypass) | bounded | bounded | useReceivePayment | Synthetic SQL (Pilot-only) | [ ] |
| E3-094 | reverse_ledger_entry | reverse_ledger_entry | ✅ | ✅ | ❌ | useReverseLedgerEntry (ReverseEntryDialog) | Synthetic SQL | [ ] |
| E3-095 | create_expense (NEW in 0075) | create_expense | ✅ | ✅ | ❌ | useCreateExpense (v2.9.1 wired) | Synthetic SQL + Manual UI | [ ] |
| E3-096 | update_expense (NEW in 0075) | edit_expense | ✅ | ✅ | ❌ | useUpdateExpense | Synthetic SQL | [ ] |
| E3-097 | update_expense (own-creator + 24h window) | inline body checks `auth.uid() = created_by` + `now() - created_at <= 24h` | ✅ (owner respects same gate) | bounded | bounded | useUpdateExpense | Synthetic SQL (Pilot-only — second non-owner) | [ ] |
| E3-098 | upsert_monthly_target (NEW in 0075) | manage_monthly_targets | ✅ | ❌ | ❌ | useUpsertTarget (TargetsPage) | Synthetic SQL + Manual UI | [ ] |

### 2.7 Settings RPCs (4 rows)

| ID | RPC | Gate | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-099 | update_shop_settings (NEW in 0075; v2.9.0.1 wired) | edit_shop_settings | ✅ | ❌ | ❌ | useUpdateShopAlertDefaults / useUpdateShopExpiredSaleSettings | Synthetic SQL + Manual UI | [ ] |
| E3-100 | update_owner_details (NEW in 0075) | edit_owner_details | ✅ | ❌ | ❌ | useUpdateOwnerDetails (Phase D8 to be wired) | Synthetic SQL | [ ] |
| E3-101 | get_active_shop (**NEW v2.9.1** migration 0087) | none (membership) | ✅ | ✅ | ✅ | useActiveShop (Phase C-introduced) | Synthetic SQL | [ ] |
| E3-102 | get_shop_settings (**NEW v2.9.1** migration 0087) | none beyond membership | ✅ | ✅ | ✅ | useShopAlertDefaults / useShopExpiredSaleSettings (Phase C migrated) | Synthetic SQL | [ ] |

### 2.8 Team / RBAC RPCs (16 rows)

| ID | RPC | Gate | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-103 | get_team_for_active_shop (NEW in 0075) | view_team | ✅ | ❌ | ❌ | useTeam (TeamPage) | Synthetic SQL + Manual UI | [ ] |
| E3-104 | get_user_permissions (NEW in 0075) | (self) OR view_team | ✅ | ✅ for self / ❌ for others | ✅ for self / ❌ for others | useSelfPermissions / useUserPermissions | Synthetic SQL + Manual UI | [ ] |
| E3-105 | modify_user_permission (NEW in 0075) | modify_user_permissions | ✅ | ❌ | ❌ | useModifyUserPermission (EditPermissionsDialog) | Synthetic SQL | [ ] |
| E3-106 | modify_user_permission (cannot_modify_own_permissions) | self-modify check | always raises if `target = auth.uid()` | always raises | always raises | useModifyUserPermission | Synthetic SQL | [ ] |
| E3-107 | modify_user_permission (cannot_modify_owner_or_unknown_user) | target.is_owner check | always raises if target is owner | always raises | always raises | useModifyUserPermission | Synthetic SQL | [ ] |
| E3-108 | modify_user_permission (permission_dependency_missing) | requires[] check on grant | bypass not allowed (owner can still trigger) | enforced | enforced | useModifyUserPermission | Synthetic SQL | [ ] |
| E3-109 | modify_user_permission (cannot_revoke_required_permission) | reverse dep check on revoke | enforced | enforced | enforced | useModifyUserPermission | Synthetic SQL | [ ] |
| E3-110 | apply_preset_to_user (NEW in 0075) | modify_user_permissions | ✅ | ❌ | ❌ | useApplyPresetToUser | Synthetic SQL | [ ] |
| E3-111 | update_user_discount_limits (NEW in 0075) | modify_user_discount_limits | ✅ | ❌ | ❌ | useUpdateUserDiscountLimits (EditDiscountLimitsDialog) | Synthetic SQL + Manual UI | [ ] |
| E3-112 | revoke_user_access (NEW in 0075) | revoke_user_access | ✅ | ❌ | ❌ | useRevokeUserAccess (RevokeAccessConfirmDialog) | Synthetic SQL | [ ] |
| E3-113 | revoke_user_access (cannot_revoke_own_access) | self check | always raises | always raises | always raises | useRevokeUserAccess | Synthetic SQL | [ ] |
| E3-114 | create_invitation (NEW in 0075) | invite_users | ✅ | ❌ | ❌ | useCreateInvitation (InviteUserDialog) | Synthetic SQL + Manual UI | [ ] |
| E3-115 | create_invitation (cannot_invite_owner) | preset must be manager or salesperson | always raises | always raises | always raises | useCreateInvitation | Synthetic SQL | [ ] |
| E3-116 | create_invitation (permission_dependency_missing) | resolves preset + overrides; requires[] checked | enforced | n/a (no perm anyway) | n/a | useCreateInvitation | Synthetic SQL | [ ] |
| E3-117 | cancel_invitation (NEW in 0075) | cancel_invitations | ✅ | ❌ | ❌ | useCancelInvitation | Synthetic SQL | [ ] |
| E3-118 | get_invitation_for_acceptance (**NEW v2.9.1** migration 0088) | none (invitee flow) | callable by invitee | callable by invitee | callable by invitee | AcceptInvitationPage | Synthetic SQL + Manual UI | [ ] |
| E3-119 | list_pending_invitations_for_shop (**NEW v2.9.1** migration 0087) | view_team | ✅ | ❌ | ❌ | usePendingInvitations (PendingInvitationsTable) | Synthetic SQL | [ ] |
| E3-120 | list_permission_audit_for_shop (**NEW v2.9.1** migration 0087) | view_user_audit_log | ✅ | ❌ | ❌ | useAuditLog (AuditLogSection) | Synthetic SQL | [ ] |
| E3-121 | get_team_member_profiles (**NEW v2.9.1** migration 0087) | view_team | ✅ | ❌ | ❌ | (helper in TeamMembersTable) | Synthetic SQL | [ ] |

### 2.9 Identity-helper RPCs (no permission, but membership gates — 4 rows)

| ID | RPC | Gate | Owner | Mgr-default | Sales-default | Frontend caller | Test method | Status |
|---|---|---|---|---|---|---|---|---|
| E3-122 | user_has_shop_access | none — returns boolean | true for self-shop | true for self-shop | true for self-shop | (server-internal, not directly called) | Synthetic SQL | [ ] |
| E3-123 | user_has_permission | none — returns boolean | true (owner shortcut) | per granted row | per granted row | (server-internal; mirrored by usePermission) | Synthetic SQL | [ ] |
| E3-124 | user_permissions_in_shop | none — returns own permissions | 50 rows owner_implicit | per granted set | per granted set | useSelfPermissions on session-init | Synthetic SQL | [ ] |
| E3-125 | set_active_shop | membership check (no_access_to_shop on miss) | succeeds for own shops | succeeds for own shops | succeeds for own shops | useSetActiveShop (ShopSwitcherDropdown) | Synthetic SQL + Manual UI | [ ] |

---

## Section 3: UI action gates (48 rows)

One row per HIDE / GREY-OUT decision encoded in Phase D clusters 2-8. Pattern reference: HIDE = element not in DOM; GREY-OUT = rendered disabled + tooltip "Requires permission: {key}. Contact your shop owner."; HIDE-COL = column not in table (table header + row cells absent); SHOW-BOOL = numeric replaced with has_khata boolean.

"normal" = button renders enabled; "grey" = renders disabled + tooltip; "hidden" = not in DOM.

### 3.1 Navigation (12 rows)

| ID | Page / Component | Element | Pattern | Permission | Owner | Mgr-default | Sales-default | Test method | Status |
|---|---|---|---|---|---|---|---|---|---|
| E3-126 | navConfig.ts | POS menu item | HIDE | record_sale | normal | normal | normal | Manual UI | [ ] |
| E3-127 | navConfig.ts | Products menu item | HIDE | view_products | normal | normal | normal | Manual UI | [ ] |
| E3-128 | navConfig.ts | Customers menu item | HIDE | view_customers | normal | normal | normal | Manual UI | [ ] |
| E3-129 | navConfig.ts | Sales menu item | HIDE | record_sale OR view_all_sales | normal | normal | normal (own only) | Manual UI | [ ] |
| E3-130 | navConfig.ts | Khata menu item | HIDE | view_customer_khata | normal | normal | hidden | Manual UI | [ ] |
| E3-131 | navConfig.ts | Stock-in menu item | HIDE | view_purchases | normal | normal | hidden | Manual UI | [ ] |
| E3-132 | navConfig.ts | Suppliers menu item | HIDE | view_suppliers | normal | normal | hidden | Manual UI | [ ] |
| E3-133 | navConfig.ts | Expenses menu item | HIDE | view_expenses | normal | normal | hidden | Manual UI | [ ] |
| E3-134 | navConfig.ts | Targets menu item | HIDE | view_monthly_targets | normal | normal | hidden | Manual UI | [ ] |
| E3-135 | navConfig.ts | Reports menu item | HIDE | view_reports | normal | normal | hidden | Manual UI | [ ] |
| E3-136 | TopBar profile popper | "Team" menu item | HIDE | view_team | normal | hidden | hidden | Manual UI | [ ] |
| E3-137 | TopBar | ShopSwitcherDropdown | HIDE | (rendered only when >1 shop on user) | hidden until 2nd shop | hidden until 2nd shop | hidden until 2nd shop | Manual UI (Pilot-only — needs multi-shop user) | [ ] |

### 3.2 Dashboard widgets (8 rows)

| ID | Page | Element | Pattern | Permission | Owner | Mgr-default | Sales-default | Test method | Status |
|---|---|---|---|---|---|---|---|---|---|
| E3-138 | DashboardPage | StatCard today_sales | HIDE/SCOPE | view_all_sales (else self-scoped) | normal (all) | normal (all) | self-only | Manual UI | [ ] |
| E3-139 | DashboardPage | StatCard outstanding_total | HIDE | view_customer_outstanding | normal | normal | normal | Manual UI | [ ] |
| E3-140 | DashboardPage | StatCard mtd_net_profit | HIDE | view_sale_cost | normal | hidden (Mgr default = false) | hidden | Manual UI | [ ] |
| E3-141 | DashboardPage | TargetBar section | HIDE | view_monthly_targets | normal | normal | hidden | Manual UI | [ ] |
| E3-142 | DashboardPage | "Set target" CTA | GREY-OUT | manage_monthly_targets | normal | grey | hidden (TargetBar gone) | Manual UI | [ ] |
| E3-143 | DashboardPage | Quick action "New sale" | HIDE | record_sale | normal | normal | normal | Manual UI | [ ] |
| E3-144 | DashboardPage | Quick action "New purchase" | HIDE | record_purchase | normal | normal | hidden | Manual UI | [ ] |
| E3-145 | DashboardPage | Quick action "Add expense" | HIDE | create_expense | normal | normal | hidden | Manual UI | [ ] |
| E3-146 | DashboardPage | Quick action "View khata" | HIDE | view_customer_khata | normal | normal | hidden | Manual UI | [ ] |
| E3-147 | DashboardPage | InventoryAlertsWidget | HIDE | view_inventory_batches | normal | normal | normal | Manual UI | [ ] |
| E3-148 | DashboardPage | ExpiredStockWidget | HIDE | view_inventory_batches | normal | normal | normal | Manual UI | [ ] |
| E3-149 | DashboardPage | ExpiredSalesWidget | HIDE | view_all_sales + view_inventory_batches | normal | normal | hidden (no view_all_sales) | Manual UI | [ ] |

### 3.3 POS internals (7 rows)

| ID | Page / Component | Element | Pattern | Permission | Owner | Mgr-default | Sales-default | Test method | Status |
|---|---|---|---|---|---|---|---|---|---|
| E3-150 | POSPage CartPanel | "Below avg cost" warning | HIDE | view_sale_cost + view_product_cost | visible | hidden (Mgr lacks view_sale_cost) | hidden | Manual UI | [ ] |
| E3-151 | POSPage CartPanel | CustomerPicker | HIDE | view_customers | normal | normal | normal | Manual UI | [ ] |
| E3-152 | POSPage CustomerPicker | "Add new" inline item | HIDE | create_customer_basic | normal | normal | normal | Manual UI | [ ] |
| E3-153 | POSPage AddCustomerDialog | Address/notes/tier fields | HIDE | create_customer_full | normal | normal | hidden (Sales default = false) | Manual UI | [ ] |
| E3-154 | POSPage ConfirmExpiredSaleDialog | "Confirm" button | HIDE | confirm_expired_sale_at_pos | normal | normal | normal (Sales default = true) | Manual UI | [ ] |
| E3-155 | POSPage PosBatchPicker | cost_per_unit column | HIDE-COL | view_batch_cost | normal | normal | hidden | Manual UI | [ ] |
| E3-156 | POSPage OverrideDiscountDialog | Discount input max | CLIP | (no permission — uses user_shop_access.discount_limits) | uncapped | capped to 25% / 15% | capped to 5% / 3% / 100 PKR / 300 PKR | Manual UI (Pilot-only) | [ ] |

### 3.4 Products (8 rows)

| ID | Page / Component | Element | Pattern | Permission | Owner | Mgr-default | Sales-default | Test method | Status |
|---|---|---|---|---|---|---|---|---|---|
| E3-157 | ProductsListPage | "New product" button | GREY-OUT | create_product | normal | normal | grey | Manual UI | [ ] |
| E3-158 | ProductTable | avg_cost column | HIDE-COL | view_product_cost | normal | normal | hidden | Manual UI | [ ] |
| E3-159 | ProductTable | last_purchase_cost column | HIDE-COL | view_product_cost | normal | normal | hidden | Manual UI | [ ] |
| E3-160 | ProductDetailBody | Edit button | GREY-OUT | edit_product | normal | normal | grey | Manual UI | [ ] |
| E3-161 | ProductDetailBody | avg_cost / last_purchase rows | HIDE | view_product_cost | normal | normal | hidden | Manual UI | [ ] |
| E3-162 | ProductDetailBody | BatchesSection | HIDE | view_inventory_batches | normal | normal | normal | Manual UI | [ ] |
| E3-163 | ProductDetailBody / PacksSection | "Add pack" + per-row edit | GREY-OUT | manage_product_packs | normal | normal | grey | Manual UI | [ ] |
| E3-164 | ProductEditDialog | is_active archive toggle | GREY-OUT | archive_product | normal | normal | grey | Manual UI | [ ] |
| E3-165 | ProductEditDialog | expiry/warranty/policy fields | GREY-OUT | edit_product_expiry_overrides | normal | normal | grey | Manual UI | [ ] |
| E3-166 | CategoryCombobox | "Create new category" item | HIDE | manage_product_categories | normal | normal | hidden | Manual UI | [ ] |
| E3-167 | VariantsTable | Inline edit price/sku | GREY-OUT | edit_product | normal | normal | grey | Manual UI | [ ] |
| E3-168 | VariantsTable | Cost columns | HIDE-COL | view_product_cost | normal | normal | hidden | Manual UI | [ ] |

### 3.5 Customers / Khata (8 rows)

| ID | Page / Component | Element | Pattern | Permission | Owner | Mgr-default | Sales-default | Test method | Status |
|---|---|---|---|---|---|---|---|---|---|
| E3-169 | CustomersListPage | "Add customer" button | GREY-OUT | create_customer_basic | normal | normal | normal | Manual UI | [ ] |
| E3-170 | CustomersListPage | Phone column | HIDE-COL | view_customer_contact | normal | normal | normal (Sales default = true) | Manual UI | [ ] |
| E3-171 | CustomersListPage | Address column | HIDE-COL | view_customer_contact | normal | normal | normal | Manual UI | [ ] |
| E3-172 | CustomersListPage | Outstanding column | SHOW-BOOL | view_customer_outstanding | numeric | numeric | numeric (Sales default = true) | Manual UI | [ ] |
| E3-173 | CustomersListPage | "View history" link | HIDE | view_customer_khata | normal | normal | hidden | Manual UI | [ ] |
| E3-174 | CustomersListPage | Edit pencil | GREY-OUT | edit_customer | normal | normal | grey | Manual UI | [ ] |
| E3-175 | CustomerDetailPage | "Receive Payment" button | GREY-OUT | receive_payment | normal | normal | normal | Manual UI | [ ] |
| E3-176 | CustomerDetailPage | Ledger table | HIDE | view_customer_khata | normal | normal | hidden | Manual UI | [ ] |
| E3-177 | CustomerDetailPage | Reverse entry icon | GREY-OUT | reverse_ledger_entry | normal | normal | grey | Manual UI | [ ] |
| E3-178 | CustomerForm | Tier dropdown | HIDE | assign_customer_tier | normal | normal | hidden (Sales default = false) | Manual UI | [ ] |
| E3-179 | KhataPage | Outstanding column numeric | SHOW-BOOL | view_customer_outstanding | numeric | numeric | numeric | Manual UI | [ ] |

### 3.6 Inventory / Batches / Suppliers / Expenses / Targets / Reports / Settings (13 rows)

| ID | Page / Component | Element | Pattern | Permission | Owner | Mgr-default | Sales-default | Test method | Status |
|---|---|---|---|---|---|---|---|---|---|
| E3-180 | ExpiredStockListPage | "Write off all" button | GREY-OUT | writeoff_batch | normal | normal | grey | Manual UI | [ ] |
| E3-181 | BatchesSection | cost_per_unit column | HIDE-COL | view_batch_cost | normal | normal | hidden | Manual UI | [ ] |
| E3-182 | BatchesSection | Per-row Write off icon | GREY-OUT | writeoff_batch | normal | normal | grey | Manual UI | [ ] |
| E3-183 | PurchasesListPage | "New stock-in" button | GREY-OUT | record_purchase | normal | normal | hidden (page hidden anyway) | Manual UI | [ ] |
| E3-184 | NewPurchasePage | "Create new pack" in unit dropdown | GREY-OUT | manage_product_packs | normal | normal | hidden | Manual UI | [ ] |
| E3-185 | PurchaseDetailPage | "Effect on inventory" card (avg_before/after) | HIDE | view_product_cost | normal | normal | hidden | Manual UI | [ ] |
| E3-186 | SuppliersListPage | "New supplier" / Edit pencil / Archive icon | GREY-OUT | manage_suppliers | normal | normal | hidden (page hidden) | Manual UI | [ ] |
| E3-187 | ExpensesPage | "Add expense" button | GREY-OUT | create_expense | normal | normal | hidden (page hidden) | Manual UI | [ ] |
| E3-188 | TargetsPage | Save button + numeric input fields | GREY-OUT (read-only) | manage_monthly_targets | normal | grey | hidden | Manual UI | [ ] |
| E3-189 | ReportsPage | Expense breakdown section | HIDE | view_expenses | normal | normal | hidden | Manual UI | [ ] |
| E3-190 | ReportsPage | Outstanding section | HIDE | view_customer_outstanding | normal | normal | normal | Manual UI | [ ] |
| E3-191 | ReportsPage | Monthly profit columns | HIDE-COL | view_sale_cost | normal | hidden | hidden | Manual UI | [ ] |
| E3-192 | SettingsPage | Customer tiers nav row | HIDE | manage_customer_tiers | normal | hidden | hidden | Manual UI | [ ] |
| E3-193 | SettingsPage | Variant attributes nav row | HIDE | manage_variant_attributes | normal | hidden | hidden | Manual UI | [ ] |
| E3-194 | SettingsPage | Inventory alert defaults section | HIDE | edit_shop_settings | normal | hidden | hidden | Manual UI | [ ] |
| E3-195 | SettingsPage | Expired-sale policy section | HIDE | edit_shop_settings | normal | hidden | hidden | Manual UI | [ ] |
| E3-196 | SettingsPage | Team nav row | HIDE | view_team | normal | hidden | hidden | Manual UI | [ ] |
| E3-197 | SettingsPage | Owner details section | HIDE | view_owner_details | normal | hidden | hidden | Manual UI | [ ] |
| E3-198 | SettingsPage | Shop information section | HIDE | edit_shop_settings | normal | hidden | hidden | Manual UI | [ ] |
| E3-199 | SettingsPage | Units of measure section | HIDE | manage_units_of_measure | normal | hidden | hidden | Manual UI | [ ] |
| E3-200 | TeamPage | "Invite user" button | GREY-OUT | invite_users | normal | n/a (page hidden) | n/a | Manual UI (Pilot-only — co-owner) | [ ] |
| E3-201 | TeamPage | Edit permissions per row | GREY-OUT | modify_user_permissions | normal | n/a | n/a | Manual UI (Pilot-only) | [ ] |
| E3-202 | TeamPage | Edit discount limits per row | GREY-OUT | modify_user_discount_limits | normal | n/a | n/a | Manual UI (Pilot-only) | [ ] |
| E3-203 | TeamPage | Cancel invitation per row | GREY-OUT | cancel_invitations | normal | n/a | n/a | Manual UI (Pilot-only) | [ ] |
| E3-204 | TeamPage | Revoke access per row | GREY-OUT | revoke_user_access | normal | n/a | n/a | Manual UI (Pilot-only) | [ ] |
| E3-205 | TeamPage | Audit log section | HIDE | view_user_audit_log | normal | n/a | n/a | Manual UI (Pilot-only) | [ ] |

---

## Section 4: Conditional read projections (23 rows)

The 14 permission-aware DEFINER views (from migration 0074) + search RPCs from 0076b. One row per (view × conditional column). Cross-referenced against `design/2026-05-13-v291-rpc-inventory.md` §2 and the 0076b migration body.

Test method for all rows: **Synthetic SQL under `SET ROLE authenticated`** + a real session JWT (per D-1).

| ID | View / RPC | Column | Always projected | NULL when missing | Mgr-default sees | Sales-default sees | Status |
|---|---|---|---|---|---|---|---|
| E3-206 | products_view | cost, avg_cost, last_purchase_cost | no | view_product_cost | populated (Mgr default = true) | NULL (Sales default = false) | [ ] |
| E3-207 | product_variants_view | cost, avg_cost, last_purchase_cost | no | view_product_cost | populated | NULL | [ ] |
| E3-208 | inventory_batches_view | cost_per_unit | no | view_batch_cost | populated | NULL | [ ] |
| E3-209 | invoices_view | gross_profit (computed total - total_cost) | no | view_sale_cost | NULL (Mgr default = false) | NULL | [ ] |
| E3-210 | invoices_view | gross_margin_percent | no | view_profit_margin | NULL | NULL | [ ] |
| E3-211 | invoices_view | row filter (cashier_id = self OR view_all_sales) | yes | n/a | rows for own + colleagues (Mgr default has view_all_sales = true) | rows for self only (Sales default = false) | [ ] |
| E3-212 | sale_items_view | cost_at_sale | no | view_sale_cost | NULL | NULL | [ ] |
| E3-213 | sale_items_view | line_profit | no | view_sale_cost | NULL | NULL | [ ] |
| E3-214 | sale_items_view | margin_percent | no | view_profit_margin | NULL | NULL | [ ] |
| E3-215 | customers_view | phone, address | no | view_customer_contact | populated | populated | [ ] |
| E3-216 | customers_view | outstanding_balance | no | view_customer_outstanding | populated | populated | [ ] |
| E3-217 | monthly_summary_view | gross_profit | no | view_sale_cost | NULL | NULL | [ ] |
| E3-218 | customer_outstanding (replaced 0074) | outstanding | no | view_customer_outstanding | populated | populated | [ ] |
| E3-219 | shop_owner_details_view | entire row | gated row filter | view_owner_details | 0 rows | 0 rows | [ ] |
| E3-220 | list_customers RPC (0076b) | phone, address | no | view_customer_contact | populated | populated | [ ] |
| E3-221 | list_customers RPC (0076b) | outstanding | no | view_customer_outstanding | populated | populated | [ ] |
| E3-222 | recent_customers RPC (0076b) | phone, address | no | view_customer_contact | populated | populated | [ ] |
| E3-223 | search_products RPC (0076b) | avg_cost, last_purchase_cost, min_price, max_price | no | view_product_cost | populated | NULL | [ ] |
| E3-224 | recent_purchase_products RPC (0076b) | avg_cost | no | view_product_cost | populated | NULL | [ ] |
| E3-225 | total_outstanding view | total + customer_count | yes (not gated; aggregate is non-leaky per ADR & §6.2 of inventory) | n/a | populated | populated | [ ] |
| E3-226 | shop_effective_subscription view | effective_status, status, trial_ends_at, current_period_ends_at, last_payment_date | yes (any shop member can read) | n/a | populated | populated | [ ] |
| E3-227 | purchases_view + purchase_items_view + purchase_overhead_items_view | entire rows | yes (gated by view_purchases at row level) | n/a | populated (Mgr default = true) | 0 rows (Sales default = false) | [ ] |
| E3-228 | invoices_view "view_all_sales=false case" — colleague's invoice → 0 rows | row filter | yes | n/a | rows visible | 0 rows for colleagues | [ ] |

---

## Section 5: Special flows (6 multi-step blocks)

Multi-step flows that don't fit cleanly into a single row. Each has a sub-section with ordered steps + expected outcome per role.

### 5.1 — E3-229: Invitation create → display 4-digit code → invitee accept → onboarding bypass → land on /dashboard

**Test method:** Manual UI + Synthetic SQL (Pilot-only — needs two real auth sessions in separate browsers).

Steps:
1. Owner logged in at Shop X. Navigate to `/settings/team`. **Expected (owner):** page loads, "Invite user" button visible.
2. Owner clicks "Invite user". Dialog opens. **Expected:** email field + preset radio (manager / salesperson) + (optional) override toggles. "Cannot invite owner" not shown.
3. Owner enters `invitee@test.local`, picks "salesperson". Submit.
4. RPC `create_invitation` returns `{invitation_id, confirmation_code}`. **Expected:** code is 4 digits, visible on screen with copy button. UI prompts owner to share verbally.
5. In second browser, invitee signs up with `invitee@test.local`. Navigates to `/invite/accept/<invitation_id>` (URL shared by owner).
6. Route guard: `RequireAuth` only (NO `RequireOnboarded` per router line 104-106). **Expected (auth'd new user):** page loads, NOT redirected to `/onboarding`.
7. Page calls `get_invitation_for_acceptance(p_invitation_id)` (new in migration 0088). **Expected:** returns shop name, intended permissions preview.
8. Invitee enters wrong code → `accept_invitation` raises `invalid_confirmation_code`. UI surfaces inline error + decrementing-attempts counter ("4 attempts remaining" → ... → "1 attempt remaining").
9. Invitee enters correct code → RPC returns new `user_shop_access.id`. UI calls `set_active_shop(new_shop_id)`.
10. UI invalidates all TanStack Query caches; navigates to `/dashboard`. **Expected:** dashboard renders with salesperson preset (no MTD profit card, no expense quick-action, etc.).
11. Permission audit row inserted with `action='access_granted'`.
12. `profiles.onboarding_completed` auto-flipped to `true` for invitee (so future logins bypass onboarding wizard).

Status: [ ]

### 5.2 — E3-230: Shop switch → query cache invalidation → redirect to /dashboard

**Test method:** Manual UI (Pilot-only — needs user with access to 2+ shops, e.g. cross-shop@test.local from C.2.0 setup).

Steps:
1. User logged in at Shop X (single shop currently). `get_user_shop_list()` returns one row. ShopSwitcherDropdown HIDDEN.
2. (Setup) Invite cross-shop user to Shop Y. They accept. Now `get_user_shop_list()` returns 2 rows.
3. Refresh / re-login at Shop X. **Expected:** ShopSwitcherDropdown VISIBLE in TopBar.
4. User clicks dropdown, picks Shop Y. UI calls `set_active_shop(shop_y_id)`. **Expected:** validates membership server-side; returns success.
5. UI: writes `shop_y_id` to `localStorage['nizaamify.active_shop_id']`; updates `useActiveShop()` context; calls `queryClient.clear()` (or scoped invalidation).
6. UI navigates to `/dashboard`. **Expected:** dashboard refetches with `app-shop-id: <shop_y_id>` header on every Supabase request.
7. Dashboard data reflects Shop Y, not Shop X. Products page reflects Shop Y inventory.
8. User picks a different shop they don't belong to via devtools → `set_active_shop` raises `no_access_to_shop`. UI re-fetches `get_user_shop_list` and shows shop picker modal.

Status: [ ]

### 5.3 — E3-231: Permission revoke → 60s stale cache window → revalidate on focus

**Test method:** Manual UI (Pilot-only — needs two browser sessions). Tests ADR `2026-05-13-v291-permission-hooks-60s-cache` and F-PD-08 from attack-surface.

Steps:
1. Browser A: owner logged in at Shop X. Navigate to `/settings/team`.
2. Browser B: manager-x logged in at Shop X. Navigate to `/products`. Verify "New product" button is enabled (Mgr default has create_product).
3. Browser A: owner clicks "Edit permissions" on manager-x row. Toggles off `create_product`. Submits. RPC `modify_user_permission(target=manager-x, key=create_product, granted=false, reason='...')` succeeds.
4. Browser A: owner's session invalidates `['permissions', shop_x_id, manager-x_id]` AND `['team', shop_x_id]` cache keys.
5. Browser B: manager-x's session: UI still shows "New product" enabled. **Expected (the 60s window):** within 60s without window-focus, the cached `usePermission('create_product')` still returns true. Click → submits `create_product_with_opening_stock` → RPC raises `insufficient_permissions` (server is immediately authoritative). UI surfaces toast.
6. Browser B: manager-x switches to another tab + back (window-focus). `refetchOnWindowFocus: true` triggers refetch of `user_permissions_in_shop(shop_x_id)`. **Expected:** "New product" button re-renders as GREY-OUT with tooltip.
7. Browser B (alternative): wait 60s of activity. **Expected:** next query triggers refetch.
8. Audit table `user_shop_permission_audit` has a row for the revoke.

Status: [ ]

### 5.4 — E3-232: Dependency-aware grant — grant view_customer_outstanding without view_customers → cascade or block

**Test method:** Synthetic SQL + Manual UI (Pilot-only).

Steps:
1. Salesperson preset user does NOT have `view_customer_outstanding` granted by default? **Re-check:** salesperson default = TRUE for view_customer_outstanding per catalog line 60. So this is harder to test on salesperson. Use a custom user where all customer-perms revoked first.
2. Custom user `manager-x-custom@test.local` with all customer-permissions revoked (view_customers off, view_customer_contact off, view_customer_outstanding off).
3. Owner navigates to `/settings/team`, opens "Edit permissions" on manager-x-custom.
4. Owner toggles `view_customer_outstanding` ON. **Expected (client-side validation per Phase D):** modal shows "Granting view_customer_outstanding requires view_customers. Grant view_customers first?" — confirm modal with cascade.
5. Owner confirms cascade. UI calls `modify_user_permission(target=mxc, key=view_customers, granted=true)` then `modify_user_permission(target=mxc, key=view_customer_outstanding, granted=true)`.
6. **Alternative (server-side enforcement):** If the cascade UI is absent / user POSTs only the outstanding grant, server-side `validate_permission_grant` raises `permission_dependency_missing` (detail: `Granting view_customer_outstanding requires view_customers to also be granted`). UI parses and offers cascade.
7. After both grants, user mxc refreshes — sees customer list with phone/address NULL (view_customer_contact still off) but outstanding numeric populated.
8. Reverse direction: owner revokes `view_customers` while `view_customer_outstanding` is granted → `cannot_revoke_required_permission` (detail: `Cannot revoke view_customers: view_customer_outstanding depends on it and is granted`).

Status: [ ]

### 5.5 — E3-233: 5-strike auto-cancel on invitation

**Test method:** Manual UI + Synthetic SQL (Pilot-only).

Steps:
1. Owner creates invitation for `invitee@test.local`. Returns `{invitation_id, confirmation_code='1234'}`.
2. Invitee signs up, navigates to `/invite/accept/<id>`.
3. Enter wrong code 4 times. Each call raises `invalid_confirmation_code`. UI: decrementing counter.
4. 5th wrong attempt → `accept_invitation` increments failed_attempts to 5. **Expected:** raises `invitation_not_pending` with `detail = 'auto_cancelled_5_strike'`. `pending_invitations.status` flips to `'cancelled'`.
5. UI surfaces "Too many wrong codes; invitation cancelled. Contact your shop owner."
6. Invitee tries to enter the correct code: also raises `invitation_not_pending` (status='cancelled').
7. Owner sees the invitation status as "cancelled (auto)" in the pending invitations list.
8. Owner can create a fresh invitation (separate row, new 4-digit code).
9. Audit table: a row recorded for the auto-cancel.

Status: [ ]

### 5.6 — E3-234: Cluster 5 expired-sale-confirm permission-revoke hot-patch (warn-policy line → block dialog when caller lacks confirm_expired_sale_at_pos)

**Test method:** Manual UI + Synthetic SQL (Pilot-only — needs salesperson with `confirm_expired_sale_at_pos` revoked).

Steps:
1. Shop X has expired_sale_policy = 'warn' (shop default). Product P1 has has_batches=true, one expired batch (qty_remaining > 0).
2. Salesperson default has confirm_expired_sale_at_pos = TRUE. Owner revokes it.
3. Salesperson at POS adds P1 to cart, qty draws on expired batch. **Expected:** `preflight_expired_sale_check` returns `would_draw_expired=true, policy='warn'`.
4. UI: previously (with permission) showed ConfirmExpiredSaleDialog with a "Confirm sale" button. After hot-patch (permission revoked) → button is HIDDEN per E3-154. Dialog shows "Ask your manager to record this sale." with no action button.
5. If salesperson bypasses UI (devtools) and submits `record_sale` with `p_confirm_expired_sale=true`, wrapper raises `insufficient_permissions` (Required: confirm_expired_sale_at_pos).
6. If salesperson submits `record_sale` with `p_confirm_expired_sale=false`, `_v28` body raises `expired_stock_needs_confirmation`.
7. After 60s cache window or focus-refetch, UI re-renders to the hidden-button state immediately (matches §5.3 pattern).

Status: [ ]

---

## Section 6: Audit / observability checks (11 rows)

Verify audit `_by_user_id` / `created_by` / `updated_by_user_id` columns get populated correctly by the wrapper or inline-at-INSERT pattern.

Test method for all rows: **Synthetic SQL** (after a manual UI action; query Postgres directly to verify column value).

| ID | Trigger / Mutation | Audit column | Pattern | Expected | Status |
|---|---|---|---|---|---|
| E3-235 | `record_sale` (cash sale by salesperson) | `invoices.cashier_id` | inline-at-INSERT in `_v28` (pre-v2.9, preserved) | = caller's auth.uid() | [ ] |
| E3-236 | `record_sale` (credit sale → ledger debit) | `ledger_entries.created_by_user_id` | inline-at-INSERT in `_v28` (migration 0086) | = caller's auth.uid() | [ ] |
| E3-237 | `receive_payment` | `ledger_entries.created_by_user_id` | inline-at-INSERT (migration 0086) | = caller's auth.uid() | [ ] |
| E3-238 | `reverse_ledger_entry` | `ledger_entries.created_by_user_id` (reversal row) | inline-at-INSERT (migration 0086) | = caller's auth.uid() | [ ] |
| E3-239 | `record_purchase` | `purchases.cashier_id` | inline-at-INSERT in `_v28` (pre-v2.9, preserved) | = caller's auth.uid() | [ ] |
| E3-240 | `create_customer_basic` / `create_customer_full` | `customers.created_by_user_id` | inline-at-INSERT (new RPCs in 0075) | = caller's auth.uid() | [ ] |
| E3-241 | `update_customer` (NEW v2.9.1 migration 0087) | `customers.updated_by_user_id` | post-delegation UPDATE | = caller's auth.uid() | [ ] |
| E3-242 | `archive_product` (NEW v2.9.1) | `products.updated_by_user_id` + `product_variants.updated_by_user_id` (mass update) | post-delegation UPDATE | both set = caller's auth.uid() | [ ] |
| E3-243 | `modify_user_permission` | `user_shop_permission_audit` insert with `action='permission_granted'` / `'permission_revoked'` | inline-at-INSERT in RPC body | row inserted with target_user_id, permission_key, old_granted, new_granted, by_user_id = caller | [ ] |
| E3-244 | `accept_invitation` | `user_shop_permission_audit` insert with `action='access_granted'` | inline | row inserted | [ ] |
| E3-245 | `deactivate_batch` / `record_partial_writeoff` | `inventory_batches.last_modified_by_user_id` | post-delegation UPDATE (migration 0080) | = caller's auth.uid() | [ ] |
| E3-246 | `create_supplier_inline` + `update_supplier` (NEW v2.9.1) + `archive_supplier` (NEW v2.9.1) | `suppliers.created_by_user_id` / `updated_by_user_id` | post-delegation UPDATE | set correctly | [ ] |
| E3-247 | `create_category_inline` / `update_category` | `product_categories.created_by_user_id` / `updated_by_user_id` | post-delegation UPDATE (0080) | set correctly | [ ] |
| E3-248 | `define_pack_inline` / `update_pack` / `deactivate_pack` | `product_packs.created_by_user_id` / `updated_by_user_id` | post-delegation UPDATE (0080) | set correctly | [ ] |
| E3-249 | `define_tier` / `update_tier` / `set_default_tier` / `deactivate_tier` | `customer_tiers.created_by_user_id` / `updated_by_user_id` | post-delegation UPDATE (0080) | set correctly | [ ] |
| E3-250 | `create_product_with_opening_stock` / `create_product_with_variants` / `add_variant_to_product` | `products.created_by_user_id`/`updated_by_user_id` + `product_variants.created_by_user_id`/`updated_by_user_id` | post-delegation UPDATE (0080) | both set | [ ] |
| E3-251 | `update_product` (NEW v2.9.1 migration 0087) | `products.updated_by_user_id` | post-delegation UPDATE inside wrapper | [BLOCKED-flag-flip] — wired only when useUpdateProduct migrates per task #23 | [ ] |
| E3-252 | `update_product` (NEW v2.9.1 migration 0087) | `product_variants.updated_by_user_id` for variants touched | post-delegation UPDATE | [BLOCKED-flag-flip] — see above | [ ] |
| E3-253 | `update_variant_inline` (NEW v2.9.1 migration 0087) | `product_variants.updated_by_user_id` | post-delegation UPDATE inside wrapper | [BLOCKED-flag-flip] until task #23 migrates useUpdateVariantInline | [ ] |
| E3-254 | Legacy direct UPDATE on `products` from current `useUpdateProduct` (today) | `products.updated_by_user_id` | NOT WRITTEN | [BLOCKED-flag-flip] — direct table write today; awaits task #23 | [ ] |
| E3-255 | `create_expense` | `expenses.created_by` | inline-at-INSERT (new RPC in 0075) | = caller's auth.uid() | [ ] |
| E3-256 | `upsert_monthly_target` | `monthly_targets.updated_by_user_id` | inline (new RPC in 0075) | = caller's auth.uid() | [ ] |

---

## Section 7: Halt-criteria checks

Quick reference of things that must be true before any pilot flag flip (`RBAC_TEAM_UI_ENABLED = true`):

| ID | Check | Source | Status |
|---|---|---|---|
| HC-01 | All 24 audit queries (AQ-01..AQ-24) return zero rows | `design/2026-05-13-rbac-attack-surface.md` §C.3 | [ ] |
| HC-02 | AQ-23 specifically (DEFINER-wrapper shape-drift detector) returns zero rows; 65-wrapper baseline verified (11 exempt + 54 conforming + 0 deviations per CLAUDE.md "v2.9 RBAC" line) | §C.3 lines 2017–2077 | [ ] |
| HC-03 | AQ-24 (legacy `current_shop_id()` callers) returns zero rows outside baseline allowlist | §C.3 lines 2079–2105 | [ ] |
| HC-04 | Task #23 complete: useUpdateProduct + useUpdateVariantInline + useArchiveProduct migrated to call `update_product` / `update_variant_inline` / `archive_product` RPCs | tasks.md (search for "useUpdateProduct" / "task #23") | [ ] |
| HC-05 | Every Section 6 audit-column row [P] pass (E3-235..E3-256), except [BLOCKED-flag-flip] rows which become [P] after HC-04 | this matrix Section 6 | [ ] |
| HC-06 | No Section 1-5 [F] failures unresolved | this matrix | [ ] |
| HC-07 | Section 4 conditional projection assertions: all rows show non-owner sees correct NULL/populated state per catalog defaults | this matrix Section 4 | [ ] |
| HC-08 | Phase E.3 stats: ≥ 95% [P] pass rate on rows that don't require pilot-only setup (i.e., excluding Pilot-only rows). With ~177 non-pilot rows, allowance is 8 unresolved [F] at flip time. | this matrix Quick stats | [ ] |
| HC-09 | Owner regression test plan (Phase A.4 — `audit/2026-05-13-v291-phase-a4-owner-regression-test-plan.md`) passes end-to-end with zero defects | A.4 doc | [ ] |
| HC-10 | `customFetch` injects `app-shop-id` header on every Supabase request from a multi-shop user — verified in Network tab on Chrome devtools (per ADR `2026-05-13-v291-customfetch-app-shop-id-header`) | src/lib/customFetch.ts implementation | [ ] |
| HC-11 | 60-second TanStack staleness contract enforced for permission queries (per ADR `2026-05-13-v291-permission-hooks-60s-cache`); refetchOnWindowFocus = true; explicit invalidation on team-mutation success | src/features/team/hooks.ts | [ ] |

---

## Methodology / sources

### Files read end-to-end for this matrix

1. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0068_v29_foundation_enum_catalog.sql` — 50-permission catalog (lines 36-92 reviewed line-by-line for preset_owner_default / preset_manager_default / preset_salesperson_default flags and requires[] arrays).
2. `/home/ali/Documents/nizaam/nizaamify/src/router/index.tsx` — every route gate (37 routes total: 5 pre-auth, 2 onboarding/subscription, 1 invitation, 1 index, 28 authenticated).
3. `/home/ali/Documents/nizaam/nizaamify/design/2026-05-13-v291-rpc-inventory.md` — RPC catalogue (~74 caller-facing DEFINER RPCs documented; 41 wrapped + 17 NEW in 0075 + 6 rewritten in 0076b + 11 NEW in 0087 + 1 NEW in 0088).
4. `/home/ali/Documents/nizaam/nizaamify/design/2026-05-13-v291-page-permission-map.md` — page audit (940 lines, 110 hide/grey-out points reviewed; Section 3 of this matrix consolidates them).
5. `/home/ali/Documents/nizaam/nizaamify/audit/2026-05-13-v291-phase-a4-owner-regression-test-plan.md` — owner regression workflows A–I cross-referenced into Sections 5 and 6 for happy-path expectations.
6. `/home/ali/Documents/nizaam/nizaamify/design/2026-05-13-rbac-attack-surface.md` — §C.2 permission-by-permission test points (Section 2 rows traceable to T-PB-<key>-{with|without} test IDs in §C.2.1) and §C.3 audit queries AQ-01..AQ-24 (Section 7 HC-01..HC-03).
7. `/home/ali/Documents/nizaam/nizaamify/decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` — §"Discipline lesson" (lines 115-150) — source of D-1.
8. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0087_v291_phase_c.sql` — 11 NEW Phase C RPCs (update_customer, update_product, archive_product, update_variant_inline, update_supplier, archive_supplier, get_active_shop, get_shop_settings, list_pending_invitations_for_shop, list_permission_audit_for_shop, get_team_member_profiles).
9. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0088_v291_get_invitation_for_acceptance.sql` — 12th NEW v2.9.1 RPC.

### Cross-doc discrepancies discovered while building this matrix

The following items in the source docs disagree or warrant followup; flagged here so reviewers don't chase them as test failures:

1. **/inventory/expired-sales route gate (E3-020).** RESOLVED post-matrix. The router was updated to compose `RequirePermission('view_all_sales')` + `RequirePermission('view_inventory_batches')` per the page-map proposal. Salespersons (default `view_all_sales = false`) now correctly redirect; managers (both `true` by default) and owners pass. Custom users with `view_inventory_batches` but not `view_all_sales` are blocked, as intended for this audit surface.

2. **Pending invitations + audit log RLS vs RPC gates.** The RPC inventory §8.1 notes the design implies `view_team` + `view_user_audit_log` gate everything, but the direct-table RLS on `pending_invitations` (`pi_owner_or_invitee_read`) and `user_shop_permission_audit` (`uspa_owner_read`) is owner-only — not permission-gated. Migration 0087 mints `list_pending_invitations_for_shop` (gated by view_team) and `list_permission_audit_for_shop` (gated by view_user_audit_log) — these are the v2.9.1 RPC path. Frontend MUST route through the RPCs, not direct table reads, for non-owner team-viewers. Rows E3-119 + E3-120 (Section 2.8) cover the RPC layer; rows E3-200..E3-205 (Section 3.6) cover the UI gates. The direct-table-read failure is out of scope for v2.9.1 (no non-owner team-viewer can reach the table directly).

3. **`view_team` preset default — salesperson row.** Catalog row 86 has `preset_salesperson_default = false`. Catalog row 76 has `preset_salesperson_default = false` for view_user_audit_log. Both correct for the "salesperson can't see team page" outcome. Re-verify after any catalog patch.

4. **OnboardingPage status under E3-008.** The route `/invite/accept/:invitation_id` deliberately omits `RequireOnboarded` (router lines 104-106 comment is explicit). An invited user with `profiles.onboarding_completed = false` can still reach the accept page. Successful accept flips `onboarding_completed = true` server-side. Tests must cover the case where an invitee has never completed onboarding (this is the *common* case — a brand new user invited from outside).

5. **`/sales/:id` route currently has no `RequirePermission('view_sale_cost')` for cost-bearing columns.** Cost projection is handled at the view layer (E3-212, E3-213). Row-level access is `view_all_sales OR cashier_id=self`. A manager-default user sees colleagues' invoices (because `view_all_sales` default = true) but does NOT see cost or profit columns (because `view_sale_cost` default = false). This is the correct end state per the catalog; no discrepancy, just easy to misread.

6. **`shops.salesperson_payment_cap_pkr` naming.** Attack-surface F-PD-05 calls out the column applies to ALL non-owner callers (manager + salesperson + custom presets), not just salesperson preset. Cosmetic rename deferred per inventory doc §6.2; tests should treat the cap as applying to any non-owner.

7. **POS "below avg cost" warning (E3-150) is informational only — false negatives are acceptable.** For non-`view_product_cost` users, `c.avg_cost` in the cart line state is NULL/0 and the warning never fires. Page-permission-map flag 3 acknowledges this. Phase E.3 does not treat this as [F] when verifying with a non-cost user.

8. **`record_sale` `_v28` body raises errors WITHOUT explicit `using errcode`**, defaulting to `'P0001'`. Frontend matches by message string. Test code must do the same (don't match on SQLSTATE).

9. **DashboardBanner is always rendered**, deliberately unconditional per AppShell line 74. Even on `/settings/support` and `/subscription/expired`. Tests should not flag this as a missing-gate.

10. **Settings sections are "HIDE entirely" for non-owners per the user-instruction line in page-permission-map line 480** ("HIDE owner-only sections entirely (settings discoverability — non-owners shouldn't see what they can't touch)"). This deviates from the otherwise-blanket GREY-OUT pattern. Tests must verify non-owners see a minimal `/settings` (Language + (conditional) Team / Tiers / Variant attributes), not a long list of grey rows.

### Why some Section 1 rows say "n/a" for owner

Pre-auth routes (`/login`, `/signup`, etc.) redirect *away* if authenticated. They're not "permission-gated" — they're "auth-state gated." The owner-vs-non-owner distinction is meaningless. Rows are listed for completeness so route-guard regression covers them.

### Stable ID system

IDs are `E3-NNN`, contiguously numbered from E3-001 to E3-256. Future agents reference individual rows by ID. New rows added in revisions get the next available number (don't renumber existing rows; that breaks cross-doc references).

---

*End of Phase E.3 coverage matrix. Total: 256 IDs allocated across 7 sections; ~207 substantive rows (excluding the 6 multi-step blocks in Section 5 which count as 1 ID each but contain ~50 steps total). When all non-Pilot rows are [P] (or [N] for genuinely-not-applicable) and HC-01..HC-11 all [P], v2.9.1 is shippable.*
