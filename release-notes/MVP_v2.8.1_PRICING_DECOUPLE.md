# MVP v2.8.1 — Pricing/stock decoupled from product creation

**Status:** Spec
**Date:** 2026-05-12

## Tagline

Products become catalog-only at create time. Cost, opening stock, and pricing
move into stock-in (or stay set-later on the product). Selling price is
optional. The v2.8 "create → edit → toggle batches → stock-in" three-step
flow collapses to "create → stock-in."

---

## 1. Motivation

Today `create_product_with_opening_stock` couples three different things:
1. Catalog row (name / category / description)
2. Selling price (variant.price)
3. Opening stock + cost (synthetic `is_opening = true` purchase row)

This couples-creates several friction points:

- **v2.8 batched products** need a two-step "create then edit-toggle then
  stock-in" flow because the toggle's "stock must be 0" guard rail
  conflicts with the create form's `opening_stock` field.
- **Bulk product import** (CSV of 200 SKUs) doesn't fit — shop owners
  upload product catalogs before stock arrives.
- **Conceptual mismatch.** Cost is a purchase concept; the catalog has no
  business carrying it.

The DB already supports this cleanly:
- `purchases.is_opening` boolean exists since v1.5 — opening-stock is
  already modeled as a kind of purchase.
- `product_variants.price` is **already nullable** (verified in the live
  schema). No migration needed for unpriced products.
- `product_variants.stock` defaults to 0; `avg_cost` defaults to 0.

So the change is purely procedural — split what the create RPC does in
half, expose the "is opening" flag in the stock-in UI, make the price
optional at create time.

---

## 2. Mental model after this change

| Concept | Where it's set | When |
|---|---|---|
| Product catalog (name / category / description) | Product create form | Up-front (or via CSV import in a future ticket) |
| Variant attributes (Color / Size etc.) | Product create form (matrix) | Up-front |
| Selling price | Product create form **or** product detail | At any time; null until set; POS blocks sales of null-priced products |
| Cost of goods | Stock-in form (every line carries `cost_at_purchase`) | When goods arrive |
| Stock on hand | Stock-in form | When goods arrive |
| Opening stock (initial inventory load) | Stock-in form **with "This is opening stock" checked** | First stock-in per product, typically |
| Batch info (when `has_batches`) | Stock-in form | Per stock-in line |

The "Opening stock" checkbox is the only new UI primitive. Internally it
just sets `p_is_opening = true` on `record_purchase` (which already
supports this since v1.5).

---

## 3. Out of scope

- Bulk CSV product import (future).
- Multi-stock-in markup-derived pricing.
- Schema changes — none required.
- Replacing or renaming the existing `create_product_with_opening_stock`
  RPC. We extend it (defaults) so old callers keep working; new callers
  pass null for the deprecated fields.

---

## 4. Backend changes

### 4.1 `create_product_with_opening_stock` — defaults for the deprecated params

The signature stays:

```
create_product_with_opening_stock(
  p_name text,
  p_category_id uuid,
  p_price numeric default null,        -- was: required
  p_opening_stock int default 0,       -- was: required
  p_opening_cost numeric default null, -- was: required when opening_stock > 0
  p_is_scan_only boolean default false,
  p_base_unit_code text default 'each',
  p_description text default null,
  p_type text default null,            -- legacy v2.5 fallback
  p_has_batches boolean default false  -- v2.8.1 new
)
```

Behavior:
- `p_price = null` → variant created with `price = null`. Variant is
  unsellable until set (record_sale raises `variant_not_sellable`).
- `p_opening_stock = 0` → no synthetic opening purchase row. Variant
  starts at stock = 0, avg_cost = 0.
- `p_opening_stock > 0` (legacy path) → existing v2.6 behavior:
  synthesize an is_opening=true purchase row, set avg_cost.
- `p_has_batches = true` AND `p_opening_stock > 0` → raise
  `cannot_seed_opening_stock_for_batched_product`. Opening stock for
  batched products must go through the stock-in flow so batch info is
  captured.

### 4.2 `create_product_with_variants` — same treatment

Each variant row in `p_variants` becomes a partial:

```jsonc
{
  "attribute_value_ids": ["..."],
  "sku": null | "...",
  "price": null | <number>,        // null → unpriced
  "opening_stock": 0,              // default 0
  "opening_cost": null             // null when opening_stock = 0
}
```

Same v2.8.1 rule: if the product carries `has_batches = true`, any variant
row with `opening_stock > 0` raises.

### 4.3 No new RPCs

We deliberately don't introduce `create_product`. The existing RPC's
parameter list becomes the union of "minimal catalog" and "with opening
stock" by virtue of all the optional defaults. Adding a second RPC would
fragment the surface and confuse the frontend.

---

## 5. Frontend changes

### 5.1 Product create form (`ProductFormPage`)

**Remove**:
- Selling price field becomes optional (UI keeps the field but allows
  blank → null).
- "Opening stock" field — **dropped entirely**.
- "Opening cost per unit" field — **dropped entirely**.

**Add**:
- "Has batches" toggle in the "Inventory behavior" section (same control
  as the edit dialog). No guard rail at create time — a fresh product has
  zero stock by definition.
- Per-product alert window fields when `has_batches` is on (mirror the
  edit dialog).

**For variant-matrix products**: the matrix builder's per-row "Opening qty"
and "Opening cost" columns also drop. The matrix is now purely about
variant attributes + per-row price overrides.

**Banner**: a small explainer at the bottom of the form when there's no
opening stock / no price set, e.g.:

> "Stock comes in via Stock-in — pick this product there and check 'This is opening stock' for the first delivery. Selling price can be set now or later on the product detail page."

### 5.2 Edit dialog (`ProductEditDialog`)

No structural changes. The has_batches toggle keeps its existing guard
rail (toggle ON requires stock = 0). The selling-price field allows
blank → null.

### 5.3 Stock-in form (`NewPurchasePage`)

**Add**: a checkbox near the top — "This is opening stock for these
products." When checked, `p_is_opening = true` is sent to
`record_purchase`. Otherwise default false.

**Visual**: just a checkbox; we don't gate any fields off when it's
checked. The single difference at the DB level is the audit flag.

A small caption sits under it: "Use this when you're recording the first
delivery for one or more of these products."

### 5.4 Product detail (`ProductDetailBody`)

When `product.price` is null, render a banner near the header:

> "Selling price not set — POS won't allow sales until it's set. **Edit product**"

Clicking "Edit product" opens the edit dialog.

### 5.5 POS picker

Products with null price already get filtered out via the existing
`onlyInStock` filter (no stock yet) AND the existing record_sale guard.
We add a defense-in-depth check: don't include null-price products in the
POS picker even if they have stock. Currently the `search_products` RPC
returns them; the frontend filters them out, OR the picker shows a "set
price" hint when stock is present.

Pragmatic v2.8.1 ship: drop them from the picker entirely. Power user
sees the product on the catalog page; can't be sold until priced.

### 5.6 Receipt + Sale Detail

No changes. They already render variant price from `price_at_sale`
snapshot.

---

## 6. Back-compat

- **Existing products** (pre-v2.8.1) have price + opening stock set from
  the old create flow. Unchanged.
- **Existing stock-ins** are unchanged. The `is_opening` flag has
  existed since v1.5; this just exposes it.
- **The legacy create-RPC parameter list** stays back-compat: old client
  tabs that still send `p_price=750`, `p_opening_stock=5`,
  `p_opening_cost=500` continue to work.
- **No migration** — the schema is already shaped right.

---

## 7. Audit additions

Two new sanity audits in the CLAUDE.md suite:

```sql
-- v2.8.1 Audit 1: no null-priced product was ever sold
-- (would indicate the record_sale guard failed)
select count(*) from public.sale_items si
join public.product_variants v on v.id = si.variant_id
where v.price is null;
-- Must return 0.

-- v2.8.1 Audit 2: at most one is_opening purchase per product
-- (warning only, not a hard fail)
select v.product_id, count(*) as opening_count
from public.purchases pu
join public.purchase_items pi on pi.purchase_id = pu.id
join public.product_variants v on v.id = pi.variant_id
where pu.is_opening = true
group by v.product_id
having count(*) > 1;
-- Soft alert. Multiple openings = likely user error during onboarding.
```

---

## 8. Acceptance criteria

- [ ] Product create form has no opening-stock fields. Saves with null
      price + 0 stock + has_batches OR not.
- [ ] Product create with `has_batches = true` succeeds and the resulting
      product can immediately be stock-in'd with batch info.
- [ ] Stock-in form has the "This is opening stock" checkbox; the saved
      purchase has `is_opening = true` and `purchase_items` are written
      normally (with batch info for batched products).
- [ ] Product detail shows a "Selling price not set" banner when price
      is null. Saving a price clears the banner.
- [ ] POS doesn't surface null-priced products. Attempting to sell one
      via stale client raises `variant_not_sellable`.
- [ ] Existing data (pre-v2.8.1 products) continues to work — POS,
      stock-in, sales, batch tracking, all unchanged.
- [ ] All v2.6 + v2.6c + v2.8 audits stay at zero rows.

---

## 9. Migration / rollout

1. **Spec → Decision file** filed (`decisions/2026-05-12-pricing-decoupled-from-product-creation.md`).
2. **Backend** — single migration `0060_v281_pricing_decouple.sql`
   updates the two create RPCs (default parameters, has_batches handling).
3. **Frontend** — ProductFormPage drops the two opening-stock fields and
   gains the has_batches toggle; matrix builder drops opening qty/cost;
   NewPurchasePage adds the is_opening checkbox; ProductDetailBody adds
   the null-price banner; POS picker filters null-priced rows.
4. **Tests** — manual QA per spec.
5. **CLAUDE.md** — v2.8.1 PRD entry + 2 new gotchas + 2 new audit entries.

---

## 10. Future hooks unlocked

- **CSV bulk import** (a future ticket): upload a list of products with
  name/category/has_batches/etc., let stock-in handle inventory. Trivial
  on top of this spec.
- **Stock-in templates** (future): if a shop's typical first stock-in is
  20 items from 1 supplier with the same overhead pattern, save it as a
  template. Easier once stock-in is the only path that touches inventory.
- **v2.10 inventory adjustments** — opens cleanly because every inventory
  mutation is already a discrete event (`purchases` rows + future
  `inventory_adjustments` rows). No coupling to product creation.
