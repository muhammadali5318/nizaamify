# 2026-05-13 — `receive_payment` daily cap applies to all non-owner callers

## Context

Phase B §B.2.4 + Phase B §B.5.1 lock: `receive_payment` is callable
by anyone with the `receive_payment` permission (salesperson preset
has it ✓ by default). To prevent fraud where a malicious cashier
records fake payments and pockets cash, a daily cap applies.

The cap value is `shops.salesperson_payment_cap_pkr` (default 10,000
PKR). The column name is retained from the role-based draft but the
rule under the permission model is broader: **the cap applies to ALL
non-owner callers**, not just the salesperson preset. A manager (or
any custom permission user) who is not the founding owner is also
subject.

## Decision

The wrapper of `receive_payment` (rewritten in 0076b):

1. Verifies `receive_payment` permission (already in 0076).
2. Reads `user_shop_access.is_owner` for the caller.
3. If `is_owner = true`: no cap; delegate to inner.
4. If `is_owner = false`:
   - Acquires `pg_advisory_xact_lock(hash(shop_id, user_id, current_date))`
     to serialize concurrent attempts.
   - Reads `shops.salesperson_payment_cap_pkr` (default 10,000).
   - Computes today's total = SUM(`ledger_entries.amount` WHERE
     `created_by_user_id = auth.uid()` AND `type = 'credit'` AND
     `created_at::date = current_date`).
   - If `today_total + p_amount > cap`: raise
     `salesperson_payment_cap_exceeded`.
5. Delegate to `receive_payment_v28` for the actual ledger insert.

The advisory lock (xact-scoped) closes the race where two concurrent
calls both pass the cap check before either inserts. The lock key is
derived from `(shop_id, user_id, current_date_int)` so contention is
bounded to a single user's same-day calls.

## Alternatives considered

1. **No serialization (race-condition tolerated).** Rejected — F-PD-02
   explicitly required closure. Two concurrent under-cap calls could
   together exceed the cap.
2. **Optimistic concurrency via SELECT FOR UPDATE on a daily totals
   table.** Considered. Would require a new `daily_payment_totals`
   table maintained by trigger. More moving parts than an advisory
   lock; rejected for v2.9.
3. **Cap applied only to `salesperson` preset users.** Rev 1's
   implication. Rejected because the preset is a starting template,
   not a permanent role tag. A user whose preset was once
   salesperson but later customized to manager-like permissions
   would slip past the cap. Applying to all non-owners is
   permission-model-consistent.
4. **Rename column to `non_owner_payment_cap_pkr`** (F-PD-05).
   Deferred to v2.10. Backward-compat is preserved; the column name
   is internal-only.

## Consequences

- The cap is enforced in the WRAPPER before delegation. Owner bypass
  via the `is_owner` shortcut.
- Phase D §C.4 F-PD-02 (concurrent-cap-check serialization) is
  closed via pg_advisory_xact_lock.
- Audit query AQ-08 (Phase C §C.3) continues to verify zero cap
  exceedances across historical data.
- The error raised on cap-exceed is `salesperson_payment_cap_exceeded`
  for backward-compatibility with Phase B §B.5.1 and Phase C §C.2
  test cases. Renaming to `non_owner_payment_cap_exceeded` deferred
  to v2.10 alongside the column rename (F-PD-05).

Related: [[2026-05-13-rbac-discount-limits-on-user-shop-access]]
(planned, not yet filed), [[2026-05-13-rbac-permission-model-over-roles]].
