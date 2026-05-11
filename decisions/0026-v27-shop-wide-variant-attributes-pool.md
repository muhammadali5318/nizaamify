# 0026 — Shop-wide variant attribute pool

**Date:** 2026-05-12
**Ticket:** v2.7
**Status:** Accepted

## Context

v2.7 introduces variant attributes (Color, Size, Storage, …). The schema
question is where these attributes live: per product (each product carries
its own attribute definitions) or shop-wide (one Color attribute, reused
across every product in the shop).

Per-product attributes feel natural at first — a Tracksuit's "Color" is
arguably a different thing than a Phone's "Storage". But:

- Reporting becomes a string-normalization problem ("how much Red did we
  sell?" requires joining across N per-product Color attributes).
- The owner re-types "Color" / "S/M/L/XL" for every product they create.
- Cross-product analytics ("Red is our best-selling color across garments")
  are impossible without an extra normalization step.

## Decision

Attributes live at shop level. `variant_attributes (shop_id, name, …)` and
`variant_attribute_values (attribute_id, value, …)`. A product references
the shared values through `product_variant_attribute_values (variant_id,
attribute_value_id)`. Two products can use the same "Red" / "M".

Implications:
- Settings → Variant Attributes is the single place to define them.
- The product create form picks from this pool. Inline "+ Add value" is
  allowed on both the product form and (eventually) the stock-in matrix.
- The cross-product report "Red sales across all garments" becomes a
  natural join, no string matching needed.

## Alternatives considered

1. **Per-product attributes.** Rejected for the three reasons above.
2. **Global (Anthropic-wide) attribute pool.** Wildly out of scope. Each
   shop's vocabulary is its own.
3. **Hybrid: attributes per shop, values per product.** Cute but undoes the
   reporting benefit (each product's "Red" would still be a distinct value).

## Consequences

- 8 attribute / value RPCs (create / update / deactivate / search / list
  for attributes and values) live in migration 0046.
- The constraint on `product_variant_attribute_values` is at the function
  level: `create_product_with_variants` validates each variant supplies
  exactly one value per attribute the product uses.
- Archive guards: `update_variant_attribute(..., p_is_active=false)` is
  rejected if any active variant still references one of the attribute's
  values. Same for `update_variant_value`. Forces the user to clean up
  the variants first.
- Cross-shop isolation is automatic — `variant_attributes.shop_id` is the
  RLS anchor; RLS on values + the link table bridges through it.

## References

- ADR-0022 (template/variant architecture)
- `MVP_v2.7_VARIANT_UI.md` §3.1–§3.3
- Migrations: 0045 (tables), 0046 (RPCs)
