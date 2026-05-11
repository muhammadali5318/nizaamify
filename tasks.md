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
- 🟨 Create product_categories table + RLS + indexes
- 🟨 Add products.category_id column
- 🟨 Backfill distinct types as categories per shop
- 🟨 Link products to categories
- 🟨 Verify zero NULL category_id rows
- 🟨 Set products.category_id NOT NULL
- 🟨 Drop old unique index (type), create new (category_id)
- 🟨 Regenerate database.ts

### Phase C — Backend RPCs
- 🟨 search_categories
- 🟨 create_category_inline
- 🟨 update_category
- 🟨 search_products(p_category_id)
- 🟨 search_products_count(p_category_id)
- 🟨 create_product_with_opening_stock(p_category_id)

### Phase D — Frontend
- 🟨 ProductDetailPage at /products/:id (header, fields, packs, recent activity)
- 🟨 Edit modal on detail page (reuses form)
- 🟨 Eye icon on /products list rows + row click → detail
- 🟨 Drop Actions column from /products (per spec discovery default)
- 🟨 Category filter dropdown on /products (URL-driven)
- 🟨 Category combobox in product form (replaces Type) + "+ Create new category"
- 🟨 POS drawer detail (right-side, mobile bottom-sheet)
- 🟨 Eye icon on POS rows + row click → drawer
- 🟨 "Add to cart" header + center-align `+` button in POS
- 🟨 i18n keys EN + UR

### Phase E — Verification
- 🟨 Manual smoke test §12
- 🟨 npm run lint + type-check + build green
- 🟨 Update CLAUDE.md (v2.5 line, gotchas, todos)
- 🟨 Record decisions in decisions/
