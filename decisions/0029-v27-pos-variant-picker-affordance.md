# 0029 — POS multi-variant rows show "Pick variant" not direct [+]

**Date:** 2026-05-12
**Ticket:** v2.7
**Status:** Accepted

## Context

Pre-v2.7, every POS row had a primary [+] button: one tap adds one base
unit of that product to the cart. v2.7 introduces multi-variant products
that have N variants, each with their own stock and price. A direct [+]
on the product row can't decide which variant to add.

## Decision

POS rows render based on `ProductSearchRow.has_variants`:

- **Single-variant** (`has_variants = false`): keeps the v2.3 [+] button.
  Stock cell shows "120 each", price cell shows the price.
- **Multi-variant** (`has_variants = true`): the [+] button is replaced by
  a "Pick variant" secondary button. Stock cell shows "11 variants"; price
  cell shows "Rs 1,200 – 1,400" (min–max from the variants).

Clicking "Pick variant" opens `PosVariantPicker` — a small dialog listing
every active variant with its current stock + price. Clicking a variant
row adds 1 of that variant to the cart at the variant's price; the dialog
closes on add. Out-of-stock variants are disabled.

Cart lines are keyed by `variant_id ?? product_id` (the `lineKey` helper).
Two variants of the same product are distinct cart lines. The cart label
renders `"Tracksuit AAA — Red / M"` when `variant_label` is set.

## Alternatives considered

1. **Auto-pick the cheapest / first variant.** Rejected — silently
   committing the cashier to a variant they didn't choose is a regression.
2. **Open a popover, not a dialog.** Considered. For v2.7 MVP a Dialog
   keeps focus capture clean across the mobile bottom-sheet cart and the
   desktop right-side cart. Polish step could swap to a popover anchored
   to the row.
3. **Variant grid (the spec §8.2 sketch with rows × columns).** Deferred
   to a follow-up. The vertical-list dialog is simpler to ship, accessible,
   and works for any attribute count.

## Consequences

- A new "search_products" return field is needed: `has_variants`,
  `variant_count`, `min_price`, `max_price` (migration 0048).
- `ProductTable` branches the stock + price cells on `has_variants` — also
  benefits the `/products` list since admin search now correctly shows
  "11 variants" for multi-variant products.
- The cart reducer's action shape changes from `product_id` keys to
  generic `key` (lineKey of variant_id ?? product_id). One-time refactor;
  the same shape serves both single and multi-variant cart lines.
- Receipt + sale detail render the variant label.

## References

- `MVP_v2.7_VARIANT_UI.md` §8
- Migration 0048
- `PosVariantPicker.tsx`, `POSPage.tsx`
