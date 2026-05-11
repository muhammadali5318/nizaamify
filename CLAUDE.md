# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # production build (no sourcemaps, esbuild minify)
npm run preview      # serve dist/ for local QA
npm run type-check   # tsc --noEmit
npm run lint         # eslint src/**/*.{js,ts,jsx,tsx}
npm run lint:fix
npm test             # vitest run (single pass)
npm run test:ui      # vitest UI
npm run coverage
```

Run a single test: `npx vitest run src/features/auth/schemas.test.ts` (or pass a name pattern with `-t "..."`).

Node engine is pinned to `>=20 <=22`. Test runner is jsdom-based; `src/setupTests.ts` only loads `@testing-library/jest-dom`.

## Architecture

### Provider tree (`src/App.tsx`)

Order is load-bearing — each layer depends on what's outside it:

```
ErrorBoundary
└── I18nextProvider
    └── QueryClientProvider
        └── BrowserRouter
            └── AuthProvider                      ← session + profile + subscription state
                └── ThemeModeProvider             ← system | light | dark, persisted to localStorage
                    └── CacheProvider (Emotion)   ← rebuilt on language change (LTR vs RTL plugin)
                        └── ThemeProvider (MUI)   ← theme is a factory: getTheme(direction, mode)
                            └── NotificationProvider
                                └── Router        ← useRoutes from src/router/index.tsx
```

The Emotion cache and MUI theme are **per-direction** (`ltr` / `rtl`) and rebuilt only when language changes — see ADR-0003 (`decisions/0003-mui-rtl-pipeline.md`). Don't recreate caches per render. `ThemeModeProvider` (v2.4) writes `data-theme="dark"` on `<html>`+`<body>` and feeds the resolved mode into `getTheme(direction, mode)` so dark mode flips both the CSS-variable layer and MUI's `palette.mode` in lockstep.

### Guard chain (`src/lib/guards.tsx`)

Every authenticated route composes guards explicitly in `src/router/index.tsx`:

`RequireAuth` → `RequireOnboarded` → `RequireActiveSubscription`

- `RequireAuth` redirects to `/login` if no session
- `RequireOnboarded` redirects to `/onboarding` if `profiles.onboarding_completed = false`
- `RequireActiveSubscription` redirects to `/subscription/expired` if status is `expired` or `suspended`
- `/settings` and `/settings/support` are deliberately **not** wrapped in `RequireActiveSubscription` so users can reach support after expiry
- Inverse guards (`RedirectIfAuthed`, `RedirectIfOnboarded`, `RedirectIfActiveSubscription`) handle the "already past this stage" cases

### Feature folder convention

`src/features/<domain>/` contains pages (`*Page.tsx`), local components, `hooks.ts` (TanStack Query hooks), `schemas.ts` (Zod), `schemas.test.ts`. Domains: `auth`, `onboarding`, `subscription`, `dashboard`, `pos`, `products`, `customers`, `khata`, `purchases`, `sales`, `expenses`, `targets`, `reports`, `settings`.

Path alias: import from `src/...` (configured in both `vite.config.ts` and `tsconfig.app.json`). `@/` is also wired in tsconfig but the codebase uses `src/`.

### Routing (`src/paths.ts`)

All routes live in the `paths` object — never hardcode strings. It exports both static paths (`paths.products`) and `goto*` helpers (`paths.gotoProduct(id)`) for parametric routes.

### i18n (`src/lib/i18n.ts`, `src/locales/{en,ur}/`)

Every user-facing string goes through `t()`. There are **14 namespaces** matching domains (`common`, `auth`, `onboarding`, `subscription`, `pos`, `products`, `customers`, `khata`, `purchases`, `sales`, `expenses`, `targets`, `reports`, `settings`). Adding a new key requires editing both `en/<ns>.json` and `ur/<ns>.json`. Language detection uses `localStorage` first, then browser. `getDirection(lng)` returns `'rtl'` for Urdu — this drives both the MUI theme and the Emotion cache.

When mutating language, **do not** add `marginLeft`/`marginRight` literals — use MUI's `start`/`end` semantics or rely on automatic mirroring (see ADR-0003).

### Supabase data layer

- Client: `src/lib/supabase.ts` (typed via generated `src/types/database.ts`)
- TanStack Query defaults: `staleTime: 5min`, `refetchOnWindowFocus: true`, `mutations.retry: 0` (`src/lib/queryClient.ts`)
- All migrations live in `supabase/migrations/NNNN_*.sql` and are applied **in order** via the Supabase MCP

Project ID for MCP calls: `orfggrnyychmmqdlbfhf`.

**After every migration:**
1. `mcp__supabase__apply_migration(project_id="orfggrnyychmmqdlbfhf", name="<NN_name>", query="...")`
2. `mcp__supabase__generate_typescript_types(project_id="orfggrnyychmmqdlbfhf")` → write result to `src/types/database.ts`
3. `mcp__supabase__get_advisors(project_id="orfggrnyychmmqdlbfhf", type="security")` — only the documented warnings (ADR-0011) should appear; anything new merits investigation

### Atomic write RPCs (do not bypass)

Stock-mutating writes go through SQL functions, never direct table inserts:

- `record_sale(...)` — inserts `invoices` + `sale_items`, decrements `products.stock`, optionally writes a `ledger_entries` row for credit sales. Fails if stock would go negative.
- `record_purchase(...)` — inserts `purchases` + `purchase_items`, increments stock, snapshots cost.
- `complete_onboarding(...)` — atomically writes `shops` + `shop_owner_details` + flips `profiles.onboarding_completed`.

These are intentionally `SECURITY DEFINER` (ADR-0007, ADR-0011). The client never `INSERT`s into `shops`, `invoices`, `purchases`, `sale_items`, `purchase_items`, or `products.stock` directly.

### Subscription enforcement is client-only (MVP)

Per ADR-0006, the React `<RequireActiveSubscription>` guard is the only enforcement point. RLS does **not** check subscription status. A determined user could bypass via devtools — accepted MVP trade-off, mitigated by 5-minute query staleness. **Do not** add an RLS subscription check without revisiting the ADR.

### Manual subscription activation

There is no payment gateway. Admins flip `subscriptions.status` via SQL — exact snippets in `decisions/0010-admin-runbook.md`. Run via `mcp__supabase__execute_sql`.

## Design system (v2.4) — read this before touching UI

The current visual language is **amber on near-black, with a sideways ambient glow**, defined entirely through tokens in `src/styles/tokens.css`. Use the patterns below; don't reach past them. Three rules cover most decisions:

> **(1)** Never write a raw hex / rgba in a component. Use a token.
> **(2)** Never use a raw color scale (`--brand-700`, `--warning-700`, `--neutral-200`) for *foreground* (text/icon/border). Use the semantic token (`--text-brand`, `--status-warning-text`, `--surface-muted`) so it flips per theme.
> **(3)** Backgrounds in full-screen page wrappers should be `transparent` (or omitted) so the body's amber glow reads through. Painting `surface-subtle` over the whole page kills the glow.

### Theme mode

- `useThemeMode()` from `src/lib/themeMode.tsx` exposes `{ mode, resolved, setMode, toggle }` where `mode ∈ { 'system', 'light', 'dark' }` and `resolved ∈ { 'light', 'dark' }`. Persisted under `nizaamify.theme.mode`.
- The DOM gets `data-theme` written on both `<html>` and `<body>`. CSS hooks via `[data-theme="dark"] { ... }` in `tokens.css`.
- MUI's `palette.mode` is fed from `resolved` so internal `alpha()` / hover / disabled calculations stay correct. Don't bypass — `getTheme(direction, mode)` in `src/theme/muiTheme.ts` is the only entry point.

### Color tokens — the canonical map

Raw scales live in `tokens.css` and stay constant across themes. Semantic tokens flip via the `[data-theme="dark"]` block. **Always reach for the semantic.**

| You want… | Use this token | Why |
|-----------|---------------|-----|
| Page bg | nothing — let body paint `--surface-subtle` | Body bg + body-glow are the canvas; pages should not redraw their own bg |
| Card bg | `--surface-card` | Slightly warm (amber undertone). Reads as "warm volume on cool page" |
| Subtle fill / disabled chip | `--surface-muted` | Mode-aware grey; mid-tone neutral |
| Page-level subtle bg block | `--surface-subtle` | Same as body bg — useful for full-bleed banners |
| Inverse surface (tooltip / inverse banner) | `--surface-inverse` | Auto-flips: dark on light, light on dark |
| Primary CTA bg | `--action-primary` (or MUI `<Button color='primary'>`) | brand-500 amber in both modes |
| Primary CTA text | `--action-primary-text` | Always dark `#1A1308` on amber |
| Brand-toned text/icon | `--text-brand` | brand-600 light / brand-400 dark — never use `--brand-700` directly |
| Status warning/error/success text | `--status-{warning,error,success}-text` | Brighter versions in dark — never use `--warning-700` etc. directly |
| Status fills (badges) | `--status-*-bg` | Translucent in dark, solid tinted in light |
| Border (default) | `--border-default` | Mode-aware |
| Border (hairline / dividers) | `--border-subtle` | Lower-contrast |
| Focus ring | `--focus-ring` | brand-500 45% — drop into `boxShadow` |

### Surface depth (when to shadow)

Pick a Card variant on intent, not just looks:

- `<Card variant="default">` — **no shadow**. Use for dashboards, list pages, form cards. The warm `--surface-card` tint provides depth on its own.
- `<Card variant="muted">` — `--surface-muted` bg, no shadow. Use for passive containers (e.g. summary footers).
- `<Card variant="elevated">` — `--shadow-card` (amber-bloom). Reserved for surfaces that genuinely need to lift — POS cart panel, important dialogs.

### Body glow (don't break it)

`tokens.css` defines `--body-glow` (a radial gradient at the trailing edge); `global.scss` paints it via `body::before` at z-index 0. `#root` is z-index 1 and *transparent* — your page content rides above it. **Any full-screen layout you add must keep its background `transparent`** (`AuthLayout`, `OnboardingPage`, `SubscriptionExpiredPage`, the `<main>` Box in `AppShell` are all set up this way). If you paint `surface-subtle` (or any solid color) on a full-bleed Box, the glow disappears under it.

### Dropdown family (MUI overrides centralised)

Every popover-like surface — `<Select>` Menu, `<Autocomplete>` Listbox, `<Menu>`, the TopBar profile-menu Popper — shares one container vocabulary defined in `getTheme()`'s `MuiMenu` / `MuiAutocomplete` / `MuiPopover` overrides. New dropdowns should pick this up automatically. **Don't override `paper`, `option`, or `listbox` styling at the call site** unless you have a real reason (and document it). The shared treatment:

- Container: `--surface-card` bg, `--shadow-card` bloom, `--radius-lg` corners, 6 px inner padding.
- Items: rounded pill (radius-md), 8 px vertical padding, hover = `--surface-muted`, selected = `--status-brand-bg` + `--text-brand`.
- Custom thin scrollbar on Autocomplete listbox.
- Open animation: 160 ms.

If you build a **new** dropdown using `<Popper>` directly (the way TopBar does), set the inner `<Paper>`'s `sx` to mirror the shared container: `borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-default)'`.

### Typography is locked

The user gave a hard rule: **don't change typography**. Keep Inter (English) + Noto Naskh Arabic (Urdu body) + Noto Nastaliq Urdu (Urdu display). The current size scale (`displayLg` / `display` / `h1`–`h6` / `body1`/`body2` / `caption`/`overline`) is the only one in use; new screens inherit. If you find yourself reaching for a custom `fontSize`, you're outside the system — use the right MUI variant.

### LTR/RTL

- Use logical CSS properties: `paddingInlineStart`, `marginInlineEnd`, `borderInlineStart`, `textAlign: 'start' | 'end'`. The amber gradient is positioned at `100% 0%` (physical top-right of viewport in both directions) — that's intentional for the lit-from-corner aesthetic; if you build a layout that needs to mirror, use a different gradient, don't fight the body glow.
- The Emotion `CacheProvider` rebuilds with `getEmotionCache(direction)` only on language change — RTL plugins are scoped per cache. Don't manually transform paddings; trust logical properties + the cache.

### Quick checklist when building a new screen

- [ ] Page wrapper background = `transparent` (or omit) — let the body glow read through.
- [ ] Surface containers = `<Card>` (default for content, elevated for floats).
- [ ] Brand-colored foreground = `--text-brand` (never `--brand-*`).
- [ ] Status-colored foreground = `--status-*-text` (never `--*-700`).
- [ ] Form fields use `<Field>` + `<Input>`/`<Textarea>` from `src/components/ui` so radii and focus rings stay consistent.
- [ ] Action buttons use `<Button variant=...>` from `src/components/ui` — never raw `<MuiButton>`.
- [ ] Dropdowns / selects don't override paper styling — let the theme handle it.
- [ ] Test in both `light` and `dark` × both `en LTR` and `ur RTL` before declaring done.

## Decision log

`decisions/` holds ADRs for every reversal of a PRD assumption or cross-cutting choice. Read `decisions/README.md` first when a question feels architectural — the answer is often already there. Notable bindings:

- **0001** — MUI v7 + SCSS instead of PRD's Tailwind; react-router v7 instead of v6; no Zustand
- **0005** — RLS is enabled in the same migration that creates the table (never split)
- **0006** — subscription gating is client-only (see above)
- **0007** — `record_sale` / `record_purchase` are SQL functions, not client transactions
- **0011** — three RPCs are deliberately `SECURITY DEFINER` callable by `authenticated`; advisor warnings are accepted
- **0015** — v1.8 database hardening: views must use `security_invoker = true`, append-only triggers extended to all financial tables, RPC grants follow `revoke from public + anon; grant to authenticated`
- **0016** — v1.9 stock-in: suppliers as a first-class entity, landed-cost pro-rata-by-value allocation, snapshot `avg_cost_before/after` on `purchase_items`
- **0017** — v2.3 partial reversal of v2.2: tiers are pure categories (no auto-discount); invoice `tier_*` columns renamed `sale_discount_*`; overhead allocation moved to `purchase_items.line_overhead_amount` via largest-remainder. Manual sale-time discount popup is the only invoice-level discount source.
- **0018** — v2.4 design-system revamp: brand scale flips from teal/navy to amber; dark mode added via `[data-theme="dark"]` token override block (semantic tokens flip, raw scales stay constant). `ThemeModeProvider` (`src/lib/themeMode.tsx`) sits above MUI's `ThemeProvider`; mode is `system | light | dark`, persisted as `nizaamify.theme.mode`. Default is `system`; user toggle in TopBar.
- **0019** — v2.5 `products.type` promoted to `product_categories` entity per shop. `products.category_id` is a NOT NULL FK; old unique index on `(shop_id, name, type)` replaced by `(shop_id, name, category_id)`. `products.type` column kept and snapshotted from the category name for legacy read paths; future cleanup migration drops it.
- **0020** — v2.5 product detail surface: full route at `/products/:id` (admin context, deep-linkable) vs. right-side drawer / bottom sheet in POS (cart state must survive). Edit is a modal on both surfaces.
- **0021** — v2.5 eye icon (leading column) is the explicit "open detail" affordance on both product surfaces; the `/products` trailing "Actions" column is dropped entirely (archive moved to the edit modal's `is_active` toggle). POS keeps the trailing column for the centered [+] and pack quick-add chips, headered "Add to cart".
- **0022** — v2.6 template/variant architecture. Every product is a template; every product has at least one variant. Stock / price / cost / avg_cost / last_purchase_cost live on `product_variants`, not `products`. The `product_with_default_variant` compat view bridges v2.5-era reads to the new schema.
- **0023** — v2.6 synthetic default variant pattern. Every existing product gets exactly one variant with `is_default = true`. Partial unique index `uq_variant_default_per_product (product_id) WHERE is_default AND is_active` enforces the invariant. v2.7 will adjust this when `products.has_variants = true`.
- **0024** — v2.6 deprecate-without-drop. The legacy `products.{stock, price, cost, avg_cost, last_purchase_cost}` and `*.product_id` columns on `sale_items` / `purchase_items` / `product_packs` stay through v2.6; `*.product_id` is auto-synced from `variant_id` by the `sync_product_id_from_variant` trigger. A v2.8+ cleanup migration drops them.
- **0025** — v2.6 RPC contract during the variant rollout. `record_sale` and `record_purchase` accept `variant_id` (preferred) or `product_id` (legacy → default variant). Same shape for `create_product_with_opening_stock` via its variant_id-returning result row. POS / stock-in keep passing `product_id` for v2.6 and switch to `variant_id` in v2.7.
- **0026** — v2.7 variant attributes live shop-wide (single Color / Size / Storage pool, reused across products) rather than per-product. Per-product attributes would have made cross-product reporting a string-normalization problem.
- **0027** — v2.7 limits products to at most 3 variant attributes. Enforced both in the matrix UI (`+ Add another attribute` hides at 3) and in `create_product_with_variants` (`too_many_attributes` exception).
- **0028** — v2.7 stock-in ships the spec's expanding-line fallback (one variant per stock-in line) rather than the full 2D matrix mode. Same data outcome on the server; the matrix grid UX is a follow-up.
- **0029** — v2.7 POS rows branch on `has_variants`: single-variant keeps the v2.3 [+] direct-add; multi-variant shows "Pick variant" → opens a dialog listing variants with stock + price + click-to-add. Two variants of one product are distinct cart lines (keyed by `variant_id ?? product_id`).

When making a decision that reverses the PRD or affects multiple layers, write a new ADR (numeric prefix, four sections: Context / Decision / Alternatives / Consequences).

## Versioned PRDs (build trail)

- **v1.2** — baseline: auth, onboarding, subscription, i18n
- **v1.3** — WAC, sales module, khata view enhancements
- **v1.4** — partial payments, customer expansion, walk-ins
- **v1.5** — product type uniqueness, opening stock, fuzzy search, POS redesign
- **v1.6** — ledger hardening: stored balance, reversals, occurred_at, append-only
- **v1.7** — design system revamp (mint→navy palette, Urdu font fix, DataTable primitive)
- **v1.8** — db hardening: RLS audit, search_path, FK indexes, locks, money precision, view security_invoker, append-only across financial tables
- **v1.9** — stock-in hardening: suppliers, landed-cost pro-rata allocation, bidirectional cost calc, searchable product/supplier comboboxes, MTD-default list with pagination, Effect-on-Inventory snapshot fix
- **v2.0** — *superseded by v2.1*. UoM + first-class pack pricing was spec'd and partially built (migrations 0026/0027), then walked back. `MVP_v2.0_UNITS_OF_MEASURE.md` is historical reference only; do not implement against it.
- **v2.1** — stock-in unit handling: `units_of_measure`, `product_packs` (no price column — packs are stock-in shortcuts only), `products.is_scan_only`, `purchase_items.{pack_id, pack_qty, pack_base_qty_snapshot, qty_in_base}`. Sales stay in base units; `record_sale` byte-equivalent to v1.6. Stock display view exposes `whole_packs` + `remainder_base` directly so the frontend never recomputes breakdowns. `record_purchase` accepts pack-shaped lines; `define_pack_inline` auto-creates UoMs at stock-in time. POS quick-add buttons; scan-only enforcement.
- **v2.2** — customer tiers + per-line discounts + manual override. `customer_tiers` (named %-only groups, default per shop), `customers.tier_id`, invoice snapshot of tier id/percent/amount/override-type/override-value, `sale_items.line_discount_*`. `record_sale` rewrites: stacking order is **negotiated price → per-line discount → tier (or override) → service charge added last**. Discounts apply to items only, never service. *Partially reverted in v2.3 — see below.*
- **v2.3** — fixes from v2.1/v2.2 testing. (a) Tiers reduced to pure customer categories: `customer_tiers.discount_percent` dropped; tiers no longer auto-discount sales. The popup is now the only source of an invoice-level discount. (b) Invoice columns renamed `tier_*` → `sale_discount_*` (4 columns + recreated `invoices_sale_discount_consistent` constraint). (c) Overhead allocation rewritten: stored as new `purchase_items.line_overhead_amount` via **largest-remainder** method in `record_purchase` (overhead distributed pro-rata by line value, leftover penny goes to the highest-value line). The legacy `overhead_per_unit` column is kept for back-compat — drop in a future cleanup. (d) `search_products` is name-only (combined name+type GIN index dropped; relevance preserved + `p_only_in_stock` filter). (e) Frontend: PurchaseDetail row indices precomputed (DataTable's `cell` doesn't pass index — was rendering NaN); columns restructured to # / Product / Qty / Unit cost / Subtotal / Overhead / Total with explanatory note; "Cost change" replaces "Δ"; per-piece cost shown under unit cost when pack base_qty > 1; supplier dropdown widened. (f) POS: tier auto-discount logic removed; customer card with tier chip pinned at the top of the cart; cart column headers added; "Override" → "Apply discount"; submit payload `tier_override_*` → `sale_discount_*`; sale discount cleared on customer change and on submit success.
- **v2.4** — UI revamp + dark mode (no business-logic changes). See the dedicated **Design system (v2.4)** section above for the canonical rules; summary here for the build trail. Brand scale flips teal/navy → amber. Dark mode via a `[data-theme="dark"]` block in `tokens.css` — only semantic tokens flip, raw scales stay constant. `ThemeModeProvider` (`src/lib/themeMode.tsx`) handles `system | light | dark` and writes `data-theme` on `<html>`+`<body>`; `getTheme(direction, mode)` flows the resolved mode into MUI's `palette.mode`. Sun/moon toggle in TopBar. New token family for ambient warmth: `--surface-card` (warm undertone for cards), `--shadow-card` / `--shadow-card-hover` (amber-bloom), `--body-glow` (radial gradient painted via `body::before`). Light-mode primary shifted from brand-700 brown to brand-500 bright amber with dark contrast text. `<Card>` default = no shadow (elevated keeps the bloom). Dropdown overrides centralised in `MuiMenu` / `MuiAutocomplete` / `MuiPopover` so every popup shares one container language. Sidebar active state simplified to an amber pill. Typography unchanged.
- **v2.7** — variant management UI on top of v2.6. (a) Shop-wide `variant_attributes` + `variant_attribute_values` + `product_variant_attribute_values` tables; new Settings → Variant Attributes page manages them. (b) Product create form gets a "Has variants?" toggle; on, replaces the single price + opening stock fields with a matrix builder. Up to 3 attributes per product (enforced at RPC + UI), cross-product generates combinations as a flat review table with auto-suggested editable SKUs and per-row price overrides. (c) Multi-variant product detail page renders a variants table with per-row inline edit and "+ Add variant" that calls `add_variant_to_product`. (d) Stock-in implements the spec's expanding-line fallback (§7.6) — one variant per stock-in line, not a 2D matrix grid; v2.3 largest-remainder overhead allocation works unchanged. (e) POS multi-variant rows show "X variants" + price range instead of stock/price; "Pick variant" button opens a dialog with click-to-add; cart line + receipt render `"Tracksuit AAA — Red / M"` labels via `product_variant_full.variant_label`. (f) Three new RPCs (`create_product_with_variants`, `add_variant_to_product`, 8 attribute/value CRUD), one new view (`product_variant_full`), `product_with_default_variant` widened with multi-variant aggregates (variant_count, min_price, max_price). Migrations 0045–0048.
- **v2.6** — foundational variant refactor (SILENT — zero user-visible changes). `products` becomes a template; stock/price/cost moved to a new `product_variants` table; every existing product gets a synthetic default variant carrying the old values. `sale_items` / `purchase_items` / `product_packs` repointed to `variant_id` (with the legacy `product_id` kept in sync via the `sync_product_id_from_variant` trigger). All stock-touching RPCs (`record_sale`, `record_purchase`, `create_product_with_opening_stock`, `search_products`, `define_pack_inline`, `update_pack`, `deactivate_pack`) rewritten to operate on `product_variants`. `search_products` reads through the `product_with_default_variant` compat view so v2.5-era hooks see the same row shape. Six audit queries (§6 of the spec) return zero rows post-migration. Sets up the v2.7 variant-management UI without leaving any "is this a variant product?" branches in legacy code. Migrations 0037–0044.
- **v2.5** — product detail page + `product_categories` entity. (a) `/products/:id` now renders a `ProductDetailPage` (header, fields, packs, last-10 activity feed); editing happens in a `ProductEditDialog` modal. (b) POS gets a right-side drawer (bottom sheet on mobile) showing the same `ProductDetailBody` plus a sticky "+ Add to cart" footer button — cart state is preserved across drawer open/edit/close. (c) `products.type` (free text) is promoted to a `product_categories` table per shop; `products.category_id` is a NOT NULL FK; unique index swapped from `(shop_id, name, type)` to `(shop_id, name, category_id)`. (d) Product form's Type input is replaced by a `CategoryCombobox` with inline "+ Create new category" dialog. (e) `/products` list gains a URL-synced single-select `?category_id=` filter; the trailing edit/archive icons column is dropped (archive moved into the edit modal's Active toggle); a leading eye-icon column is the explicit "View details" affordance. (f) POS picker gains the same eye icon + "Add to cart" column header + center-aligned [+] button. (g) Three new SECURITY DEFINER RPCs (`search_categories`, `create_category_inline`, `update_category`); `search_products` / `_count` gain `p_category_id`; `create_product_with_opening_stock` prefers `p_category_id` but falls back to `p_type` so stale clients don't break. (h) `products.type` is kept and snapshotted from the category name — drop in a future cleanup migration.

## Open ToDos / Known gaps

- Supabase free tier: no PITR backups; move to Pro before any real customer goes live (hard requirement before launch)
- Toggle leaked-password-protection + email-confirmation in Supabase auth dashboard (Pro tier required for HIBP)
- `void_sale` RPC for full sale reversal (reverse debit + restock + voided flag) — deferred from v1.8
- `purchase_overhead_items` append-only enforcement is in v1.9; per-supplier comparison reports UI is a future ticket
- Drop legacy `products.cost` column (deferred from v1.5; `avg_cost` and `last_purchase_cost` are the source of truth)
- Drop legacy `ledger_entries.paid_at` (deferred from v1.6)
- Advance payments (customer credit balance) — deferred from v1.4
- Returns / refunds — deferred since v1.2
- Weekly `pg_dump` GitHub Action — recommended in v1.8 post-mortem; still pending
- v2.1 polish: per-supplier comparison reports UI; mobile cart pack-edit sheet (currently only desktop has the inline pack chip)
- v2.2 polish: edit-line bottom sheet on mobile (per-line discount UI is desktop-inline only); `khata` list does not surface tier (only customer detail does)
- v2.3 cleanup: drop legacy `purchase_items.overhead_per_unit` once all reads/writes have been switched to `line_overhead_amount` (UI already prefers the new column with a fallback)
- v2.4 polish: dashboard stat tiles could carry a delta indicator (matches design-inspiration screenshots) once the dashboard summary RPC starts returning a previous-period comparison; auth/onboarding hero illustrations could use a dedicated dark-mode SVG variant
- v2.5 cleanup: drop legacy `products.type` column once every read path is audited; `create_product_with_opening_stock` snapshots category name into `type` to keep legacy readers working. Also retire the `p_type` fallback parameter on that RPC.
- v2.5 polish: bulk re-categorize action (no UI exists; admin re-categorizes one at a time via the edit modal). Category hierarchy and per-category pricing rules are out of scope for this MVP — both are v3 conversations.
- v2.6 deferred drops (target v2.8+): `products.{stock, price, cost, avg_cost, last_purchase_cost}` are deprecated (variant is source of truth); `sale_items.product_id`, `purchase_items.product_id`, `product_packs.product_id` are kept-in-sync denormalized columns. Drop after v2.7 stabilizes. Also retire the `product_id` fallback path in `record_sale` / `record_purchase` then.
- v2.6 deferred work: SKU uniqueness on `product_variants` (spec §2.1's index used a subquery; deferred to v2.7 when the UI starts generating SKUs).
- v2.6 deferred verification: full re-run of v1.3–v2.5 manual test matrices per §11 of the v2.6 spec. Code-level checks (lint, type, build, tests) are green; live-data smoke tests (POS sale, stock-in with overhead, pack-based stock-in, partial payments) need a human to walk through.
- v2.7 deferred items (spec §14): full stock-in matrix grid UX (only the expanding-line fallback shipped — ADR-0028); per-cell unit selector for variants-with-packs ("tape rolls" case); 3-attribute matrix with tabbed third dimension; per-variant packs (the single-variant pack flow stays unchanged, multi-variant products hide the Packs section on the detail page); variant images; variant-level barcodes; bulk variant import (CSV); variant-level reorder points; backorder behaviour (multi-variant POS picker currently disables out-of-stock variants outright).
- v2.7 deferred verification: §13 manual smoke matrix (tracksuit, yoga mat, masking tape, iPhone, single-variant regression, cross-shop isolation). Code-level checks (lint, type, build, tests) are green.
- v2.7 SKU uniqueness deferred from v2.6 §2.1 is *still* deferred — the v2.7 matrix builder auto-suggests SKUs but writes them as-is. A future migration will add a row trigger enforcing (shop_id, lower(trim(sku))) uniqueness when sku is non-null.

## Gotchas / hard-earned lessons

- **`pg_trgm` set_limit** is per-statement, not persistent — set it inside each search function via `perform extensions.set_limit(0.2)`.
- **`pg_trgm` lives in `extensions` schema** (moved in v1.8). Functions that use the `%` operator, `similarity()`, or `set_limit()` need `set search_path = public, extensions, pg_catalog`.
- **Append-only triggers block backfill UPDATEs.** When a v1.9-style migration adds a column with a default of 0 and needs to backfill existing rows from another column, you must `ALTER TABLE … DISABLE TRIGGER <name>` for the duration of the UPDATE, then re-enable. See §B of `0024_v19_suppliers_landed_cost.sql`.
- **Postgres unique indexes** need `WHERE is_active = true` to allow re-using a name after archiving — used on suppliers and products.
- **`record_sale` and `record_purchase` lock** product rows with `FOR UPDATE` before reading stock and avg_cost; concurrent stock-ins on the same product are race-safe.
- **RLS `auth.uid()` should always be `(select auth.uid())`** so the planner caches it per query (v1.8).
- **Supabase auto-grants EXECUTE explicitly** to `anon`, `authenticated`, and `service_role` on every newly created function — `revoke from public` alone is a no-op for anon. The pattern is: `revoke … from public, anon; grant … to authenticated;` (caught in v1.8a / v1.9a).
- **`SECURITY DEFINER` trigger functions** (e.g. `products_normalize_trigger`) needed when the trigger calls another helper that authenticated doesn't have EXECUTE on (caught in v1.8b).
- **`reverse_ledger_entry` blocks sale-tied debits** — entries with `invoice_id IS NOT NULL` raise `cannot_reverse_invoice_tied_debit` so callers go through `receive_payment` (or future `void_sale`) instead.
- **`create or replace view`** cannot change column types. When casting a computed sum to `numeric(12,2)` you must `drop view; create view`.
- **Landed-cost allocation** (v1.9): overhead is distributed pro-rata by line value into `purchase_items.overhead_per_unit`. `avg_cost` uses the effective unit cost (= `cost_at_purchase + overhead_per_unit`); `last_purchase_cost` stays at the supplier's quoted unit cost. Don't conflate the two.
- **`product_packs` has no `price` column** (v2.0's pack-as-sellable-unit design was scrapped in v2.1). Pack pricing was determined to be overkill for SME tier. If a B2B customer ever asks for receipt-level "1 carton (50 each) @ 1,200" pricing, it's a v3 ticket — don't add a price column to packs without revisiting the v2.0 → v2.1 supersession.
- **Frontend never recomputes pack breakdown** (v2.1 §5.2). The `product_stock_display` view exposes `whole_packs` and `remainder_base` already computed; consume them directly. The original "5 cartons + 5 each" off-by-one bug came from JS recomputation drifting from DB truth — keeping one source authoritative is the fix.
- **Restoring an RPC body via migration**: `CREATE OR REPLACE FUNCTION` cannot change a function's parameter list. When v2.1 reverted `record_sale` to v1.6 shape it kept the same signature, so REPLACE worked; when v2.2 added `p_tier_override_type` / `p_tier_override_value`, the migration `DROP FUNCTION` first then created the new shape. Pattern: signature-changing rewrites need DROP + CREATE in the same transaction.
- **Discount stacking order is fixed** (v2.2 §1, unchanged in v2.3): negotiated unit price → per-line discount → sale-discount popup → service charge added last. Discounts never touch service. Snapshots on invoice + sale_item rows mean future edits never rewrite history.
- **v2.3 partial reversion of v2.2** (ADR-0017): `customer_tiers.discount_percent` is dropped, tiers are pure categories. The invoice columns `tier_override_type/value` and `tier_discount_*` were renamed to `sale_discount_*`. Tier joins on the invoice (via `invoices.tier_id`) survive — they're a snapshot of *which tier the customer was on at sale time*, used purely for analytics/display, not discount math. The popup is the only invoice-level discount source.
- **Largest-remainder overhead allocation** (v2.3, replaces v1.9 per-unit method): `record_purchase` distributes overhead pro-rata by line value into `purchase_items.line_overhead_amount` (NOT `overhead_per_unit`). The CTE computes a raw share, then the leftover penny (subtotal − sum-of-rounded-shares) goes to the highest-value line. This is exact: `sum(line_overhead_amount) = overhead_subtotal` always. The legacy `overhead_per_unit` column is kept for back-compat; UI reads `line_overhead_amount` first, falls back to `overhead_per_unit × qty_in_base` on legacy rows.
- **DataTable `cell` signature is `(row) → ReactNode` only** — no index parameter. Code that wrote `cell: (_p, idx) => idx + 1` rendered NaN (the v2.3 PurchaseDetail bug). Precompute serial numbers from the rows array (`new Map(rows.map((r,i) => [r.id, i+1]))`) and look up by id inside cell.
- **POS product list: all "add" affordances live in the rightmost (actions) column** (v2.3 §6.3.2/§6.3.3, revised). The primary `[+]` IconButton sits on top, pack quick-add chips (secondary variant) stack vertically below it. Scan-only products replace the `[+]` with a muted "Scan only" caption while still showing pack chips. `ProductTable` widens the actions column to 160 px when `loadBreakdownsForActions` is set so chip labels don't truncate.
- **POS cart lines are self-labeling cards** (v2.3 follow-up, replaces the column-headers approach). Each line is a `surface-base` card with `border-subtle` + `shadow-xs` + `radius-md`, sitting on a `surface-subtle` panel background. Layout per card: header strip with product name (wraps freely — never `noWrap`) on the left and line total + × removal on the right; hairline divider; controls strip with Qty stepper + Price input each preceded by an uppercase caption label. No column headers above the list — the inline captions handle that job. Same composition from 320 px to 1200 px; the controls strip flex-wraps if the panel narrows. Tabular-nums on totals and the price input keep numbers visually aligned even with proportional fonts.
- **Dark mode is token-only — never use raw color scales for foreground text** (v2.4). The `[data-theme="dark"]` block in `tokens.css` only flips semantic tokens; raw scales (`--brand-700`, `--warning-700`, `--neutral-200`, etc.) stay constant. Components that hard-code raw scales for *visible* color (text, icon, leading bar) become hard to read on near-black surfaces. The semantic tokens to reach for are: `--text-brand` (replaces `--brand-700` for any "brand-colored" text/icon), `--status-{success,warning,error,info}-text` (replaces `--{success,warning,error,info}-700`), `--surface-inverse` / `--text-inverse` (for tooltips and inverse contexts), `--surface-muted` (replaces `--neutral-200` for subtle fills). Background fills with raw scales are usually fine because they're not load-bearing; foreground text is what fails legibility.
- **Categories are per-shop entities, never freetext** (v2.5). `products.category_id` is the FK; `products.type` is a deprecated snapshot kept only until a future cleanup migration audits all readers. New code MUST read/write `category_id`. The unique index on `products` is `(shop_id, lower(trim(name)), category_id)` — two products may share a name across categories within a shop. ADR-0019.
- **POS drawer must never mount/unmount the cart** (v2.5, ADR-0020). The POS product detail drawer is a *presentational* overlay over the POS page; cart state lives in `POSPage`'s `useReducer` and is independent of the drawer. The drawer's "+ Add to cart" footer calls a parent handler with the product id — it never owns the cart. Any future change that ties cart state to the drawer is a regression.
- **Stop propagation inside `renderActions` if the row is also clickable** (v2.5). `DataTable` cells don't stopPropagation by default — when a row has `onRowClick`, every click inside a cell bubbles up. POS wraps the actions Stack with `onClick={e => e.stopPropagation()}` so the [+] button and pack chips don't also open the detail drawer.
- **`create_product_with_opening_stock` has a back-compat `p_type` parameter** (v2.5). New callers MUST pass `p_category_id`. The `p_type` fallback exists only so a stale tab in the field doesn't 500. It auto-creates / resolves the category from the type string. The parameter and the legacy `products.type` column drop together in a future cleanup.
- **Stock decrements on `product_variants.stock`, never on `products.stock`** (v2.6, ADR-0022). The `products.{stock, price, cost, avg_cost, last_purchase_cost}` columns are deprecated; reads via `product_with_default_variant` and `product_stock_display` get fresh values from the variant. Direct reads against `products.*` for stock/price post-v2.6 will silently show stale data forever.
- **Every product has at least one variant** (v2.6, ADR-0023). Single-variant products have exactly one variant with `is_default = true`; v2.7+ multi-variant products have many variants and none of them carry `is_default`. The compat view `product_with_default_variant` LEFT JOINs the default variant — for multi-variant products (post-v2.7) the variant fields are NULL there and the UI reads aggregates from a different view.
- **`record_sale` / `record_purchase` accept variant_id (preferred) OR product_id (legacy → default variant)** (v2.6, ADR-0025). Items missing both raise `item_missing_variant_or_product_id`. Items passing a product_id whose product has no default variant raise `product_has_no_default_variant` (mostly a v2.7 multi-variant footgun). New code MUST pass `variant_id`.
- **`sale_items.product_id` / `purchase_items.product_id` / `product_packs.product_id` are denormalized columns kept in sync by the `sync_product_id_from_variant` trigger** (v2.6, ADR-0024). Writers pass only `variant_id`; the trigger fills `product_id`. Do not write to `product_id` directly — the trigger overwrites your value on every UPDATE.
- **Pack-management RPCs (`define_pack_inline`, `update_pack`, `deactivate_pack`) still accept `p_product_id` for back-compat** (v2.6). Internally they resolve to the product's default variant and operate on `product_packs.variant_id`. v2.7 will add `p_variant_id` overloads when multi-variant packs become real.
- **Append-only backfill UPDATEs must dodge `sale_items_no_modify` / `purchase_items_no_modify` triggers** (v1.8 / v1.9 / v2.0 / v2.6). Pattern: `ALTER TABLE … DISABLE TRIGGER <name>` → UPDATE → `ENABLE TRIGGER`. v2.6's 0039 migration uses this for the variant_id backfill on `sale_items` and `purchase_items`; `product_packs` has only a touch trigger so no toggle is needed there.
- **A product can have at most 3 variant attributes** (v2.7, ADR-0027). Enforced both at the UI (the "+ Add another attribute" affordance hides at 3) and in `create_product_with_variants` (`too_many_attributes` exception). The matrix UI's 2D grid is the visual ceiling; 4+ attributes have no clean layout.
- **Variant attributes are shop-wide, not per-product** (v2.7, ADR-0026). Color / Size / Storage live in `variant_attributes (shop_id, name)`. Two products in the same shop pick from the same value pool — so "how much Red did we sell across all garments?" stays a simple join.
- **POS multi-variant rows show "Pick variant" instead of [+]** (v2.7, ADR-0029). `search_products` returns `has_variants` + `min_price` / `max_price` so the UI branches without an extra fetch. Cart lines are keyed by `variant_id ?? product_id` (the `lineKey` helper) — two variants of one product are distinct cart lines.
- **The v2.7 stock-in matrix is the expanding-line fallback, not the 2D grid** (ADR-0028). When a multi-variant product is picked on a stock-in line, a variant `<Select>` appears. Receiving N variants of one product = N stock-in lines. The full matrix UX (per-cell grid, per-cell pricing toggle, inline `+ Add Color value`) is on the open-todo list.
- **`enforce_variant_default_invariants` trigger** (v2.7, migration 0045) rejects `is_default = true` on a variant whose product has `has_variants = true`. Partial indexes can't express that invariant because Postgres rejects subqueries in WHERE predicates — the row trigger is the only way to enforce "multi-variant products may not have a default."
- **`create_product_with_variants` requires exactly one value per attribute per variant** (v2.7). The RPC raises `variant_must_have_one_value_per_attribute` if a variant's `attribute_value_ids` length doesn't match the product's `attribute_ids` length. The UI matrix builder enforces this by construction (every cell is a cross-product of selected values).

## Lint / test gotchas

- ESLint uses flat config (`eslint.config.cjs`) via `FlatCompat`. `no-console` errors except `warn`/`error`.
- TypeScript is `strict` with `noUnusedLocals` and `noUnusedParameters` — unused imports break the build.
- The CI pipeline (`bitbucket-pipelines.yml`) runs `lint` → `test` → `build` on every PR, plus a Trivy vulnerability scan on `dev`/`qa`/`main`. The pipeline still references legacy Auth0 env vars in the build step — those are dead and need cleanup; current builds need only the `VITE_SUPABASE_*` and `VITE_SUPPORT_*`/`VITE_BANK_*`/`VITE_MONTHLY_PRICE_PKR` vars listed in `README.md`.
