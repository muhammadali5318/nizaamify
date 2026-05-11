# 0019 — `products.type` promoted to `product_categories` entity per shop

**Date:** 2026-05-11
**Ticket:** v2.5
**Status:** Accepted

## Context

Since v1.2, `products.type` has been a NOT NULL free-text column used to
group products within a shop. v1.5 added a unique index on
`(shop_id, name, type)` so the same name could be reused across different
types. The list page had no category filter; the product form had a freeSolo
combobox that pulled distinct existing values via a separate
`useExistingProductTypes` hook.

The trouble with free-text is that "phones", "Phone", "PHONES" diverge over
time, the filter on the list page can't be exposed reliably, and
reports-by-category become a string-normalization problem the cashier shouldn't
think about. The spec for v2.5 calls this out and asks for a proper entity.

## Decision

A new `product_categories` table per shop. `products.category_id` is a NOT
NULL FK with `ON DELETE RESTRICT`. The migration backfills distinct existing
`type` values per shop into category rows and links every product before
enforcing NOT NULL.

The old unique index `(shop_id, name, type)` is dropped and replaced by
`(shop_id, name, category_id)` — same property (two products in the same
category cannot share a name, but the same name across different categories is
fine), now keyed on the entity instead of the freetext string.

`products.type` is **kept** for one cycle. `create_product_with_opening_stock`
snapshots the category name into `type` so legacy read paths (purchases,
reports, any unaudited UI) continue to render the right label. A future
cleanup migration drops the column.

Three new RPCs: `search_categories(p_query, p_limit, p_offset)` returning
fuzzy-matched categories ordered by usage; `create_category_inline(p_name)`
that revives an archived match before inserting; `update_category(p_id, p_name,
p_is_active)`. `search_products` / `search_products_count` gain a
`p_category_id` filter for the list-page filter dropdown.

## Alternatives considered

1. **Multi-category per product (M2M)**. Rejected. No customer asked, schema
   complexity isn't justified, and the v1.5 unique-by-name-and-type contract
   couldn't be preserved without a primary-category concept. v3 ticket if it
   comes up.
2. **Category hierarchy (parent_category_id)**. Rejected for the same reason —
   flat structure covers SME tier needs. Add a column later if needed.
3. **Drop `products.type` immediately in 0036**. Rejected: legacy read paths
   (sales list `row.type` badge in `ProductTable`, purchase history) reference
   it. Snapshotting category name into the column keeps them working until a
   focused cleanup migration audits all readers.
4. **Default-seed shops with starter categories** (Electronics, Accessories,
   etc.). User declined — owners create as they go via the inline `+ Create
   new category` affordance in the product form.

## Consequences

- Every existing product is linked to a category derived from its old `type`
  value (verified by a `do $$` block in §D of the migration that raises if any
  rows are unmatched).
- The product form's `type` field is replaced by a `CategoryCombobox` reusing
  the same shape as `ProductCombobox` / `SupplierCombobox` /
  `CustomerPicker`.
- The list page gains a URL-synced `?category_id=` filter, paging resets on
  filter change.
- The legacy `products.type` column carries a snapshot until a future cleanup
  migration drops it. Documented in CLAUDE.md "Open ToDos / Known gaps" and
  "Gotchas".
- Two products can share a name across different categories within the same
  shop (was always the case, semantics preserved).
