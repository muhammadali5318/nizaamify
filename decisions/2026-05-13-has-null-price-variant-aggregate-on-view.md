# has_null_price_variant aggregate on the product view (not a separate RPC)

**Date:** 2026-05-13 (v2.8.3)
**Status:** Accepted

## Context

v2.8.3's catalog list needs to:

1. Render a "Set price ⚠" warning on rows where any variant has `price = null`.
2. Provide a "Needs pricing" filter chip that limits the list to those rows.

The data already exists — `product_variants.price` is nullable since v2.8.1.
But it's not exposed in a way the catalog list query (`search_products`)
can use directly. Two options:

1. **Add an aggregate to `product_with_default_variant`** — a boolean
   `has_null_price_variant` computed via `exists()` over the variants.
   `search_products` gets a new `p_needs_pricing` parameter that filters
   on it.
2. **Separate RPC** — `list_products_needing_pricing()` that returns just
   the unpriced products. Frontend swaps between regular search and this
   for the filter case.

## Decision

**Aggregate on the view + parameter on the search RPC.** Same pattern as
v2.5's `p_category_id` and `v2.6`'s `p_only_in_stock` — additive parameters
with `false` default, back-compat preserved.

## Why

1. **One code path for catalog list.** Frontend always calls
   `search_products`; the filter chip just toggles a parameter. Two code
   paths (regular + needs-pricing-only) would be fragile — pagination,
   sorting, search interactions diverging over time.

2. **Filter is composable.** `p_needs_pricing` AND `p_category_id` AND
   query string all apply together. Separate RPC would need its own
   category + search support, doubling surface.

3. **Aggregate is cheap.** `exists(... where price is null)` short-circuits
   on the first hit; the subquery runs per row but the typical shop has
   tens of products, not thousands. Catalog list is human-paced.

4. **Counter is automatic.** `search_products_count` with `p_needs_pricing=true`
   gives the chip count via the same code path as the row data.

## Alternatives considered

1. **Materialize the boolean as a column on `products`.** Would require a
   trigger on `product_variants` to maintain it. Higher write cost, more
   moving parts, drift risk. The view aggregate computes on read — simpler.
2. **Compute on the frontend.** Frontend would need to fetch all variants
   per product (or rely on the multi-variant view) and aggregate in JS.
   That's the kind of "client-side reduce over money paths" pattern v2.6c
   explicitly retired. Server aggregates are the rule.

## Consequences

- `product_with_default_variant` widens by one boolean column —
  back-compat with existing readers (they ignore the new column).
- `search_products` + `search_products_count` gain `p_needs_pricing` with
  default false — back-compat with v2.5/v2.6/v2.7 callers.
- Frontend gets a clean URL-synced filter via `?needs_pricing=1` and a
  counter without an extra query.
- When a new field is added to `product_with_default_variant` in a future
  ticket, the `has_null_price_variant` aggregate must be preserved (per
  the v2.8.3 gotcha in CLAUDE.md).
