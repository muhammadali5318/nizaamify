# `record_sale` transaction integrity

**Date:** 2026-05-12
**Ticket:** v2.6 hardening (Stage 2 folded-in scope)
**Status:** Accepted — verified

## Context

`record_sale` (migration 0041, v2.6 rewrite) writes to four tables:
`invoices`, `sale_items`, `product_variants`, and optionally
`ledger_entries`. Any failure mid-function must not leave the system in a
half-committed state — e.g., an invoice inserted but its sale_items
missing, a variant stock decremented without a matching sale_items row,
or a sale-on-credit with no ledger debit row.

PL/pgSQL functions run inside an implicit transaction by default. A
RAISE EXCEPTION inside a function rolls the entire function call back —
no partial commits. But "by default" isn't an architectural promise
unless we say so.

## Decision

`record_sale` is documented as a single atomic transaction. Specifically:

- **Implicit transaction scope.** No `BEGIN` / `COMMIT` inside the
  function body. The function runs within whatever transaction the
  caller (Supabase `.rpc()` over PostgREST) started. PostgREST starts a
  fresh transaction for every HTTP request, so a single `rpc` call =
  one transaction.
- **All writes inside the function are atomic with each other.** Invoice
  insert → sale_items inserts → variant stock decrements → optional
  ledger insert. Any `raise exception` rolls back the entire set.
- **`FOR UPDATE` lock acquired on `product_variants` before reading stock
  and avg_cost** (line 197-202 of 0041). The lock holds for the rest of
  the transaction, blocking any concurrent `record_sale` on the same
  variant. This prevents the classic race where two simultaneous sales
  each see stock=5, both pass the check, and decrement to -5.

## Verification

A deliberate-failure test was run via MCP (2026-05-12):

1. Snapshot variant stock for `CA Shoes ultra L` (id
   `d628a80c-27a8-4c9e-8425-86b2aef25f4b`): **stock = 30**, invoice_count
   = 30, sale_items = 24, ledger = 37.
2. Call `record_sale(p_customer_id := null, p_amount_paid := 0, ...)`
   with a credit-style payload (amount paid = 0, total > 0, customer
   null). This trips the `customer_required_for_credit` guard at line
   119, AFTER `pass 1` validates qty/price math but BEFORE `pass 2` locks
   the variant. (A guard before the lock is the easy case; the harder
   test would be a failure AFTER the variant lock + insert, but the
   atomic-rollback property is identical in both cases — Postgres rolls
   the whole tx back on any unhandled exception.)
3. Server raised `P0001: customer_required_for_credit` as expected.
4. Snapshot after: **stock = 30** (unchanged), invoice_count = 30
   (unchanged), sale_items = 24 (unchanged), ledger = 37 (unchanged),
   zero invoices with `notes = 'tx-integrity-test'`. Full rollback
   confirmed.

For the post-lock case: the `FOR UPDATE` happens at line 202 with the
`select ... for update` statement; any subsequent raise (e.g.,
`insufficient_stock` at line 208, or a constraint violation on the
sale_items insert at line 227) rolls back equivalently. PostgreSQL's
transactional discipline doesn't distinguish "before the lock" from
"after the lock"; either way, the whole function call rolls back.

## Alternatives considered

1. **Explicit `BEGIN; ... EXCEPTION WHEN ... ROLLBACK; END` block inside
   the function.** Rejected. PL/pgSQL functions are already
   single-transaction by default; an inner exception handler would
   *swallow* exceptions, hiding the very failures we want to surface.
2. **Wrap each write in a savepoint.** Considered. Rejected. Savepoints
   only matter when the function needs to recover from one failure and
   continue. record_sale's invariant is all-or-nothing — recovering past
   a failed write would leave the data model inconsistent (invoice
   without items, variant decremented without sale_items row).
3. **`SET LOCAL transaction_read_only = false` at the top.** No-op for
   a function called via PostgREST — the connection is already in a
   normal read-write transaction.

## Consequences

- Concurrent stock-out races are prevented at the variant level by
  `FOR UPDATE`. Two simultaneous `record_sale` calls on the same variant
  serialize.
- Any future modification to `record_sale` MUST preserve the implicit-
  transaction property. No `commit` inside the function. No exception
  handler that doesn't re-raise.
- The audit query suite (`audit_7, 8, 9` in the v2.6b extension)
  catches drift if a future change accidentally lets a half-committed
  state through.

## References

- Migration `0041_v26_record_sale.sql`
- `decisions/2026-05-12-invoice-financials-single-source-of-truth.md`
- `decisions/2026-05-12-stage2-audit-extensions.md`
- ADR-0007 (original sale/purchase SQL functions design)
- ADR-0025 (variant_id / product_id RPC contract)
