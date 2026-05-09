# Product Requirements Document (PRD)
## Shop Sales & Service Management System — MVP v1.2

**Audience:** Claude Code (build agent) and human reviewers
**Version:** 1.2
**Last updated:** 2026-05-07
**Stack:** React (frontend) • Supabase (auth, Postgres, RLS) • react-i18next (i18n)
**Backend connection:** Supabase MCP (Claude Code connects to Supabase via the Supabase MCP server for schema migrations, policy creation, and seed data)
**Currency:** PKR
**Timeline:** 10 weeks

---

## Table of Contents

1. [Goals & Non-Goals](#1-goals--non-goals)
2. [Tech Stack & Repository Layout](#2-tech-stack--repository-layout)
3. [User Roles & Account Model](#3-user-roles--account-model)
4. [Authentication Flow](#4-authentication-flow)
5. [Onboarding Flow (Mandatory Gating)](#5-onboarding-flow-mandatory-gating)
6. [Subscription, Trial & Manual Payment Flow](#6-subscription-trial--manual-payment-flow)
7. [Notification Banners](#7-notification-banners)
8. [Internationalization (English / Urdu)](#8-internationalization-english--urdu)
9. [Core Domain Features](#9-core-domain-features)
10. [Database Schema (Supabase / Postgres)](#10-database-schema-supabase--postgres)
11. [Row Level Security (RLS) Policies](#11-row-level-security-rls-policies)
12. [Routes & Page Map](#12-routes--page-map)
13. [Component Architecture](#13-component-architecture)
14. [Access Gating Middleware](#14-access-gating-middleware)
15. [Supabase MCP Usage by Claude Code](#15-supabase-mcp-usage-by-claude-code)
16. [Build Phases (10-Week Plan)](#16-build-phases-10-week-plan)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Out of Scope (Phase 2+)](#18-out-of-scope-phase-2)

---

## 1. Goals & Non-Goals

### Goals
- Ship a single-shop POS + Khata (credit ledger) + inventory + expenses + targets system in 10 weeks.
- Multi-tenant by design (`shop_id` on every domain row) so multiple shops can be onboarded later without schema rewrites.
- Self-serve signup with a **1-month free trial**, gated onboarding, and **manual subscription activation** by an admin once the customer pays offline.
- Full **English / Urdu** UI with RTL support for Urdu.
- All static UI strings routed through `react-i18next` — no hard-coded user-facing text.

### Non-Goals (MVP)
- No payment gateway integration (Stripe / JazzCash / Easypaisa). Payments are reconciled manually.
- No commission split, no roles beyond a single "shop owner" account, no barcode hardware, no offline mode, no return/refund flow, no advanced reports/exports.

---

## 2. Tech Stack & Repository Layout

### Stack
| Layer | Choice |
|---|---|
| Frontend framework | React 18 + Vite |
| Language | TypeScript |
| Routing | React Router v6 |
| Styling | Tailwind CSS |
| State / data | TanStack Query (server state) + Zustand (UI state, only if needed) |
| Forms | React Hook Form + Zod |
| i18n | react-i18next + i18next-browser-languagedetector |
| Backend | Supabase (Auth, Postgres, RLS, Storage if needed) |
| Hosting | Vercel (frontend), Supabase Cloud (backend) |
| Testing | Vitest + React Testing Library (light coverage on critical paths) |

### Suggested repo layout
```
shop-mvp/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx           # QueryClient, AuthProvider, i18n, Theme
│   ├── features/
│   │   ├── auth/                   # signup, login, password reset
│   │   ├── onboarding/             # mandatory shop + owner details wizard
│   │   ├── subscription/           # trial banners, expired page, status hook
│   │   ├── pos/
│   │   ├── products/
│   │   ├── customers/
│   │   ├── khata/                  # credit ledger
│   │   ├── purchases/              # stock-in
│   │   ├── expenses/
│   │   ├── targets/
│   │   ├── reports/
│   │   └── settings/               # language, profile, support
│   ├── components/
│   │   ├── ui/                     # Button, Input, Card, Dialog, Banner...
│   │   └── layout/                 # AppShell, Sidebar, TopBar
│   ├── lib/
│   │   ├── supabase.ts             # client init
│   │   ├── i18n.ts                 # i18next init
│   │   └── guards.ts               # auth/onboarding/subscription guards
│   ├── locales/
│   │   ├── en/common.json
│   │   ├── en/pos.json
│   │   ├── en/...
│   │   ├── ur/common.json
│   │   └── ur/...
│   ├── types/
│   │   └── database.ts             # supabase-generated types
│   └── main.tsx
├── supabase/
│   ├── migrations/                 # SQL migrations (Claude Code authors via MCP)
│   └── seed.sql
├── .env.example
├── tailwind.config.ts
├── vite.config.ts
└── README.md
```

### Required environment variables
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPPORT_PHONE=
VITE_SUPPORT_WHATSAPP=
VITE_SUPPORT_EMAIL=
VITE_BANK_ACCOUNT_NAME=
VITE_BANK_ACCOUNT_NUMBER=
VITE_BANK_NAME=
VITE_MONTHLY_PRICE_PKR=
```

---

## 3. User Roles & Account Model

For MVP there is **one role**: `shop_owner`. Each Supabase auth user owns exactly one shop. The `auth.users` row is the source of truth for identity; everything else hangs off `auth.users.id`.

```
auth.users (Supabase managed)
   └── profiles            (1:1, app-level user profile + preferences)
         └── shops          (1:1 in MVP, modeled as 1:N for future)
               ├── shop_owner_details     (1:1, the human owner's contact info)
               ├── subscriptions          (1:1)
               ├── products / customers / invoices / ...
```

> **Why separate `shop_owner_details` from `profiles`?** `profiles` is the *app user* (login email, language preference). `shop_owner_details` captures the *business owner's* information for the shop record (could differ from the login email — e.g., a manager creates the account, owner details are the proprietor).

---

## 4. Authentication Flow

### Sign up
1. User visits `/signup`, enters: email, password, confirm password.
2. Client calls `supabase.auth.signUp({ email, password })`.
3. Supabase sends verification email (use Supabase's built-in template, customized in Supabase dashboard with both EN and UR copy).
4. On success, a `profiles` row is created via DB trigger (see schema), and a `subscriptions` row is created in `trial` status with `trial_ends_at = now() + interval '30 days'`.
5. User is redirected to `/verify-email` page that says "Check your inbox."

### Login
1. User visits `/login`, enters email + password.
2. `supabase.auth.signInWithPassword(...)`.
3. On success → router runs guard chain:
   - **Auth guard:** signed in? → if no, kick to `/login`.
   - **Onboarding guard:** `profiles.onboarding_completed === true`? → if no, force `/onboarding`.
   - **Subscription guard:** subscription status in (`trial`, `active`)? → if `expired` or `suspended`, force `/subscription/expired`.
4. After all three pass → land on `/dashboard`.

### Password reset
- `/forgot-password` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`.
- `/reset-password` → reads recovery token from URL hash, calls `supabase.auth.updateUser({ password })`.

### Logout
- Available from user menu in TopBar. Calls `supabase.auth.signOut()`, clears React Query cache, redirects to `/login`.

### Session handling
- Use `supabase.auth.onAuthStateChange` inside an `AuthProvider` context to keep session in sync.
- Persist session via Supabase's default localStorage strategy.

---

## 5. Onboarding Flow (Mandatory Gating)

Until onboarding is complete the user **cannot reach any other authenticated route**. The guard logic checks `profiles.onboarding_completed`.

### Onboarding wizard — `/onboarding`

A 2-step wizard inside a single page (no skipping, no closing).

**Step 1 — Shop details**
- `shop_name` (required, 2–100 chars)
- `shop_address` (required, 5–250 chars)
- `shop_phone` (required, valid PK phone — accept `+92` or `0` prefix; regex example: `^(\+92|0)[0-9]{10}$`)
- `shop_type` (optional, free text — e.g., "Mobile shop", "Auto parts")

**Step 2 — Owner details**
- `owner_name` (required, 2–100 chars)
- `owner_phone` (required, same phone validation as above)
- `owner_cnic` (optional, format `XXXXX-XXXXXXX-X`)
- `owner_address` (required, 5–250 chars)

**On submit:**
1. Insert into `shops` and `shop_owner_details` (use a single Postgres function `complete_onboarding(...)` for atomicity — see schema).
2. Set `profiles.onboarding_completed = true`.
3. Invalidate the relevant React Query keys.
4. Redirect to `/dashboard`.

**UX rules**
- All form labels and validation messages go through i18n keys (`onboarding.shop.name_label`, etc.).
- The wizard must work in both LTR (English) and RTL (Urdu).
- Show a friendly welcome message with the user's email and explain that this info is required to use the system.
- If the user logs out mid-onboarding, the partial form state is **not** persisted (next login they restart the wizard, but already-saved DB data is preserved if any single step was committed — for MVP we save only on the final submit, so this is moot).

---

## 6. Subscription, Trial & Manual Payment Flow

### Subscription states
| Status | Meaning | Access |
|---|---|---|
| `trial` | Inside the 30-day free trial | Full access |
| `active` | Paid; admin manually activated | Full access |
| `expired` | Trial or paid period ended, no payment received | Locked — only `/subscription/expired` and `/settings/support` |
| `suspended` | Manually suspended by admin (e.g., refund, abuse) | Locked — only `/subscription/expired` |

### Trial creation
On signup, the DB trigger `handle_new_user()` creates a `subscriptions` row:
```
status            = 'trial'
trial_started_at  = now()
trial_ends_at     = now() + interval '30 days'
```

### Daily expiry sweep
A scheduled Postgres function `expire_subscriptions()` runs daily (Supabase pg_cron) and flips any `trial`/`active` rows whose `current_period_ends_at` (or `trial_ends_at` for trials) is in the past to `expired`.

> **Why a sweep instead of pure on-read checks?** On-read checks are required *too* (the guard always recomputes effective status), but the sweep guarantees admin reports are consistent and that a user who logs in just after midnight sees the right state without race conditions.

### Effective status check (client + RLS)
A SQL view `subscription_effective` (and a matching client-side helper) returns the *effective* status:
- If `status` is `expired` or `suspended` → return as-is.
- If `status = 'trial'` and `now() > trial_ends_at` → effective `expired`.
- If `status = 'active'` and `now() > current_period_ends_at` → effective `expired`.
- Otherwise → return stored status.

### Manual payment flow (no gateway)
1. User sees expiration banner (see section 7).
2. User opens `/settings/support` (or the link inside the banner) to view payment instructions:
   - Bank name, account title, account number, IBAN
   - Support phone + WhatsApp number (deep-linkable: `https://wa.me/<number>?text=...`)
   - Support email
   - Monthly price (from env)
3. User sends payment offline and contacts support with proof.
4. **Admin (you) manually updates** the user's `subscriptions` row in Supabase:
   - `status = 'active'`
   - `current_period_starts_at = now()`
   - `current_period_ends_at = now() + interval '1 month'`
   - `last_payment_date = <date>`
   - `last_payment_amount = <amount>`
   - `notes = 'Paid via bank transfer, ref XYZ'`
5. On next page load (or when client receives a Supabase realtime event on the subscription row — *optional for MVP*) the user regains access.

### Subscription expired page — `/subscription/expired`
- Friendly heading: "Your subscription has ended."
- Show effective status, last payment date (if any), and the monthly price.
- Show full payment instructions (same content as `/settings/support`).
- A "Logout" button.
- A "Refresh status" button that simply re-fetches the subscription.
- No other navigation links — sidebar/topbar nav is hidden on this page.

---

## 7. Notification Banners

A single `<DashboardBanner />` component renders at the top of every authenticated screen (above the main content area). It picks the highest-priority banner to show.

### Banner rules (highest priority first)
| Trigger | Severity | Copy (i18n key) | Actions |
|---|---|---|---|
| Subscription `suspended` | error | `banner.subscription_suspended` | "Contact support" → `/settings/support` |
| Subscription effectively `expired` | error | `banner.subscription_expired` | "Pay now" → `/subscription/expired` |
| Trial: ≤ 3 days left | warning | `banner.trial_ending_soon` (with `daysLeft`) | "View payment options" |
| Trial: 4–7 days left | info | `banner.trial_reminder` (with `daysLeft`) | "View payment options" |
| Active sub: ≤ 5 days until renewal | warning | `banner.subscription_renewal_due` | "Renew" → `/settings/support` |
| Active sub: 6–10 days until renewal | info | `banner.subscription_renewal_reminder` | "Renew early" |
| None of the above | (no banner) | — | — |

### Behavior
- Banner is **dismissible** for `info` severity only (and the dismissal persists for that day in localStorage keyed by `banner_<type>_<YYYY-MM-DD>`).
- `warning` and `error` banners are **not dismissible**.
- Banner color tokens: info = blue, warning = amber, error = red. Tailwind classes only.
- Banner respects RTL — actions on the leading edge in Urdu.

---

## 8. Internationalization (English / Urdu)

### Library
`react-i18next` + `i18next-browser-languagedetector`.

### Setup (`src/lib/i18n.ts`)
```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../locales/en';   // index file aggregating all namespaces
import ur from '../locales/ur';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, ur },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ur'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lng',
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
```

### Namespaces
Split per feature: `common`, `auth`, `onboarding`, `pos`, `products`, `customers`, `khata`, `purchases`, `expenses`, `targets`, `reports`, `subscription`, `settings`.

### RTL handling
- On language change, set `document.documentElement.dir = i18n.language === 'ur' ? 'rtl' : 'ltr'` and `lang` attribute.
- Use Tailwind's logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) instead of `ml-*`, `mr-*`, etc., so layouts mirror automatically.
- Numbers and currency: use `Intl.NumberFormat` with locale `en-PK` for English, `ur-PK` for Urdu. Currency is always PKR.
- Dates: use `Intl.DateTimeFormat` with the same locales; format `dd/MM/yyyy` for both, but Urdu numerals when locale is `ur-PK`.

### Language selector
- Lives in the user menu (TopBar) and on the login/signup pages (so unauthenticated users can also pick).
- On change:
  1. `i18n.changeLanguage(newLng)`
  2. Persist to `localStorage` (handled by detector).
  3. If user is logged in, update `profiles.preferred_language`.
- On login, if `profiles.preferred_language` differs from the detector's value, server value wins.

### Translation key rules
- **Zero hard-coded user-facing strings.** Every label, button, error, toast, banner, validation message goes through `t('namespace:key')`.
- Use placeholders: `t('banner.trial_ending_soon', { daysLeft: 2 })`.
- Pluralization via i18next plural rules — Urdu has different rules than English; declare `_one` / `_other` keys.
- Keep keys hierarchical and stable: `pos.cart.empty_state.title`, not `pos.title1`.

### Initial Urdu translations
Claude Code should generate the EN keys first, then provide reasonable Urdu translations. Mark uncertain translations with a comment for the human to review. Common terms (POS-domain) to translate carefully:
- "Khata" → "کھاتہ" (already a Urdu word — keep as-is)
- "Stock" → "اسٹاک"
- "Cash" → "نقد", "Credit" → "ادھار"

---

## 9. Core Domain Features

These are unchanged in scope from MVP v1.1 and re-summarized here for completeness. Every domain table must include `shop_id uuid not null` and be RLS-scoped.

| Module | Core actions |
|---|---|
| Products | Create, edit, archive (soft-delete via `is_active`). Search by name. |
| POS | Search products, add to cart, adjust qty, add service charge, complete sale (cash or credit). On sale: deduct stock, write `invoices` + `sale_items`, snapshot price + cost. |
| Khata | Customer-level running balance. Credit/partial sale → ledger debit (linked to the originating sale). Receive payment → ledger credit (customer-level only, **never** linked to a specific sale). Customer detail → full history. Filter list by Open / Closed / All. See the **Khata model — design principle** subsection below. |
| Customers | Add (name, phone). Phone unique within a shop. |
| Stock-in (Purchases) | Record market purchase, snapshot cost, increase stock immediately. |
| Expenses | Categorized (rent, electricity, internet, salary, fuel, other). Date, amount, note. |
| Monthly targets | One row per month per shop: target_sale, target_gross_profit, target_net_profit. Dashboard shows progress vs achieved. |
| Reports | Daily sales summary, outstanding balances, monthly expense summary, gross/net profit summary. |

---

### Khata model — design principle (locked, v1.6a)

The khata is a **customer-level running balance**, not a per-invoice AR system. This decision is intentional and final for the MVP. Future iterations must not reintroduce per-invoice payment allocation without a deliberate product decision.

**The model:**
- Each customer has a single `outstanding_balance` (stored on `customers`, maintained by trigger on `ledger_entries` insert).
- A credit/partial **sale** writes a `ledger_entries` debit row with `invoice_id` set to the originating sale. The debit's `invoice_id` means "the sale that created this debt" and is used only for display context (product names, service notes) on the khata detail screen.
- A **payment received** writes a `ledger_entries` credit row with `invoice_id = NULL`, **always**. There is no UI to link a payment to a specific sale; there is no allocation across multiple sales; there is no per-sale "remaining" derived from later credits.
- Sale invoices show **what was paid at the time of the sale** (`invoices.amount_paid`) and the on-credit gap at sale time. They do **not** track payments received afterward against that specific sale.

**Why this model and not invoice-allocated AR (FIFO or manual):**
1. **Mental model match.** Pakistani/Indian shopkeepers think in running balances per customer, not invoice-by-invoice. Forcing allocation adds friction without clarity for them.
2. **Single source of truth.** A mixed model (some payments linked to invoices, some not) creates two states for the same money: customer balance vs. per-invoice remaining. They diverge silently — a 500-paid sale shows "remaining 500" because the cashier forgot to link the payment, even though the customer's balance is correct. v1.6 shipped this mixed model briefly; it was rejected in v1.6a for exactly this reason.
3. **Audit clarity preserved by other means.** The debit row already records which sale created the debt. Payments record what was received and when, with optional notes. Reversal entries (`reverses_entry_id`) record corrections. Every cash movement is auditable; we just don't pretend it's allocated.
4. **Standards-aligned AR (FIFO auto-allocation, splitting one payment across invoices) is a feature for v2+** — gated on real demand from sophisticated users, not the default shopkeeper path.

**Database invariant:** `ledger_entries` has a `CHECK (type = 'debit' OR invoice_id IS NULL)` constraint. Any code path that inserts a credit row with a non-null `invoice_id` will fail at the database level. This is the rule, not a convention.

**Hardening (v1.6):**
- Stored `customers.outstanding_balance`, maintained by trigger on `ledger_entries` insert.
- Append-only `ledger_entries` (UPDATE/DELETE blocked by trigger; RLS narrowed to SELECT + INSERT).
- Reversal mechanism via `reverse_ledger_entry` and `reverses_entry_id` (no direct edits/deletes).
- Customer-level overpayment guard inside `receive_payment` (cannot pay more than customer's outstanding).
- Reconciliation view `customer_balance_reconciliation` for ops audit (drift must always be 0).

---

## 10. Database Schema (Supabase / Postgres)

> All tables live in the `public` schema. UUIDs use `gen_random_uuid()`. All money is stored as `numeric(12, 2)` in PKR. All timestamps are `timestamptz`.

### `profiles`
1:1 with `auth.users`. Created by trigger on signup.
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  preferred_language text not null default 'en' check (preferred_language in ('en','ur')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `shops`
```sql
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  shop_name text not null,
  shop_address text not null,
  shop_phone text not null,
  shop_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)   -- enforce 1:1 in MVP; remove for multi-shop
);
```

### `shop_owner_details`
```sql
create table public.shop_owner_details (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  owner_name text not null,
  owner_phone text not null,
  owner_cnic text,
  owner_address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id)
);
```

### `subscriptions`
```sql
create type public.subscription_status as enum ('trial','active','expired','suspended');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.subscription_status not null default 'trial',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  last_payment_date date,
  last_payment_amount numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);
```

### Domain tables (existing MVP tables, extended with `shop_id`)
```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  cost numeric(12,2) not null check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id),
  total numeric(12,2) not null check (total >= 0),
  service_charge numeric(12,2) not null default 0 check (service_charge >= 0),
  payment_type text not null check (payment_type in ('cash','credit')),
  cashier_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  price_at_sale numeric(12,2) not null,
  cost_at_sale numeric(12,2) not null
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  -- invoice_id is meaningful ONLY on debit rows (the sale that created the debt).
  -- On credit rows it is enforced to be NULL (see the khata model design principle
  -- in §9 and the constraint below). This is the v1.6a finalized invariant.
  invoice_id uuid references public.invoices(id),
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('debit','credit')),
  occurred_at timestamptz not null default now(),
  paid_at timestamptz,                    -- legacy from v1.2; deprecated, do not write from new code
  notes text,                             -- v1.6
  reverses_entry_id uuid references public.ledger_entries(id), -- v1.6 reversal pointer
  created_at timestamptz not null default now(),
  constraint ledger_entries_credit_no_invoice
    check (type = 'debit' or invoice_id is null),
  constraint ledger_entries_no_self_reversal
    check (reverses_entry_id is null or reverses_entry_id <> id)
);
-- Each entry can only be reversed once.
create unique index uq_ledger_entries_reverses
  on public.ledger_entries (reverses_entry_id) where reverses_entry_id is not null;
-- Append-only enforcement: triggers raise on UPDATE / DELETE; reverse the entry
-- with public.reverse_ledger_entry() instead. RLS exposes SELECT + INSERT only.
-- Stored balance lives on public.customers.outstanding_balance, maintained by
-- a trigger on ledger_entries INSERT.

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  total_cost numeric(12,2) not null check (total_cost >= 0),
  source text,
  note text,
  purchase_date date not null default current_date,
  cashier_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  cost_at_purchase numeric(12,2) not null
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.monthly_targets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  month date not null,                          -- store first day of month
  target_sale numeric(12,2) not null default 0,
  target_gross_profit numeric(12,2) not null default 0,
  target_net_profit numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, month)
);
```

### Triggers & functions

**`handle_new_user()`** — runs on `auth.users` insert.
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.subscriptions (user_id, status, trial_started_at, trial_ends_at)
  values (new.id, 'trial', now(), now() + interval '30 days');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**`complete_onboarding(...)`** — atomic onboarding.
```sql
create or replace function public.complete_onboarding(
  p_shop_name text,
  p_shop_address text,
  p_shop_phone text,
  p_shop_type text,
  p_owner_name text,
  p_owner_phone text,
  p_owner_cnic text,
  p_owner_address text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.shops (owner_user_id, shop_name, shop_address, shop_phone, shop_type)
  values (v_user_id, p_shop_name, p_shop_address, p_shop_phone, p_shop_type)
  returning id into v_shop_id;

  insert into public.shop_owner_details (shop_id, owner_name, owner_phone, owner_cnic, owner_address)
  values (v_shop_id, p_owner_name, p_owner_phone, p_owner_cnic, p_owner_address);

  update public.profiles set onboarding_completed = true, updated_at = now() where id = v_user_id;

  return v_shop_id;
end;
$$;
```

**`current_shop_id()`** — helper for RLS.
```sql
create or replace function public.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.shops where owner_user_id = auth.uid() limit 1;
$$;
```

**`expire_subscriptions()`** — daily cron.
```sql
create or replace function public.expire_subscriptions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set status = 'expired', updated_at = now()
  where (status = 'trial' and trial_ends_at < now())
     or (status = 'active' and current_period_ends_at < now());
end;
$$;

-- Schedule daily at 00:05 server time
select cron.schedule('expire-subscriptions', '5 0 * * *', $$ select public.expire_subscriptions(); $$);
```

**`subscription_effective` view**
```sql
create or replace view public.subscription_effective as
select
  s.user_id,
  case
    when s.status in ('expired','suspended') then s.status
    when s.status = 'trial' and now() > s.trial_ends_at then 'expired'::subscription_status
    when s.status = 'active' and now() > s.current_period_ends_at then 'expired'::subscription_status
    else s.status
  end as effective_status,
  s.trial_ends_at,
  s.current_period_ends_at,
  s.last_payment_date
from public.subscriptions s;
```

### Indexes
```sql
create index on public.products (shop_id) where is_active;
create index on public.customers (shop_id);
create index on public.invoices (shop_id, created_at desc);
create index on public.sale_items (invoice_id);
create index on public.ledger_entries (shop_id, customer_id);
create index on public.purchases (shop_id, purchase_date desc);
create index on public.expenses (shop_id, expense_date desc);
create index on public.monthly_targets (shop_id, month);
```

---

## 11. Row Level Security (RLS) Policies

Enable RLS on every table:
```sql
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_owner_details enable row level security;
alter table public.subscriptions enable row level security;
-- ...same for products, customers, invoices, sale_items, ledger_entries,
-- purchases, purchase_items, expenses, monthly_targets
```

### Policy patterns

**`profiles`** — owner reads/updates own row.
```sql
create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
```

**`shops`** — owner reads/updates own shop. Insert handled by `complete_onboarding` (security definer), so direct insert is denied.
```sql
create policy "shops_owner_read" on public.shops
  for select using (owner_user_id = auth.uid());
create policy "shops_owner_update" on public.shops
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
```

**`shop_owner_details`** — same pattern, joined through shop.
```sql
create policy "owner_details_read" on public.shop_owner_details
  for select using (shop_id = public.current_shop_id());
create policy "owner_details_update" on public.shop_owner_details
  for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
```

**`subscriptions`** — read-only for the user. Updates only via service role (admin / cron).
```sql
create policy "subscriptions_self_read" on public.subscriptions
  for select using (user_id = auth.uid());
-- No insert/update/delete policy → blocked for end users.
```

**Domain tables (`products`, `customers`, `invoices`, etc.)** — all CRUD scoped to the user's shop.
```sql
create policy "products_shop_read" on public.products
  for select using (shop_id = public.current_shop_id());
create policy "products_shop_write" on public.products
  for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
-- Repeat the same pair for every shop-scoped table.
```

> **Subscription enforcement:** The MVP enforces subscription status in the **client guard** (section 14) and on **manual admin actions only**. Don't enforce it inside RLS for v1 — it complicates SQL and slows reads. Phase 2 can add a `check_subscription_active()` function used in policies if abuse becomes an issue.

---

## 12. Routes & Page Map

| Path | Auth | Onboarding | Subscription | Page |
|---|---|---|---|---|
| `/login` | public | — | — | Login |
| `/signup` | public | — | — | Sign up |
| `/forgot-password` | public | — | — | Forgot password |
| `/reset-password` | public | — | — | Reset password (from email link) |
| `/verify-email` | public | — | — | Verify email notice |
| `/onboarding` | required | not done | any | Onboarding wizard |
| `/subscription/expired` | required | done | expired/suspended | Payment instructions |
| `/dashboard` | required | done | trial/active | Dashboard |
| `/pos` | required | done | trial/active | POS |
| `/products` | required | done | trial/active | Products list |
| `/products/new` `/products/:id` | required | done | trial/active | Product form |
| `/customers` | required | done | trial/active | Customers list |
| `/customers/:id` | required | done | trial/active | Customer detail + ledger |
| `/khata` | required | done | trial/active | Outstanding balances |
| `/purchases` | required | done | trial/active | Stock-in entries |
| `/purchases/new` | required | done | trial/active | New stock-in |
| `/expenses` | required | done | trial/active | Expenses list + add |
| `/targets` | required | done | trial/active | Monthly targets |
| `/reports` | required | done | trial/active | Reports hub |
| `/settings` | required | done | any | Profile + language |
| `/settings/support` | required | done | any | Payment / support info |
| `*` | — | — | — | 404 |

---

## 13. Component Architecture

### `<AppShell>` (authenticated layout)
- TopBar: shop name, language selector, user menu (settings, logout).
- Sidebar: nav links per route map.
- Main: `<DashboardBanner />` then `<Outlet />`.
- Sidebar/TopBar are **hidden** on `/onboarding` and `/subscription/expired`.

### `<DashboardBanner>` (section 7)
Pure component, takes a `BannerKind` enum and renders the highest-priority kind from a `useEffectiveSubscription()` hook.

### `<LanguageSelector>`
Dropdown with English / اردو. Calls `i18n.changeLanguage` and updates `profiles.preferred_language` if logged in.

### `<RequireAuth>`, `<RequireOnboarded>`, `<RequireActiveSubscription>`
Route guards composing on top of each other (section 14).

### Hooks
- `useSession()` → current Supabase session + user.
- `useProfile()` → React Query for `profiles` row.
- `useShop()` → React Query for `shops` row (uses `current_shop_id` indirectly).
- `useEffectiveSubscription()` → React Query reading `subscription_effective` view.
- `useDaysUntil(date)` → derived helper for banners.

---

## 14. Access Gating Middleware

Compose three guards in the router. Each one reads from React Query (cached) and falls back to a loading splash if data is in flight.

```tsx
// Pseudocode
function RequireAuth({ children }) {
  const { session, isLoading } = useSession();
  if (isLoading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function RequireOnboarded({ children }) {
  const { data: profile, isLoading } = useProfile();
  if (isLoading) return <FullPageSpinner />;
  if (!profile?.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return children;
}

function RequireActiveSubscription({ children }) {
  const { data: sub, isLoading } = useEffectiveSubscription();
  if (isLoading) return <FullPageSpinner />;
  if (!sub || sub.effective_status === 'expired' || sub.effective_status === 'suspended') {
    return <Navigate to="/subscription/expired" replace />;
  }
  return children;
}

// Composition
<Route element={<RequireAuth><AppShell /></RequireAuth>}>
  <Route path="/onboarding" element={<Onboarding />} />
  <Route path="/subscription/expired" element={<SubscriptionExpired />} />
  <Route element={<RequireOnboarded><RequireActiveSubscription><Outlet /></RequireActiveSubscription></RequireOnboarded>}>
    <Route path="/dashboard" element={<Dashboard />} />
    {/* ... rest of authenticated routes ... */}
  </Route>
</Route>
```

> **Inverse guards:** `/onboarding` should *redirect to /dashboard* if `onboarding_completed === true`. Same for `/subscription/expired` if subscription is `trial` or `active`. Implement this with a small `<RedirectIf>` helper.

---

## 15. Supabase MCP Usage by Claude Code

Claude Code will be connected to Supabase via the **Supabase MCP server**. Use it for the following operations (do **not** bypass MCP and write SQL by hand in the dashboard for tracked artifacts):

1. **Project bootstrap** — confirm project URL, anon key, service role key. Store the first two in the frontend `.env`; never expose the service role key to the client.
2. **Schema migrations** — author every migration as a SQL file in `supabase/migrations/<timestamp>_<name>.sql`. Apply via MCP. The schema in section 10 should be split across migrations roughly as:
   - `0001_extensions.sql` (`pgcrypto`, `pg_cron`)
   - `0002_profiles_and_subscriptions.sql`
   - `0003_shops_and_owner.sql`
   - `0004_domain_tables.sql`
   - `0005_functions_triggers.sql`
   - `0006_views.sql`
   - `0007_rls_policies.sql`
   - `0008_cron.sql`
3. **Seed data** — for development only. Create a `supabase/seed.sql` with a couple of fake products and customers for one test shop.
4. **Auth configuration** — set Site URL, redirect URLs, and email templates (English + Urdu copy) in the Auth settings via MCP if supported, else document the values to set manually.
5. **Type generation** — run Supabase's TypeScript type generation against the live schema and commit `src/types/database.ts`. Re-run on every migration.
6. **Manual subscription updates** — admin (you) updates rows in `subscriptions` via SQL editor or a small admin script. Document the exact SQL snippet:
```sql
update public.subscriptions
set status = 'active',
    current_period_starts_at = now(),
    current_period_ends_at = now() + interval '1 month',
    last_payment_date = current_date,
    last_payment_amount = <amount>,
    notes = '<reference>',
    updated_at = now()
where user_id = '<uuid>';
```

---

## 16. Build Phases (10-Week Plan)

Each phase ends with a working, deployable build.

### Week 1 — Foundation
- Vite + React + TS scaffold, Tailwind, ESLint/Prettier.
- Supabase project created via MCP.
- Migrations 0001–0002 applied (`profiles`, `subscriptions`, `handle_new_user` trigger).
- AuthProvider, supabase client, basic `<RequireAuth>`.
- i18n initialized with EN + UR skeleton, language selector working on a test page.
- Login + Signup + Forgot/Reset Password screens (no onboarding yet).
- CI/CD to Vercel.
**Deliverable:** A user can sign up, verify email, log in, and see a placeholder home page in either language.

### Week 2 — Onboarding + Subscription scaffolding
- Migrations 0003 (`shops`, `shop_owner_details`) + 0005 (`complete_onboarding`).
- Onboarding wizard (2 steps) with Zod validation, fully translated.
- `<RequireOnboarded>` guard.
- Migration 0006–0008 (`subscription_effective` view, RLS, cron).
- `<RequireActiveSubscription>` guard.
- `/subscription/expired` page with payment instructions from env.
- `<DashboardBanner />` with all 6 banner kinds, hooked to `useEffectiveSubscription`.
**Deliverable:** Full account-lifecycle flow works end-to-end. Manual admin activation tested.

### Week 3–4 — POS + Inventory
- Migration 0004 (domain tables + RLS).
- Products CRUD + search.
- Stock-in (purchases) entry.
- POS: search, cart, qty adjust, service charge, complete sale (cash or credit).
- Stock auto-deduction inside a Postgres function for atomicity (`record_sale(...)`).
**Deliverable:** Complete sale flow + stock-in flow.

### Week 5 — Khata
- Customers CRUD.
- Credit sale → ledger debit (linked to originating sale).
- Receive payment → ledger credit (customer-level only; **no** per-sale linking — see §9 design principle).
- Customer detail screen: full history, running balance, reverse-entry action.
- Khata list with Open / Closed / All filter and fuzzy search.
**Deliverable:** Khata fully functional with translations.

### Week 6 — Targets + Expenses
- Monthly targets form + dashboard widget.
- Expenses CRUD with category dropdown.
- Profit summary on dashboard (gross, net).
**Deliverable:** Owner can see targets vs achieved + expenses + net profit.

### Week 7 — Subscription polish + Reports
- All banner copy reviewed in both languages.
- Subscription state edge cases (expired during session) handled gracefully — show banner *and* redirect on next route change.
- Reports: daily sales, outstanding balances, monthly expenses, gross/net profit.
**Deliverable:** Reports + subscription/banner UX hardened.

### Week 8 — Polish, RTL, performance
- Full RTL audit of every screen.
- Mobile/tablet responsiveness.
- Loading + empty + error states everywhere.
- React Query refetch tuning.
- Lighthouse pass: performance ≥ 80, a11y ≥ 90.
**Deliverable:** Production-quality build.

### Week 9 — End-to-end testing + seed
- Critical-path tests with Vitest + RTL or Playwright.
- Seed real product catalog with the pilot shop owner.
- Train shop owner (target: < 30 minutes to self-sufficiency).
**Deliverable:** Pilot shop trained and seeded.

### Week 10 — Beta launch + feedback
- Shop owner uses system for real transactions daily.
- Daily feedback review.
- Top 3 issues triaged into hotfix vs Phase 2.
**Deliverable:** Live system with first week of real-usage data.

---

## 17. Acceptance Criteria

The MVP is complete when **all** of the following are true:

### Account lifecycle
- [ ] A new user can sign up, verify email, and log in.
- [ ] After first login, the user is forced into the onboarding wizard and cannot navigate elsewhere until it is complete.
- [ ] Submitting the wizard creates a `shops` row, a `shop_owner_details` row, and flips `profiles.onboarding_completed` to true atomically.
- [ ] The user is automatically given a 30-day trial subscription on signup.
- [ ] When the trial expires, the user is locked out of all routes except `/subscription/expired` and `/settings/support`, and `/login`/`/logout`.
- [ ] An admin can manually flip a user's subscription to `active` via SQL and the user regains full access on next page load.
- [ ] When a user's `active` period ends, they are again locked out.

### Banners & notifications
- [ ] Trial info banner appears at 4–7 days remaining; warning at ≤ 3 days; error after expiry.
- [ ] Active-subscription renewal reminder appears 6–10 days before renewal; warning at ≤ 5 days.
- [ ] `error` and `warning` banners cannot be dismissed; `info` banners can be dismissed for the day.

### Internationalization
- [ ] Every user-facing string in the app is loaded from the i18n bundle — no hard-coded strings remain (verified by a lint rule or manual audit).
- [ ] Switching to Urdu flips `dir="rtl"` and mirrors all layouts correctly.
- [ ] Language preference persists across sessions and is synced to `profiles.preferred_language` for logged-in users.
- [ ] Numbers and dates render in locale-appropriate format (PKR currency in both, Urdu numerals when locale is `ur-PK`).

### Domain features
- [ ] A cash or credit sale completes from product search to invoice without errors and decrements stock.
- [ ] A stock-in purchase increases stock and snapshots cost.
- [ ] A credit sale posts a debit to the customer ledger and bumps `customers.outstanding_balance`.
- [ ] Receiving a payment posts a customer-level credit and reduces the running balance.
- [ ] `receive_payment` rejects amounts greater than the customer's outstanding balance with a friendly error (no entry created, balance unchanged).
- [ ] `ledger_entries` cannot be updated or deleted from the application; corrections happen via `reverse_ledger_entry`.
- [ ] `customer_balance_reconciliation` returns zero rows with `drift <> 0` after any sequence of sales, payments, and reversals.
- [ ] Monthly targets can be set; dashboard shows progress vs achieved.
- [ ] Expenses can be added; net profit reflects sales − cost − expenses for the current month.

### Quality
- [ ] All Supabase tables have RLS enabled and tested with a second user account (no cross-shop reads).
- [ ] Common actions complete in < 1s; reports in < 3s on a typical broadband connection.
- [ ] Mobile/tablet responsive — verified on iPad and a mid-range Android tablet viewport.

---

## 18. Out of Scope (Phase 2+)

| Feature | Reason | Earliest target |
|---|---|---|
| Payment gateway (Stripe, JazzCash, Easypaisa) | Manual reconciliation works for early customers; gateway integration is significant effort. | v2 |
| Commission / profit split (multi-user earnings) | Many edge cases; settle manually until v2. | v2 |
| Vendor / supplier management & purchase orders | Shops know suppliers; not blocking. | v2 |
| Role-based access (cashier, technician, accountant) | Single-owner is enough for MVP. | v2 |
| Barcode scanner integration | Keyboard/mouse covers MVP. | v2 |
| Returns / refunds | Touches stock + ledger; needs careful design. | v2 |
| Advanced reports + CSV/Excel export | Basic summaries enough for MVP. | v2 |
| Offline mode | Validate connectivity assumptions first. | v2 |
| Multi-shop per user | Schema already supports it; UI doesn't. | v2 |
| Realtime subscription status updates (no manual refresh) | Optional UX win, not required. | v2 |
| Push / SMS / WhatsApp notifications for renewal | Email + in-app banner is enough for MVP. | v2 |

---

## Appendix A — i18n key starter set

A non-exhaustive starter so Claude Code has a concrete shape to follow. Generate the rest as features are built.

```json
// locales/en/common.json
{
  "app_name": "Shop Manager",
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "back": "Back",
    "next": "Next",
    "logout": "Logout"
  },
  "language": {
    "english": "English",
    "urdu": "اردو"
  }
}
```

```json
// locales/en/onboarding.json
{
  "title": "Set up your shop",
  "subtitle": "We need a few details before you can start.",
  "step": {
    "shop": "Shop details",
    "owner": "Owner details"
  },
  "shop": {
    "name_label": "Shop name",
    "address_label": "Shop address",
    "phone_label": "Shop phone",
    "type_label": "Shop type (optional)"
  },
  "owner": {
    "name_label": "Owner name",
    "phone_label": "Owner phone",
    "cnic_label": "Owner CNIC (optional)",
    "address_label": "Owner address"
  },
  "errors": {
    "phone_invalid": "Enter a valid Pakistani phone number"
  }
}
```

```json
// locales/en/subscription.json
{
  "expired": {
    "title": "Your subscription has ended",
    "body": "To continue using Shop Manager, please complete your monthly payment using the details below and contact support.",
    "refresh": "Refresh status"
  },
  "banner": {
    "trial_reminder_one": "Your free trial ends in {{daysLeft}} day. View payment options.",
    "trial_reminder_other": "Your free trial ends in {{daysLeft}} days. View payment options.",
    "trial_ending_soon_one": "Your free trial ends in {{daysLeft}} day. Please pay to keep using the app.",
    "trial_ending_soon_other": "Your free trial ends in {{daysLeft}} days. Please pay to keep using the app.",
    "subscription_renewal_reminder": "Your subscription renews in {{daysLeft}} days.",
    "subscription_renewal_due": "Your subscription is due in {{daysLeft}} days. Renew to avoid interruption.",
    "subscription_expired": "Your subscription has expired. Pay now to restore access.",
    "subscription_suspended": "Your account is suspended. Contact support."
  }
}
```

The same keys must exist in `locales/ur/*.json` with Urdu translations.

---

## Appendix B — Manual admin runbook (your reference)

When a customer pays you offline:
1. Confirm the bank deposit / WhatsApp screenshot.
2. Find the user in Supabase Auth dashboard, copy their `user_id`.
3. Run the SQL snippet from section 15 with the right amount and reference.
4. Optionally message the customer in Urdu/English: "آپ کی ادائیگی کی تصدیق ہو گئی ہے۔" / "Your payment has been confirmed."

When you need to suspend a user (refund, abuse):
```sql
update public.subscriptions
set status = 'suspended', notes = '<reason>', updated_at = now()
where user_id = '<uuid>';
```

When a customer disputes their expiry date:
```sql
select user_id, status, trial_ends_at, current_period_ends_at, last_payment_date, notes
from public.subscriptions where user_id = '<uuid>';
```

---

*End of PRD.*
