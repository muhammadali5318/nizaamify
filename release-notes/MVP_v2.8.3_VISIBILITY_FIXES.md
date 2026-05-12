# MVP v2.8.3 — Expired stock visibility + Price-missing surfacing

**Audience:** Claude Code
**Companion to:** `PRD.md` and v1.3–v2.8.2 specs.
**Stack:** unchanged.
**Type:** Two small visibility fixes bundled for a single ship.
**Realistic effort:** half a day to one full day.
**Prerequisite:** v2.8, v2.8.1, v2.8.2 all shipped.

> **What this ships.** Two narrow gaps from real post-v2.8 usage:
> 1. **Expired stock surfacing.** Batches whose `expiry_date < current_date` and `qty_remaining > 0` fall out of the dashboard widget the day they expire. They accumulate silently. A new dashboard section lists them, with the same shape as the existing expiring-soon widget but on the other side of the expiry line.
> 2. **Null-price surfacing.** Since v2.8.1 made price optional at create time, products can sit in the catalog without a sell price. They're invisible in POS but indistinguishable in the catalog list. A row-level visual + a small "needs pricing" filter chip surfaces the omission.
>
> Both are "make silent failure modes visible" fixes. No new data flows, no new business rules — just exposing state that already exists.

---

## 0. How to work this ticket

### Phase A — Discovery (short — this is a small ticket)

1. **Read `CLAUDE.md`** and recent fix specs (`v2.8`, `v2.8.1`, `v2.8.2`).
2. **Verify shipped state via MCP:**
   ```sql
   -- v2.8 audit (still passes)
   select * from public.batches_expiring_soon limit 1;

   -- Check for already-expired-but-still-active batches in live data
   select count(*) as expired_active_with_stock
   from public.inventory_batches
   where is_active = true
     and qty_remaining > 0
     and expiry_date is not null
     and expiry_date < current_date;

   -- Check for null-price variants on active products
   select count(*) as null_price_active_products
   from public.product_variants v
   join public.products p on p.id = v.product_id
   where v.is_active and p.is_active and v.price is null;
   ```
   Output volumes give you a sense of whether this ships into a problem that's already happened or is preventative.
3. **Skills check** — `frontend-design` skill for dashboard widget and list-row styling. Match existing v2.8 alert widget patterns exactly.
4. **Append entries to `tasks.md`** for v2.8.3.
5. **Append `decisions/`** entries scaffolded (see §7).
6. **No long discovery report needed** — this is two small visible changes. Proceed.

### Phase B — Backend (minimal)

One new view for expired stock. Possibly one helper view or RPC for null-price filter (or solve in frontend via existing `search_products` — see §3.2).

### Phase C — Frontend

One new dashboard section. One row-level visual in catalog list. One filter chip in catalog filter bar.

### Phase D — Verification

Manual smoke test. Update `CLAUDE.md`.

---

## 1. Expired stock dashboard section

### 1.1 The gap

`batches_expiring_soon` view (v2.8 §4.6) filters:
```sql
where ... and b.expiry_date - current_date <= alert_window_days
```

This does not include batches where `expiry_date < current_date`. The day a batch crosses the expiry line, it drops off the widget entirely. Shop owner has no surface that says "you have expired stock to deal with."

`batches_warranty_expiring_soon` already has the same exclusion (`warranty_expires_at >= current_date`). The warranty-already-expired case is deferred to v2.10 as part of the RTV workflow, which is correct — expired warranty means "you can no longer return defectives to the supplier," and the response is a workflow, not just a visual.

But **expired stock** is different. The response is simple: write it off (v2.8.2's partial-write-off flow handles this cleanly). No new workflow needed; just visibility.

### 1.2 New view: `batches_already_expired`

```sql
create or replace view public.batches_already_expired as
select
  b.id as batch_id,
  b.batch_no,
  b.qty_remaining,
  b.expiry_date,
  (current_date - b.expiry_date) as days_since_expired,
  v.id as variant_id,
  p.id as product_id,
  p.name as product_name,
  p.shop_id
from public.inventory_batches b
join public.product_variants v on v.id = b.variant_id
join public.products p on p.id = v.product_id
where b.is_active
  and b.qty_remaining > 0
  and b.expiry_date is not null
  and b.expiry_date < current_date;
```

No alert-window logic. Either a batch is expired or it isn't. Order in UI: most-recently-expired first (smallest `days_since_expired`), so shop owner sees the freshly-expired stock at the top.

RLS inherited through the variant → product → shop chain via the existing batch RLS policy. No new policy needed.

### 1.3 Dashboard section UI

Sits below the existing "Inventory alerts" widget. Same v1.7 design-system shell, distinct copy:

```
─ Expired stock ────────────────────────────────────────
  3 batches with expired stock still on hand
                                                [View all]

  Brand X Foundation — batch BX-FND-260605 (52 units) expired 12 days ago
  Olper's Milk — batch OLP-MLK-260828 (8 units) expired 4 days ago
  ...

                                       [ Write off all... ]
```

Per-row affordance: clicking a row navigates to the product detail page with the relevant batch row highlighted/scrolled-into-view. From there the shop owner uses v2.8.2's partial-write-off flow (`record_partial_writeoff` + `WriteOffBatchDialog`).

**"Write off all..." button:** opens a bulk-confirm dialog listing every expired batch and asking for a single reason. On confirm, iterates `record_partial_writeoff(batch_id, qty_remaining, reason)` for each. This is the only new affordance compared to v2.8's expiring-soon widget. Worth building because shop owners with monthly expiry cycles will want to clear them all at once rather than click each.

If the bulk write-off feels like scope creep, ship Phase 1 without it (per-row only) and add the bulk button as v2.8.4 if real shops ask. Recommend including it — it's about 30 minutes of UI work on top of what's already needed.

### 1.4 Visibility rule

Same as v2.8's alert widget: only render this section when there's at least one row to show. Empty state collapses entirely — no "no expired stock 🎉" celebration, that's noise.

### 1.5 Severity / urgency styling

Different from "expiring soon" amber treatment. Use a slightly more urgent visual (red or strong color per v1.7 design system's `danger` token). The shop owner has missed the prevention window; this is "deal with it now" not "be aware."

Cap the inline list at 5 rows; "View all" navigates to a dedicated list at `/inventory/expired` with the full set. Same pattern as v2.8's expiring-soon "View all" link.

### 1.6 Audit query addition

```sql
-- v2.8.3 Audit: every expired batch with stock either appears in the view
-- OR has been deactivated. No silent accumulation.
select b.id, b.batch_no, b.qty_remaining, b.expiry_date
from public.inventory_batches b
where b.is_active
  and b.qty_remaining > 0
  and b.expiry_date is not null
  and b.expiry_date < current_date
  and b.id not in (select batch_id from public.batches_already_expired);
-- Must return zero rows (the view filter is the same shape; this catches
-- any divergence from a future refactor).
```

Add to the audit suite.

---

## 2. Null-price surfacing in catalog

### 2.1 The gap

v2.8.1 made `product_variants.price` nullable and decoupled it from creation. The POS picker filters null-price products out (v2.8.1 §5.5). The product detail shows a banner (v2.8.1 §5.4). But the catalog list at `/products` treats null-price products identically to priced ones — a shop owner scrolling their catalog can't tell which products still need pricing.

For shops migrating in 200 products via the form, this matters. They'll forget some.

### 2.2 List row visual

In the existing `/products` list (from v2.5 § eye-icon row + v2.7 multi-variant treatment), the Price column for null-price products shows:

```
Name                Category      Stock       Price                Add to cart
iPhone 14           Mobile        50 each     Rs 100,000              [+]
Cable USB-C         Accessories   120 each    Rs 200                  [+]
Brand X Foundation  Cosmetics     0 (none)    Set price ⚠            [...]
```

- The Price cell renders "Set price ⚠" in muted/danger tone (per v1.7 `danger` token at reduced emphasis — not screaming red, but not invisible either).
- Clickable — clicking navigates to the product detail page (same as v2.5's eye-icon / row-click), where the v2.8.1 "Selling price not set" banner + edit dialog already exists.
- For multi-variant products with mixed pricing (some variants priced, some not), show `Rs 200 – set price ⚠` so the partial state is visible. If all variants are null, show `Set price ⚠`.

### 2.3 Filter chip in catalog filter bar

The v2.5 filter bar has Search + Category. Add a single filter chip:

```
Search [____________]  Category [All ▼]  ☐ Needs pricing
```

When checked, the list filters to products where at least one active variant has `price = null`. URL state: `?needs_pricing=1` so the filter is shareable / bookmarkable / back-button-preserved.

### 2.4 Backend support

The existing `search_products` RPC (v2.6 + v2.7) returns `product_with_default_variant` shape, which already exposes variant `price`. The frontend can filter on this client-side for single-variant products.

For multi-variant products, `product_with_default_variant.price` is `null` (no default variant). The frontend needs to know "does any variant of this product have null price?" That data isn't in the current view shape.

Two options:

**Option A (frontend-only):** add an aggregate to `product_with_default_variant` — `has_null_price_variant boolean` computed as `exists(select 1 from product_variants where product_id = p.id and is_active and price is null)`. Single SQL change, no new RPC. Filter chip becomes a server-side filter via a new parameter `p_needs_pricing` on `search_products`.

**Option B (skip the aggregate):** filter chip queries a separate RPC `list_products_needing_pricing()`. Two code paths in the catalog list (regular search vs. needs-pricing filter), which is fragile.

**Recommend Option A.** One column add to the view, one parameter add to `search_products`. Backward compatible.

```sql
-- Update v2.7's product_with_default_variant view
create or replace view public.product_with_default_variant as
select
  p.id as product_id,
  p.shop_id,
  p.name,
  p.category_id,
  p.description,
  p.is_scan_only,
  p.is_active as product_is_active,
  p.base_unit_id,
  p.has_variants,
  p.has_batches,
  p.created_at as product_created_at,
  p.updated_at as product_updated_at,
  v.id as variant_id,
  v.sku,
  v.stock,
  v.price,
  v.cost,
  v.avg_cost,
  v.last_purchase_cost,
  v.is_active as variant_is_active,
  (select count(*) from public.product_variants where product_id = p.id and is_active) as variant_count,
  (select sum(stock) from public.product_variants where product_id = p.id and is_active) as total_stock_all_variants,
  (select min(price) from public.product_variants where product_id = p.id and is_active and price is not null) as min_price,
  (select max(price) from public.product_variants where product_id = p.id and is_active and price is not null) as max_price,
  -- NEW in v2.8.3:
  exists(
    select 1 from public.product_variants
    where product_id = p.id and is_active and price is null
  ) as has_null_price_variant
from public.products p
left join public.product_variants v
  on v.product_id = p.id and v.is_default and v.is_active and not p.has_variants;
```

And update `search_products`:

```sql
create or replace function public.search_products(
  p_query text default null,
  p_category_id uuid default null,
  p_needs_pricing boolean default false,    -- NEW v2.8.3
  p_limit int default 50,
  p_offset int default 0
) returns setof public.product_with_default_variant
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_q text := coalesce(trim(p_query), '');
begin
  if v_shop_id is null then return; end if;
  set local pg_trgm.similarity_threshold = 0.2;

  if length(v_q) = 0 then
    return query
      select * from public.product_with_default_variant
      where shop_id = v_shop_id
        and product_is_active
        and (p_category_id is null or category_id = p_category_id)
        and (not p_needs_pricing or has_null_price_variant)
      order by product_updated_at desc
      limit p_limit offset p_offset;
    return;
  end if;

  return query
    select * from public.product_with_default_variant
    where shop_id = v_shop_id
      and product_is_active
      and (p_category_id is null or category_id = p_category_id)
      and (not p_needs_pricing or has_null_price_variant)
      and (name % v_q OR name ilike '%' || v_q || '%')
    order by
      case when name ilike v_q || '%' then 0 else 1 end,
      similarity(name, v_q) desc nulls last,
      length(name)
    limit p_limit offset p_offset;
end;
$$;
```

Same pattern as v2.5's `p_category_id` addition — additive, defaults preserve old behavior.

### 2.5 Counter in the filter chip

When `needs_pricing` filter is active, show the count in the chip label:

```
☑ Needs pricing (4)
```

Computed via the standard `search_products_count` counterpart (which also accepts `p_needs_pricing`).

### 2.6 Empty state

If filter returns zero products: friendly empty state — "All products are priced." With a small "Clear filter" link. Same pattern as v2.5's empty category filter.

---

## 3. Implementation order

1. **Discovery** (Phase A): run the two SQL checks for current state; note volumes.
2. **Append `tasks.md`** with v2.8.3 phases.
3. **Migration `00XX_v283_expired_and_pricing_visibility.sql`:**
   - Create `batches_already_expired` view.
   - Update `product_with_default_variant` view with `has_null_price_variant` column.
   - Update `search_products` and `search_products_count` to accept `p_needs_pricing`.
4. **Regenerate `database.ts`.**
5. **Add audit query** from §1.6 to the audit suite (CLAUDE.md update).
6. **Frontend — expired stock dashboard section:**
   - New widget below existing alerts widget on dashboard.
   - Per-row click handler navigates to product detail with batch highlighted.
   - Bulk "Write off all..." dialog calling `record_partial_writeoff` in a loop.
   - "View all" route `/inventory/expired` with full list.
7. **Frontend — null-price surfacing:**
   - Catalog list row Price cell renders "Set price ⚠" for null-price.
   - Multi-variant: "Rs X – set price ⚠" for partial pricing.
   - Filter chip "Needs pricing (N)" with URL state.
   - Empty state when filter returns zero.
8. **i18n updates** (§5).
9. **Manual smoke test** (§6).
10. **Update `CLAUDE.md`** (§8).
11. **Write decision files** (§7).
12. **Final report** in chat with screenshots of both new surfaces.

---

## 4. Hard constraints

- **No new business logic.** Both fixes expose state that already exists.
- **No schema changes to base tables.** Only view + function updates.
- **No regression to v2.8 alert widget behavior.** It keeps doing exactly what it does today.
- **No changes to `record_partial_writeoff` or `deactivate_batch`.** The bulk write-off dialog is purely a frontend loop over the existing RPC.
- **Preserve all v1.3–v2.8.2 acceptance criteria.**

---

## 5. i18n keys (additions)

```jsonc
// locales/en/dashboard.json (additions)
{
  "expired_stock": {
    "title": "Expired stock",
    "count_one": "{{count}} batch with expired stock still on hand",
    "count_other": "{{count}} batches with expired stock still on hand",
    "expired_days_ago_one": "expired {{count}} day ago",
    "expired_days_ago_other": "expired {{count}} days ago",
    "view_all": "View all",
    "write_off_all": "Write off all...",
    "write_off_all_dialog_title": "Write off {{count}} expired batches",
    "write_off_all_dialog_body": "All listed batches will be written off with the reason below. This removes their stock and marks them inactive.",
    "write_off_all_reason_label": "Reason",
    "write_off_all_reason_placeholder": "e.g., Expired stock cleanup"
  }
}

// locales/en/products.json (additions)
{
  "list": {
    "set_price_warning": "Set price",
    "set_price_aria": "This product needs a selling price",
    "price_range_with_unpriced": "Rs {{min}} – set price"
  },
  "filters": {
    "needs_pricing": "Needs pricing",
    "needs_pricing_count": "Needs pricing ({{count}})",
    "all_priced_empty": "All products are priced.",
    "clear_filter": "Clear filter"
  }
}
```

Mirror in `locales/ur/*`.

---

## 6. Manual test matrix

### 6.1 Expired stock widget — empty state
- Shop with no batched products, or all batches still within expiry.
- Dashboard: expired stock widget does not render.

### 6.2 Expired stock widget — populated
- Pick a batched product (e.g., Brand X Foundation).
- Via direct SQL (test-only), set one batch's `expiry_date = current_date - 12` and ensure `qty_remaining > 0, is_active = true`.
- Refresh dashboard.
- Verify: widget renders with one row.
- Verify: row shows product name, batch_no, qty_remaining, "expired 12 days ago".
- Click row → product detail page opens, batch highlighted or scrolled into view.

### 6.3 Bulk write-off
- Create 3 expired batches across 2 products via direct SQL.
- Dashboard: widget shows all 3.
- Click "Write off all...". Dialog lists all 3 with qty.
- Enter reason "Monthly expiry cleanup". Confirm.
- Verify: each batch gets `qty_remaining = 0`, `is_active = false` (per v2.8.2 trigger).
- Verify: `variant.stock` decremented for each affected variant.
- Verify: audit 1 (variant.stock = Σ active_batch.qty_remaining) still passes.
- Refresh dashboard: widget no longer renders (empty).

### 6.4 Null-price single-variant
- Create new product "Test Product Unpriced" via product form, leave price blank.
- Catalog list at `/products`: row shows "Set price ⚠" in Price column.
- Click the row → product detail. v2.8.1 banner appears.

### 6.5 Null-price filter chip
- With at least one null-price product in catalog.
- Click "Needs pricing" chip. Verify URL becomes `?needs_pricing=1`.
- List filters to only null-price products. Chip shows count.
- Combine with category filter: both apply (AND).
- Combine with search query: all three apply.
- Uncheck → returns to full list.

### 6.6 Null-price multi-variant (partial pricing)
- Create variant product with 3 variants. Price 2 of them, leave 1 null.
- Catalog list: Price column shows "Rs X – set price ⚠".
- "Needs pricing" filter includes this product.

### 6.7 Null-price empty state
- Set all products to have prices.
- Click "Needs pricing" filter. Verify empty state "All products are priced."
- "Clear filter" link returns to full list.

### 6.8 POS regression
- Product with null price.
- Search in POS picker. Verify it does NOT appear (per v2.8.1 §5.5 filter).
- No regression to existing POS behavior.

### 6.9 Audit queries
- Run v2.8.3 audit (§1.6). Must return zero rows.
- Run all v2.6 + v2.8 + v2.8.1 + v2.8.2 audits. Must return zero rows.

### 6.10 Cross-shop isolation
- Account B does not see Account A's expired batches or null-price products.

---

## 7. Decision files

1. `2026-05-13-expired-stock-as-separate-dashboard-section.md` — why a separate section vs. extending the expiring-soon widget; rationale (different urgency, different action).
2. `2026-05-13-bulk-write-off-loops-existing-rpc.md` — bulk write-off implemented as frontend iteration over `record_partial_writeoff`, not a new bulk RPC; rationale (no new server logic needed; preserves audit trail of N individual write-offs with same reason).
3. `2026-05-13-has-null-price-variant-aggregate-on-view.md` — adding aggregate to `product_with_default_variant` view rather than a separate RPC; rationale.

---

## 8. CLAUDE.md update

Append to versioned PRDs section:

```
- v2.8.3: visibility fixes for two silent failure modes. Expired stock dashboard section surfaces batches past expiry_date that still have qty_remaining > 0 (the day-after-expiry silent-accumulation gap from v2.8). Catalog list and filter chip surface null-price products from v2.8.1's optional pricing flow.
```

Add to **Gotchas**:

```
- Two batch-visibility views exist: batches_expiring_soon (within alert window, not yet expired) and batches_already_expired (past expiry, stock on hand). They're mutually exclusive by design; together they cover the lifecycle.
- The product catalog list's "Needs pricing" filter and row treatment relies on product_with_default_variant.has_null_price_variant. When adding new fields to the view, preserve this aggregate.
- Bulk write-off from the expired stock widget is a frontend loop over record_partial_writeoff, not a separate RPC. Each batch gets its own write-off row in the future v2.10 adjustments ledger. Don't combine into one ledger entry; the per-batch granularity is the audit trail.
```

Add to **Open ToDos / Known gaps**:

```
- batches_warranty_expired view (analog of batches_already_expired for the warranty case) is still deferred to v2.10 as part of the RTV workflow. Shop owner doesn't get a passive alert when supplier warranty lapses; they get the RTV-window-closing flow.
```

---

## 9. Out of scope

- **Warranty-already-expired surfacing.** v2.10 with RTV workflow.
- **Per-product "needs pricing" reminders** (e.g., email at 24 hours).
- **Auto-deactivate of expired batches.** Shop owner action — system surfaces, owner decides.
- **Bulk re-pricing UI** (set price on N null-price products at once). Future if real shops have lots of unpriced products.
- **Reports on historical write-offs.** v2.10's adjustments ledger.

---

*End of v2.8.3 spec.*
