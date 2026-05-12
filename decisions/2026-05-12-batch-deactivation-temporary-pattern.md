# deactivate_batch directly decrements variant.stock (temporary)

**Date:** 2026-05-12 (v2.8)
**Status:** Accepted — will be reworked by v2.10

## Context

v2.8 ships `deactivate_batch(p_batch_id, p_reason)` for the "write off
a damaged/expired batch" workflow. The function needs to:

1. Reduce variant.stock by the batch's remaining qty (the stock disappears).
2. Set batch.is_active=false and zero qty_remaining.
3. Capture a reason in batch.notes.

v2.10 will introduce a proper `inventory_adjustments` ledger that
captures damage, RTV, theft, etc. with structured reasons. Once that
exists, stock should derive from the ledger (purchases + adjustments −
sales), not be directly mutated by callers.

## Decision

For v2.8, `deactivate_batch` directly UPDATEs `product_variants.stock`.
This is a known temporary pattern.

The decrement is explicit and atomic with the batch update; no
inventory ledger row is created. The reason is captured as a free-text
note appended to `batches.notes`.

## Alternatives considered

1. **Block write-offs until v2.10 ships** — leaves users stuck with
   damaged batches they can't model. Bad MVP UX.
2. **Build a minimal inventory_adjustments table now** — bigger scope
   than v2.8 should bite off. v2.10 will design it properly with reason
   enum, audit trail, RTV linkage.
3. **Write off without decrementing stock** — leaves a phantom qty on
   the variant that no batch covers; breaks audit 1 (variant.stock =
   Σ batch.qty_remaining for batched products).

## Consequences

- v2.8 `deactivate_batch` mutates two tables (`product_variants` +
  `inventory_batches`) atomically.
- v2.10 will:
  - Add `inventory_adjustments` with reason enum.
  - Rewrite `deactivate_batch` to insert into the adjustments ledger
    instead of touching variant.stock.
  - Add a materialized "stock" computation derived from purchases +
    adjustments − sales, and treat the current `product_variants.stock`
    column as a cache.
- Until then, the v2.8 audit suite (audit 1) verifies the invariant
  `variant.stock == Σ active_batch.qty_remaining` for batched products
  — so any drift caused by mistaken direct UPDATEs (outside
  `deactivate_batch`) is caught.
