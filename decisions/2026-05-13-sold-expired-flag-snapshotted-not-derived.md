# `sale_items.sold_expired` is snapshotted at sale time, not derived on read

**Date:** 2026-05-13 (v2.8.4)
**Status:** Accepted

## Context

Past sales need to indicate which lines drew from expired stock — for
the sale-detail "Expired stock" badge, the receipt disclaimer, the
dashboard widget, and the `/inventory/expired-sales` audit list. Two
implementations:

1. **Compute on read.** Join `sale_items` to `inventory_batches` and
   compare `batch.expiry_date < invoices.created_at::date` per line.
2. **Snapshot on write.** Add a `sold_expired boolean NOT NULL DEFAULT
   false` column to `sale_items` and have `record_sale` set it per
   chunk during the FEFO walk.

## Decision

**Snapshot on write.** Three reasons, in order of weight:

1. **Historical truth survives later writes.** If a batch is written off
   (v2.8.2) or has its `notes` field touched, the join-on-read approach
   either has to special-case soft-deleted batches or risks the line
   silently flipping based on what the batch table looks like now. The
   snapshot column is immutable — whatever was true at sale time stays
   true.
2. **Append-only invariant for free.** The
   `sale_items_no_modify` trigger (v1.8 §B) is a blanket reject of
   UPDATE/DELETE on `sale_items`. Snapshot columns are immutable
   automatically; no new trigger logic.
3. **Read-path simplicity.** Receipt rendering, the dashboard widget,
   the audit page, and the sale-detail badge all just read a column.
   No `inventory_batches` join required when the audit path doesn't
   need batch details.

The column is `NOT NULL DEFAULT false`, so the v2.8 pre-v2.8.4 rows
land at `false` — historically those sales might have drawn from
expired stock, but we don't have the evidence to retro-tag them, so
"unknown" reads as "false." Acceptable: v2.8.4 enforces going forward.

## Alternatives considered

1. **Derive on read with a view.** Tempting because it requires no
   schema change — but a view `sale_items_with_expired_flag` would have
   to left-join `inventory_batches`, handle nulls (non-batched lines),
   and risk drift the day someone changes `inventory_batches`. The
   audit query becomes complex; the receipt rendering pulls more data.
2. **Compute in the application layer.** Worse: each consumer
   (receipt, badge, widget) reimplements the comparison logic, and
   the "snapshot vs. current state" question gets answered
   inconsistently.

## Consequences

- New column `sale_items.sold_expired boolean NOT NULL DEFAULT false`
  with a partial index `(sold_expired) WHERE sold_expired` for the
  audit queries.
- `record_sale` sets the flag per allocated chunk via a parallel
  `v_sold_expired_arr boolean[]` array, then writes one row per chunk
  into `sale_items` with the matching flag.
- No new audit query needed (v2.8.4 spec §6 confirms). The flag is
  snapshot truth; there's no derivable invariant to check.
- Future cleanups (e.g. v2.10's `inventory_adjustments` work) can
  freely touch `inventory_batches.expiry_date` without affecting the
  historical record of which sales were drawn from expired stock.
