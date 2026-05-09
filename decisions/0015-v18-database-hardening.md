# 0015 — v1.8 database hardening

## Context

A discovery-first audit (see `MVP_FIXES_v1.8.md`) walked the live database against fintech-grade hardening principles: atomicity, concurrency safety, audit immutability, defense-in-depth, money precision, and tenant isolation. Most of the schema was already in good shape — all base-table money columns were `numeric(12,2)`, every public table had RLS plus a policy, every SECURITY DEFINER RPC had `set search_path`, and customer-balance reconciliation drift was zero. But the audit also found one true cross-tenant data leak plus a sizable hardening backlog (15 distinct findings across S0/S1/S2/S3).

The fix landed across two migrations:

- `0020_v18_db_hardening.sql` — sub-sections A–K covering all S0/S1/S2 plus the chosen S3 items.
- `0021_v18a_revoke_public_execute.sql` — fix-up after re-audit revealed `revoke … from anon` was a no-op while `PUBLIC` still held EXECUTE.

This ADR records the cross-cutting decisions that don't naturally live in any single migration comment.

## Decisions

### 1. Views with cross-tenant exposure must use `with (security_invoker = true)`

`customer_balance_reconciliation` and `ledger_entries_view` were created without `security_invoker=true`. They executed as the view owner (postgres) and bypassed RLS — every authenticated user could read every shop's customer balances and entire ledger including invoice notes. This was the single S0 cross-tenant leak.

Fixed by recreating both with `with (security_invoker = true)`. As a forward-looking rule: every view in `public` that touches shop-scoped data must declare `security_invoker=true`. The other reporting views (`customer_outstanding`, `daily_sales_today`, `monthly_summary`, `subscription_effective`) already had it.

### 2. Append-only enforcement extended to all financial tables

Pre-v1.8, only `ledger_entries` had an append-only trigger (from v1.6). v1.8 extended the same pattern to `invoices`, `sale_items`, `purchases`, `purchase_items` via a shared `financial_records_immutable()` trigger function. These tables are now strictly write-once at the database level; corrections must take the form of a fresh sale, purchase, or ledger reversal.

Trade-off accepted: editing an `invoices.notes` field after creation is no longer possible without designing a new corrective-entry mechanism. PRD never specified that as a flow, and the audit posture benefit is large — a cashier (or anyone with shop RLS) can no longer rewrite recorded sales.

### 3. `REVOKE … FROM anon` requires `REVOKE … FROM PUBLIC` first

PostgreSQL gotcha discovered during re-audit: functions ship with `EXECUTE` granted to `PUBLIC` by default. Revoking from `anon` directly is a no-op because anon inherits via `PUBLIC`. The advisor stayed lit until 0021 revoked from `PUBLIC` and re-granted explicitly to `authenticated`.

Standing rule for any future SECURITY DEFINER RPC:

```sql
revoke execute on function public.<fn>(<sig>) from public;
grant  execute on function public.<fn>(<sig>) to authenticated;
```

(Or `service_role` only if it should not be reachable by end-users.) Don't `revoke from anon` and assume it bites.

### 4. `pg_trgm` lives in `extensions` schema, not `public`

Moved per Supabase advisor `extension_in_public`. Operator class moved with the extension; existing trigram indexes auto-rebound. The four trigram-using SECURITY DEFINER RPCs (`search_products`, `search_products_count`, `search_khata_customers`, `search_khata_customers_count`) had their `search_path` updated to `public, extensions, pg_catalog` so the `%` operator, `similarity()`, and `set_limit()` calls still resolve.

Standing rule: any new extension installs into `extensions` (not `public`). Functions that use it set `search_path = public, extensions, pg_catalog`.

### 5. Trigger functions are not RPCs

`ledger_entries_update_balance`, `ledger_entries_immutable`, `financial_records_immutable`, `touch_updated_at`, `products_normalize_trigger`, `normalize_product_text`, `expire_subscriptions` had EXECUTE revoked from `public, anon, authenticated`. PostgreSQL's trigger system bypasses function-level EXECUTE checks, so triggers continue to fire. The revocation eliminates them as RPC surface.

### 6. Append-only CHECK constraints are zero-violation today

All seven new CHECK constraints (`customers_outstanding_non_negative`, `sale_items_price_non_negative`, `sale_items_cost_non_negative`, `purchase_items_cost_non_negative`, `subscriptions_payment_amount_non_negative`, `subscriptions_trial_window_valid`, `monthly_targets_*_non_negative`, `customers_phone_not_blank`) were verified zero-violation against current data before adding. RPCs already enforce these rules in app code; the constraints add a defense-in-depth layer that catches direct `service_role` writes and future migrations.

### 7. Computed view sums cast to `numeric(12,2)`

Bare `numeric` outputs in computed view columns surfaced as looser TypeScript types than the source columns warranted. Cast every computed money column to `numeric(12,2)` in `customer_balance_reconciliation`, `customer_outstanding`, `daily_sales_today`, `monthly_summary`. Required `drop view; create view` (Postgres rejects column-type changes via `create or replace view`).

### 8. Unused trigram + speculative-search indexes are kept, not dropped

The advisor flagged seven indexes as never-scanned: trigram indexes (`idx_*_trgm`), the speculative `idx_products_shop_name_active`, the unique guard `uq_ledger_entries_reverses`, low-traffic PKs, and the new FK indexes from this migration. Decision: do not drop. The trigram indexes back search functionality that's correctness-critical when invoked; the unique guard prevents a documented race in `reverse_ledger_entry`; PKs are trivially-correctness-critical. Drop only btree indexes that genuinely duplicate another, of which we have none.

## Alternatives considered

- **Soft-delete columns on financial tables instead of append-only triggers.** Rejected — bloats every read query with a `where deleted_at is null` filter, and a sufficiently-determined user could just NULL the soft-delete back. Append-only is stricter.
- **Switch every SECURITY DEFINER RPC to SECURITY INVOKER.** Rejected — `record_sale` etc. need to write to tables (`invoices`, `sale_items`, `products`) the cashier should not be able to write directly. SECURITY DEFINER is the only way to preserve "atomic write through one RPC, no direct table access" while keeping RLS otherwise restrictive. ADR-0011 already accepted this trade-off; v1.8 extends the same logic to the other RPCs.
- **Defer the pg_trgm move.** Rejected — cheap to fix, removes a permanent advisor warning, hardens against future naming conflicts.
- **Add a strict regex on `customers.phone`.** Rejected — too brittle for international and mixed local-format numbers. Settled on `length(trim(phone)) > 0` as a minimum guard.

## Consequences

- The cross-tenant view leak is closed. RLS is now the authoritative tenant boundary for every reachable surface.
- Financial records (invoices, items, purchases, ledger) are write-once at the DB level. Any future "edit invoice" feature requires designing a corrective-entry mechanism; PRD does not request one.
- `anon` cannot reach any RPC. Defense-in-depth — every RPC also bails on `auth.uid() is null` internally.
- Every FK column has a leading-column index — joins and `ON DELETE CASCADE` operations on `profiles`, `products`, etc. are no longer seq-scans.
- Money / time / non-negative invariants are encoded as constraints; they survive removal of any single layer of app-code validation.
- ADR-0011 still stands: the SECURITY DEFINER warnings for `record_sale`, `record_purchase`, `complete_onboarding` are accepted. v1.8 extends the same accepted-warning posture to the other RPCs (`receive_payment`, `reverse_ledger_entry`, `create_product_with_opening_stock`, `current_shop_id`, the four search RPCs, and the two list RPCs) — they are functionally equivalent: SECURITY DEFINER is required to read across customer/ledger/invoice tables in a single shop-scoped query.
- Auth-side `auth_leaked_password_protection` advisor remains until enabled in the Supabase dashboard. Email confirmation is also pending dashboard toggle. The migration cannot enable these.
- Free-tier disaster recovery posture is unchanged. Recommend Pro tier upgrade and/or a weekly `pg_dump` GitHub Action before any real customer goes live.

## Runbooks

- **Customer-balance reconciliation:** `select * from public.customer_balance_reconciliation where drift <> 0;` should always return zero rows. If non-zero, investigate before "fixing" by resyncing — it means the v1.6 trigger missed events.
- **Append-only correction:** to "edit" an `invoices` row, void via reversal (`reverse_ledger_entry` for ledger; new sale for invoice). Direct `UPDATE` raises `P0001 invoices are append-only`.
- **Adding a new SECURITY DEFINER RPC:** include `set search_path = public` (or `public, extensions, pg_catalog` if it uses pg_trgm), then immediately `revoke execute … from public; grant execute … to authenticated;`. Don't rely on `revoke from anon`.
- **Auth dashboard toggles:** enable HaveIBeenPwned check + email confirmation at https://supabase.com/dashboard/project/orfggrnyychmmqdlbfhf/auth/providers and /auth/policies. The advisor will clear once both flip on.
