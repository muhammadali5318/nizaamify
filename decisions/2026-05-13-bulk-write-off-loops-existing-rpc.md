# Bulk write-off iterates record_partial_writeoff (no new bulk RPC)

**Date:** 2026-05-13 (v2.8.3)
**Status:** Accepted

## Context

The v2.8.3 dashboard widget surfaces expired batches with a "Write off all..."
bulk action. Implementation options:

1. **Frontend loop** — iterate `record_partial_writeoff(batch_id, qty, reason)`
   over each batch with the same reason.
2. **New server RPC** — `record_bulk_writeoff(batch_ids[], reason)` that
   does the writes in a single transaction.

## Decision

**Frontend loop.** Each batch gets its own write-off RPC call with the same
reason; if N batches are written off the user sees N separate `Wrote off X
unit(s): reason` notes — one per batch.

## Why

1. **No new server logic.** The action is exactly N invocations of an
   existing RPC. A bulk RPC would replicate `record_partial_writeoff`'s
   validation (shop check, qty check, batch ownership) and stock-decrement
   logic, just inside a loop. Code duplication with no functional gain.

2. **Per-batch audit trail.** The batch's `notes` field captures the
   write-off history. Looping the per-batch RPC means each batch carries its
   own dated note. A bulk RPC would either append the same note to N batches
   (same outcome, different code path) or share one ledger row across all
   (worse for traceability — when v2.10's `inventory_adjustments` ledger
   lands, you want one row per batch so a single batch's write-off can be
   linked back to its `inventory_adjustments` row uniquely).

3. **Failure granularity.** If one batch in the bulk action fails (RLS,
   concurrent qty change, etc.), the frontend can report "N succeeded, 1
   failed" rather than the bulk RPC's atomic all-or-nothing transaction.
   For an audit-trail action this is more forgiving — partial success is
   often the right outcome.

## Alternatives considered

1. **New `record_bulk_writeoff` RPC.** Rejected — replicates existing logic
   without adding value; complicates the v2.10 ledger transition.
2. **Single transaction via the API layer (begin/commit around the loop).**
   Supabase JS doesn't expose transaction control to the client; would
   require a custom RPC anyway. And we wouldn't want atomic — see #3 above.

## Consequences

- `BulkWriteOffDialog` is a small UI loop over `useRecordPartialWriteoff`.
  Submitting catches per-iteration errors, counts failures, surfaces a
  "N batches failed, try again or write off individually" notice.
- When v2.10's `inventory_adjustments` ledger replaces direct stock decrement
  inside `record_partial_writeoff`, the bulk-write-off frontend changes
  zero. Each batch still gets its own adjustments row.
- The audit trail remains per-batch granular — searching `batches.notes`
  for "RTV cleanup" returns the N batches that were bulk-written-off
  together, while preserving each batch's own dated history.
