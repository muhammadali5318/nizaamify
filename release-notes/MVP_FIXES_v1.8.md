# MVP Hardening — v1.8 (Database Audit & Critical Fixes)

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline) and v1.3–v1.7 fix specs.
**Stack:** unchanged — React + Supabase (via Supabase MCP) + react-i18next.

> **Mission:** treat this database like a fintech system with **zero fault tolerance**. Every dollar/PKR that flows through it must be auditable, atomic, race-safe, and recoverable. First, fix every issue the Supabase advisor dashboard is currently flagging. Then conduct a full architect-level schema review and fix what you find. Move methodically. Investigate before changing.

---

## 0. How to work this ticket

This is a **discovery-first** ticket more than any previous one. You're not implementing new features — you're fixing latent issues. **Do not write any migration until Phase A is complete and reviewed.**

### Phase A — Discovery

1. **Pull every Supabase advisor warning via MCP.** Use the Supabase MCP server's advisor/lints capability. Categorize by:
   - **Security** advisors (RLS gaps, function search_path, exposed views, etc.)
   - **Performance** advisors (missing indexes, slow query plans, RLS init plan, etc.)
   - **General** lints (missing primary keys, multiple permissive policies, etc.)
   For each one, capture: title, severity, table/function affected, remediation hint.

2. **Run the architect-audit query set** in §3. Each query surfaces a specific class of issue. Capture the output of every one.

3. **Read the live schema end-to-end via MCP.** Don't trust migration files. Specifically:
   - Every table's columns, types, defaults, constraints, indexes.
   - Every function body and security context.
   - Every trigger.
   - Every RLS policy (USING and WITH CHECK clauses).
   - The `auth` configuration (leaked password protection, MFA settings — surfaced via the advisor or the Supabase dashboard).

4. **Build a triage table in chat** before writing any fix. Schema:
   | # | Severity | Source | Title | Affected | Fix sketch | Risk if unfixed |

   Sort S0 → S3 (severity scale in §2). **Stop here and post the table.** Do not move to Phase B until the user has confirmed priorities.

### Phase B — Migration design

Every fix lands in a single migration: `00XX_v18_db_hardening.sql`. Group fixes into logical sub-sections within the file. Idempotent everywhere (`if not exists`, `if exists`). Apply via Supabase MCP.

### Phase C — Apply

Apply migration. Regenerate `src/types/database.ts`. Re-run the architect-audit queries from §3 to confirm each issue is resolved.

### Phase D — Frontend verification

Quickly sanity-check that no app behavior changed: every flow from `PRD.md` §6 still passes. **No frontend changes expected** for most of these fixes — they're DB-internal. Where a fix changes a function signature, update the caller and report it.

### Phase E — Post-mortem report

Write a short report in chat: what was broken, what was fixed, what's still deferred (and why), and what runbooks the user now has for ongoing health.

---

## 1. The fintech-grade lens

The product handles real money. The shop owner's livelihood depends on the integrity of this database. Apply the following standards everywhere:

| Principle | What it means here |
|---|---|
| **Atomicity** | Every multi-row financial operation lives inside a Postgres function with proper transaction semantics. Frontend never composes multi-step writes. |
| **Concurrency safety** | Stock decrements, payment posts, balance updates are protected by `FOR UPDATE` locks. Two cashiers acting on the same row at the same instant produce a deterministic result, never a race. |
| **Audit immutability** | Financial events (sales, ledger entries) are append-only at the database level — not just by convention. |
| **Defense in depth** | Validation lives at three layers: client UX, RPC function body, and database constraints. Removing any one layer doesn't open a hole. |
| **Authority of constraints** | If a column has business-rule semantics (amount > 0, payment_type ∈ {cash, credit, partial}), encode it as a CHECK or FK or unique constraint. Don't rely on app code. |
| **Recovery posture** | The user can restore to any point in the last 30 days. Free tier doesn't grant this — flag explicitly so the user moves to Pro before scaling. |
| **Tenant isolation** | RLS leaves zero gaps. Every table that holds shop data has RLS enabled with both USING and WITH CHECK clauses where applicable. |
| **Money precision** | All money is `numeric(12,2)`. No `float`, no `double precision`, no `real`. No silent rounding via implicit casts. |
| **Time correctness** | All timestamps are `timestamptz`. Never bare `timestamp`. Business event time (`occurred_at`) and audit time (`created_at`) are distinct fields where they differ. |

---

## 2. Severity scale

| Tag | Meaning | Examples |
|---|---|---|
| **S0** — Critical | Direct path to data corruption, money loss, or cross-shop leak. Fix immediately. | RLS disabled on `invoices`. SECURITY DEFINER function without `search_path`. Missing `FOR UPDATE` on stock decrement. Money column stored as `float`. |
| **S1** — High | Likely-soon production issue: performance cliff at scale, audit gap, or hardening hole. | Foreign key without index. `auth.uid()` called per-row in RLS. Append-only trigger missing on `ledger_entries`. Missing CHECK constraint on amount. |
| **S2** — Medium | Latent risk that's not biting today but will. | Multiple permissive policies for same role. Extensions in `public` schema. Inconsistent default values across similar columns. Soft-delete column missing on a financial record table. |
| **S3** — Low | Hygiene / maintainability. | Inconsistent column naming. Missing column comments. Index naming convention drift. |

S0 and S1 are **must-fix this round**. S2 fix where cheap, defer otherwise. S3 document but don't fix.

---

## 3. Architect-audit queries

Run each of these via MCP and capture the output. Each one surfaces a specific class of issue.

### 3.1 Tables without RLS enabled (S0 if found)

```sql
select schemaname, tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
  and not rowsecurity;
```

Expected: zero rows. Any row is S0.

### 3.2 Tables with RLS but no policies (S0 if found)

A table with RLS enabled but no policies blocks all access — including legitimate access. Or, depending on how it was set up, it may permit unintended access. Either way, audit:

```sql
select t.schemaname, t.tablename
from pg_tables t
where t.schemaname = 'public'
  and t.rowsecurity
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = t.schemaname and p.tablename = t.tablename
  );
```

### 3.3 SECURITY DEFINER functions without `search_path` (S0)

A `SECURITY DEFINER` function without an explicit `search_path` is a known privilege-escalation risk — a malicious schema in the user's path can hijack `public.foo()` calls.

```sql
select n.nspname as schema, p.proname as function,
       p.prosecdef as is_security_definer,
       p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (p.proconfig is null
       or not exists (
         select 1 from unnest(p.proconfig) c where c like 'search_path=%'
       ));
```

Every function listed needs `set search_path = public` (or `pg_catalog, public`) added. Recreate as:

```sql
create or replace function public.fn_name(...)
returns ...
language plpgsql
security definer
set search_path = public  -- THIS LINE
as $$ ... $$;
```

### 3.4 Foreign keys without indexes (S1)

Unindexed FKs cause two problems: slow joins, and slow `ON DELETE CASCADE` operations (Postgres has to seq-scan the child table).

```sql
select
  conrelid::regclass as table_name,
  a.attname as column_name,
  c.conname as constraint_name
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
where c.contype = 'f'
  and c.connamespace = 'public'::regnamespace
  and not exists (
    select 1
    from pg_index i
    where i.indrelid = c.conrelid
      and a.attnum = i.indkey[0]    -- column must be the LEADING column of the index
  )
order by conrelid::regclass::text, a.attnum;
```

Each row needs `create index if not exists idx_<table>_<col> on public.<table>(<col>);`.

### 3.5 Money columns not using `numeric` (S0 if found)

```sql
select table_name, column_name, data_type, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public'
  and (column_name ~* 'price|cost|amount|total|balance|charge|paid|credit|debit')
  and data_type not in ('numeric', 'integer', 'bigint');
```

Expected: zero rows. `float`/`double precision`/`real` for money is a critical bug — they cause silent rounding (e.g., `0.1 + 0.2 = 0.30000000000000004`). `numeric(12,2)` is the standard.

### 3.6 Money columns missing precision/scale (S1)

```sql
select table_name, column_name, data_type, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public'
  and data_type = 'numeric'
  and (numeric_precision is null or numeric_scale is null);
```

Bare `numeric` (no precision) is unbounded and unpredictable. Should be `numeric(12,2)` for money.

### 3.7 Money columns without `>= 0` CHECK (S1)

For a small-shop POS, all money is non-negative — there are no debit-side accounts that should hold negative balances (we use a separate ledger entry type for that). Any negative value is a bug.

```sql
-- Manual review: for each money column, confirm a CHECK exists
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as def
from pg_constraint
where contype = 'c'
  and connamespace = 'public'::regnamespace;
```

Cross-reference output with the money column list from §3.5. Each money column should have a `>= 0` (or `> 0` for amounts) check.

### 3.8 Timestamps that are `timestamp` instead of `timestamptz` (S1)

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and data_type = 'timestamp without time zone';
```

Expected: zero rows. All timestamps must be `timestamptz`. Bare `timestamp` is interpreted in the server's local timezone, which causes silent drift and hard-to-debug "off by 5 hours" bugs.

### 3.9 Policies calling `auth.uid()` directly instead of `(select auth.uid())` (S1)

Postgres can't cache `auth.uid()` per query when called directly inside a USING/WITH CHECK clause — it re-evaluates per row. Wrapping in `(select auth.uid())` lets the planner cache it. This is the **single biggest RLS performance issue at scale** and is one of the most common Supabase advisor warnings.

```sql
select schemaname, tablename, policyname,
       qual as using_clause, with_check
from pg_policies
where schemaname = 'public'
  and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  and (qual not like '%(select auth.uid())%' and with_check not like '%(select auth.uid())%');
```

For each match, recreate the policy substituting `auth.uid()` with `(select auth.uid())`. Same applies to `auth.role()` and `auth.jwt()`.

### 3.10 Multiple permissive policies for the same role/action (S2)

```sql
select schemaname, tablename, cmd, roles, count(*) as policy_count
from pg_policies
where schemaname = 'public' and permissive = 'PERMISSIVE'
group by schemaname, tablename, cmd, roles
having count(*) > 1;
```

Multiple permissive policies are OR'd together — every one is evaluated for every row. Slow at scale. Consolidate into one per (table, action, role).

### 3.11 Indexes that are unused (S3)

```sql
select schemaname, relname as table, indexrelname as index,
       idx_scan, idx_tup_read
from pg_stat_user_indexes
where schemaname = 'public'
  and idx_scan = 0
order by relname, indexrelname;
```

Indexes that have never been scanned cost write performance and storage but contribute nothing. **Don't drop unused trigram or unique indexes** — they're correctness-critical or speculative for new search features. Drop only btree indexes that duplicate another.

### 3.12 Tables without primary keys (S0 if found)

```sql
select t.table_schema, t.table_name
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema = t.table_schema
      and tc.table_name = t.table_name
      and tc.constraint_type = 'PRIMARY KEY'
  );
```

Expected: zero rows.

### 3.13 Extensions installed in `public` (S2)

```sql
select extname, extnamespace::regnamespace as schema
from pg_extension
where extnamespace::regnamespace::text = 'public';
```

Extensions like `pg_trgm` should live in a dedicated `extensions` schema, not `public`. Moving them is a one-liner per extension and prevents naming conflicts.

### 3.14 Append-only enforcement on `ledger_entries` (S0)

v1.6 specified this. Verify the trigger exists and fires on UPDATE and DELETE.

```sql
select tgname, pg_get_triggerdef(oid) as def
from pg_trigger
where tgrelid = 'public.ledger_entries'::regclass
  and not tgisinternal;
```

If no trigger blocks UPDATE/DELETE, that's S0 — financial records can be silently rewritten.

### 3.15 Stored balance vs replay (S0 if drift)

```sql
select count(*) as drift_count
from public.customer_balance_reconciliation
where drift <> 0;
```

Expected: 0. Any drift means the trigger from v1.6 has missed events at some point. Investigate before "fixing" by resyncing.

### 3.16 Locking patterns in financial functions

Read the bodies of `record_sale`, `record_purchase`, `receive_payment`, `reverse_ledger_entry` via MCP. Confirm:

- Stock reads inside `record_sale` use `for update` on the products row.
- Customer balance reads inside `receive_payment` use `for update` on the customer row.
- All multi-row writes happen inside the function (no client-side composition of `INSERT` + `UPDATE`).

Any function missing `for update` where it touches stock or balances → S0.

### 3.17 Auth security settings (S1)

Check via the Supabase dashboard or MCP:

- **Leaked password protection** — should be **enabled**. Free tier supports it. Uses HaveIBeenPwned to reject known-breached passwords on signup/reset.
- **Minimum password length** — at least 8.
- **Email confirmation required** — should be **enabled** so signup flow goes through verification.
- **MFA** — for v1.8, do not enforce on shopkeepers (friction), but the option to enable later should be documented.

### 3.18 Storage bucket policies (if storage is used)

We don't think the MVP uses Supabase Storage based on PRD §2 — confirm via MCP. If buckets exist, ensure each has explicit public/private setting and policies. An open bucket is a data leak.

---

## 4. Common fix recipes

### 4.1 RLS gap — table missing policies

```sql
alter table public.<table> enable row level security;

create policy "<table>_shop_read" on public.<table>
  for select using (shop_id = (select public.current_shop_id()));

create policy "<table>_shop_write" on public.<table>
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));
```

Note `(select public.current_shop_id())` — wrapping in `select` lets Postgres cache the result per query, same trick as `auth.uid()`.

### 4.2 Function `search_path` fix

```sql
create or replace function public.<fn>(...)
returns ...
language plpgsql
security definer
set search_path = public  -- ADD THIS
as $$ ... $$;
```

Recreate every flagged function. **Use `create or replace`** so dependencies (triggers, views) survive. Verify by re-running §3.3 query.

### 4.3 Foreign key without index

```sql
create index if not exists idx_<table>_<column>
  on public.<table> (<column>);
```

For composite usage patterns (e.g., `(shop_id, customer_id)` always queried together), use a composite index instead of separate single-column ones.

### 4.4 `auth.uid()` per-row → cached

Find the policy:
```sql
select schemaname, tablename, policyname, qual, with_check
from pg_policies
where qual like '%auth.uid()%' and qual not like '%(select auth.uid())%';
```

Recreate it with the wrapped form:
```sql
drop policy "<name>" on public.<table>;
create policy "<name>" on public.<table>
  for <action>
  using (<column> = (select auth.uid()))
  with check (<column> = (select auth.uid()));
```

### 4.5 Missing CHECK constraint on a money column

```sql
alter table public.<table>
  add constraint <table>_<col>_non_negative check (<col> >= 0);
```

If existing rows violate, the ALTER will fail. First find them:
```sql
select id, <col> from public.<table> where <col> < 0;
```
Decide with the user whether to correct, archive, or skip. Don't silently zero them.

### 4.6 Append-only trigger on a financial table

Pattern from v1.6:
```sql
create or replace function public.<table>_immutable()
returns trigger language plpgsql as $$
begin
  raise exception '<table> are append-only — record a corrective entry instead'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists <table>_no_modify on public.<table>;
create trigger <table>_no_modify
  before update or delete on public.<table>
  for each row execute function public.<table>_immutable();
```

Apply to: `ledger_entries` (already from v1.6, verify), `invoices` (likely should be), `sale_items` (definitely should be). **Do not** apply to mutable rows like `products.stock` — that updates legitimately.

### 4.7 `FOR UPDATE` lock added to a financial function

When fixing a function missing locks:
```sql
-- Before:
select avg_cost into v_cost from public.products where id = p_id;

-- After:
select avg_cost into v_cost from public.products where id = p_id for update;
```

Lock the parent row that's about to be mutated. Lock order matters — always lock products before customers in `record_sale`, customers before invoices in `receive_payment`. Document the lock order in a comment to prevent deadlocks.

### 4.8 Move extensions out of `public`

```sql
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

-- Update grants so functions in public can still use it
grant usage on schema extensions to postgres, anon, authenticated, service_role;
```

The `%` and `similarity()` operators may need explicit qualification if calls break — adjust on a per-function basis if the migration surfaces issues.

### 4.9 `timestamp` → `timestamptz` migration

```sql
alter table public.<table>
  alter column <col> type timestamptz using <col> at time zone 'UTC';
```

Pick a timezone consistent with how the data was originally written. For a fresh app it's almost always UTC; for legacy data it might be the server's old timezone. Verify with the user before running.

---

## 5. Architect review — beyond the linter

The advisor and the audit queries catch the obvious. These are the things that need a human (Claude in this case, with care) to spot. Walk each one explicitly and report what you find.

### 5.1 Atomicity completeness

For every mutation flow, confirm there's no client-composed multi-step write:

- Sale: client sends 1 RPC, function does invoice + items + stock + ledger atomically.
- Purchase: client sends 1 RPC, function does purchase + items + stock + avg_cost atomically.
- Receive payment: 1 RPC, function does balance check + ledger insert + balance update (via trigger).
- Reverse entry: 1 RPC.
- Onboarding: 1 RPC.
- Create product: 1 RPC (with optional opening stock).

Anywhere the client does `await insertA(); await insertB();` is a transactional bug. Find and fix.

### 5.2 Audit trail completeness

For each financial event type, verify there's a row that records:
- **What** happened (sale, purchase, payment, reversal)
- **When** (`occurred_at` if business time differs from row creation time)
- **Who** triggered it (`cashier_id` / `created_by` linked to `auth.users`)
- **What it touched** (FK back to the affected entity)
- **Cannot be deleted or edited** (immutable)

Tables this applies to:
- `invoices` — must record cashier, immutable after insert.
- `sale_items` — immutable.
- `ledger_entries` — immutable, append-only, reversed via separate entry (already from v1.6).
- `purchases` — must record cashier, immutable.
- `purchase_items` — immutable.

Anywhere `cashier_id` / `created_by` is nullable on a financial table, that's a gap — make it `not null`.

### 5.3 Constraint coverage

For each business invariant, ask: "is this enforced by a constraint, or only by app code?" If only app code, file it.

Examples to check:
- `invoices.amount_paid <= invoices.total` — should be a CHECK (v1.4 spec).
- `sale_items.qty > 0` — CHECK.
- `sale_items.price_at_sale >= 0` — CHECK.
- `ledger_entries.amount > 0` — CHECK (v1.6).
- `ledger_entries.type in ('debit', 'credit')` — CHECK or enum.
- `subscriptions.trial_ends_at > trial_started_at` when both set — CHECK.
- `customers.phone` matches PK phone format — CHECK using regex (or accept that app-side validation is sufficient).
- `products.stock >= 0` — CHECK (PRD baseline).
- `products.avg_cost >= 0` — CHECK (v1.3).

For every gap: add the constraint. If existing rows would violate, surface them first.

### 5.4 RLS correctness audit

For each table, walk the policies and ask:

1. Is RLS enabled? (Should be on every public table.)
2. Are there policies for SELECT, INSERT, UPDATE, DELETE separately, or one `for all`?
3. Do USING clauses use `(select auth.uid())` and `(select current_shop_id())`?
4. Do INSERT/UPDATE policies have a WITH CHECK clause? (Important — without it, INSERT/UPDATE policies don't validate the new row.)
5. Is there at least one policy per action that an authenticated user needs to perform?
6. Are there any policies for `anon` role that shouldn't be there?

Common gap: a policy using `for select` only is fine for read-only tables, but for `customers` (write-needed), if there's only `for select`, all writes are blocked. Verify the v1.4–v1.5 customer flows still work after auditing.

### 5.5 Concurrency hot paths

Map the contention points and verify each is locked:

| Hot path | Contention | Lock |
|---|---|---|
| Two cashiers selling the same product | `products.stock` | `select ... for update` in `record_sale` |
| Two cashiers receiving payment from same customer | `customers.outstanding_balance` | `select ... for update` in `receive_payment` |
| Two simultaneous reversals of same entry | `ledger_entries.id` | Unique index on `reverses_entry_id` (already v1.6) |
| Trial countdown trigger racing user requests | `subscriptions` | Function update is single-row, no contention |

If any function reads a row it's about to mutate without `for update`, that's S0.

### 5.6 Money precision review

Walk every money column. Confirm:
- All `numeric(12,2)`. None bare. None float.
- All have `>= 0` checks where appropriate.
- All sums and aggregations use the same precision (Postgres preserves precision, but explicit casts in functions can lose it — review each function).
- Currency is implicit PKR everywhere, single-currency. Confirm no column has currency code attached.

> **Future-watch:** if multi-currency is ever in scope, every money row needs an explicit currency code. Don't add it now (YAGNI), but the column convention should be documented as "single-currency PKR until further notice."

### 5.7 PII review (light pass)

The system stores customer names, phones, addresses. For an MVP serving a single shop's owner, this is fine. Document for future awareness:
- A "delete customer" feature should hard-delete personal fields and replace with placeholders, leaving the financial trail.
- Phone numbers in plain text are acceptable for now; encryption-at-rest is handled by Supabase.
- No CNIC of customers is stored. CNIC of *owners* is stored (v1.2 onboarding) — that's PII that probably should not be required (already optional, good).

### 5.8 Disaster recovery posture

Free tier: no backups. **This is the single biggest risk to the user's business.**

Document and recommend in the post-mortem:
1. Move to **Pro tier** before any real customer goes live (separate ticket — already discussed).
2. Until then, set up a **weekly `pg_dump` GitHub Action** as v1.9 candidate. ~30 minutes of work, saves the business.
3. Document the **migration rollback procedure** for the user. If a v1.X migration ever damages data, what's the recovery? (Currently: nothing. Pro tier with PITR is the answer.)

---

## 6. Implementation order

1. **Phase A discovery output** — triage table posted in chat. Wait for confirmation before moving on.
2. **S0 fixes first**, in order:
   - RLS gaps
   - Functions missing `search_path`
   - Append-only triggers missing on financial tables
   - Money columns not using `numeric`
   - `FOR UPDATE` locks missing on financial functions
   - Tables without primary keys (likely none, but check)
3. **S1 fixes**:
   - FK indexes
   - `auth.uid()` performance fix in policies
   - Money CHECK constraints
   - Bare `numeric` → `numeric(12,2)`
   - `timestamp` → `timestamptz`
   - Auth settings (leaked password protection, etc.)
4. **S2 fixes** if cheap:
   - Multiple permissive policies → consolidate
   - Extensions out of `public`
   - Soft-delete columns where missing
5. **S3 — document only**, do not fix.
6. **Re-run audit queries** in §3 — confirm zero S0/S1 remain.
7. **Run reconciliation**: `select count(*) from customer_balance_reconciliation where drift <> 0;` → must be 0.
8. **Manual smoke test**: every flow from PRD §6 + v1.3–v1.7 acceptance criteria. Nothing should regress.
9. **Post-mortem in chat** (§5.8): what was broken, what was fixed, what's deferred, runbooks the user now has.

---

## 7. Acceptance criteria

- [ ] Phase A discovery report posted in chat with full triage table; user confirmed priorities before fixes started.
- [ ] All Supabase advisor warnings of severity equivalent to S0/S1 are resolved or explicitly deferred (with reason in post-mortem).
- [ ] Re-running every query in §3 returns zero S0 results and zero S1 results (or has the expected zero/empty output).
- [ ] Every public table has RLS enabled and at least one matching policy per needed action.
- [ ] Every `SECURITY DEFINER` function has `set search_path = public`.
- [ ] Every foreign key column has a leading-column index.
- [ ] Every policy referencing `auth.uid()`, `auth.role()`, or `auth.jwt()` wraps the call in `(select ...)`.
- [ ] Every money column is `numeric(12,2)` with a non-negative CHECK.
- [ ] Every timestamp column is `timestamptz`.
- [ ] `ledger_entries`, `invoices`, `sale_items`, `purchases`, `purchase_items` all have append-only triggers.
- [ ] `record_sale`, `record_purchase`, `receive_payment`, `reverse_ledger_entry` all use `FOR UPDATE` on rows they mutate.
- [ ] `customer_balance_reconciliation` view returns zero drift rows.
- [ ] Auth: leaked password protection enabled, email confirmation required, minimum password length ≥ 8.
- [ ] Every flow from `PRD.md` §6 and v1.3–v1.7 acceptance criteria still passes.
- [ ] Post-mortem report posted in chat with: what was found, severity counts (S0/S1/S2/S3), what was fixed, what's deferred, runbooks (reconciliation query, weekly pg_dump procedure if free tier, recommendation to upgrade to Pro before scaling).

---

## 8. Out of scope for this round

- **Migration to Pro tier.** Recommended in the post-mortem; user decision.
- **Point-in-time recovery setup.** Pro feature.
- **Encryption-at-application-layer for PII.** Supabase handles encryption-at-rest; field-level encryption is a separate, larger design.
- **Materialized views for reports.** Performance optimization, not a hardening concern.
- **Sharding / partitioning.** Premature at MVP scale.
- **Custom audit log table.** The `created_at` + `cashier_id` pattern + append-only triggers cover the audit need. A separate `audit_log` table with WHO/WHAT/WHEN/IP-ADDR is a future concern when compliance demands it.
- **Test infrastructure.** Still skipped per user instruction. The audit queries in §3 are the verification surface.
- **Frontend changes.** Only when a function signature changed and the caller needs an update.

---

*End of v1.8 database hardening spec.*
