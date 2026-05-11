# 0025 — `record_sale` / `record_purchase` accept variant_id OR product_id

**Date:** 2026-05-12
**Ticket:** v2.6
**Status:** Accepted

## Context

The v2.6 silent refactor (ADR-0022) moves stock decrements from
`products.stock` to `product_variants.stock`. The two write RPCs that touch
stock are `record_sale` and `record_purchase`. Their callers — the POS page,
the stock-in form, and various tests / seed scripts — pass items keyed by
`product_id`. Updating every caller in the same release is risky and
unnecessary; v2.6 is supposed to be invisible at the UI layer.

## Decision

The v2.6 versions of `record_sale` and `record_purchase` accept items in
either shape:

```
{ "variant_id": "<uuid>", "qty": ..., ... }           // preferred
{ "product_id": "<uuid>", "qty": ..., ... }           // legacy fallback
```

Per-item resolution: prefer `variant_id` when present; otherwise resolve
`product_id` to its `is_default AND is_active` variant and operate on that.
A row missing both raises `item_missing_variant_or_product_id`.

`sale_items` and `purchase_items` are always written with `variant_id`; the
`sync_product_id_from_variant` trigger (ADR-0024) fills `product_id` so the
denormalized column stays accurate for legacy reports.

## Alternatives considered

1. **Update every caller in v2.6 to pass `variant_id`.** Rejected: contradicts
   the "silent refactor" goal. v2.6 is supposed to ship without UI changes.
2. **Accept only `variant_id`; break every existing caller.** Rejected: same
   reason, plus loses rollback insurance.
3. **Two separate RPCs — `record_sale_v2` for variants, keep `record_sale`
   pointing at products.** Rejected: doubles the function surface, fragments
   the discount/overhead math across two implementations.

## Consequences

- The POS module still passes `product_id` per cart line; nothing changed
  in `POSPage.tsx` for v2.6. v2.7 will start passing `variant_id` when the
  cashier picks a non-default variant via the new picker.
- The stock-in form still passes `product_id`; v2.7's matrix mode emits
  per-cell lines keyed by `variant_id`.
- The `product_id` resolution path is documented as deprecated in
  CLAUDE.md. When v2.8 cleans up the legacy columns it will also drop the
  `product_id` fallback from the two RPCs.
- An explicit error `product_has_no_default_variant` fires if a caller
  passes a `product_id` whose product has no `is_default = true` variant —
  catches the v2.7 case where someone tries to add to cart by product_id
  on a multi-variant product.

## References

- ADR-0022 (template/variant architecture)
- ADR-0024 (kept columns + sync trigger)
- Migrations: 0041 (record_sale), 0042 (record_purchase + opening-stock RPC)
- `MVP_v2.6_VARIANT_REFACTOR.md` §3.1–§3.3
