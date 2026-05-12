# sale_items.cost_at_sale uses batch.cost_per_unit for batched products

**Date:** 2026-05-12 (v2.8)
**Status:** Accepted

## Context

Pre-v2.8 (v2.6/v2.6c), `record_sale` snapshots `cost_at_sale` from
`variant.avg_cost` (a weighted-average across all stock-ins).
`invoice_financials.gross_profit` reads that snapshot directly.

For batched products this is **wrong** when the batches have different
costs. Example:

- Batch A: 100 units @ Rs 500 each = Rs 50,000
- Batch B: 100 units @ Rs 700 each = Rs 70,000
- variant.avg_cost = Rs 600

If the cashier sells 10 units from Batch A at Rs 800 each:
- True cost = 10 × 500 = Rs 5,000
- True profit = 8,000 − 5,000 = Rs 3,000
- Old behavior: cost_at_sale = 600 → reports profit as 8,000 − 6,000 = Rs 2,000

The shop owner's per-batch P&L would be misleading.

## Decision

For batched products, `record_sale` snapshots `cost_at_sale` from the
specific batch's `cost_per_unit` (the landed-cost-per-base-unit captured
at stock-in). For non-batched products, behavior is unchanged
(`cost_at_sale = variant.avg_cost`).

`invoice_financials.gross_profit` is automatically correct because it
already reads `sale_items.cost_at_sale` directly per the v2.6c
single-source-of-truth ADR. No view change needed.

## Alternatives considered

1. **Keep using variant.avg_cost** — preserves single code path but
   gives wrong per-batch profit. Defeats half the point of batch tracking.
2. **Compute on read** in `invoice_financials` (join through batch) —
   would require special-casing the view for batched products and would
   break the v2.6c discipline of reading snapshotted values. Snapshots
   are also robust against future schema changes.

## Consequences

- A multi-batch cart line (one logical line spanning two batches) emits
  multiple `sale_items` rows, each with its own `cost_at_sale` taken
  from its source batch. Per-line profit is therefore accurate even for
  split lines.
- Anyone writing new profit math must respect this rule — the cost on
  each `sale_items` row is authoritative for that row. Don't reach back
  to `variant.avg_cost`.
- The batch's `cost_per_unit` is itself the v2.3 largest-remainder
  effective per-base-unit cost (unit cost + allocated overhead share),
  so landed cost is captured correctly.
