# Pricing/stock decoupled from product creation

**Date:** 2026-05-12 (v2.8.1)
**Status:** Accepted

## Context

`create_product_with_opening_stock` couples three writes:

1. **Catalog row** — what the product is.
2. **Selling price** — what you charge for it.
3. **Opening stock + cost** — initial inventory load, modeled internally
   as a synthetic `is_opening = true` purchase.

The coupling created friction:

- **v2.8 batched products** needed a 3-step "create → edit-toggle →
  stock-in" flow because the form's `opening_stock` field conflicts with
  `has_batches`'s "stock must be 0" guard rail.
- **Bulk import** is impossible — shop owners with 200 SKUs to load don't
  know cost-of-goods at upload time; that's a purchase concept.
- **Conceptual confusion** — cost of goods is a purchase event, not a
  catalog attribute.

The database already supports the cleaner model: `purchases.is_opening`
exists since v1.5, `product_variants.price` is nullable, `stock` and
`avg_cost` default to 0. The change is purely procedural.

## Decision

Move opening stock + cost out of product creation. Selling price stays on
the product but becomes optional at create time.

The product create form ships only what's catalog-shaped: name, variant
attributes, category, description, optional selling price, optional
has_batches flag with alert-window overrides.

Stock-in gains an "This is opening stock" checkbox that flips the existing
`purchases.is_opening` to true. No new entity. No special-case branching
in `record_purchase`.

### What stays the same

- `create_product_with_opening_stock` RPC name and signature — the old
  client tabs in the field that still pass price/opening_stock keep
  working. We just default-null the params they no longer have to send.
- The data model. `is_opening`, `purchase_items`, `inventory_batches` —
  all unchanged.
- Profit math, FEFO, audit suite — unchanged.

### What changes

- `ProductFormPage` drops the opening-stock / opening-cost inputs; the
  selling-price input allows blank.
- The "Has batches" toggle joins the create form (was edit-only in v2.8).
  At create time there's no stock guard rail; a fresh product is always
  at 0.
- Matrix builder drops the per-row opening qty / opening cost columns.
- `NewPurchasePage` gets a single new checkbox at the top: "This is
  opening stock."
- `ProductDetailBody` shows a "Selling price not set" banner when
  `price` is null, with a link to open the edit dialog.
- POS picker filters null-priced products even if they have stock —
  preventing accidental sale of an unpriced product.

## Alternatives considered

1. **New `create_product` RPC** — fragments the API; old client tabs
   would break and a deprecation window would have to be managed. The
   defaulted-params approach is back-compat by construction.
2. **Pricing on stock-in (cost + markup → price)** — couples back to
   stock-in differently. Markup percentages aren't shop-wide — different
   products have different margins. Rejected.
3. **Keep opening-stock on create, just remove `has_batches` conflict** —
   leaves the bulk-import + conceptual-cleanup wins on the table.

## Consequences

- The v2.8 "save first, then edit, then stock-in" flow collapses to
  "save, then stock-in." The has_batches toggle is now create-time.
- POS picker filters null-price products. A "Set selling price" CTA on
  product detail prompts the user.
- A future v2.x ticket can ship CSV bulk import on top of this with
  trivial server changes.
- v2.10 inventory adjustments lands more cleanly because every inventory
  mutation already flows through a discrete event row — no special-case
  for opening stock.

## References

- `MVP_v2.8.1_PRICING_DECOUPLE.md`
- ADR-2026-05-12-batches-vs-serials-mutually-exclusive (v2.8 batch toggle constraints)
