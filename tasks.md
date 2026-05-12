# Shop POS MVP — Tasks

User-facing tracker for the 10-week Shop POS MVP build per `PRD.md`. Each milestone is independently demonstrable; we check in with you at every milestone boundary.

Plan file (full detail): `~/.claude/plans/soft-jingling-canyon.md`
Decision log (architectural choices): `decisions/`

---

## Pre-flight

- [x] Create `tasks.md` (this file) and `decisions/` folder with initial ADRs
- [x] Install deps: `@supabase/supabase-js`, `@tanstack/react-query`, `react-i18next`, `i18next`, `i18next-browser-languagedetector`, `zod`, `@hookform/resolvers`, `stylis-plugin-rtl`
- [x] Create Supabase project `nizaamify-shop-mvp` via MCP, capture URL + publishable key
- [x] Strip Auth0 from `.env`, write `.env.local` (gitignored) and `.env.example`
- [x] Delete unrelated scaffold pages and components; update `paths.ts`

---

## Milestones

### M1 — Foundation & Auth shell  *(PRD week 1)* ✅
**Demo:** signup → verify email → login → placeholder dashboard. EN/UR toggle works.

- [x] Migrations `0001_extensions.sql`, `0002_profiles_and_subscriptions.sql`, `0002a_revoke_handle_new_user_exec.sql` applied via MCP
- [x] `src/lib/{supabase,i18n,queryClient,rtlCache}.ts`
- [x] `src/theme/muiTheme.ts` → factory `getTheme(direction)`
- [x] `src/App.tsx` rewritten with all providers (Theme + Emotion cache + i18n + Query + Auth)
- [x] `features/auth/AuthProvider.tsx` with `onAuthStateChange`
- [x] `RequireAuth` + `RedirectIfAuthed` guards, `LanguageSelector` component
- [x] Pages: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`
- [x] Locales: `en/{common,auth}.json`, `ur/{common,auth}.json`
- [x] `npm run type-check && npm run lint && npm run build` green
- [x] `mcp__supabase__get_advisors` clean (after revoking REST exec on `handle_new_user`)

### M2 — Onboarding + Subscription gating  *(PRD week 2)* ✅
**Demo:** Full account lifecycle. Trial countdown banner. Admin SQL flips status to `active`; user regains access on refresh.

- [x] Migrations `0003`–`0008` applied; types regenerated
- [x] 2-step onboarding wizard at `/onboarding` (RHF + zod, PK phone + CNIC validation)
- [x] `RequireOnboarded`, `RequireActiveSubscription`, `RedirectIf` guards
- [x] `/subscription/expired` page (env-driven payment instructions, refresh button)
- [x] `<DashboardBanner />` with all 6 banner kinds; info-only dismissibility per-day
- [x] Admin SQL snippet documented in `decisions/0010-admin-runbook.md`
- [x] ADR-0011 documents intentional SECURITY DEFINER RPCs

### M3 — Products + Stock-in  *(PRD week 3)* ✅
**Demo:** Add 5 products, record a stock-in, stock count visible.

- [x] Migration `0009_sale_purchase_functions.sql` (`record_purchase()` + `record_sale()` for M4)
- [x] `/products` list/form/search with soft-delete (`is_active`)
- [x] `/purchases` and `/purchases/new`

### M4 — POS sale flow  *(PRD week 4)* ✅
**Demo:** Cash sale + credit sale; stock decrements; ledger entry on credit.

- [x] `record_sale()` added to migration `0009`
- [x] `/pos`: search → cart → qty → service charge → cash/credit → complete
- [x] Inline customer picker + add-customer dialog for credit sales
- [x] In-browser receipt view (with print button)

### M5 — Khata  *(PRD week 5)* ✅
**Demo:** Credit sale → outstanding shows → record payment → balance closes.

- [x] Migration `0010_khata_views.sql` with `customer_outstanding`
- [x] Customers list/add via shared dialog (phone unique per shop)
- [x] Customer detail page (history + outstanding)
- [x] Receive payment dialog writes ledger credit
- [x] `/khata` outstanding balances list

### M6 — Targets + Expenses + Dashboard  *(PRD week 6)* ✅
**Demo:** Set monthly target. Add 3 expenses. Dashboard shows progress.

- [x] Migration `0011_dashboard_views.sql` (`monthly_summary`, `daily_sales_today`)
- [x] `/expenses` CRUD with category dropdown
- [x] `/targets` monthly form (upsert per shop+month)
- [x] `/dashboard` widgets: today's sales, outstanding total, MTD sales/gross/net, target progress, quick actions

### M7 — Reports + Subscription edge cases  *(PRD week 7)* ✅
**Demo:** Reports < 3s; mid-session expiry degrades gracefully.

- [x] `/reports` hub (last 7 days sales, last 6 months summary, MTD expenses by category, outstanding balances)
- [x] Mid-session expiry: existing `<RequireActiveSubscription>` redirects on next nav; `<DashboardBanner />` flips on refetch (5min staleness + window-focus refetch)
- [x] EN+UR banner copy reviewed across all 6 banner kinds

### M8 — RTL audit + responsive polish  *(PRD week 8)* ⚙️ partial
**Demo:** Full app in Urdu without layout breaks; usable on tablet.

- [x] New code audited — no hard-coded `left`/`right` placements; ADR-0012 documents results
- [x] AppShell, drawers, AppBar, dialogs use direction-agnostic MUI primitives
- [x] Loading + empty + error states added to all list pages
- [ ] **Manual:** iPad + mid-Android tablet viewport walkthrough
- [ ] **Manual:** Lighthouse run on `npm run preview` (perf ≥ 80, a11y ≥ 90)
- [ ] **Backlog:** fix five LTR-fixed paddings in legacy Monai components (see ADR-0012)

### M9 — Tests + seed + training  *(PRD week 9)* ⚙️ partial
**Demo:** Tests green; pilot shop seeded.

- [x] Vitest schema tests (auth, onboarding, banner format) — 15 tests pass
- [x] `supabase/seed.sql` parameterized template (replace `<USER_ID>`, run via SQL editor or MCP)
- [ ] **Optional next:** end-to-end test of signup→sale→payment via Playwright or Vitest+jsdom (skipped: requires live Supabase or mocking layer)
- [ ] **Manual:** seed pilot shop + train owner

### M10 — Beta launch  *(PRD week 10)* ⏳ manual
**Demo:** Live system + first week of real-usage data.

- [ ] **Manual:** pilot shop runs real transactions for one week
- [ ] **Manual:** daily feedback triage; record top 3 issues

---

## v2.5 — Product detail + category entity *(post-MVP fix)*

Spec: `MVP_FIXES_v2.5.md`

Status: 🟦 not started · 🟨 in progress · ✅ done · ❌ blocked

### Phase B — Schema migration
- ✅ Create product_categories table + RLS + indexes
- ✅ Add products.category_id column
- ✅ Backfill distinct types as categories per shop
- ✅ Link products to categories
- ✅ Verify zero NULL category_id rows
- ✅ Set products.category_id NOT NULL
- ✅ Drop old unique index (type), create new (category_id)
- ✅ Regenerate database.ts

### Phase C — Backend RPCs
- ✅ search_categories
- ✅ create_category_inline
- ✅ update_category
- ✅ search_products(p_category_id)
- ✅ search_products_count(p_category_id)
- ✅ create_product_with_opening_stock(p_category_id)

### Phase D — Frontend
- ✅ ProductDetailPage at /products/:id (header, fields, packs, recent activity)
- ✅ Edit modal on detail page (reuses form)
- ✅ Eye icon on /products list rows + row click → detail
- ✅ Drop Actions column from /products (per spec discovery default)
- ✅ Category filter dropdown on /products (URL-driven)
- ✅ Category combobox in product form (replaces Type) + "+ Create new category"
- ✅ POS drawer detail (right-side, mobile bottom-sheet)
- ✅ Eye icon on POS rows + row click → drawer
- ✅ "Add to cart" header + center-align `+` button in POS
- ✅ i18n keys EN + UR

### Phase E — Verification
- 🟦 Manual smoke test §12 — **not run by Claude.** Code-level checks (lint, type, build, tests) all green; the §12 walkthrough is a human task.
- ✅ npm run lint + type-check + build + tests green
- ✅ Update CLAUDE.md (v2.5 line, gotchas, todos)
- ✅ Record decisions in decisions/ (ADRs 0019, 0020, 0021)

---

## v2.6 — Foundational variant refactor *(SILENT, no user-visible changes)*

Spec: `MVP_v2.6_VARIANT_REFACTOR.md`

### Phase A — Discovery
- ✅ Inspect live schema; confirm v2.5 baseline
- ✅ Sample data volume (tiny — 13 products, 20 sales, 21 purchases, 3 packs)
- ✅ Confirm append-only triggers on sale_items / purchase_items (will need DISABLE for backfill)
- ✅ Append v2.6 + v2.7 phase tracker to tasks.md

### Phase B — Schema migration
- ✅ §2.1 Create product_variants table + RLS + indexes
- ✅ §2.2 Backfill default variant per product (audit 1)
- ✅ §2.3-§2.5 Add variant_id columns + backfill + NOT NULL (audits 2-4)
- ✅ §2.7-§2.8 product_packs unique-index swap + sync_product_id_from_variant trigger
- ✅ §2.10 product_with_default_variant view
- ✅ §3.5 product_stock_display view rewritten on variants
- ✅ Regenerate database.ts

### Phase C — Function rewrites
- ✅ record_sale (variant-aware, legacy product_id fallback)
- ✅ record_purchase (variant-aware, preserve v2.3 largest-remainder overhead)
- ✅ create_product_with_opening_stock (product + default variant in one tx)
- ✅ search_products (returns compat view rows)
- ✅ define_pack_inline / update_pack / deactivate_pack (default-variant resolution)
- ✅ Grants

### Phase D — Frontend
- ✅ Regenerate types
- ✅ Fix anything that breaks (ProductSearchRow shape, hooks)

### Phase E — Verification
- ✅ Audit queries §6 (all six must return zero rows)
- ✅ Reconciliation §7 (variant stock sum = old product stock)
- ✅ 5 ADRs per §14
- ✅ CLAUDE.md update

---

## v2.7 — Variant management UI *(user-visible features on top of v2.6)*

Spec: `MVP_v2.7_VARIANT_UI.md`

### Phase A — Discovery
- ✅ Confirm v2.6 audits all green
- ✅ Append v2.7 phase tracker

### Phase B — Schema migration
- ✅ variant_attributes + values + product_variant_attribute_values
- ✅ products.has_variants column
- ✅ Replace v2.6 uq_variant_default_per_product (subquery → row trigger)

### Phase C — Backend
- ✅ Attribute CRUD RPCs (create / update / deactivate / search)
- ✅ Value CRUD RPCs (add / update / deactivate / list)
- ✅ create_product_with_variants RPC
- ✅ add_variant_to_product RPC
- ✅ product_variant_full view
- ✅ Update product_with_default_variant for multi-variant aggregates

### Phase D — Frontend
- ✅ Settings → Variant Attributes page
- ✅ Product form "Has variants?" toggle + matrix builder
- ✅ Product detail page variants table + Add variant dialog
- ✅ Stock-in matrix mode (fallback: expanding-line list if matrix is too complex)
- ✅ POS variant picker + multi-variant list rendering
- ✅ Cart line + receipt + sale detail variant labels

### Phase E — Verification
- ✅ i18n EN + UR (variants / variant_attributes — stock_in.matrix and pos.variant_picker keys added)
- ✅ 4 ADRs filed (0026 attributes-pool, 0027 max-3, 0028 expanding-line fallback, 0029 POS picker). Spec §15 listed 6; the SKU-pattern + attribute-edit-locked-after-history ADRs were not warranted (auto-SKU is straightforward UI; lock-after-history is enforced by sale_items/purchase_items append-only triggers from v1.8).
- ✅ CLAUDE.md updated (v2.7 PRD line, 5 gotchas, 3 deferred-todo entries)
- 🟦 Manual smoke test §13 — **not run by Claude.** Code-level checks (lint, type, build, tests) all green. Spec's §13 walkthrough (tracksuit, yoga mat, masking tape, iPhone, single-variant regression, cross-shop isolation) is a human task.

---

## Stage 1 — Profit calculation bug (P0, minimal fix) — 2026-05-12

**Sales reported:** `f9f13521` (5% sale-level discount) showing wrong profit 1,000 instead of 500. `62c622cd` (no discount) correct at 1,000.

### Phase 1A — Forensic discovery
- ✅ Fetched both invoices + their sale_items via MCP
- ✅ Hand-computed expected profit per v2.2/v2.3 stacking discipline
- ✅ Located TWO profit code paths: SaleDetailPage.tsx:173 (per-line) + monthly_summary.gross_profit view (Dashboard/Reports). Both ignore sale-level discount; monthly_summary additionally ignores line discounts.

### Phase 1B — Classification
- ✅ Class 1 (profit ignores sale-level discount) at two independent sites; byproduct of Class 5 (paths disagree)
- ✅ Decision file: `decisions/2026-05-12-profit-calculation-bug-root-cause.md`

### Phase 1C — Minimal fix
- ✅ SaleDetailPage.tsx: pre-compute per-line allocation of sale_discount_amount (largest-remainder, sums to exact value); subtract each line's share from revenue before computing per-line profit
- ✅ Monthly_summary view left alone — Stage 2's invoice_financials view replaces it (folded-in scope)

### Phase 1D — Verification gate
- ✅ Sale #f9f13521 hand-computed expected profit (500) matches new formula; Sale #62c622cd profit (1,000) unchanged
- ✅ No regression: build / type / lint green; existing v1.3–v2.5 acceptance criteria unchanged (only a display-side change)
- ✅ CLAUDE.md gotcha added
- 🟦 **Stage 2 (folded-in scope) will fix the dashboard/reports gross_profit by reading from invoice_financials view; until that lands, the dashboard MTD figure remains over-stated by Σ sale_discount + Σ line_discount in the period.**

### Stage 2 hardening (folded-in from Stage 1) — completed 2026-05-12
- ✅ **invoice_financials view (single source of truth)** — migration 0051. `sale_item_financials` does largest-remainder allocation of `invoices.sale_discount_amount` across lines; `invoice_financials` aggregates per-invoice. `monthly_summary` rewritten to read from `invoice_financials`. ADR: `decisions/2026-05-12-invoice-financials-single-source-of-truth.md`. SaleDetail + Dashboard now read the same canonical number.
- ✅ **3 financial audit queries** (audits 7/8/9) — stored_total consistency, math sanity, ledger debit ≡ outstanding. All return 0 rows. ADR: `decisions/2026-05-12-stage2-audit-extensions.md`.
- ✅ **record_sale transaction integrity ADR** — verified via deliberate-failure test (credit payment with no customer → exception → full rollback). ADR: `decisions/2026-05-12-record-sale-transaction-integrity.md`.
- ✅ **cost_at_sale snapshot timing ADR** — verified in migration 0041 (FOR UPDATE acquired before avg_cost read; snapshot frozen by append-only trigger). ADR: `decisions/2026-05-12-cost-at-sale-snapshot-timing.md`.
- ✅ **Decimal precision audit** — all money columns confirmed `numeric(12,2)`. New views inherit.
- ✅ **No JS Number on money paths** — full codebase audit + 6 server-side views/columns added (migrations 0052–0056): `invoice_financials.outstanding`, `purchase_item_financials` (line_subtotal + line_overhead + line_total + cost_delta), `daily_sales_7`, `expenses_by_category_mtd`, `total_outstanding`, generated `invoices.outstanding` column. Frontend hooks (`useSale`, `usePurchaseDetail`, `useTotalOutstanding`, `useDailySalesLast7`, `useExpenseBreakdownThisMonth`, SalesListPage) all read server-computed totals. Composition-time previews (POS cart, NewPurchase form) explicitly out of scope — server is authoritative on submission. `Receipt.tsx` subtotal flagged as known composition-path leak in CLAUDE.md. ADR: `decisions/2026-05-12-no-js-number-on-money-paths.md`.

### Stage 2 verification gate — 2026-05-12
- ✅ All 9 audits return 0 rows (v2.6 §6 audits 1-6 + new 7/8/9)
- ✅ Sale #62c622cd profit = 1,000.00 via `invoice_financials` (expected 1,000) ✓
- ✅ Sale #f9f13521 profit = 500.00 via `invoice_financials` (expected 500) ✓
- ✅ `npm run type-check` clean
- ✅ `npm run lint` clean
- ✅ Security advisors: only the documented warnings (ADR-0011 + HIBP open-todo); no new ones from migrations 0051–0056
- ✅ Dashboard MTD figure is no longer over-stated — `monthly_summary` now reads from `invoice_financials`

---

## v2.8 — Batch tracking, FEFO, supplier warranty & expiry alerts — 2026-05-12

### Phase A — Discovery gate
- ✅ v2.6 §6 audits 1-6 + v2.6c audits 7-9 all return 0 rows
- ✅ Live schema verified: 42 variants across 20 products, all sale_items/purchase_items variant-linked, `invoice_financials` view present, `products.has_batches` absent (clean slate)

### Phase B — Schema migration (`0057_v28_batch_tracking.sql`)
- ✅ `products.has_batches` (default false), `expiry_alert_days`, `warranty_alert_days` (per-product overrides)
- ✅ `shops.default_expiry_alert_days`, `default_warranty_alert_days` (defaults 30)
- ✅ `inventory_batches` table with RLS (scoped variant → product → shop), 6 indexes (FEFO, expiry, warranty, variant lookup, batch_no uniqueness when active), `touch_updated_at` + `batch_immutable_fields` triggers
- ✅ `sale_items.batch_id` (nullable; NOT NULL enforced by `record_sale` for batched products) + index
- ✅ `purchase_items.batch_id` (nullable, bidirectional with `inventory_batches.purchase_item_id`) + index

### Phase C — Backend RPCs + views (`0058*`)
- ✅ `suggest_batch_no(p_variant_id, p_received_at)` → `<SHOPSP>-<PROD>-<YYMMDD>-<NNN>` (column-name fix applied — `shops.shop_name`, not `name`)
- ✅ `record_purchase` rewrite — captures batch info when `product.has_batches`. Inserts `inventory_batches` with `cost_per_unit` = effective landed cost (v2.3 LR overhead allocation); wires `purchase_items.batch_id` back. Raises `batch_info_required_for_batched_product` / `batch_no_required` / `duplicate_batch_no` as appropriate.
- ✅ `record_sale` rewrite — FEFO walk (`expiry_date asc nulls last, received_at asc, id asc`); optional `batch_id` override per item; multi-batch line split (one cart line → multiple `sale_items` rows when spanning batches); `line_discount_amount` allocated via largest-remainder by qty; `cost_at_sale` = batch's `cost_per_unit` for batched lines; raises `selected_batch_insufficient` / `batch_not_in_variant_or_inactive` / `no_batch_stock_available`.
- ✅ `deactivate_batch(p_batch_id, p_reason)` — manual write-off; decrements `variant.stock` by `qty_remaining` (temporary pattern, see ADR), flips `is_active=false`, appends reason to notes.
- ✅ `batches_expiring_soon` + `batches_warranty_expiring_soon` views (security_invoker = true), driven by `coalesce(product.x_alert_days, shop.default_x_alert_days)`.
- ✅ `invoice_financials` from v2.6c unchanged — reads `sale_items.cost_at_sale` directly, so per-batch profit is automatically accurate.

### Phase D — Frontend surfaces
- ✅ **ProductEditDialog**: Inventory behavior section (has_batches toggle with shop-default hints; per-product `expiry_alert_days` + `warranty_alert_days` fields visible when toggled on; pre-submit guard rails — `cannot_enable_batches_with_stock` / `cannot_disable_batches_with_active_batches`)
- ✅ **`src/features/batches/`** — new feature folder. Hooks: `useActiveBatchesForVariant`, `useAllBatchesForVariant`, `useExpiringSoon`, `useWarrantyExpiringSoon`, `useHasAnyBatchedProduct`, `useDeactivateBatch`, `useShopAlertDefaults`, `useUpdateShopAlertDefaults`, `suggestBatchNo`.
- ✅ **BatchesSection + WriteOffBatchDialog** — product detail page renders an Active/Inactive table with per-row "Write off" affordance; inactive batches collapsed by default with "+ Show inactive" toggle.
- ✅ **NewPurchasePage** — batch fields per line (batch_no auto-pre-filled via `suggestBatchNo`, manufactured/expiry dates, supplier_warranty_days, "No expiry date" checkbox). Submit-time validation. `PurchaseLineInput` extended with `batch?` object.
- ✅ **DashboardPage** — `InventoryAlertsWidget` auto-hides for shops without batched products; surfaces top 4 of each list (expiring + warranty-expiring); badges + counts pull from `dashboard:inventory_alerts.*` keys.
- ✅ **SettingsPage** — shop-level alert defaults section (default_expiry_alert_days + default_warranty_alert_days editor with save button).
- ✅ **SaleDetailPage** — batch_no surfaced under the product name on each line; pulled via the existing `useSale` hook (joined `inventory_batches`).
- 🟦 Deferred to a v2.8 polish ticket: ProductFormPage create-flow batch toggle (works via edit dialog post-create); POS cart batch indicator + "Pick batch" picker (FEFO works automatically without it); multi-variant batched-product detail surface.

### Phase E — ADRs, i18n, CLAUDE.md, audits
- ✅ 7 ADRs filed in `decisions/`: batches-vs-serials-mutually-exclusive; fefo-override-ux-pick-batch-link; batch-cost-vs-avg-cost-on-sales; multi-batch-line-split-data-model; batch-deactivation-temporary-pattern; shop-level-alert-defaults-with-product-overrides; batch-immutability-rules.
- ✅ i18n: new `batches` namespace (en + ur), registered in `i18n.ts` + `locales/{en,ur}/index.ts`. Additions to `products`, `dashboard`, `pos` namespaces.
- ✅ CLAUDE.md: v2.8 PRD entry; 6 new gotchas; 3 open-todo entries.
- ✅ Final audit gate: v2.6 §6 audits 1-6 + v2.6c audits 7-9 + v2.8 §9 audits 1/4/5 — all return expected values (zeros + immutable trigger present).
- ✅ `npm run type-check` clean. `npm run lint` clean. `npm run build` clean.
- 🟦 Spec §10 manual smoke matrix (cosmetics, multi-batch FEFO, override, supplier warranty alerts, write-off, cross-shop) — code-level checks green; live-data walkthrough is a human task.

---

## v2.8.1 — Pricing/stock decoupled from product creation — 2026-05-12

Per `MVP_v2.8.1_PRICING_DECOUPLE.md`. Migration 0060 + frontend rework. The v2.8 "save first, then edit-toggle, then stock-in" three-step flow collapses into "save (with has_batches checked), then stock-in."

### Phase B — schema/RPC (migration 0060)
- ✅ DROP+CREATE `create_product_with_opening_stock`: `p_price` defaults null; new params `p_has_batches`, `p_expiry_alert_days`, `p_warranty_alert_days`.
- ✅ DROP+CREATE `create_product_with_variants`: same treatment.
- ✅ New raise `cannot_seed_opening_stock_for_batched_product` when has_batches=true AND opening_stock>0 (batched products must go through stock-in).
- ✅ Schema columns untouched — `product_variants.price` was already nullable; `stock`/`avg_cost` default to 0.

### Phase C — frontend
- ✅ Product create form: drops opening_stock + opening_cost inputs; selling price input becomes optional (blank → null); new Inventory-behavior section with has_batches toggle + alert window overrides + banner explaining stock-in flow.
- ✅ VariantMatrixBuilder: drops `defaultOpeningCost` prop, drops per-row Opening qty column, drops `opening_stock` from `MatrixVariantSpec` and `VariantMatrixState.overrides`.
- ✅ ProductFormPage EditForm + ProductEditDialog: keep working with the new optional-price schema (was already aligned in v2.8 polish).
- ✅ AddProductInlineDialog: stops passing opening_stock/opening_cost (no UI surface to set them).
- ✅ NewPurchasePage: new "This is opening stock" checkbox just above the Items section. Wires `is_opening` through `useRecordPurchase`.
- ✅ ProductDetailBody: null-price banner with "Set selling price" CTA when `product.price IS NULL && !has_variants`.
- ✅ i18n additions in `products` + `purchases` (en + ur) — `price_optional_help`, `price_placeholder`, `set_price`, `price_not_set_banner`, `inventory_behavior.stock_in_first_hint`, `form.is_opening_label`, `form.is_opening_help`.

### Phase D — verification
- ✅ ADR filed: `decisions/2026-05-12-pricing-decoupled-from-product-creation.md`.
- ✅ All audit invariants green (v2.6 + v2.6c + v2.8 sets all pass; +1 new check: zero sale_items rows where variant.price IS NULL).
- ✅ `npm run type-check` clean. `npm run lint` clean. `npm run build` clean.
- ✅ CLAUDE.md updated (v2.8.1 PRD entry + gotcha).

---

## v2.8.2 — Partial write-off + auto-deactivate when empty — 2026-05-12

Per `MVP_v2.8.2_PARTIAL_WRITEOFF.md`. Two gaps closed:
- Partial RTV / damage / loss has no clean path in v2.8 (whole-batch write-off only).
- Empty batches stay `is_active = true` until manual write-off — they clutter the active list.

### Migration 0061
- ✅ `record_partial_writeoff(batch_id, qty, reason)` — decrements `variant.stock` and `batch.qty_remaining` by exactly `qty`, appends a dated note. Validates ownership, active status, qty bounds.
- ✅ `batch_auto_deactivate_when_empty` BEFORE UPDATE trigger — fires on `> 0 → 0` transition, flips `is_active = false`. Composes cleanly with the existing immutability + touch triggers (alphabetical order on `inventory_batches`).
- ✅ `deactivate_batch` kept for back-compat (no callers in the new UI).

### Frontend
- ✅ `useRecordPartialWriteoff` hook added.
- ✅ WriteOffBatchDialog rewritten: new "Qty to write off" input defaults to `qty_remaining`; always calls `record_partial_writeoff` (auto-deactivate trigger handles the full case). Disabled submit when qty is invalid. Warning banner adapts when the qty equals `qty_remaining`.
- ✅ i18n: `batches:actions.write_off_qty_label`, `write_off_qty_help`, `write_off_full_note`, `batches:errors.qty_invalid` (en + ur).

### Verification
- ✅ ADR filed: `decisions/2026-05-12-partial-writeoff-and-auto-deactivate.md`.
- ✅ New invariant `qty_remaining=0 AND is_active=true → 0 rows` returns 0.
- ✅ All prior audits stay zero (v2.6 §6, v2.6c, v2.8 §9, v2.8.1).
- ✅ Both triggers present on `inventory_batches`: auto-deactivate (new) + immutability (existing).
- ✅ Type-check + lint + build green.

---

## v2.8.3 — Expired stock visibility + null-price surfacing — 2026-05-13

Per `MVP_v2.8.3_VISIBILITY_FIXES.md`. Two visibility surfaces, one migration, no schema change.

### Phase A — Discovery
- ✅ Live data: 0 expired-with-stock batches, 0 null-price active products. Both surfaces ship preventatively.

### Phase B — Backend (migration 0063)
- ✅ `batches_already_expired` view (security_invoker = true). Same column shape as `batches_expiring_soon` minus alert-window logic — past-expiry is past-expiry.
- ✅ `product_with_default_variant` widened with `has_null_price_variant` boolean (exists() over active variants with price = null).
- ✅ `search_products` + `search_products_count` DROP+CREATE with new `p_needs_pricing` param (default false, back-compat preserved). RETURNS TABLE gains `has_null_price_variant`.
- ✅ §1.6 audit query: zero rows confirming the view's filter is in sync with the live data shape.

### Phase C — Frontend
- ✅ `useAlreadyExpired` hook + `AlreadyExpiredBatchRow` type.
- ✅ `ExpiredStockWidget` mounted on DashboardPage below the existing alerts widget. Danger-tone styling (left border + error-text + WarningAmberIcon). Per-row click navigates to product detail. "View all" links to `/inventory/expired`. "Write off all..." opens `BulkWriteOffDialog`.
- ✅ `BulkWriteOffDialog` iterates `record_partial_writeoff(qty_remaining)` over each batch with a shared reason. Surfaces per-iteration failure count.
- ✅ `ExpiredStockListPage` at `/inventory/expired` with the full list, per-row + bulk write-off both available.
- ✅ Catalog list `ProductTable`: Price cell renders "Set price ⚠" for null-price single-variant rows and "Rs X – set price" for partial multi-variant pricing. Both with `aria-label` for accessibility.
- ✅ ProductsListPage: new "Needs pricing" Checkbox in the filter bar, URL-synced via `?needs_pricing=1`. Drops page param on toggle. Empty state when filter returns zero: "All products are priced."
- ✅ ProductTable plumbed with `needsPricing` + `emptyHelpKey` props.

### Phase D — Verification
- ✅ 3 ADRs filed: `2026-05-13-expired-stock-as-separate-dashboard-section`, `2026-05-13-bulk-write-off-loops-existing-rpc`, `2026-05-13-has-null-price-variant-aggregate-on-view`.
- ✅ i18n: `dashboard:expired_stock.*` keys (en + ur). `products:list.*` + `products:filters.*` keys (en + ur).
- ✅ All prior audits still zero (v2.6 §6, v2.6c, v2.8, v2.8.1, v2.8.2). New v2.8.3 audit (§1.6) returns 0.
- ✅ Type-check + lint + build green.
- 🟦 Spec §6 manual smoke matrix — code-level checks green; live-data walkthrough is a human task.

## v2.8.4 — Expired sale policy enforcement — 2026-05-13

Per `MVP_v2.8.4_EXPIRED_SALE_POLICY.md`. Closes the v2.8.3 visibility-vs-prevention gap. Two migrations (0064 schema, 0065 RPC rewrites), zero data rewrites.

### Phase A — Discovery
- ✅ CLAUDE.md, v2.8 spec, v2.8.1–v2.8.3 specs and ADRs surveyed.
- ✅ Current `record_sale` body inspected (migration 0058 §C); FEFO walk + manual-override branch noted.
- ✅ `sale_items_no_modify` trigger (migration 0020 §B) confirmed as a blanket reject — `sold_expired` is automatically immutable; no new trigger logic needed.
- ✅ Spec ambiguity in §3.3 pre-flight (would naively flag non-batched products as expired) resolved by gating on `products.has_batches = true` before any batch math.
- ✅ FEFO Pass 2 ordering ("least-expired first") interpreted as `ORDER BY expiry_date DESC` (largest past date = closest to today = least-expired).

### Phase B — Schema migration (0064)
- ✅ `expired_sale_policy` enum `('block', 'warn', 'allow')` guarded by `do $$ ... exception when duplicate_object`.
- ✅ `shops.default_expired_sale_policy` NOT NULL DEFAULT `'warn'`.
- ✅ `shops.expired_sale_receipt_disclaimer` NOT NULL DEFAULT `false`.
- ✅ `products.expired_sale_policy` nullable (null = use shop default via `coalesce(...)`).
- ✅ `sale_items.sold_expired` NOT NULL DEFAULT `false` + partial index `(sold_expired) WHERE sold_expired`.
- ✅ Generated TS types regenerated; advisors clean (only the documented `security_definer_view`, `auth_leaked_password_protection`, and `authenticated_security_definer_function_executable` warnings per ADR-0011).

### Phase C — Backend RPCs (0065)
- ✅ `record_sale` DROP + CREATE with appended `p_confirm_expired_sale boolean default false` parameter. Effective policy resolved per cart line via `coalesce(p.expired_sale_policy, shop.default_expired_sale_policy, 'warn')`.
- ✅ Manual-batch override path: computes `v_batch_expired`; `block` raises `expired_stock_blocked`; `warn` without confirmation raises `expired_stock_needs_confirmation`; `warn` with confirmation sets `sold_expired = true`; `allow` sets `sold_expired = v_batch_expired`.
- ✅ FEFO `allow` branch: single pass over the unfiltered candidate list; per-chunk `sold_expired = (batch.expiry_date IS NOT NULL AND batch.expiry_date < current_date)`.
- ✅ FEFO non-`allow` branch: Pass 1 over non-expired (`expiry_date IS NULL OR expiry_date >= current_date`, ASC by expiry) with `sold_expired = false`; on shortfall, `block` raises `insufficient_non_expired_stock`, `warn` without confirmation raises `expired_stock_needs_confirmation`, `warn` with confirmation runs Pass 2 over expired batches `ORDER BY expiry_date DESC` with `sold_expired = true`.
- ✅ `sale_items` inserts include `sold_expired` from a parallel `v_sold_expired_arr boolean[]` array.
- ✅ New `preflight_expired_sale_check(p_items jsonb)` returns `(variant_id, would_draw_expired, expired_batch_ids, policy)` — gated on `products.has_batches = true`; non-batched items return `would_draw_expired = false`. FEFO path sums non-expired stock vs requested qty; manual-override path checks the specific batch's expiry.
- ✅ Grants: `revoke from public, anon; grant to authenticated` on both new function signatures.

### Phase D — Frontend
- ✅ Settings page (`SettingsPage.tsx`): new "Expired stock sales" subsection with `RadioGroup` for default policy + Checkbox for receipt disclaimer. New hooks `useShopExpiredSaleSettings` + `useUpdateShopExpiredSaleSettings`.
- ✅ Product edit dialog (`ProductEditDialog.tsx`): per-product policy radio inside the "Inventory behavior" section, visible only when `has_batches = true`. "Use shop default (currently: X)" + Block / Warn / Allow with help text. Wired through extended `UpdateProductInput.expired_sale_policy`.
- ✅ Zod schemas (`schemas.ts`): `expired_sale_policy` optional enum + null on both create and edit schemas.
- ✅ POS submit flow (`POSPage.tsx`): preflight RPC called before `record_sale`; rows with `would_draw_expired = true` route to `BlockedExpiredSaleDialog` (any `policy='block'`) or `ConfirmExpiredSaleDialog` (any `policy='warn'`). Block-first ordering. Block "Open product" navigates to product detail; warn "Yes, complete sale" forwards `confirm_expired_sale = true` to `record_sale`.
- ✅ Error mapping: `expired_stock_blocked` and `insufficient_non_expired_stock` surface the block-style banner; `expired_stock_needs_confirmation` re-opens the warn dialog (race protection).
- ✅ Receipt (`Receipt.tsx`): new `showExpiredDisclaimer` prop. POSPage computes it from `shop.expired_sale_receipt_disclaimer` AND a post-`record_sale` count query on `sale_items.sold_expired = true`.
- ✅ Sale detail (`SaleDetailPage.tsx`): "Expired stock" `Badge` (error variant) inline with the product name when `sold_expired = true`. `useSale` hook widened to select `sold_expired` from `sale_items`.
- ✅ `ExpiredSalesWidget` mounted on DashboardPage below `ExpiredStockWidget`. Hides when count = 0. Per-row click navigates to sale detail. "View all" links to the audit route when count > 5.
- ✅ `ExpiredSalesListPage` at `/inventory/expired-sales` (`paths.expiredSales` + router wiring). Full DataTable with date, sale, product, qty, days-expired-at-sale columns.
- ✅ Cart EXPIRED indicator (spec §4.4) — applies only to manually-picked batches, which POS doesn't ship yet (per `docs/todos.md` v2.8 polish line). No-op for v2.8.4.
- ✅ i18n keys (en + ur): `products:inventory_behavior.expired_sale_policy.*`, `batches:expired_sales.*`, `pos:expired_sale.*` + `pos:cart.batch_expired_label`, `sales:detail.sold_expired_badge` + `sales:detail.receipt_disclaimer_default`, `dashboard:expired_sales_widget.*`.

### Phase E — Verification
- ✅ 5 ADRs filed: `2026-05-13-expired-sale-policy-three-modes`, `2026-05-13-warn-as-default-policy`, `2026-05-13-preflight-rpc-for-expired-stock-check`, `2026-05-13-sold-expired-flag-snapshotted-not-derived`, `2026-05-13-receipt-disclaimer-opt-in`.
- ✅ Type-check + lint + build green.
- ✅ No new audit query needed — `sold_expired` is snapshot truth with no derivable invariant; all prior audits remain zero.
- ✅ CLAUDE.md, `docs/build-trail.md`, `docs/gotchas.md` (6 new gotchas), `docs/todos.md` (2 deferred items + verification debt entry) updated.
- 🟦 Spec §6 manual smoke matrix (cases 6.1–6.19) — code-level checks green; live-data walkthrough is a human task.

## v2.8.5 — POS Pick batch picker — 2026-05-13

Unblocked by v2.8.4. Ships the manual-override UI deferred from v2.8 §4.4 so spec §6.9 / §6.10 can be exercised from the POS instead of the SQL editor.

### Phase A — Backend (migration 0067)
- ✅ `product_with_default_variant` view gains `has_batches` (appended — Postgres views can't insert columns mid-list under CREATE OR REPLACE).
- ✅ `search_products` RETURNS TABLE gains `has_batches boolean` + `default_variant_id uuid` via DROP + CREATE for the signature change.
- ✅ Re-grant (`revoke from public, anon; grant to authenticated`).
- ✅ TS types regenerated.

### Phase B — Frontend
- ✅ `ProductSearchRow` widened with `has_batches` + `default_variant_id`.
- ✅ `CartItem` gains `has_batches`, `resolved_variant_id`, `batch_id`, `batch_no`, `batch_expiry_date`. `AddItem` type updated.
- ✅ New cart reducer actions `set_batch` + `clear_batch`. `add` initializer sets batch fields to null.
- ✅ `buildItemsPayload()` + preflight items mapping conditionally include `batch_id` when set.
- ✅ `handleAddProduct`, `handleAddVariant`, `handleAddProductById` all populate `has_batches` + `resolved_variant_id` on the cart line. Fallback path queries `product_with_default_variant` view instead of `products` so the new fields come through.
- ✅ New `PosBatchPicker.tsx` — Dialog wrapper; lists `useActiveBatchesForVariant` rows; EXPIRED red badge on past-expiry; brand badge on the selected row; insufficient-qty rows dimmed + click-disabled; "Reset to FEFO" footer action.
- ✅ CartPanel local state `batchPickerForKey` tracks which line's picker is open; single `<PosBatchPicker>` mounted at the bottom of the cart list. Per-line "Pick batch" / "Reset to FEFO" link row renders only when `has_batches = true`. Picked batch_no + expiry badge inline on the cart line.

### Phase C — Verification
- ✅ Type-check + lint + build green.
- ✅ ADR `2026-05-13-pos-batch-picker-ships-as-v285-polish` filed.
- ✅ CLAUDE.md / build-trail / gotchas / todos updated.
- 🟦 Manual smoke: rerun v2.8.4 §6.9 (warn override expired → confirm) and §6.10 (block override expired → reject) via the POS UI; verify cart-line EXPIRED badge, picker dialog, Reset to auto-pick. Live-data walkthrough is a human task.

### Phase D — UX polish (post-shipping feedback)
- ✅ Picker highlights the auto-pick row when no manual override is active — brand-bordered row + "Will be used" `Badge` + an info `Banner` at the top of the picker explaining "Auto-pick uses the batch closest to its expiry date so older stock leaves first."
- ✅ Dropped all user-facing "FEFO" / "oldest" wording. Now "auto-pick" (en) / "خودکار انتخاب" (ur). New i18n keys: `pos:cart.batch_next_up`, `pos:cart.batch_auto_hint`, `batches:indicators.next_up`, `batches:indicators.auto_hint`. Reset action now reads "Reset to auto-pick" / "Use auto-pick" depending on context.
- ✅ Insufficient-stock card layout fix in `PosBatchPicker`: switched the two-column row layout to a vertical stack (batch_no + badges row, then meta row, then full-width hint). Hint text rewritten in plain language with `{available}` / `{needed}` interpolation and a soft red-tinted background; new key `batches:errors.selected_batch_insufficient_long`.
- ✅ Cache-invalidation fix: `useRecordSale` + `useRecordPurchase` now invalidate `['product']` (singular), `['batches']`, and `['alerts']` on success — without these the POS batch picker, product-detail page, and dashboard alert widgets all showed stale qty_remaining until a hard reload. Gotcha added to `docs/gotchas.md` so future RPC hooks that mutate stock or batches follow the same pattern.
- ✅ Gotchas updated: future contributors won't reintroduce "FEFO" in visible strings, and the auto-pick highlight is documented as purely visual (no auto-dispatch on render).
