# v2.9.1 Frontend Page Audit + Permission Map

Author: Phase A.3 audit, 2026-05-13
Status: Working draft — drives all of Phase D
Cross-refs:
- 50-permission catalog: `supabase/migrations/0068_v29_foundation_enum_catalog.sql`
- New v2.9 RPCs: `supabase/migrations/0075_v29_new_rpcs.sql`
- Permission attack surface + test-point map: `design/2026-05-13-rbac-attack-surface.md` §C.2
- RBAC model design: `design/2026-05-13-rbac-model-design.md`
- v2.9.0.1 sweep that already migrated 3 hooks: `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md`

Locked design rules:
- **B.2 hybrid rendering** — POS-like read-heavy paths HIDE entirely; management/CRUD/settings paths GREY OUT with tooltip "Requires permission: {key}. Contact your shop owner.". Owner sees nothing greyed out (implicit shortcut).
- **B.3 shop switcher** — TopBar dropdown when user has 2+ shops; redirect to `/dashboard` on switch.

---

## 0. Overview

| Metric | Count |
|---|---|
| New pages | 2 (`/settings/team`, `/invite/accept/:invitation_id`) |
| Existing pages needing touching | 27 |
| Components needing touching | ~35 (dialogs, pickers, widgets) |
| Hooks files needing touching | 16 |
| Distinct hook functions needing edits | ~45 |
| Routes needing guard updates | 28 (all authenticated routes) |
| Permission-conditional render points (HIDE) | ~30 (mostly POS inner) |
| Permission-conditional render points (GREY-OUT) | ~80 (lists, detail pages, settings) |
| Hidden-section points (settings owner-only) | ~10 |

Hide vs grey-out distribution:
- **HIDE** — POS internals, POS cart inner controls, scan-only nav items, customer name fields/tier inside POS cart, batch picker rows
- **GREY-OUT** — `/products`, `/customers`, `/sales`, `/khata`, `/purchases`, `/suppliers`, `/expenses`, `/reports`, `/targets`, `/inventory/*`, detail pages, edit dialogs, all settings management toggles
- **HIDDEN SECTION** — owner-only sections of `/settings`: shop settings, owner details, units of measure, variant attributes, team (the entire `/settings/team` link is hidden from non-team-viewers)

---

## 1. New pages (Phase D.1)

### `/settings/team`

- **File**: `src/features/team/TeamPage.tsx` (new)
- **Path constant**: add to `src/paths.ts` → `team: '/settings/team'`
- **Route**: gated by `RequirePermission('view_team')`; redirects to `/settings` if missing.
- **Hide vs grey-out**: GREY OUT individual sections (management page). The entire route itself is gated; non-`view_team` users redirect.
- **Permission to access page**: `view_team`
- **Sections + permission gating**:
  - **Active team list table** — `view_team`
  - **"Invite user" button** (top right of header) — `invite_users` (grey-out + tooltip)
  - **Per-member row → "Edit permissions" button → permissions modal** — `modify_user_permissions` (grey-out)
  - **Per-member row → "Edit discount limits" button** — `modify_user_discount_limits` (grey-out)
  - **Per-member row → "Apply preset" dropdown** — `modify_user_permissions` (grey-out)
  - **Per-member row → "Revoke access" / kebab menu** — `revoke_user_access` (grey-out, plus destructive ConfirmDialog)
  - **Pending invitations table** — `view_team`
  - **"Cancel invitation" button per row** — `cancel_invitations` (grey-out)
  - **"Resend code" affordance per row** — `invite_users` (grey-out)
  - **Audit log section** (collapsible) — `view_user_audit_log` (whole section HIDDEN entirely if missing — sensitive)
- **RPCs called** (all per `supabase/migrations/0075_v29_new_rpcs.sql`):
  - `get_team_for_active_shop()` — list active team members + their resolved permissions
  - `get_user_permissions(p_target_user_id)` — full per-user permission JSONB for the edit modal
  - `create_invitation(p_email, p_role_preset, p_permissions_jsonb, p_discount_limits_jsonb, p_expires_at)`
  - `cancel_invitation(p_invitation_id)`
  - `modify_user_permission(p_target_user_id, p_permission_key, p_granted)`
  - `apply_preset_to_user(p_target_user_id, p_preset)` — `'manager' | 'salesperson'`
  - `update_user_discount_limits(p_target_user_id, p_limits_jsonb)`
  - `revoke_user_access(p_target_user_id)`
  - Direct read on `user_shop_permission_audit` (RLS gates to `view_user_audit_log` per §B.4.9 of model-design)
  - Direct read on `pending_invitations` table or via `get_team_for_active_shop` projection (verify which against final migration 0075 body)
- **Components needed under `src/features/team/`**:
  - `TeamMembersTable.tsx` — main listing
  - `PendingInvitationsTable.tsx`
  - `InviteUserDialog.tsx` — email + role preset radio + custom-overrides toggle + 4-digit code display on success
  - `EditPermissionsDialog.tsx` — modal with the full 50-perm catalog grouped by category, checkboxes, validates dependencies client-side before submit (mirrors `validate_permission_grant`)
  - `EditDiscountLimitsDialog.tsx`
  - `RevokeAccessConfirmDialog.tsx`
  - `AuditLogSection.tsx` — collapsible reader for `user_shop_permission_audit` rows
- **Hook file**: `src/features/team/hooks.ts` (new)
- **i18n namespace**: `team`

### `/invite/accept/:invitation_id`

- **File**: `src/features/team/AcceptInvitationPage.tsx` (new)
- **Path constant**: `acceptInvitation: '/invite/accept/:invitation_id'` + `gotoAcceptInvitation(id)`
- **Route guards**: `RequireAuth` only — non-onboarded auth user is fine (accepting will skip onboarding for them). NO `RequirePermission` (the page IS the permission-grant ceremony).
- **Hide vs grey-out**: N/A — the page is either accessible or it surfaces a friendly "Invitation not found / expired / already accepted" empty state.
- **UX flow**:
  - Reads `invitation_id` from URL params
  - Fetches the invitation row (or has the user enter the 4-digit code if email mismatch — per ADR-13 mistyped-email mitigation)
  - Shows shop name + invited email + intended permissions preview (the snapshot)
  - 4-digit code input (mitigation against mistyped-email phishing — see ADR `2026-05-13-rbac-4-digit-code-mistyped-email-mitigation.md`)
  - Submit → `accept_invitation(p_invitation_id, p_verbal_code)`
  - On success: refresh `useUserShopList`, `set_active_shop(new_shop_id)`, redirect to `/dashboard`
  - Auto-cancel after 5 strikes — surface "Too many wrong codes; invitation cancelled. Contact your shop owner."
- **RPC called**: `accept_invitation(p_invitation_id, p_verbal_code)`
- **i18n namespace**: `team` (shared with team page) or `invitations` (new)

---

## 2. Modified existing pages — global navigation

### TopBar

- **File**: `src/components/layout/TopBar.tsx`
- **Current behavior**: Theme toggle + language selector + profile menu (logout only).
- **v2.9.1 changes**:
  - Add **ShopSwitcherDropdown** component, positioned at line ~88 (between `flex:1` spacer and theme toggle).
  - Visible only when `useUserShopList().data.length > 1` — hidden for single-shop owners.
  - Selected shop label = current active shop name (read from `useShop()`); dropdown lists all shops the user has access to + a "Manage" affordance only visible if user is owner.
  - On select → call `set_active_shop(p_shop_id)` → invalidate every TanStack Query key + navigate to `/dashboard`.
  - Add "**Team**" menu item to the profile popper (line ~177) — visible only when `view_team`.
- **New RPCs called**:
  - `get_user_shop_list()` — returns `[{shop_id, shop_name, is_owner, role_label}]`
  - `set_active_shop(p_shop_id)` — writes the `app-shop-id` HTTP header source via the new `customFetch` (see §6 below) and persists to localStorage; per current_active_shop_id design no DB call required if header injection is the source of truth, but keeping the RPC name as the official "swap" entry point for forward-compat
- **Component**: `src/components/layout/ShopSwitcherDropdown.tsx` (new)
- **Hide vs grey-out**: Inherently invisible when not relevant (no shops to switch); Team menu item HIDDEN when no `view_team`.

### Sidebar

- **File**: `src/components/layout/Sidebar.tsx`
- **Nav config**: `src/layouts/navConfig.ts` (the canonical source of menu items)
- **v2.9.1 changes**: `useNavSections()` becomes permission-aware. Each menu item gets a `permission` field; filter out items the user lacks. Use HIDE pattern — clean nav is critical.
- **Permission gating per item**:

| Menu item | `to` | Permission |
|---|---|---|
| Dashboard | `paths.dashboard` | (always visible) |
| POS | `paths.pos` | `record_sale` |
| Products | `paths.products` | `view_products` |
| Customers | `paths.customers` | `view_customers` |
| Sales | `paths.sales` | `record_sale` OR `view_all_sales` (either gives access; view_all_sales unlocks colleagues' rows) |
| Khata | `paths.khata` | `view_customer_khata` |
| Stock-in | `paths.purchases` | `view_purchases` |
| Suppliers | `paths.suppliers` | `view_suppliers` |
| Expenses | `paths.expenses` | `view_expenses` |
| Targets | `paths.targets` | `view_monthly_targets` |
| Reports | `paths.reports` | `view_reports` |
| Settings | `paths.settings` | (always visible — sections inside gate themselves) |
| Support | `paths.support` | (always visible) |

Add Settings → Team menu item (rendered conditionally on `view_team`).

### AppShell

- **File**: `src/layouts/AppShell.tsx` — no structural change. The `DashboardBanner` (line 74) already renders unconditionally and is fine.

---

## 3. Modified pages — per-feature

### features/auth/

- **LoginPage.tsx**, **SignupPage.tsx**, **ForgotPasswordPage.tsx**, **ResetPasswordPage.tsx**, **VerifyEmailPage.tsx** — no changes (pre-auth).
- **AuthProvider.tsx** — no permission changes, but see §6 for `customFetch` injection of `app-shop-id` header.
- **hooks.ts** (`src/features/auth/hooks.ts`):
  - `useProfile()` (line 5): unchanged.
  - `useShop()` (line 23): **needs change** — currently filters `.eq('owner_user_id', user.id)`, which breaks for non-owner employees on the team page. Replace with a call to `get_user_shop_list()` filtered to active shop, OR keep but rename to `useOwnedShop()` and add a new `useActiveShop()` hook that reads from the active-shop list. The active shop should resolve via `current_active_shop_id()` server-side; the client needs a clear hook name.
  - `useEffectiveSubscription()` (line 43): unchanged.

### features/onboarding/

- **OnboardingPage.tsx** — calls `complete_onboarding(...)` which already implicitly sets the new user as owner with full permissions (per ADR `2026-05-13-rbac-owner-implicit-shortcut.md`). No changes needed.
- **schemas.ts** — unchanged.

### features/subscription/

- **SubscriptionExpiredPage.tsx** — unchanged.
- **DashboardBanner.tsx** — unchanged (data sourced from existing subscription queries).

### features/dashboard/

- **DashboardPage.tsx** (`src/features/dashboard/DashboardPage.tsx`):
  - Hide vs grey-out: HIDE entire widget when user lacks the underlying read permission. Dashboard is read-heavy and clean.
  - **`<StatCard>` today_sales** (line 118): requires `view_all_sales` to show shop-wide; otherwise show "Your sales today" filtered to `cashier_id = self`. The underlying `daily_sales_today` view should project conditionally per `view_all_sales` (see §C.2.1.1 attack-surface).
  - **`<StatCard>` outstanding_total** (line 124): requires `view_customer_outstanding`. HIDE if missing.
  - **`<StatCard>` mtd_sales** (line 129): requires `view_all_sales`.
  - **`<StatCard>` mtd_net_profit** (line 134): requires `view_sale_cost` (else gross_profit comes back NULL). Show only if has `view_sale_cost`. The "Gross profit" helper line additionally needs `view_sale_cost`.
  - **TargetBar section** (lines 142–183): requires `view_monthly_targets` to display, `manage_monthly_targets` for the "Set target" CTA inside.
  - **Quick actions** (lines 185–222):
    - "New sale" — `record_sale` (hide)
    - "New purchase" — `record_purchase` (hide)
    - "Add expense" — `create_expense` (hide)
    - "View khata" — `view_customer_khata` (hide)
  - **`<InventoryAlertsWidget />`** (line 227): requires `view_inventory_batches`. HIDE if missing.
  - **`<ExpiredStockWidget />`** (line 232): requires `view_inventory_batches`. HIDE.
  - **`<ExpiredSalesWidget />`** (line 236): requires `view_all_sales` AND `view_inventory_batches`. HIDE.
- **hooks.ts** (`src/features/dashboard/hooks.ts`):
  - `useTodaySales()` (line 10): reads `daily_sales_today` view — needs server-side conditional projection per `view_all_sales` (Phase C view rewrite).
  - `useMonthlySummary()` (line 24): reads `monthly_summary` view — needs `view_reports` + `view_sale_cost` projection.
  - `useTotalOutstanding()` (line 39): reads `total_outstanding` view — needs `view_customer_outstanding` projection (per attack-surface §C.2.1.4).

### features/pos/

**Hide vs grey-out: HIDE throughout (POS internals).**

- **POSPage.tsx** (`src/features/pos/POSPage.tsx`):
  - **Page itself**: gated by `record_sale` (route guard); redirect to `/dashboard` if missing.
  - **CustomerPicker** in cart panel (line 1165): HIDE for users without `view_customers`. Forces walk-in mode.
  - **Customer card with tier badge** (lines 1146–1151): tier name HIDDEN without `view_customers` (tier name doesn't leak much; safe to keep, but consistent with rest).
  - **CustomerPicker "Add new" item**: HIDE without `create_customer_basic`.
  - **"Pick variant" button** (line 833): no gate beyond `record_sale` (variant choice is part of the sale).
  - **Quick-add pack chips** (line 869): no gate.
  - **PosProductDrawer** (line 1004): inherits product view permissions (see ProductDetailBody below).
  - **Service charge field** (line 1632): no gate.
  - **Payment "Amount paid" / "Pay full" / "Pay nothing"** (lines 1663–1691): no gate; these gate via the `customerRequired` logic already.
  - **OverrideDiscountDialog** (line 985): no per-permission gate beyond `record_sale`; **but** server-side enforces `discount_limit_*` JSONB caps on the user (per `modify_user_discount_limits` permission for managers; salespersons get default cap from preset). The frontend should fetch the user's discount limits via `get_user_permissions(self)` and pre-clip the dialog's max input.
  - **BlockedExpiredSaleDialog** (line 1024) + **ConfirmExpiredSaleDialog** (line 1039): the "Confirm expired sale" button inside ConfirmExpiredSaleDialog requires `confirm_expired_sale_at_pos`. HIDE the confirm button (cashier sees "ask your manager" empty state). Without the permission, `record_sale` raises and the user gets a friendly error.
  - **PosBatchPicker** (line 1550): cost columns inside HIDE without `view_batch_cost`.
  - **`cost_at_sale` / `avg_cost` / `belowCost` warning** (line 1535–1540): HIDE without `view_sale_cost` AND `view_product_cost`. The "below avg cost" banner currently uses `c.avg_cost` (cart line state) — needs to be wrapped in a guard.
- **hooks.ts** (`src/features/pos/hooks.ts`):
  - `useRecordSale()` (line 13): no signature change; server enforces `record_sale`. Add `confirm_expired_sale` UI gate (see above).
  - `usePreflightExpiredSaleCheck()` (line 91): no change.
- **AddCustomerDialog.tsx**: gate visibility behind `create_customer_basic`. Field set "address / notes / tier" gated additionally behind `create_customer_full`. HIDE pattern.
- **CustomerPicker.tsx** (`src/features/customers/CustomerPicker.tsx`, used by POS):
  - HIDE component entirely without `view_customers`.
  - "Add new" item HIDDEN without `create_customer_basic`.
  - Phone display HIDDEN without `view_customer_contact` (show name only).
- **OverrideDiscountDialog.tsx**: clip max value via fetched discount limits (see above).
- **BlockedExpiredSaleDialog.tsx** / **ConfirmExpiredSaleDialog.tsx**: as covered above.
- **PosBatchPicker.tsx**: HIDE `cost_per_unit` column without `view_batch_cost`. The picker remains usable (batch number + expiry + qty visible).
- **PosVariantPicker.tsx**: no per-permission gate.
- **PosProductDrawer.tsx**: inherits ProductDetailBody gating.
- **QtyStepper.tsx**, **Receipt.tsx**: no gate.

### features/products/

**Hide vs grey-out: GREY OUT (management/CRUD page).**

- **ProductsListPage.tsx**:
  - **Route gate**: `view_products`.
  - **"New product" button** (line 104): GREY OUT without `create_product` + tooltip.
  - **"Needs pricing" filter chip** (line 69): no gate (filter on view).
  - **CategoryFilter** (line 63): no extra gate; reads via `search_categories` which already requires `view_products` server-side.
  - **Stock display mode selector** (line 84): no gate.
- **ProductTable.tsx** (`src/features/products/ProductTable.tsx`):
  - **avg_cost column** (line 387): HIDE without `view_product_cost`. The conditional view projection (per attack-surface §C.2.1.2) returns NULL — frontend should hide column header entirely when no row has a populated value, OR pass `showAvgCost={hasViewProductCost}` from each caller.
  - **last_purchase_cost column** (line 426): HIDE without `view_product_cost`.
  - **price column** (line 314): always visible.
  - **stock column**: always visible (gated by `view_products` at route level).
  - **"Set price" warning** (lines 333–377): visible to anyone with `view_products`; clicking opens edit dialog which is gated separately.
  - **Eye icon "view details"** (line 211): always visible.
- **ProductDetailPage.tsx**:
  - **Route**: `view_products`.
  - **"Edit" button** in PageHeader (passed to ProductDetailBody): GREY OUT without `edit_product`.
- **ProductDetailBody.tsx**:
  - **avg_cost / last_purchase_cost rows** (lines 178–189): HIDE without `view_product_cost`.
  - **Edit button** (line 118): GREY OUT without `edit_product`.
  - **Null-price banner** (lines 128–147): visible; "Set price" CTA is the same edit dialog (`edit_product` permission required).
  - **VariantsTable** (line 210): renders cost columns conditionally per `view_product_cost`.
  - **BatchesSection** (line 218): gated by `view_inventory_batches`. HIDE entire section.
  - **PacksSection** (line 230): visible to `view_products`; edit/archive inside gated by `manage_product_packs` (grey-out).
- **ProductEditDialog.tsx**:
  - **Whole dialog** opens only when caller passes the trigger — caller gates by `edit_product`.
  - **Archive toggle (`is_active` switch)** inside the dialog (per ADR-0021, archive moved to the edit modal): GREY OUT without `archive_product`. The trigger `archive_product_trigger` (see ADR `2026-05-13-rbac-archive-product-trigger-gate.md`) is the server-side enforcement.
  - **expiry_alert_days / warranty_alert_days / expired_sale_policy radio** inside the dialog: GREY OUT without `edit_product_expiry_overrides`.
  - **has_batches toggle**: GREY OUT without `edit_product_expiry_overrides`.
- **ProductFormPage.tsx** (creation):
  - **Route gate**: `view_products` + GREY OUT (or route redirect) without `create_product`.
- **CategoryCombobox.tsx**: read via `search_categories` — works for `view_products`. Inline "Create category" item HIDDEN without `manage_product_categories`.
- **CategoryFilter.tsx**: read via `search_categories`. No extra gate.
- **CreateCategoryDialog.tsx**: dialog open gated by `manage_product_categories` (caller hides trigger).
- **PacksSection.tsx**: "+ Add pack" + per-row Edit/Archive icons GREY OUT without `manage_product_packs`.
- **ProductCombobox.tsx**: reads via `search_products`. No client-side gate; server enforces `view_products`.
- **VariantsTable.tsx**: per-row inline edit (sku/price/is_active) GREY OUT without `edit_product`. "Add variant" GREY OUT without `create_product`. Cost columns HIDE without `view_product_cost`.
- **AddVariantDialog.tsx**: gated trigger via `create_product`.
- **VariantEditDialog.tsx**: gated trigger via `edit_product`; archive toggle gated by `archive_product`.
- **AddProductInlineDialog.tsx** (stock-in inline-create modal): trigger gated by `create_product`.
- **schemas.ts**, **categoryHooks.ts**: hook calls listed in §5.
- **hooks.ts** (`src/features/products/hooks.ts`):
  - `useSearchProducts()` (line 80): no signature change; server returns NULL for `avg_cost` / `last_purchase_cost` when missing `view_product_cost`.
  - `useProduct()` (line 124): direct `from('products').select(...)` — reads `avg_cost`, `cost`, `last_purchase_cost`. Server's RLS denies these columns when missing `view_product_cost` (raw-table denial via §C.2.1.2). Frontend should still merge gracefully (return NULL).
  - `useProductVariants()` (line 193): same — `product_variant_full` view projects costs conditionally.
  - `useUpdateVariantInline()` (line 227): **DIRECT TABLE UPDATE** on `product_variants`. Server RLS will deny without `edit_product`. Either:
    - Keep as-is and rely on RLS denial (acceptable; surface a friendly error)
    - Migrate to a new `update_variant_inline` RPC (better — gets `_by_user_id` audit). See §5.
  - `useAddVariantToProduct()` (line 313): calls `add_variant_to_product` RPC. Server gates by `create_product`.
  - `useCreateProduct()` (line 439): calls `create_product_with_opening_stock`. Server gates by `create_product`.
  - `useCreateProductWithVariants()` (line 507): calls `create_product_with_variants`. Server gates by `create_product`.
  - `useUpdateProduct()` (line 537): **DIRECT TABLE UPDATE** on `products` AND `product_variants`. Two issues — RLS will deny without `edit_product`. Migrate to an `update_product` wrapper RPC (Phase C) so `_by_user_id` audit columns get written.
  - `useArchiveProduct()` (line 644): **DIRECT TABLE UPDATE** with `is_active`. Server-side `archive_product_trigger` enforces `archive_product` permission. Keep as direct or migrate to an `archive_product` RPC.
  - `useProducts()` (line 672): direct `from('products').select('*')`. Cost columns null out for low-permission users.
  - `useProductActivity()` (line 357): joins purchases + sales via tables. Cost columns null out per RLS.

### features/customers/

**Hide vs grey-out: GREY OUT (management).**

- **CustomersListPage.tsx**:
  - **Route gate**: `view_customers`.
  - **"Add customer" button** (line 151): GREY OUT without `create_customer_basic` + tooltip.
  - **Edit pencil icon per row** (line 132): GREY OUT without `edit_customer`.
  - **"View history" link** (line 125): GREY OUT without `view_customer_khata`. Without it, hide the link.
  - **Phone column** (line 64): HIDE the column or render "—" without `view_customer_contact` (per attack-surface §C.2.1.4 — server returns NULL).
  - **Address column** (line 68): HIDE without `view_customer_contact`.
  - **Outstanding column** (line 87): show `has_khata` boolean instead of numeric without `view_customer_outstanding`. Per `customers_view` projection.
- **CustomerDetailPage.tsx**:
  - **Route gate**: `view_customers`.
  - **Edit button** (line 273): GREY OUT without `edit_customer`.
  - **"Receive Payment" button** (line 281): GREY OUT without `receive_payment`. (Server enforces; cap from `shops.salesperson_payment_cap_pkr`.)
  - **Outstanding amount display** (line 257): HIDE without `view_customer_outstanding` — show "—" or only `has_khata` boolean.
  - **Phone display** (line 240): HIDE without `view_customer_contact`.
  - **Tier badge** (line 242): visible; tiers are not sensitive.
  - **Address + notes blocks** (lines 293–333): HIDE without `view_customer_contact` (address) / `view_customers` (notes — depends; notes are sensitive, recommend tying to `view_customer_contact`).
  - **Ledger table** (whole section): HIDE without `view_customer_khata`.
  - **Reverse entry icon per row** (line 198): GREY OUT without `reverse_ledger_entry`.
- **CustomerFormPage.tsx** (create + edit shared):
  - **Create mode route gate**: `create_customer_basic` (basic fields visible) + `create_customer_full` (address/notes/tier fields visible).
  - **Edit mode route gate**: `edit_customer`.
- **CustomerForm.tsx**:
  - **Name + Phone fields**: always visible when on this form.
  - **Tier dropdown** (lines 113–138): GREY OUT (or HIDE) without `assign_customer_tier`.
  - **Address + Notes fields** (lines 154–180): HIDE without `view_customer_contact` (in edit) or `create_customer_full` (in create).
  - **"Show more fields" toggle** (line 142): same.
- **CustomerPicker.tsx**: gated as covered under POS §3.
- **hooks.ts** (`src/features/customers/hooks.ts`):
  - `useCustomers()` (line 37): direct `from('customers').select('*')`. Server RLS / column projection handles permissions.
  - `useCustomer()` (line 51): direct select — phone/address null when missing `view_customer_contact`.
  - `useCreateCustomer()` (line 68): calls `create_customer_full` RPC (already migrated in v2.9.0.1 sweep). **DONE.**
  - `useUpdateCustomer()` (line 106): **DIRECT TABLE UPDATE**. Migrate to `update_customer` RPC (Phase C) for audit. Server RLS will currently deny without `edit_customer` per v2.9 policies. Additional concern: changing `tier_id` requires `assign_customer_tier` — needs server-side column-level enforcement (per F-PD-12 in attack surface).
  - `useCustomerHistoryCount()` (line 147): read from `invoices`+`ledger_entries`. Server RLS on ledger requires `view_customer_khata`. May return 0 without permission — surface gracefully.
  - `useRecentCustomers()` (line 168): RPC `recent_customers` — server gates by `view_customers`.
  - `useCustomerSearch()` (line 182): direct from `customers`. Server gates.
  - `useListCustomers()` (line 209): RPC `list_customers` — server gates by `view_customers`; columns null-out per `view_customer_contact` / `view_customer_outstanding`.

### features/khata/

**Hide vs grey-out: GREY OUT (management).**

- **KhataPage.tsx**:
  - **Route gate**: `view_customer_khata`.
  - **Status filter + search**: no extra gate.
  - **Outstanding column** (line 137): server returns NULL for `outstanding_balance` without `view_customer_outstanding`; show "—" gracefully.
  - **"View history" link per row** (line 161): inherits `view_customer_khata`.
- **ReceivePaymentDialog.tsx** (`src/features/khata/ReceivePaymentDialog.tsx`):
  - Dialog open is gated by caller (`receive_payment`).
  - Amount input: server enforces `salesperson_payment_cap_pkr` cap. Client should pre-fetch the cap and surface "max: X PKR".
- **ReverseEntryDialog.tsx**: dialog open gated by caller (`reverse_ledger_entry`).
- **hooks.ts** (`src/features/khata/hooks.ts`):
  - `useOutstanding()` (line 13): reads `customer_outstanding` view. Server returns null `outstanding` column without `view_customer_outstanding`.
  - `useSearchKhataCustomers()` (line 62): RPCs `search_khata_customers` + `_count` — server gates by `view_customer_khata`.
  - `useLedgerEntries()` (line 96): reads `ledger_entries_view`. Server gates by `view_customer_khata`.
  - `useReceivePayment()` (line 122): RPC `receive_payment` — server gates + caps.
  - `useReverseLedgerEntry()` (line 144): RPC `reverse_ledger_entry` — server gates.

### features/sales/

**Hide vs grey-out: GREY OUT (management).**

- **SalesListPage.tsx**:
  - **Route gate**: `record_sale` OR `view_all_sales` (any-of).
  - **Total / payment_type / service_charge columns**: server returns columns; row-filter applies on `view_all_sales` (without it, only own rows).
  - **Customer dropdown filter** (line 252): pull `useCustomers()` — gated by `view_customers`.
- **SaleDetailPage.tsx**:
  - **Route gate**: `record_sale` OR `view_all_sales`. Plus per-row RLS gate (`cashier_id = self_id` OR `view_all_sales`).
  - **`unit_cost` column** (line 158): HIDE without `view_sale_cost`. Per attack-surface §C.2.1.1, `cost_at_sale` is null on the view.
  - **`line_profit` column** (line 197): HIDE without `view_sale_cost`.
  - **`line_value` / `line_total` / subtotal / total / amount_paid / on_credit**: always visible.
  - **"Reprint receipt" button** (if added — not in current code; placeholder for v2.9): gate behind `reprint_receipt`.
  - **"Sold expired" badge** (line 121): always visible (audit trail). No gate.
  - **Linked ledger section** (lines 441–475): HIDE without `view_customer_khata`.
- **ExpiredSalesListPage.tsx** (`/inventory/expired-sales`):
  - **Route gate**: `view_all_sales` + `view_inventory_batches` (because it cross-joins).
- **ExpiredSalesWidget.tsx** (dashboard): gated as covered in dashboard.
- **hooks.ts** (`src/features/sales/hooks.ts`):
  - `useSales()` (line 94): direct `from('invoices')`. Row-filtered server-side by `view_all_sales`. Cost-bearing columns project null without `view_sale_cost`.
  - `useSale()` (line 128): direct from `invoices` + `sale_item_financials` + `invoice_financials`. Cost columns null-out.
  - `useExpiredSales()` (line 299): direct from `sale_items` (sold_expired = true). Server RLS gates.

### features/purchases/

**Hide vs grey-out: GREY OUT (management).**

- **PurchasesListPage.tsx**:
  - **Route gate**: `view_purchases`.
  - **Supplier filter** (uses `SupplierCombobox`): inherits `view_suppliers`.
  - **"New stock-in" button**: GREY OUT without `record_purchase`. Tooltip lists the 5 dependency permissions if missing them.
- **NewPurchasePage.tsx**:
  - **Route gate**: `record_purchase` (the RPC requires all 5 deps via `requires` array).
  - **Inline-create product trigger inside ProductCombobox**: GREY OUT without `create_product`.
  - **"Create new pack" item in unit dropdown** (line 760): GREY OUT without `manage_product_packs`.
  - **Submit button**: enabled only when `record_purchase` granted. Server enforces.
- **PurchaseDetailPage.tsx**:
  - **Route gate**: `view_purchases`.
  - **unit_cost / line_subtotal / line_overhead / line_total / overhead categories**: visible (operational data for stock-in users by spec — `view_purchases` includes cost since stock-in workflow needs it).
  - **"Effect on inventory" card with avg_before/avg_after** (lines 381–399): HIDE without `view_product_cost` (avg cost is product-cost data).
- **CreatePackDialog.tsx**: dialog open gated by `manage_product_packs`.
- **StockInVariantMatrix.tsx**: no extra gate beyond `record_purchase`.
- **hooks.ts** (`src/features/purchases/hooks.ts`):
  - `useRecordPurchase()` (line 72): RPC `record_purchase` — server gates.
  - `useSearchPurchases()` (line 122): RPC `search_purchases` + `_count` — server gates by `view_purchases`.
  - `usePurchaseDetail()` (line 211): direct from `purchases` + `purchase_item_financials`. Server gates `view_purchases`; `avg_cost_before/after` null-out per `view_product_cost`.

### features/batches/

- **ExpiredStockListPage.tsx** (`/inventory/expired`):
  - **Route gate**: `view_inventory_batches`.
  - **"Write off all" button** (line 119): GREY OUT without `writeoff_batch`.
  - **Per-row "Write off" icon** (line 92): GREY OUT without `writeoff_batch`.
- **BatchesSection.tsx** (inside ProductDetailBody):
  - **Cost per unit column** (line 121): HIDE without `view_batch_cost`.
  - **Write-off icon per row** (line 134): GREY OUT without `writeoff_batch`.
- **InventoryAlertsWidget.tsx**: gated as covered in dashboard; entire widget hides without `view_inventory_batches`.
- **ExpiredStockWidget.tsx**: same — `view_inventory_batches` gate.
- **WriteOffBatchDialog.tsx**: trigger gated by `writeoff_batch`. Cost calculation inside HIDE without `view_batch_cost`.
- **BulkWriteOffDialog.tsx**: same — `writeoff_batch`.
- **hooks.ts** (`src/features/batches/hooks.ts`):
  - `useActiveBatchesForVariant()` (line 21): direct from `inventory_batches`. Server projects `cost_per_unit` null without `view_batch_cost`.
  - `useAllBatchesForVariant()` (line 54): same.
  - `useExpiringSoon()` / `useAlreadyExpired()` / `useWarrantyExpiringSoon()`: read alert views; server gates by `view_inventory_batches`.
  - `useHasAnyBatchedProduct()`: counts `products.has_batches=true`. Server gates by `view_products`. Used only to hide the widget when shop doesn't use batches — owner-implicit-true makes this work for new owners.
  - `useRecordPartialWriteoff()` (line 158): RPC `record_partial_writeoff` — server gates by `writeoff_batch`.
  - `useDeactivateBatch()` (line 182): RPC `deactivate_batch` — server gates by `writeoff_batch`.
  - `useShopAlertDefaults()` (line 213): **DIRECT TABLE READ from `shops`** — needs `view_team` or no gate? Actually any authenticated user with active shop can read these public-ish shop fields. Server should expose via a `get_shop_settings` projection that excludes owner-only fields.
  - `useUpdateShopAlertDefaults()` (line 232): RPC `update_shop_settings` (already migrated in v2.9.0.1 sweep). **DONE.** Server gates by `edit_shop_settings`.
  - `useShopExpiredSaleSettings()` (line 250): direct read from `shops` (same concern).
  - `useUpdateShopExpiredSaleSettings()` (line 270): RPC `update_shop_settings`. **DONE.** Server gates.
  - `suggestBatchNo()` (line 288): RPC `suggest_batch_no` — server gates by `record_purchase`.

### features/suppliers/

**Hide vs grey-out: GREY OUT (management).**

- **SuppliersListPage.tsx**:
  - **Route gate**: `view_suppliers`.
  - **"New supplier" button** (line 152): GREY OUT without `manage_suppliers`.
  - **Edit pencil + archive icon per row** (line 122, 132): GREY OUT without `manage_suppliers`.
- **SupplierFormPage.tsx** (create + edit shared): route gated by `manage_suppliers`.
- **SupplierForm.tsx**: no per-permission gate inside.
- **AddSupplierDialog.tsx**: trigger gated by `manage_suppliers`.
- **SupplierCombobox.tsx**: read via `search_suppliers` — `view_suppliers`. Inline "Create new" item HIDDEN without `manage_suppliers`.
- **hooks.ts** (`src/features/suppliers/hooks.ts`):
  - `useSupplier()` (line 28): direct `from('suppliers')` — server gates by `view_suppliers`.
  - `useRecentSuppliers()` (line 45): RPC `recent_suppliers` — server gates by `view_suppliers`.
  - `useSearchSuppliers()` (line 59): RPC `search_suppliers` — server gates by `view_suppliers`.
  - `useCreateSupplier()` (line 91): RPC `create_supplier_inline` — server gates by `manage_suppliers`.
  - `useUpdateSupplier()` (line 116): **DIRECT TABLE UPDATE**. Server RLS gates by `manage_suppliers`. Migrate to `update_supplier` RPC (Phase C) for audit.
  - `useArchiveSupplier()` (line 149): **DIRECT TABLE UPDATE** with `is_active=false`. Same — migrate to RPC.

### features/expenses/

**Hide vs grey-out: GREY OUT (management).**

- **ExpensesPage.tsx**:
  - **Route gate**: `view_expenses`.
  - **"Add expense" button** (line 112): GREY OUT without `create_expense`.
  - **Per-row edit (none currently in UI but slated): if added** → GREY OUT without `edit_expense`; server enforces 24h window + own-creator.
- **hooks.ts** (`src/features/expenses/hooks.ts`):
  - `useExpenses()` (line 16): direct `from('expenses')` — server gates by `view_expenses`.
  - `useCreateExpense()` (line 39): **DIRECT TABLE INSERT** — needs migration to `create_expense` RPC (already exists per migration 0075 line 11). Critical for audit. See §5.

### features/targets/

**Hide vs grey-out: GREY OUT.**

- **TargetsPage.tsx**:
  - **Route gate**: `view_monthly_targets`.
  - **Save button** (line 92): GREY OUT without `manage_monthly_targets`.
  - **All input fields**: GREY OUT (read-only) without `manage_monthly_targets`.
- **hooks.ts** (`src/features/targets/hooks.ts`):
  - `useTargetForMonth()` (line 19): direct `from('monthly_targets')` — server gates by `view_monthly_targets`.
  - `useUpsertTarget()` (line 34): **DIRECT TABLE UPSERT**. Migrate to `upsert_monthly_target` RPC (already exists per migration 0075 line 14). See §5.

### features/reports/

**Hide vs grey-out: GREY OUT (management). Or HIDE individual sections when underlying permission missing.**

- **ReportsPage.tsx**:
  - **Route gate**: `view_reports`.
  - **Daily sales section** (line 164): server view `daily_sales_7` requires `view_reports`; gross_profit columns null without `view_sale_cost`.
  - **Monthly summary section** (line 179): server view `monthly_summary` projects `gross_profit`/`total_expenses`/`net_profit` conditional on `view_sale_cost` + `view_expenses`. HIDE gross/expenses/net cols when missing.
  - **Expense breakdown section** (line 194): HIDE entire section without `view_expenses`.
  - **Outstanding section** (line 209): HIDE without `view_customer_outstanding`.
- **hooks.ts** (`src/features/reports/hooks.ts`):
  - `useDailySalesLast7()` (line 11): direct from `daily_sales_7` view — server gates.
  - `useMonthlySummaryLast6()` (line 28): direct from `monthly_summary` — server gates.
  - `useExpenseBreakdownThisMonth()` (line 48): direct from `expenses_by_category_mtd` view — server gates by `view_expenses`.

### features/settings/

**Hide vs grey-out: HIDE owner-only sections entirely (settings discoverability — non-owners shouldn't see what they can't touch). Per the user instruction in task brief.**

- **SettingsPage.tsx**:
  - **Page route**: always accessible (no gate).
  - **Language selector section** (line 98): always visible.
  - **"Customer tiers" navigation row** (lines 105–122): HIDE entirely without `manage_customer_tiers`.
  - **"Variant attributes" navigation row** (lines 123–142): HIDE entirely without `manage_variant_attributes`.
  - **"Inventory alert defaults" section** (lines 146–184): HIDE entirely without `edit_shop_settings`.
  - **"Expired-sale policy" section** (lines 186–257): HIDE entirely without `edit_shop_settings`.
  - **New "Team" navigation row** (add): HIDE entirely without `view_team`.
  - **New "Owner details" section** (add — currently no UI for shop_owner_details PII): HIDE entirely without `view_owner_details`. Edit gated by `edit_owner_details`.
  - **New "Shop information" section** (shop_name, address, phone — currently no UI): HIDE without `edit_shop_settings`.
  - **New "Units of measure" section** (currently no dedicated UI; managed inline in stock-in): HIDE without `manage_units_of_measure`.
- **SupportPage.tsx**: always accessible (deliberately not subscription-gated either).

### features/tiers/

**Hide vs grey-out: GREY OUT.**

- **TiersPage.tsx**:
  - **Route gate**: `manage_customer_tiers` (page exists only for tier managers; non-managers shouldn't even reach it via deep-link).
  - **"New tier" button** (line 84): GREY OUT or hide (page-level gate makes this redundant; keep for defense-in-depth).
  - **Star/edit/archive icons per row** (lines 158–197): always enabled when on this page.
- **TierFormDialog.tsx**: gated by caller.
- **hooks.ts** (`src/features/tiers/hooks.ts`):
  - `useTiers()` (line 22): direct from `customer_tiers` + customers. Server gates by `view_customers` (tiers are read for cart display).
  - `useDefineTier()`, `useUpdateTier()`, `useDeactivateTier()`, `useSetDefaultTier()`: all RPCs — server gates by `manage_customer_tiers`.

### features/variants/

**Hide vs grey-out: GREY OUT.**

- **VariantAttributesPage.tsx**:
  - **Route gate**: `manage_variant_attributes`.
  - All inner actions (create attr, add value, edit, archive) operate at this gate.
- **VariantMatrixBuilder.tsx** (used in product creation): no extra gate; inherits `create_product`.
- **VariantAttributeDialog.tsx**, **VariantValueDialog.tsx**: gated by caller.
- **hooks.ts** (`src/features/variants/hooks.ts`):
  - `useVariantAttributes()` (line 41): RPC `search_variant_attributes` — server gates by `view_products` (read on shop-wide pool) per attack-surface (any user with `view_products` can read the pool; managing them requires `manage_variant_attributes`).
  - `useAttributeValues()` (line 61): RPC `list_attribute_values` — server gates by `view_products`.
  - `useCreateVariantAttribute()`, `useUpdateVariantAttribute()`, `useDeactivateVariantAttribute()`, `useAddVariantValue()`, `useUpdateVariantValue()`, `useDeactivateVariantValue()`: RPCs — server gates by `manage_variant_attributes`.

### features/units/

- **hooks.ts** (`src/features/units/hooks.ts`):
  - `useUnitsOfMeasure()` (line 23): direct from `units_of_measure`. Read by any authenticated user (per migration 0081 consolidation). No client gate.
  - `useProductPacks()` (line 41): direct from `product_packs`. Server gates by `view_products`.
  - `useDefinePackInline()` (line 94): RPC `define_pack_inline` — server gates by `manage_product_packs`.
  - `useUpdatePack()` (line 125): RPC `update_pack` — server gates by `manage_product_packs`.
  - `useDeactivatePack()` (line 247): RPC `deactivate_pack` — server gates by `manage_product_packs`.
  - `fetchPurchasableUnitsForProduct()` (line 159): direct from `product_packs`. Server gates by `view_products`.
  - `useProductStockBreakdowns()` (line 224): direct from `product_stock_display` view. Server gates by `view_products`.

---

## 4. Read-only quick-reference: hide vs grey-out by file

(Working list during Phase D. File:line refers to anchor where the gate decision is wired.)

| File | Element | Permission | Pattern |
|---|---|---|---|
| `src/layouts/navConfig.ts` | POS menu item | `record_sale` | HIDE |
| `src/layouts/navConfig.ts` | Products menu item | `view_products` | HIDE |
| `src/layouts/navConfig.ts` | Customers menu item | `view_customers` | HIDE |
| `src/layouts/navConfig.ts` | Sales menu item | `record_sale` OR `view_all_sales` | HIDE |
| `src/layouts/navConfig.ts` | Khata menu item | `view_customer_khata` | HIDE |
| `src/layouts/navConfig.ts` | Stock-in menu item | `view_purchases` | HIDE |
| `src/layouts/navConfig.ts` | Suppliers menu item | `view_suppliers` | HIDE |
| `src/layouts/navConfig.ts` | Expenses menu item | `view_expenses` | HIDE |
| `src/layouts/navConfig.ts` | Targets menu item | `view_monthly_targets` | HIDE |
| `src/layouts/navConfig.ts` | Reports menu item | `view_reports` | HIDE |
| `src/components/layout/TopBar.tsx:139` | Profile popper "Team" item | `view_team` | HIDE |
| `src/components/layout/TopBar.tsx:118` | ShopSwitcherDropdown (new) | (visible when >1 shop) | HIDE |
| `src/features/dashboard/DashboardPage.tsx:118` | StatCard today_sales | `view_all_sales` (else self-only) | HIDE/SCOPE |
| `src/features/dashboard/DashboardPage.tsx:124` | StatCard outstanding_total | `view_customer_outstanding` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:134` | StatCard mtd_net_profit | `view_sale_cost` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:142` | TargetBar section | `view_monthly_targets` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:162` | "Set target" CTA | `manage_monthly_targets` | GREY-OUT |
| `src/features/dashboard/DashboardPage.tsx:191` | "New sale" quick action | `record_sale` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:200` | "New purchase" quick action | `record_purchase` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:207` | "Add expense" quick action | `create_expense` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:215` | "View khata" quick action | `view_customer_khata` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:227` | InventoryAlertsWidget | `view_inventory_batches` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:232` | ExpiredStockWidget | `view_inventory_batches` | HIDE |
| `src/features/dashboard/DashboardPage.tsx:236` | ExpiredSalesWidget | `view_all_sales` + `view_inventory_batches` | HIDE |
| `src/features/pos/POSPage.tsx` (route) | Page | `record_sale` | REDIRECT |
| `src/features/pos/POSPage.tsx:1165` | CustomerPicker | `view_customers` | HIDE |
| `src/features/pos/POSPage.tsx:1024` | BlockedExpiredSaleDialog | (always available — informs cashier) | n/a |
| `src/features/pos/POSPage.tsx:1039` | ConfirmExpiredSaleDialog confirm btn | `confirm_expired_sale_at_pos` | HIDE |
| `src/features/pos/POSPage.tsx:1535` | "Below avg cost" warning | `view_sale_cost` + `view_product_cost` | HIDE |
| `src/features/pos/PosBatchPicker.tsx` | cost_per_unit column | `view_batch_cost` | HIDE |
| `src/features/pos/OverrideDiscountDialog.tsx` | Discount input max | (clipped by user discount_limit) | n/a (input clamp) |
| `src/features/pos/AddCustomerDialog.tsx` | Address/notes/tier fields | `create_customer_full` | HIDE |
| `src/features/pos/AddCustomerDialog.tsx` | Whole dialog trigger | `create_customer_basic` | HIDE |
| `src/features/products/ProductsListPage.tsx:104` | "New product" button | `create_product` | GREY-OUT |
| `src/features/products/ProductTable.tsx:387` | avg_cost column | `view_product_cost` | HIDE COL |
| `src/features/products/ProductTable.tsx:426` | last_purchase_cost column | `view_product_cost` | HIDE COL |
| `src/features/products/ProductDetailBody.tsx:117` | Edit button | `edit_product` | GREY-OUT |
| `src/features/products/ProductDetailBody.tsx:178-189` | avg_cost / last_purchase rows | `view_product_cost` | HIDE |
| `src/features/products/ProductDetailBody.tsx:210` | VariantsTable cost cols | `view_product_cost` | HIDE COL |
| `src/features/products/ProductDetailBody.tsx:218` | BatchesSection | `view_inventory_batches` | HIDE |
| `src/features/products/ProductDetailBody.tsx:230` | PacksSection edit/add | `manage_product_packs` | GREY-OUT |
| `src/features/products/ProductEditDialog.tsx` | Whole dialog open | `edit_product` | (caller hides trigger) |
| `src/features/products/ProductEditDialog.tsx` | `is_active` archive toggle | `archive_product` | GREY-OUT |
| `src/features/products/ProductEditDialog.tsx` | expiry/warranty/policy fields | `edit_product_expiry_overrides` | GREY-OUT |
| `src/features/products/ProductEditDialog.tsx` | has_batches toggle | `edit_product_expiry_overrides` | GREY-OUT |
| `src/features/products/CategoryCombobox.tsx` | "Create new category" item | `manage_product_categories` | HIDE |
| `src/features/products/PacksSection.tsx` | "Add pack" + edit/archive | `manage_product_packs` | GREY-OUT |
| `src/features/products/AddProductInlineDialog.tsx` | Whole dialog trigger | `create_product` | HIDE |
| `src/features/products/AddVariantDialog.tsx` | Trigger | `create_product` | GREY-OUT |
| `src/features/products/VariantEditDialog.tsx` | Trigger | `edit_product` | GREY-OUT |
| `src/features/products/VariantsTable.tsx` | Inline edit price/sku | `edit_product` | GREY-OUT |
| `src/features/products/VariantsTable.tsx` | Archive toggle | `archive_product` | GREY-OUT |
| `src/features/customers/CustomersListPage.tsx:151` | "Add customer" button | `create_customer_basic` | GREY-OUT |
| `src/features/customers/CustomersListPage.tsx:64` | Phone column | `view_customer_contact` | HIDE COL |
| `src/features/customers/CustomersListPage.tsx:68` | Address column | `view_customer_contact` | HIDE COL |
| `src/features/customers/CustomersListPage.tsx:87` | Outstanding column | `view_customer_outstanding` | SHOW BOOL |
| `src/features/customers/CustomersListPage.tsx:125` | "View history" link | `view_customer_khata` | HIDE |
| `src/features/customers/CustomersListPage.tsx:132` | Edit pencil | `edit_customer` | GREY-OUT |
| `src/features/customers/CustomerDetailPage.tsx:240` | Phone display | `view_customer_contact` | HIDE |
| `src/features/customers/CustomerDetailPage.tsx:257` | Outstanding numeric | `view_customer_outstanding` | HIDE |
| `src/features/customers/CustomerDetailPage.tsx:273` | Edit button | `edit_customer` | GREY-OUT |
| `src/features/customers/CustomerDetailPage.tsx:281` | Receive Payment button | `receive_payment` | GREY-OUT |
| `src/features/customers/CustomerDetailPage.tsx:293` | Address+notes block | `view_customer_contact` | HIDE |
| `src/features/customers/CustomerDetailPage.tsx:337` | Ledger table | `view_customer_khata` | HIDE |
| `src/features/customers/CustomerDetailPage.tsx:198` | Reverse entry icon | `reverse_ledger_entry` | GREY-OUT |
| `src/features/customers/CustomerForm.tsx:113` | Tier dropdown | `assign_customer_tier` | HIDE |
| `src/features/customers/CustomerForm.tsx:154` | Address/Notes fields | `view_customer_contact` (edit) / `create_customer_full` (create) | HIDE |
| `src/features/customers/CustomerPicker.tsx` | Whole component | `view_customers` | HIDE |
| `src/features/customers/CustomerPicker.tsx` | "Add new" item | `create_customer_basic` | HIDE |
| `src/features/khata/KhataPage.tsx:137` | Outstanding column numeric | `view_customer_outstanding` | SHOW BOOL |
| `src/features/khata/ReceivePaymentDialog.tsx` | Whole dialog trigger | `receive_payment` | (caller gates) |
| `src/features/khata/ReverseEntryDialog.tsx` | Whole dialog trigger | `reverse_ledger_entry` | (caller gates) |
| `src/features/sales/SalesListPage.tsx` (route) | Page | `record_sale` OR `view_all_sales` | REDIRECT |
| `src/features/sales/SaleDetailPage.tsx:158` | unit_cost column | `view_sale_cost` | HIDE COL |
| `src/features/sales/SaleDetailPage.tsx:197` | line_profit column | `view_sale_cost` | HIDE COL |
| `src/features/sales/SaleDetailPage.tsx:441` | Linked ledger section | `view_customer_khata` | HIDE |
| `src/features/sales/ExpiredSalesListPage.tsx` (route) | Page | `view_all_sales` + `view_inventory_batches` | REDIRECT |
| `src/features/purchases/PurchasesListPage.tsx` (route) | Page | `view_purchases` | REDIRECT |
| `src/features/purchases/PurchasesListPage.tsx` | "New stock-in" button | `record_purchase` | GREY-OUT |
| `src/features/purchases/NewPurchasePage.tsx` (route) | Page | `record_purchase` | REDIRECT |
| `src/features/purchases/NewPurchasePage.tsx:760` | "Create new pack" item | `manage_product_packs` | GREY-OUT |
| `src/features/purchases/PurchaseDetailPage.tsx:381` | "Effect on inventory" card | `view_product_cost` | HIDE |
| `src/features/purchases/CreatePackDialog.tsx` | Trigger | `manage_product_packs` | (caller hides) |
| `src/features/batches/ExpiredStockListPage.tsx` (route) | Page | `view_inventory_batches` | REDIRECT |
| `src/features/batches/ExpiredStockListPage.tsx:119` | "Write off all" button | `writeoff_batch` | GREY-OUT |
| `src/features/batches/ExpiredStockListPage.tsx:92` | Per-row Write off | `writeoff_batch` | GREY-OUT |
| `src/features/batches/BatchesSection.tsx:121` | cost_per_unit col | `view_batch_cost` | HIDE COL |
| `src/features/batches/BatchesSection.tsx:134` | Write-off icon | `writeoff_batch` | GREY-OUT |
| `src/features/suppliers/SuppliersListPage.tsx:152` | "New supplier" button | `manage_suppliers` | GREY-OUT |
| `src/features/suppliers/SuppliersListPage.tsx:122` | Edit pencil | `manage_suppliers` | GREY-OUT |
| `src/features/suppliers/SuppliersListPage.tsx:132` | Archive icon | `manage_suppliers` | GREY-OUT |
| `src/features/suppliers/SupplierFormPage.tsx` (route) | Page | `manage_suppliers` | REDIRECT |
| `src/features/suppliers/SupplierCombobox.tsx` | "Create new" item | `manage_suppliers` | HIDE |
| `src/features/expenses/ExpensesPage.tsx:112` | "Add expense" button | `create_expense` | GREY-OUT |
| `src/features/targets/TargetsPage.tsx:92` | Save button | `manage_monthly_targets` | GREY-OUT |
| `src/features/targets/TargetsPage.tsx:66-87` | Numeric input fields | `manage_monthly_targets` | GREY-OUT (read-only) |
| `src/features/reports/ReportsPage.tsx:194` | Expense breakdown section | `view_expenses` | HIDE |
| `src/features/reports/ReportsPage.tsx:209` | Outstanding section | `view_customer_outstanding` | HIDE |
| `src/features/reports/ReportsPage.tsx` | Monthly profit columns | `view_sale_cost` | HIDE COL |
| `src/features/settings/SettingsPage.tsx:105` | Customer tiers row | `manage_customer_tiers` | HIDE |
| `src/features/settings/SettingsPage.tsx:123` | Variant attributes row | `manage_variant_attributes` | HIDE |
| `src/features/settings/SettingsPage.tsx:146` | Alert defaults section | `edit_shop_settings` | HIDE |
| `src/features/settings/SettingsPage.tsx:186` | Expired-sale section | `edit_shop_settings` | HIDE |
| `src/features/settings/SettingsPage.tsx` (new) | Team navigation row | `view_team` | HIDE |
| `src/features/settings/SettingsPage.tsx` (new) | Owner details section | `view_owner_details` | HIDE |
| `src/features/settings/SettingsPage.tsx` (new) | Shop information section | `edit_shop_settings` | HIDE |
| `src/features/settings/SettingsPage.tsx` (new) | Units of measure section | `manage_units_of_measure` | HIDE |
| `src/features/tiers/TiersPage.tsx` (route) | Page | `manage_customer_tiers` | REDIRECT |
| `src/features/variants/VariantAttributesPage.tsx` (route) | Page | `manage_variant_attributes` | REDIRECT |
| `src/features/team/TeamPage.tsx` (new, route) | Page | `view_team` | REDIRECT |
| `src/features/team/TeamPage.tsx` (new) | Invite button | `invite_users` | GREY-OUT |
| `src/features/team/TeamPage.tsx` (new) | Edit permissions per row | `modify_user_permissions` | GREY-OUT |
| `src/features/team/TeamPage.tsx` (new) | Edit discount limits per row | `modify_user_discount_limits` | GREY-OUT |
| `src/features/team/TeamPage.tsx` (new) | Cancel invitation per row | `cancel_invitations` | GREY-OUT |
| `src/features/team/TeamPage.tsx` (new) | Revoke access per row | `revoke_user_access` | GREY-OUT |
| `src/features/team/TeamPage.tsx` (new) | Audit log section | `view_user_audit_log` | HIDE |

---

## 5. Hooks needing modification

The v2.9.0.1 sweep (`decisions/2026-05-12-v2-9-0-1-frontend-sweep.md`) already migrated three hooks. They are **explicitly excluded** below to avoid double-listing:
- `useCreateCustomer` → `create_customer_full`
- `useUpdateShopAlertDefaults` → `update_shop_settings`
- `useUpdateShopExpiredSaleSettings` → `update_shop_settings`

Remaining hooks needing migration to RPCs for `_by_user_id` audit-column writes (Group C / 11 paths from the sweep ADR plus several new ones the v2.9.1 ticket commits to):

### Direct-table writes needing RPC wrappers

| Hook + file:line | Current call | v2.9.1 replacement RPC | Notes |
|---|---|---|---|
| `useUpdateCustomer` — `src/features/customers/hooks.ts:106` | `from('customers').update(...)` | new `update_customer(p_id, p_name, p_phone, p_address, p_notes, p_tier_id)` (Phase C) | Server-side must additionally enforce `assign_customer_tier` when `p_tier_id` differs from current (F-PD-12) |
| `useUpdateProduct` — `src/features/products/hooks.ts:537` | `from('products').update(...)` + `from('product_variants').update(...)` | new `update_product(p_id, p_name, p_category_id, ...)` | Must wrap BOTH table writes atomically — currently runs as two separate updates with a stale-flag pre-check |
| `useArchiveProduct` — `src/features/products/hooks.ts:644` | `from('products').update({is_active})` + variant sync | new `archive_product(p_id, p_is_active)` | The `archive_product_trigger` already gates server-side; an RPC adds audit |
| `useUpdateVariantInline` — `src/features/products/hooks.ts:227` | `from('product_variants').update(...)` | new `update_variant_inline(p_variant_id, p_sku, p_price, p_is_active)` | Splits into `edit_product` (sku, price) + `archive_product` (is_active=false) |
| `useUpdateSupplier` — `src/features/suppliers/hooks.ts:116` | `from('suppliers').update(...)` | new `update_supplier(p_id, ...)` | RLS in v2.9 gates by `manage_suppliers`; RPC adds audit |
| `useArchiveSupplier` — `src/features/suppliers/hooks.ts:149` | `from('suppliers').update({is_active: false})` | new `archive_supplier(p_id)` | Same |
| `useCreateExpense` — `src/features/expenses/hooks.ts:39` | `from('expenses').insert(...)` | existing `create_expense` RPC (migration 0075 line 11) | Already migrated server-side — just wire up |
| `useUpsertTarget` — `src/features/targets/hooks.ts:34` | `from('monthly_targets').upsert(...)` | existing `upsert_monthly_target` RPC (migration 0075 line 14) | Same — wire up only |
| `useShop` — `src/features/auth/hooks.ts:23` | `from('shops').select('id, shop_name').eq('owner_user_id', user.id)` | new `get_active_shop()` or reuse `get_user_shop_list()` | Currently breaks for non-owner employees; the v2.9.1 multi-shop UX requires reading the **active** shop, not the **owned** shop |
| `useShopAlertDefaults` — `src/features/batches/hooks.ts:213` | `from('shops').select('default_*_alert_days')` | new `get_shop_settings()` projection RPC | Reads two non-sensitive numeric fields; safe under any authenticated user, but consolidating reads through one RPC keeps the policy surface clean |
| `useShopExpiredSaleSettings` — `src/features/batches/hooks.ts:250` | `from('shops').select('default_expired_sale_policy, expired_sale_receipt_disclaimer')` | new `get_shop_settings()` projection RPC | Same |

### Hooks gaining new RPC signatures (new in v2.9.1 — team feature)

| New hook | File | RPC |
|---|---|---|
| `useTeam` | `src/features/team/hooks.ts` | `get_team_for_active_shop()` |
| `useUserPermissions(targetId)` | `src/features/team/hooks.ts` | `get_user_permissions(p_target_user_id)` |
| `useSelfPermissions` | `src/features/team/hooks.ts` (cached, used app-wide) | `get_user_permissions(auth.uid())` — drives every client-side `hasPermission(key)` check |
| `usePendingInvitations` | `src/features/team/hooks.ts` | direct read or via `get_team_for_active_shop` |
| `useCreateInvitation` | `src/features/team/hooks.ts` | `create_invitation(p_email, p_role_preset, p_permissions_jsonb, p_discount_limits_jsonb, p_expires_at)` |
| `useCancelInvitation` | `src/features/team/hooks.ts` | `cancel_invitation(p_invitation_id)` |
| `useAcceptInvitation` | `src/features/team/hooks.ts` | `accept_invitation(p_invitation_id, p_verbal_code)` |
| `useModifyUserPermission` | `src/features/team/hooks.ts` | `modify_user_permission(p_target_user_id, p_permission_key, p_granted)` |
| `useApplyPresetToUser` | `src/features/team/hooks.ts` | `apply_preset_to_user(p_target_user_id, p_preset)` |
| `useUpdateUserDiscountLimits` | `src/features/team/hooks.ts` | `update_user_discount_limits(p_target_user_id, p_limits_jsonb)` |
| `useRevokeUserAccess` | `src/features/team/hooks.ts` | `revoke_user_access(p_target_user_id)` |
| `useUserShopList` | `src/features/team/hooks.ts` | `get_user_shop_list()` |
| `useSetActiveShop` | `src/features/team/hooks.ts` | `set_active_shop(p_shop_id)` (or pure header injection — see Phase C decision) |
| `useUpdateOwnerDetails` | `src/features/settings/hooks.ts` (new) | `update_owner_details(...)` |
| `useShopOwnerDetails` | `src/features/settings/hooks.ts` (new) | direct from `shop_owner_details` (gated by `view_owner_details`) |

### New permission-check helpers (lib, not feature hooks)

- `src/lib/permissions.ts` (new) — `usePermission(key)`, `useDiscountLimit(kind)`, plus typed `PERMISSION_KEYS` constants matching the 50-key catalog.
- `src/lib/customFetch.ts` (new — per CLAUDE.md v2.9 RBAC notes) — injects `app-shop-id` header on every Supabase request; integrates with `useSetActiveShop`.

---

## 6. Routes needing guard updates

Add three new guard primitives in `src/lib/guards.tsx`:

- `RequirePermission(key: PermissionKey, fallback?: 'redirect' | 'render-empty')` — checks `useSelfPermissions().data[key]`. Default fallback redirects to `/dashboard` with a non-blocking toast "You don't have access to that page".
- `RequireAnyPermission(keys: PermissionKey[])` — for routes gated by either-of (e.g. Sales = `record_sale` OR `view_all_sales`).
- `RequireOwner` — `useUserShopList().data.find(active).is_owner === true`. Only used inside the new team page for owner-only sub-flows (none currently, but reserved).

Then in `src/router/index.tsx`:

| Route | Current guards | v2.9.1 additional guard |
|---|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | `RedirectIfAuthed` | (unchanged) |
| `/onboarding` | `RequireAuth` → `RedirectIfOnboarded` | (unchanged) |
| `/subscription/expired` | `RequireAuth` → `RequireOnboarded` → `RedirectIfActiveSubscription` | (unchanged) |
| `/invite/accept/:invitation_id` (new) | `RequireAuth` | (no permission gate — accepting IS the grant ceremony) |
| `/settings` | `RequireAuth` → `RequireOnboarded` | (unchanged — sections inside gate themselves) |
| `/settings/support` | same | (unchanged) |
| `/settings/team` (new) | `RequireAuth` → `RequireOnboarded` → `RequirePermission('view_team')` | NEW |
| `/settings/tiers` | (subscription-bypassing) | `RequirePermission('manage_customer_tiers')` |
| `/settings/variant-attributes` | (subscription-bypassing) | `RequirePermission('manage_variant_attributes')` |
| `/dashboard` | `RequireActiveSubscription` | (unchanged — page internals gate per-widget) |
| `/pos` | `RequireActiveSubscription` | `RequirePermission('record_sale')` |
| `/products` | `RequireActiveSubscription` | `RequirePermission('view_products')` |
| `/products/new` | same | `RequirePermission('create_product')` (route-level redirect; internal grey-out still useful as defense) |
| `/products/:id` | same | `RequirePermission('view_products')` |
| `/customers` | same | `RequirePermission('view_customers')` |
| `/customers/new` | same | `RequirePermission('create_customer_basic')` |
| `/customers/:id` | same | `RequirePermission('view_customers')` |
| `/customers/:id/edit` | same | `RequirePermission('edit_customer')` |
| `/suppliers` | same | `RequirePermission('view_suppliers')` |
| `/suppliers/new` | same | `RequirePermission('manage_suppliers')` |
| `/suppliers/:id/edit` | same | `RequirePermission('manage_suppliers')` |
| `/khata` | same | `RequirePermission('view_customer_khata')` |
| `/purchases` | same | `RequirePermission('view_purchases')` |
| `/purchases/new` | same | `RequirePermission('record_purchase')` |
| `/purchases/:id` | same | `RequirePermission('view_purchases')` |
| `/sales` | same | `RequireAnyPermission(['record_sale', 'view_all_sales'])` |
| `/sales/:id` | same | `RequireAnyPermission(['record_sale', 'view_all_sales'])` |
| `/expenses` | same | `RequirePermission('view_expenses')` |
| `/targets` | same | `RequirePermission('view_monthly_targets')` |
| `/reports` | same | `RequirePermission('view_reports')` |
| `/inventory/expired` | same | `RequirePermission('view_inventory_batches')` |
| `/inventory/expired-sales` | same | `RequireAnyPermission(['view_all_sales'])` + `RequirePermission('view_inventory_batches')` (compose) |

Add the new path constants in `src/paths.ts`:
```
team: '/settings/team',
acceptInvitation: '/invite/accept/:invitation_id',
gotoAcceptInvitation: (id: string) => `/invite/accept/${id}`,
```

---

## 7. Implementation order

Per PRD §D.11, the eight-cluster Phase D build:

### Step 1 — Infrastructure (Phase C output consumed in D)
Files touched:
- `src/lib/customFetch.ts` (new) — wraps Supabase client, injects `app-shop-id` header
- `src/lib/supabase.ts` — wire in `customFetch`
- `src/lib/permissions.ts` (new) — `usePermission`, `useSelfPermissions`, key constants
- `src/lib/guards.tsx` — add `RequirePermission`, `RequireAnyPermission`, `RequireOwner`
- `src/features/team/hooks.ts` (new) — `useUserShopList`, `useSelfPermissions`, `useSetActiveShop`
- `src/components/ui/PermissionTooltip.tsx` (new — shared "Requires permission: {key}. Contact your shop owner." tooltip)
- `src/components/ui/PermissionGated.tsx` (new — wrapper that renders children, grey-out version, or nothing based on permission)
- i18n keys for permission-tooltip messages in all 14 namespaces' `common`

### Step 2 — TopNav + shop switcher
Files:
- `src/components/layout/TopBar.tsx` — add ShopSwitcherDropdown + Team menu item
- `src/components/layout/ShopSwitcherDropdown.tsx` (new)
- `src/layouts/navConfig.ts` — make permission-aware (add `permission` field per nav item, filter)
- `src/components/layout/Sidebar.tsx` — consume new filtered nav list

### Step 3 — `/settings/team`
Files:
- `src/features/team/TeamPage.tsx` (new)
- `src/features/team/TeamMembersTable.tsx` (new)
- `src/features/team/PendingInvitationsTable.tsx` (new)
- `src/features/team/InviteUserDialog.tsx` (new)
- `src/features/team/EditPermissionsDialog.tsx` (new — checkbox grid with client-side dependency validation)
- `src/features/team/EditDiscountLimitsDialog.tsx` (new)
- `src/features/team/RevokeAccessConfirmDialog.tsx` (new)
- `src/features/team/AuditLogSection.tsx` (new)
- `src/features/team/hooks.ts` — extend with mutation hooks
- `src/paths.ts` — add `team` + `acceptInvitation`
- `src/router/index.tsx` — add `/settings/team` route
- `src/features/settings/SettingsPage.tsx` — add Team navigation row + hide owner-only sections
- i18n namespace `team`

### Step 4 — `/invite/accept`
Files:
- `src/features/team/AcceptInvitationPage.tsx` (new)
- `src/router/index.tsx` — add `/invite/accept/:invitation_id` route
- Hook additions in `src/features/team/hooks.ts`
- i18n keys

### Step 5 — POS
Files:
- `src/features/pos/POSPage.tsx` — wire in `view_customers`, `view_sale_cost`, `view_product_cost` gates; gate CustomerPicker, "below avg cost" warning, ConfirmExpiredSaleDialog confirm button
- `src/features/pos/OverrideDiscountDialog.tsx` — clip max input via discount_limit
- `src/features/pos/AddCustomerDialog.tsx` — gate `create_customer_full` fields
- `src/features/pos/PosBatchPicker.tsx` — hide cost column
- `src/features/customers/CustomerPicker.tsx` — gate component + "add new" item
- `src/router/index.tsx` — add `RequirePermission('record_sale')` to POS route

### Step 6 — Products + customers + inventory
Files:
- `src/features/products/ProductsListPage.tsx`
- `src/features/products/ProductTable.tsx` — col-hide for avg_cost / last_purchase_cost
- `src/features/products/ProductDetailPage.tsx`
- `src/features/products/ProductDetailBody.tsx`
- `src/features/products/ProductEditDialog.tsx`
- `src/features/products/ProductFormPage.tsx`
- `src/features/products/VariantsTable.tsx`
- `src/features/products/VariantEditDialog.tsx`
- `src/features/products/AddVariantDialog.tsx`
- `src/features/products/AddProductInlineDialog.tsx`
- `src/features/products/CategoryCombobox.tsx`
- `src/features/products/PacksSection.tsx`
- `src/features/products/hooks.ts` — migrate `useUpdateProduct`, `useArchiveProduct`, `useUpdateVariantInline` to RPCs
- `src/features/customers/CustomersListPage.tsx`
- `src/features/customers/CustomerDetailPage.tsx`
- `src/features/customers/CustomerFormPage.tsx`
- `src/features/customers/CustomerForm.tsx`
- `src/features/customers/CustomerPicker.tsx` (touched in Step 5 too)
- `src/features/customers/hooks.ts` — migrate `useUpdateCustomer` to RPC
- `src/features/khata/KhataPage.tsx`
- `src/features/batches/ExpiredStockListPage.tsx`
- `src/features/batches/BatchesSection.tsx`
- `src/features/batches/InventoryAlertsWidget.tsx`
- `src/features/batches/ExpiredStockWidget.tsx`
- `src/features/batches/WriteOffBatchDialog.tsx`
- `src/features/batches/BulkWriteOffDialog.tsx`
- `src/features/batches/hooks.ts` — migrate `useShop*` reads to `get_shop_settings()` RPC
- `src/features/sales/SalesListPage.tsx`
- `src/features/sales/SaleDetailPage.tsx`
- `src/features/sales/ExpiredSalesListPage.tsx`
- `src/features/sales/ExpiredSalesWidget.tsx`
- Routes in `src/router/index.tsx` for all of above

### Step 7 — Suppliers + expenses + reports
Files:
- `src/features/suppliers/SuppliersListPage.tsx`
- `src/features/suppliers/SupplierCombobox.tsx`
- `src/features/suppliers/AddSupplierDialog.tsx`
- `src/features/suppliers/hooks.ts` — migrate `useUpdateSupplier` + `useArchiveSupplier` to RPCs
- `src/features/purchases/PurchasesListPage.tsx`
- `src/features/purchases/NewPurchasePage.tsx`
- `src/features/purchases/PurchaseDetailPage.tsx`
- `src/features/purchases/CreatePackDialog.tsx`
- `src/features/expenses/ExpensesPage.tsx`
- `src/features/expenses/hooks.ts` — migrate `useCreateExpense` to `create_expense` RPC
- `src/features/targets/TargetsPage.tsx`
- `src/features/targets/hooks.ts` — migrate `useUpsertTarget` to `upsert_monthly_target` RPC
- `src/features/reports/ReportsPage.tsx`
- `src/features/dashboard/DashboardPage.tsx`
- Routes in `src/router/index.tsx`

### Step 8 — Settings
Files:
- `src/features/settings/SettingsPage.tsx` — final pass: hide all owner-only sections, add new sections (Team row, Shop info, Owner details, Units of measure)
- `src/features/settings/hooks.ts` (new) — `useShopOwnerDetails`, `useUpdateOwnerDetails`, `useUnitsOfMeasure` (admin variant)
- `src/features/settings/OwnerDetailsSection.tsx` (new)
- `src/features/settings/ShopInfoSection.tsx` (new)
- `src/features/settings/UnitsOfMeasureSection.tsx` (new)
- `src/features/tiers/TiersPage.tsx` — route guard
- `src/features/variants/VariantAttributesPage.tsx` — route guard
- `src/features/auth/hooks.ts` — finalize `useShop()` rename / replacement

---

## 8. Methodology / sources

Files read for this audit:

Code (authoritative):
- `src/paths.ts`
- `src/router/index.tsx`
- `src/lib/guards.tsx`
- `src/layouts/AppShell.tsx`
- `src/layouts/navConfig.ts`
- `src/components/layout/TopBar.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/features/auth/hooks.ts`
- `src/features/onboarding/OnboardingPage.tsx`
- `src/features/dashboard/DashboardPage.tsx` + `hooks.ts`
- `src/features/pos/POSPage.tsx` + `hooks.ts`
- `src/features/products/ProductsListPage.tsx` + `ProductDetailPage.tsx` + `ProductDetailBody.tsx` + `ProductEditDialog.tsx` (first 100 lines) + `AddProductInlineDialog.tsx` + `ProductTable.tsx` + `PacksSection.tsx` + `hooks.ts` + `categoryHooks.ts`
- `src/features/customers/CustomersListPage.tsx` + `CustomerDetailPage.tsx` + `CustomerForm.tsx` + `CustomerPicker.tsx` + `hooks.ts`
- `src/features/khata/KhataPage.tsx` + `ReceivePaymentDialog.tsx` + `ReverseEntryDialog.tsx` + `hooks.ts`
- `src/features/suppliers/SuppliersListPage.tsx` + `hooks.ts`
- `src/features/sales/SalesListPage.tsx` + `SaleDetailPage.tsx` + `ExpiredSalesListPage.tsx` + `hooks.ts`
- `src/features/purchases/PurchasesListPage.tsx` + `NewPurchasePage.tsx` + `PurchaseDetailPage.tsx` + `hooks.ts`
- `src/features/batches/BatchesSection.tsx` + `ExpiredStockListPage.tsx` + `InventoryAlertsWidget.tsx` + `hooks.ts`
- `src/features/expenses/ExpensesPage.tsx` + `hooks.ts`
- `src/features/targets/TargetsPage.tsx` + `hooks.ts`
- `src/features/reports/ReportsPage.tsx` + `hooks.ts`
- `src/features/settings/SettingsPage.tsx`
- `src/features/tiers/TiersPage.tsx` + `hooks.ts`
- `src/features/variants/VariantAttributesPage.tsx` + `hooks.ts`
- `src/features/units/hooks.ts`

Specs and ADRs:
- `supabase/migrations/0068_v29_foundation_enum_catalog.sql` (50-permission catalog source of truth)
- `supabase/migrations/0075_v29_new_rpcs.sql` (heading of every new RPC enumerated)
- `design/2026-05-13-rbac-attack-surface.md` §C.2.1.1–C.2.1.8 (per-permission test-point map mined for which page each permission touches)
- `design/2026-05-13-rbac-model-design.md` §B.5+ (UX-side notes referenced via CLAUDE.md)
- `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` (already-migrated hooks; excluded from §5 to avoid double work)
- `CLAUDE.md` (v2.9 RBAC summary block — three rules cover most decisions)

Source quality:
- File:line citations are exact. Re-check is strongly recommended when implementing — the codebase already moves.
- Permissions cited are verbatim keys from the catalog at `0068_v29_foundation_enum_catalog.sql`. Any deviation = flag-and-discuss in PR.
- The handful of new RPCs proposed under §5 (e.g. `update_customer`, `update_product`, `update_supplier`, `archive_supplier`, `archive_product`, `update_variant_inline`, `get_active_shop`, `get_shop_settings`) are PROPOSED for Phase C — they don't exist in `0075` yet. Phase C build must mint them.

---

## Flags / open questions

1. **`useShop()` rename**: the existing hook filters by `owner_user_id = auth.uid()`, which fails for non-owner team members. Phase C should decide whether to (a) rename it to `useOwnedShop()` and ship a new `useActiveShop()`, or (b) replace it in place with a server-side `get_active_shop()` that respects the `app-shop-id` header. Recommended: (b), because the rest of the app already reads "the current shop" from this hook.
2. **Dashboard `useTotalOutstanding()` vs `view_customer_outstanding`**: The total-outstanding view aggregates per-customer outstanding. Confirm Phase C's view rewrite either projects 0 or NULL for users without the permission (preferred: project 0 — leaks nothing useful since the count is shop-wide).
3. **POS "below avg cost" warning**: currently uses cart-line `c.avg_cost` (snapshot at add-to-cart). For non-`view_product_cost` users this comes back as 0/null and the warning never triggers (false negative). Acceptable for v2.9.1 since the warning is a soft nudge.
4. **Receipt reprint**: there's no current "Reprint" button. ADR notes `reprint_receipt` is a UI-only gate. v2.9.1 should add this to SaleDetailPage as a Phase D.6 polish task.
5. **`expired_sale_policy` per-product override field on ProductEditDialog**: the field gating (`edit_product_expiry_overrides`) needs a server-side column-level trigger. Currently the update happens via the same `useUpdateProduct` flow that lacks fine-grained column gating. Phase C must add either a column-level trigger or split the patch into two RPCs.
6. **Settings → Owner-only sections**: HIDE entirely (per task brief). This means a manager/salesperson opens `/settings` and sees only Language + (conditional) Team + Tiers + Variant attributes. They do not see Shop info, Owner details, Inventory alert defaults, Expired-sale policy, Units of measure. Matches the user instruction: "lets owners discover what's owner-only" by virtue of those rows existing for them.
7. **`view_team` vs `view_user_audit_log`**: the audit log section is HIDDEN (not grey-out) without `view_user_audit_log` even on the team page — audit is the most sensitive surface and we follow the "owner-only sections" pattern for it. Both team admins and audit viewers see the audit; everyone else doesn't know it exists.
