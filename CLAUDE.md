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
            └── AuthProvider                  ← session + profile + subscription state
                └── CacheProvider (Emotion)   ← rebuilt on language change (LTR vs RTL plugin)
                    └── ThemeProvider (MUI)   ← theme is a factory, re-fed on direction change
                        └── NotificationProvider
                            └── Router        ← useRoutes from src/router/index.tsx
```

The Emotion cache and MUI theme are **per-direction** (`ltr` / `rtl`) and rebuilt only when language changes — see ADR-0003 (`decisions/0003-mui-rtl-pipeline.md`). Don't recreate caches per render.

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

## Decision log

`decisions/` holds ADRs for every reversal of a PRD assumption or cross-cutting choice. Read `decisions/README.md` first when a question feels architectural — the answer is often already there. Notable bindings:

- **0001** — MUI v7 + SCSS instead of PRD's Tailwind; react-router v7 instead of v6; no Zustand
- **0005** — RLS is enabled in the same migration that creates the table (never split)
- **0006** — subscription gating is client-only (see above)
- **0007** — `record_sale` / `record_purchase` are SQL functions, not client transactions
- **0011** — three RPCs are deliberately `SECURITY DEFINER` callable by `authenticated`; advisor warnings are accepted

When making a decision that reverses the PRD or affects multiple layers, write a new ADR (numeric prefix, four sections: Context / Decision / Alternatives / Consequences).

## Lint / test gotchas

- ESLint uses flat config (`eslint.config.cjs`) via `FlatCompat`. `no-console` errors except `warn`/`error`.
- TypeScript is `strict` with `noUnusedLocals` and `noUnusedParameters` — unused imports break the build.
- The CI pipeline (`bitbucket-pipelines.yml`) runs `lint` → `test` → `build` on every PR, plus a Trivy vulnerability scan on `dev`/`qa`/`main`. The pipeline still references legacy Auth0 env vars in the build step — those are dead and need cleanup; current builds need only the `VITE_SUPABASE_*` and `VITE_SUPPORT_*`/`VITE_BANK_*`/`VITE_MONTHLY_PRICE_PKR` vars listed in `README.md`.
