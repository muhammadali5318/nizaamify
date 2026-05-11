# inventory_batches immutability rules

**Date:** 2026-05-12 (v2.8)
**Status:** Accepted

## Context

`inventory_batches` rows are mostly append-only. Some fields must stay
frozen at insert time (auditability of cost / dates / supplier warranty
across the batch's life), while others must mutate (qty_remaining
decrements on sale, is_active flips on write-off, notes get appended).

## Decision

The `batch_immutable_fields` trigger (BEFORE UPDATE) raises on changes
to any of these:

| Field | Why immutable |
|---|---|
| `id` | Standard |
| `variant_id` | Re-pointing the batch at a different variant breaks history. |
| `batch_no` (case-insensitive) | Supplier-facing identifier; renaming corrupts traceability. |
| `qty_received` | Snapshot of intake. qty_remaining tracks consumption separately. |
| `cost_per_unit` | Profit math is anchored on this. Mutating it retroactively rewrites history. |
| `manufactured_date` | Snapshot at intake. |
| `expiry_date` | FEFO depends on this; mutating reorders past sales. |
| `supplier_warranty_days` | Warranty alert math depends on this. |
| `warranty_expires_at` | Derived at insert from received_at + warranty_days; mutating drifts. |
| `received_at` | Anchors FEFO sort and warranty math. |
| `purchase_item_id` | Audit trail. |
| `supplier_id` | Denormalized supplier identity; mutation breaks supplier-warranty queries. |

Allowed mutations: `qty_remaining`, `is_active`, `notes`, `updated_at`.

## Alternatives considered

1. **Full append-only (block all UPDATEs)** — would require an
   `inventory_adjustments` ledger from day 1 to support FEFO decrement.
   v2.10 will do this; v2.8 ships the simpler "mutate qty_remaining
   in place" pattern.
2. **No immutability** — allows post-hoc edits to cost / dates which
   would silently corrupt profit reports and FEFO ordering. Rejected.

## Consequences

- The trigger function is `SECURITY DEFINER` so it runs under the
  function owner's privileges (consistent with v1.8 append-only triggers
  on sale_items / purchase_items).
- Allowed mutations (qty_remaining, is_active, notes) cover every
  legitimate write path:
  - `record_sale` decrements qty_remaining (FEFO + override).
  - `deactivate_batch` flips is_active + zeros qty_remaining + appends notes.
  - Future v2.10 inventory_adjustments may decrement qty_remaining
    further (e.g. partial damage); same trigger applies.
- Audit 5 verifies the trigger is attached. Drop the trigger by mistake
  and the audit catches it.
