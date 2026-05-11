# 0023 — Synthetic default variant for single-variant products

**Date:** 2026-05-12
**Ticket:** v2.6
**Status:** Accepted

## Context

The v2.6 template/variant decision (ADR-0022) requires every product to have
at least one variant. Every existing product in the database is a
single-variant product (no Color, Size, etc.); v2.7 introduces the first
multi-variant cases. The migration needs to do something with the existing
products: give each one a synthetic variant that's invisible to the UI.

## Decision

Every product gets exactly one variant with `is_default = true` and the
product's existing `stock`, `price`, `cost`, `avg_cost`, `last_purchase_cost`
copied across.

A partial unique index `uq_variant_default_per_product (product_id) WHERE
is_default AND is_active` enforces "at most one active default variant per
product." Coupled with the audit-1 check (every active product has exactly
one default variant), the system maintains the invariant that
single-variant products are the one-to-one degenerate case of the variant
model.

The v2.6 compat view `product_with_default_variant` joins each product to
this single variant and exposes the v2.5 shape (one row per product, with
stock/price/cost at the top level). Every v2.5-era read path consumes the
view and sees no change.

v2.7 will introduce multi-variant products. When `products.has_variants =
true`, no variant on that product carries `is_default = true` — they're all
real variants with attribute values. The v2.7 spec §3.5 adjusts the partial
index to enforce the default constraint only when `has_variants = false`
(via row trigger, since Postgres rejects subqueries in partial-index
predicates).

## Alternatives considered

1. **No default flag — single-variant products have a single variant with
   no special marker.** Rejected: queries need a way to identify "the
   variant" without a `LIMIT 1` that could pick the wrong one if a future
   migration accidentally creates multiple. The flag is the invariant.
2. **A separate `single_variant_products` table.** Rejected: doubles the
   number of tables to query and breaks the "every product is a template"
   invariant from ADR-0022.
3. **Make every "default" variant `is_default = false` and rely on the row
   count.** Rejected: same fragility as option 1.

## Consequences

- 13 default variants were backfilled in migration 0038 (one per existing
  product). Archived products got archived variants so old `sale_items` /
  `purchase_items` rows always find a matching variant in the v2.6 §6
  audits.
- The compat view `product_with_default_variant` is the bridge between v2.5
  reads and the new schema. Removing it is a v2.8+ task once every UI
  surface reads directly from `product_variants`.
- The v2.7 multi-variant rollout has a well-defined contract: products
  with `has_variants = true` have no default; products with
  `has_variants = false` (or pre-v2.7 products) have exactly one default.

## References

- ADR-0022 (the parent architectural call)
- Migrations: 0037 (table), 0038 (backfill + audit 1), 0040 (compat view)
- `MVP_v2.6_VARIANT_REFACTOR.md` §2.10
