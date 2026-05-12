# Partial write-off + auto-deactivate when empty

**Date:** 2026-05-12 (v2.8.2)
**Status:** Accepted

## Context

v2.8's batch write-off flow has two gaps:

1. **No partial path.** `deactivate_batch` is all-or-nothing per batch.
   Real-world cases (2 of 10 damaged, partial supplier-warranty RTV)
   force a clunky workaround: write off the whole batch then re-stock-in
   the remainder. That resets the warranty clock, fragments batch
   traceability, and disturbs WAC.

2. **Empty batches linger.** A batch that sells through naturally
   keeps `is_active = true`. The v2.8 spec §3.6 considered an
   auto-deactivate trigger but didn't attach it; the BatchesSection UI
   was supposed to filter on `qty_remaining > 0` but doesn't. Users
   see depleted batches cluttering the active list.

## Decision

Two functions, one migration, no schema change.

### 1. `record_partial_writeoff(batch_id, qty, reason)`

Decrements `variant.stock` and `batch.qty_remaining` by exactly `qty`
inside a single transaction. Appends a structured note to the batch
like `2026-05-12 — Wrote off 2 unit(s): RTV to supplier`. Validates:

- Batch belongs to the user's shop
- Batch is currently active
- `qty > 0`
- `qty <= batch.qty_remaining`

When `qty == qty_remaining`, the second trigger (below) handles the
auto-deactivation in the same UPDATE. No special case in the RPC.

### 2. Trigger `batch_auto_deactivate_when_empty`

BEFORE UPDATE on `inventory_batches`. Sets `new.is_active = false`
when `new.qty_remaining = 0 AND new.is_active AND old.qty_remaining > 0`.

Fires once on the transition from > 0 to 0. Doesn't re-fire on
subsequent updates to an already-empty batch (notes edits etc.).

Covers every code path that touches qty atomically:
- `record_sale` FEFO decrement
- `record_partial_writeoff`
- `deactivate_batch` (still works for back-compat — its explicit
  `is_active = false` write is a no-op since the trigger already
  flipped it)
- Anything future

### 3. UI: WriteOffBatchDialog gains a qty input

Defaults to `qty_remaining`. User types a smaller number for partial.
Always routes through `record_partial_writeoff` (which handles the
full case via the trigger).

## Alternatives considered

1. **Two separate dialogs / RPCs** — one for full, one for partial.
   Rejected: same shape, same intent, the partial case is just
   `qty < qty_remaining`. Splitting doubles the surface.
2. **Auto-deactivate via the RPCs themselves** instead of a trigger
   — would require code changes in every RPC that touches qty.
   Trigger is one place, fires on every path automatically.
3. **Periodic cleanup job** (90 days, per v2.8 spec §3.6 mention) —
   adds a cron / scheduled task to maintain. The trigger does it
   instantaneously with zero ops burden.

## Trigger ordering

Three BEFORE UPDATE triggers on `inventory_batches`. Postgres fires
BEFORE row-level triggers in name order:

| Order | Trigger | Action |
|---|---|---|
| 1 | `inventory_batches_auto_deactivate` | Flips `new.is_active = false` on the 0-transition |
| 2 | `inventory_batches_immutable` | Validates frozen fields didn't change |
| 3 | `inventory_batches_touch` | Sets `new.updated_at = now()` |

The auto-deactivate trigger's only mutation is `is_active`, which is
in the immutability trigger's allowed-mutations list. No conflict.

## Consequences

- v2.10's `inventory_adjustments` ledger will replace the direct stock
  mutation in `record_partial_writeoff`, but the RPC surface stays
  the same. Frontend doesn't change. The trigger stays.
- `deactivate_batch` becomes redundant for the new UI flow but is
  kept around for back-compat. v2.10 can deprecate.
- BatchesSection's active list naturally cleans itself — empty batches
  flip to inactive immediately and disappear from view (still
  accessible via "+ Show inactive").
- The "0 inventory" lingering-batch UX gotcha is gone. Step 13 of the
  v2.8 QA still passes — variant.stock decrements correctly.

## Audit impact

- Audit 1 (`variant.stock = Σ active batch.qty_remaining`) — still
  holds. Partial decrement keeps both sides in sync; auto-deactivate
  removes the batch from the sum at the same instant its qty hits 0.
- Audit 4 (`qty_remaining <= qty_received`) — still holds. Partial
  decrement only decreases qty.
- Audit 5 (immutable trigger present) — unchanged.
- No new audits needed.

## References

- `MVP_v2.8.2_PARTIAL_WRITEOFF.md`
- ADR `2026-05-12-batch-deactivation-temporary-pattern` (the v2.10
  inventory_adjustments transition path)
- ADR `2026-05-12-batch-immutability-rules` (the allowed-mutations list)
