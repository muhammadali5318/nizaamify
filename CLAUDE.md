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

Full version history is in `docs/build-trail.md` — load when you need long-form context for a specific version. Quick reference:

- **v1.2–v1.7** — baseline + ledger hardening + initial design system
- **v1.8** — db hardening (RLS, search_path, FK indexes, append-only triggers, money precision)
- **v1.9** — stock-in hardening (suppliers, landed-cost pro-rata allocation)
- **v2.0** — *superseded by v2.1*. Do not implement against `MVP_v2.0_UNITS_OF_MEASURE.md`.
- **v2.1** — UoM + pack tables (stock-in shortcuts, no pack pricing); sales stay in base units
- **v2.2** — customer tiers + per-line discounts + manual override (*partially reverted in v2.3*)
- **v2.3** — tiers reduced to pure categories; `tier_*` → `sale_discount_*`; largest-remainder overhead allocation
- **v2.4** — UI revamp + dark mode (amber on near-black); see Design system section
- **v2.5** — product detail page + `product_categories` entity
- **v2.6** — foundational variant refactor (silent); `products` becomes template, stock/price live on `product_variants`
- **v2.6c** — profit-bug hardening; `invoice_financials` / `sale_item_financials` views as single source of truth; no-JS-Number-on-money discipline
- **v2.7** — variant management UI (shop-wide attributes, matrix builder, multi-variant POS picker)
- **v2.8** — batch tracking (FEFO, per-product opt-in via `products.has_batches`)
- **v2.8.1** — pricing/stock decoupled from product creation
- **v2.8.2** — partial write-off + auto-deactivate when empty
- **v2.8.3** — expired-stock + null-price visibility surfaces

## Open ToDos / Known gaps

Full list in `docs/todos.md`. Headlines: infra/launch blockers (PITR, HIBP, weekly pg_dump action), deferred features (`void_sale`, advance payments, returns/refunds), legacy column cleanups (deprecated `products.*` post-v2.6, `purchase_items.overhead_per_unit`, `products.type`), and v2.6/v2.7/v2.8 verification debt (manual smoke matrices still pending). Load that file when picking up backlog work.

## Gotchas / hard-earned lessons

Full list in `docs/gotchas.md`, grouped by area (SQL / RPCs / discounts & money / packs, categories, variants / batches / frontend). Load that file when you're about to touch the relevant area — most rules are still active. The most consequential, repeated below as defaults:

- **No JS Number arithmetic on money paths** (v2.6c). Authoritative money comes from SQL views (`invoice_financials`, `purchase_item_financials`, `daily_sales_7`, `expenses_by_category_mtd`, `total_outstanding`, `invoices.outstanding`). JS only `Number(...)`s at the `formatPKR()` boundary, never `+ - * /` between money values. Composition-path JS (POS cart preview) is the only exception and is cosmetic.
- **Stock lives on `product_variants`, not `products`** (v2.6, ADR-0022). The `products.{stock, price, cost, avg_cost, last_purchase_cost}` columns are deprecated; read via `product_with_default_variant` / `product_stock_display`. Direct reads from `products.*` show stale data forever.
- **`record_sale` / `record_purchase` prefer `variant_id`; `product_id` is a legacy fallback** (v2.6, ADR-0025). New code passes `variant_id`. Items missing both raise `item_missing_variant_or_product_id`.
- **For batched products, `sale_items.cost_at_sale` is the BATCH's `cost_per_unit`, not `variant.avg_cost`** (v2.8). Profit math must respect this when the line carries a `batch_id`.
- **`inventory_batches` is append-only except `qty_remaining` / `is_active` / `notes`** (v2.8). The `batch_immutable_fields` trigger blocks everything else.
- **Dark mode is token-only — never use raw color scales for foreground text** (v2.4). Reach for `--text-brand`, `--status-*-text`, `--surface-muted` etc. Raw `--brand-700` / `--warning-700` / `--neutral-200` for visible text breaks legibility in dark mode.
- **Append-only triggers block backfill UPDATEs.** Pattern: `ALTER TABLE … DISABLE TRIGGER` → UPDATE → ENABLE.
- **Supabase auto-grants EXECUTE to anon/authenticated/service_role.** `revoke from public` alone is a no-op for anon — use `revoke … from public, anon; grant … to authenticated;`.

## Lint / test gotchas

- ESLint uses flat config (`eslint.config.cjs`) via `FlatCompat`. `no-console` errors except `warn`/`error`.
- TypeScript is `strict` with `noUnusedLocals` and `noUnusedParameters` — unused imports break the build.
- The CI pipeline (`bitbucket-pipelines.yml`) runs `lint` → `test` → `build` on every PR, plus a Trivy vulnerability scan on `dev`/`qa`/`main`. The pipeline still references legacy Auth0 env vars in the build step — those are dead and need cleanup; current builds need only the `VITE_SUPABASE_*` and `VITE_SUPPORT_*`/`VITE_BANK_*`/`VITE_MONTHLY_PRICE_PKR` vars listed in `README.md`.
