# v2.8.2 — Partial write-off + auto-deactivate when empty

**Status:** Spec
**Date:** 2026-05-12

## Motivation

Two gaps in v2.8's write-off flow:

1. **No partial path.** The trash icon on the product detail page calls
   `deactivate_batch`, which zeroes the whole batch's stock. There's no
   way to RTV / damage-write-off 2 of 10 units while keeping the other 8
   sellable. The "workaround" is to write off the entire batch and re-
   stock-in 8 units as a new batch — but that resets the warranty
   clock, fragments traceability, and drifts avg_cost.

2. **Empty batches linger.** When a batch sells through naturally
   (qty_remaining transitions to 0), `is_active` stays true. The v2.8
   spec §3.6 considered an auto-deactivate trigger but didn't attach
   it; the BatchesSection UI was supposed to filter on `qty_remaining > 0`
   but doesn't. Result: empty batches clutter the active list.

## Scope

1. New RPC `record_partial_writeoff(batch_id, qty, reason)` — decrements
   `batch.qty_remaining` and `variant.stock` by exactly `qty` and
   appends a structured note. Validates ownership, active status, and
   `qty <= qty_remaining`. v2.10's `inventory_adjustments` ledger will
   later replace the direct stock mutation; the RPC surface stays the
   same.

2. New BEFORE UPDATE trigger `batch_auto_deactivate_when_empty` on
   `inventory_batches` — flips `is_active = false` the instant
   `qty_remaining` transitions from > 0 to 0. Covers every code path
   that touches qty (record_sale FEFO, record_partial_writeoff, and
   anything future).

3. UI: WriteOffBatchDialog gains a "Qty to write off" input that
   defaults to `qty_remaining`. Routes everything through
   `record_partial_writeoff` (the trigger handles the auto-deactivate
   when qty reaches 0, so we don't need to branch in JS).

4. `deactivate_batch` is kept but unused by the new UI. Old callers
   (anyone with cached client code) continue to work.

## Out of scope

- Reason enum (`rtv` / `damaged` / `expired` etc.) — that's v2.10.
- An `inventory_adjustments` ledger — also v2.10.
- A periodic cleanup job for batches that have been empty for >N days
  — no longer needed; the trigger handles auto-deactivation.

## Schema changes

None. Both pieces are functions only — `record_partial_writeoff` is a
new function; `batch_auto_deactivate_when_empty` is a new trigger that
mutates `is_active` (already in the allowed-mutations list per the
batch immutability ADR).

## Trigger ordering

Three BEFORE UPDATE triggers on `inventory_batches`:

| Order | Trigger | What it does |
|---|---|---|
| 1 | `inventory_batches_auto_deactivate` | Sets `new.is_active = false` if `new.qty_remaining = 0` and `old.qty_remaining > 0` |
| 2 | `inventory_batches_immutable` | Validates that frozen fields haven't changed |
| 3 | `inventory_batches_touch` | Sets `new.updated_at = now()` |

Postgres fires BEFORE triggers in name order. The auto-deactivate
trigger fires first and modifies `new.is_active`; the immutability
trigger fires second and is fine with that change because `is_active`
is in the allowed-mutations list. No conflict.

## Audit invariants

`variant.stock = Σ active_batch.qty_remaining` (audit 1) still holds
after every partial write-off because we decrement both sides by the
same number atomically inside the RPC.

`qty_remaining <= qty_received` (audit 4) is unchanged — partial
write-off only ever decreases qty_remaining.

The immutability audit (audit 5 — trigger exists) is unchanged.

## Acceptance criteria

- [ ] `record_partial_writeoff(batch_id, qty, reason)` decrements
      variant.stock + batch.qty_remaining by qty; raises if qty exceeds
      remaining or batch isn't in the user's shop.
- [ ] Trigger fires on the first transition from qty_remaining > 0 to
      0. Does NOT fire on subsequent updates to an already-empty batch
      (e.g. notes-only updates).
- [ ] WriteOffBatchDialog accepts a qty (defaults to qty_remaining).
      Partial qty leaves the batch active with stock reduced. Full qty
      brings it to 0 → trigger flips is_active.
- [ ] BatchesSection's active list no longer shows empty batches
      (because they're now inactive).
- [ ] After running step 13 from the v2.8 QA (write off with real qty
      remaining), audit 1 still passes.
- [ ] All v2.6 + v2.6c + v2.8 + v2.8.1 audits stay zero.

## Migration

Single migration `0061_v282_partial_writeoff_and_auto_deactivate.sql`.
ADR: `decisions/2026-05-12-partial-writeoff-and-auto-deactivate.md`.
