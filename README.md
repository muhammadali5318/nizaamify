# Nizaamify — Shop POS MVP

A **React + TypeScript + Vite** application for Pakistani shop owners — POS, inventory, credit ledger (khata), expenses, and monthly targets, with a 30-day trial and offline-payment activation.

Built per `PRD.md` v1.2. Implementation plan: `~/.claude/plans/soft-jingling-canyon.md`. Decisions: `decisions/`. Progress: `tasks.md`.

---

## Tech Stack

- **React 19** + **Vite 7** + **TypeScript**
- **MUI v7** for UI, **Emotion** with `stylis-plugin-rtl` for RTL
- **react-router v7** (declarative `BrowserRouter`)
- **react-hook-form** + **Zod** + **@hookform/resolvers**
- **TanStack Query** for server state
- **react-i18next** + **i18next-browser-languagedetector** (English / Urdu)
- **Supabase** (Auth + Postgres + RLS + pg_cron)
- **Vitest** + **Testing Library** (schema-level tests; run via `npm test`)

---

## Getting started

### Prerequisites
- Node.js `>=20 <=22`, npm `>=10.8.0`. (`.nvmrc` pins 20.18.0.)
- A Supabase project with the migrations in `supabase/migrations/` applied (we apply via Supabase MCP).

### Install + run

```bash
npm install
npm run dev          # start dev server on http://localhost:5173
npm run build        # production build
npm run preview      # serve dist/ for local QA
npm run type-check
npm run lint
npm test
```

### Environment

Copy `.env.example` to `.env` (or `.env.local` for local-only). Required keys:

```
VITE_SUPABASE_URL=                # https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=           # publishable key (sb_publishable_...) or legacy anon key

VITE_SUPPORT_PHONE=
VITE_SUPPORT_WHATSAPP=
VITE_SUPPORT_EMAIL=

VITE_BANK_ACCOUNT_NAME=
VITE_BANK_ACCOUNT_NUMBER=
VITE_BANK_NAME=

VITE_MONTHLY_PRICE_PKR=
```

The support / bank / price values are surfaced on `/subscription/expired` and `/settings/support`.

---

## Repo layout

```
src/
├── App.tsx                      # all providers (Theme + Emotion cache + i18n + Query + Auth + ErrorBoundary)
├── lib/                         # supabase, i18n, queryClient, rtlCache, guards
├── features/                    # auth, onboarding, subscription, dashboard, pos, products,
│                                # customers, khata, purchases, expenses, targets, reports, settings
├── layouts/AppShell.tsx         # responsive sidebar/topbar shell with banner slot
├── locales/{en,ur}/*.json       # 13 namespaces — every user-facing string
├── theme/muiTheme.ts            # getTheme(direction) factory
└── types/database.ts            # generated via Supabase MCP — re-run after every migration
supabase/
├── migrations/0001…0011         # apply in order via mcp__supabase__apply_migration
└── seed.sql                     # parameterized dev data (replace <USER_ID>)
decisions/                       # ADRs for every PRD reversal + cross-cutting choice
tasks.md                         # milestone tracker
```

---

## Auth lifecycle

1. **Signup** at `/signup` → Supabase sends a verification email → user lands on `/verify-email`.
2. **Verification** click → `/login`.
3. **Login** → guard chain: `RequireAuth → RequireOnboarded → RequireActiveSubscription`.
4. **First login** is forced into `/onboarding` (2-step wizard: shop + owner). On submit, the `complete_onboarding` RPC writes shop + owner details + flips `profiles.onboarding_completed` atomically.
5. **30-day trial** is created automatically on signup by the `handle_new_user` trigger.
6. When the trial or paid period ends, the user is redirected to `/subscription/expired`. Only `/settings`, `/settings/support`, and `/subscription/expired` are reachable. Admin manually flips status via SQL (see `decisions/0010-admin-runbook.md`).

---

## Operator runbook

- **Activate / suspend a subscription:** `decisions/0010-admin-runbook.md` (SQL snippets).
- **RTL audit checklist:** `decisions/0012-m8-rtl-audit-status.md`.
- **All architectural decisions:** `decisions/README.md`.

### Apply a new migration

```
mcp__supabase__apply_migration(project_id="orfggrnyychmmqdlbfhf", name="<NN_name>", query="...")
```

After every migration, regenerate types:

```
mcp__supabase__generate_typescript_types(project_id="orfggrnyychmmqdlbfhf")
```

…and write the result to `src/types/database.ts`.

### Run advisors after schema changes

```
mcp__supabase__get_advisors(project_id="...", type="security")
```

Expected warnings (intentional, see ADR-0011):
- `complete_onboarding`, `current_shop_id`, `record_purchase`, `record_sale` are SECURITY DEFINER RPCs callable by `authenticated` — required for atomicity.
- `auth_leaked_password_protection` — toggle in dashboard before launch.
