# Multi-batch line split: data preserves the split, UI summarizes

**Date:** 2026-05-12 (v2.8)
**Status:** Accepted

## Context

In v2.8 FEFO, a single cart line can span multiple batches. Example:
cashier sells 10 units of a batched product; the oldest batch has only
4 remaining, so `record_sale` walks to the next batch for the remaining
6 units.

There's a choice about how to represent this:

1. **Single sale_items row** with mixed cost_at_sale and a joined
   `batch_link` table tracking the split.
2. **Multiple sale_items rows** (one per batch consumed), each with its
   own cost_at_sale and batch_id. UI re-aggregates for display.

## Decision

**Multiple sale_items rows.** A cart line of 10 units spanning two
batches produces two `sale_items` rows: one for qty=4 with
`batch_id = oldest_batch.id` and `cost_at_sale = oldest_batch.cost_per_unit`,
and one for qty=6 with the next batch's values.

`line_discount_amount` is split across the rows via largest-remainder by
qty (sum exactly equals the original line discount).

The UI summarizes split rows back into one logical line on display
(receipt, sale detail) with a "From batches X (4 units) + Y (6 units)"
sub-line. Aggregation key: `invoice_id, variant_id, price_at_sale,
line_discount_type, line_discount_value`.

## Alternatives considered

1. **Single row + batch_link table.** Splits the data model further;
   join required everywhere; per-row cost no longer cleanly accurate
   for profit math (a single row can't carry two costs).
2. **Reject multi-batch lines** — force cashier to split manually if
   the oldest batch can't cover the line. Terrible UX; defeats the
   "FEFO is automatic" premise.

## Consequences

- Authoritative profit per row is preserved (single cost_at_sale per row).
- `invoice_financials.gross_profit` is automatically accurate (it sums
  per-row revenue and cost — both already correct).
- **Anyone consuming sale_items must not assume 1:1 with cart lines.**
  When rendering receipts or reports, group by the aggregation key.
- The line_discount_value field stays identical across split rows (the
  cashier-entered value is a single value per line); the
  line_discount_amount is what's split. Display can read either.
