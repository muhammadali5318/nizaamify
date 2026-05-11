# FEFO with manual override via "Pick batch" affordance

**Date:** 2026-05-12 (v2.8)
**Status:** Accepted

## Context

When a batched product is added to a POS cart, the default behavior is
FEFO (First Expire First Out) — `record_sale` walks active batches ordered
by `expiry_date asc nulls last, received_at asc, id asc` and consumes them
in turn. This is correct in 98% of cases.

The remaining 2%: a cashier needs to deliberately sell from a specific
batch — for example, a customer-facing warranty-claim swap that pulls
from a specific labeled batch, or a damaged-but-saleable batch that the
shop wants to clear before its expiry-soon siblings.

## Decision

POS cart shows a small "Pick batch" link under each batched-product cart
line. Clicking it opens a popover listing all active batches for that
variant with qty remaining + expiry, ordered FEFO. Cashier picks one; the
cart line stores a `batch_id` override.

On submit, `record_sale` uses the override (validating ownership + active
+ qty_remaining >= line qty). Rejects with `selected_batch_insufficient`
if the chosen batch can't cover the line.

A "Reset to FEFO" link clears the override.

## Alternatives considered

1. **Always show batch dropdown** — too noisy. 98% of cashiers don't
   care about which batch; making them pick every time slows down checkout.
2. **No override at all** — leaves the warranty-claim swap workflow
   unmodelable. Cashier would have to write off the FEFO-selected batch
   afterward, which is wrong.
3. **Override at variant level** — pin a batch globally for that variant
   until cleared. Confusing and easy to forget. Per-line override is
   surgical.

## Consequences

- Cart state carries an optional `batch_id` per line. When set, it's the
  override; when null, server picks FEFO.
- The picker popover queries `inventory_batches` for the variant, ordered
  FEFO, filtered to `is_active and qty_remaining > 0`.
- If the override batch becomes invalid between picker-time and submit
  (e.g. depleted by a concurrent sale), `record_sale` raises and the
  cashier picks again.
- Multi-batch line split (one cart line spanning two batches) only happens
  in the FEFO path, never when an override is set. Override = single batch,
  single sale_items row.
