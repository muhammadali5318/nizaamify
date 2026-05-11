# 0022 — Product-template / variant architecture

**Date:** 2026-05-12
**Ticket:** v2.6
**Status:** Accepted

## Context

Pre-v2.6, `products` carried `stock`, `price`, `cost`, `avg_cost`,
`last_purchase_cost`. That worked for single-SKU products but blocked v2.7's
multi-variant work: there was no way for a Track Suit to have a Red/M stock
of 5 and a Blue/L stock of 8 unless variants existed as a first-class entity.

The variant feature could have been built three ways:

1. **Bolt-on layer.** Products keep their stock/price; some products gain
   extra "variant" rows. Every query in the system asks "is this a variant
   product or not?" Forked codebase forever.
2. **Split-as-products.** Each color × size becomes its own `products` row.
   Cross-variant reports ("total Tracksuit AAA sales") need string-pattern
   joins; the data model doesn't match the shop owner's mental model.
3. **Template + variant** (this decision). `products` is pure metadata
   (name, category, description, type, is_scan_only); every product has at
   least one row in `product_variants` carrying the stock/price/cost.

## Decision

Approach 3. Every product is a template; every product has at least one
variant. Stock, price, cost, avg_cost, last_purchase_cost live on
`product_variants`. `products.stock` / `products.price` / etc. are deprecated
columns kept through v2.6 for legacy reports; a future cleanup migration
drops them.

Single-variant products (everything pre-v2.7) have exactly one variant with
`is_default = true`. Multi-variant products (introduced in v2.7) have many
variants, none of them `is_default`. The compat view
`product_with_default_variant` joins each product to its default variant so
the v2.5-era UI keeps working unchanged.

## Alternatives considered

See §1 of `MVP_v2.6_VARIANT_REFACTOR.md` and the "Context" section above.
The bolt-on approach was rejected because of the forked-codebase trap; the
split-as-products approach was rejected because reports become a string
problem.

## Consequences

- A migration (0037–0044) was needed to add the table, backfill default
  variants, repoint `sale_items` / `purchase_items` / `product_packs` to
  `variant_id`, and rewrite every stock-touching RPC.
- Every existing transaction row now references a default variant
  (audits 2–6 in v2.6 §6 return zero rows).
- The legacy `products.*` columns and the legacy `*.product_id` columns on
  transaction tables stay for one cycle, kept in sync by triggers
  (`sync_product_id_from_variant` on the three transaction tables). v2.8
  cleanup migration drops them.
- v2.7 ships variant attributes, matrix product creation, stock-in matrix
  mode, and the POS variant picker on top of this foundation — without
  touching the same schema slice twice.

## References

- ADR-0023 (default-variant pattern for single-variant products)
- ADR-0024 (deprecate-without-drop product_id columns)
- ADR-0025 (variant_id-or-product_id RPC contract during the transition)
- `MVP_v2.6_VARIANT_REFACTOR.md` §1
- Migrations: 0037–0044
