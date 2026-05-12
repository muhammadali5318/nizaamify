# MVP v2.3 — Fixes from v2.1 / v2.2 testing

**Audience:** Claude Code
**Companion to:** `PRD.md` and v1.3–v2.2 specs.
**Stack:** unchanged.
**Type:** Bug-fix + scope reduction + rename.
**Realistic effort:** 2–3 days.

> **Two consequential design changes** worth flagging up front:
> 1. **Customer tier auto-discount is removed.** Tiers stay as customer **categories** (Wholesale / VIP / Walk-in for the chip display), but no automatic % gets applied at sale time when a customer is selected. The **manual sale-time discount popup stays** — cashier can still apply % or PKR per-sale, with state resetting after each sale. Reasoning: real shopkeeper negotiations vary per sale; a fixed customer rate is the wrong abstraction.
> 2. **Schema rename: `tier_*` → `sale_discount_*` on invoices.** Once tiers don't carry pricing, calling the override "tier_override" is misleading. Columns get renamed to `sale_discount_type`, `sale_discount_value`, `sale_discount_amount`, `sale_discount_percent_snapshot`. Clean semantics for v3+ engineering.
>
> Plus several real bug fixes: overhead rounding, NaN in stock-in detail, search-by-name-only, supplier dropdown width, product form decimal steps, POS UI polish.

---

## 0. How to work this ticket

### Phase A — Discovery (mandatory before code)

1. **Re-read** `CLAUDE.md` and recent fix specs (`v1.9`, `v2.1`, `v2.2`).
2. **Skills check** — same routine. Use `frontend-design` skill for UI work.
3. **Determine v2.2 build state.** Three possibilities:
   - **(a) v2.2 fully shipped** — tiers + line discounts + override modal all live with `tier_*` columns populated.
   - **(b) v2.2 partially shipped** — schema landed, some UI done.
   - **(c) v2.2 never started** — only v2.1 is live; `tier_*` columns don't exist yet on invoices.
   
   Run schema inspection via MCP and report which case. The migration in §7 is idempotent and handles all three.
4. **Reproduce the bugs** the user reported. For account `muhammad.ali.dev97@gmail.com`:
   - Stock-in: Redmi X7 (qty 56, unit cost 1,250) + iPhone 16 (1 box of 14 at 14,000) + delivery overhead 1,000.
   - Verify the displayed `overhead/unit` values are `15` and `12` (whole-number rounded — this is bug #1).
   - Verify the round-trip: `15 × 56 + 12 × 14 = 1,008 ≠ 1,000` overhead total. This is the rounding-error bug.
   - Verify `#` column shows `NaN` in stock-in detail.
   - Verify product search returns inaccurate results.
5. **Discovery report in chat** — v2.2 build state, schema diff, bug reproduction notes, plan, then proceed.

### Phase B — Schema migration

Single migration `00XX_v23_fixes.sql`. Idempotent. Apply via MCP, regenerate `database.ts`.

### Phase C — Backend functions

Update `record_purchase` (largest-remainder rounding). Update `record_sale` (drop tier auto-discount; keep manual sale-discount; rename params). Update `search_products` (name-only).

### Phase D — Frontend

In the order in §9. Heavy on UI fixes — coordinate with `frontend-design` skill conventions and the v1.7 design system.

### Phase E — Verification

Manual smoke test reproducing the user's stock-in scenario. Update CLAUDE.md.

---

## 1. Customer tier scope reduction (KEEP manual override)

### 1.1 What's removed

- `customer_tiers.discount_percent` column → **dropped**
- Auto-application of customer's tier discount when customer is selected in POS → **removed**
- The "Tier discount (Wholesale 5%)" line that auto-renders in totals based on customer → **removed**

### 1.2 What's kept (and renamed)

- **Manual sale-time discount popup** — cashier triggers it on the current sale. % or PKR. State resets after submit, after customer change, or on "Remove discount" click. **Renamed from "Override" to "Apply discount"** in UI copy.
- `customer_tiers` table — purely as customer **categories** now (name, is_default, is_active, notes)
- `customers.tier_id` — categorization
- `invoices.tier_id` — still snapshots customer's tier at sale time (for reporting, chip display in sale detail)
- `sale_items.line_discount_*` — per-line discounts unchanged from v2.2
- v1.3's editable unit price at sale time (cashier negotiation) — unchanged

### 1.3 The rename: `tier_*` → `sale_discount_*` on invoices

Once tiers don't carry pricing, the "tier override" naming is misleading. Rename columns:

| Before (v2.2) | After (v2.3) | Purpose |
|---|---|---|
| `invoices.tier_override_type` | `invoices.sale_discount_type` | `'percent'` or `'fixed'` (or NULL if no discount applied) |
| `invoices.tier_override_value` | `invoices.sale_discount_value` | The user-entered value at sale time (for audit) |
| `invoices.tier_discount_percent_snapshot` | `invoices.sale_discount_percent_snapshot` | The percent applied (NULL for fixed) |
| `invoices.tier_discount_amount` | `invoices.sale_discount_amount` | The PKR amount applied (always populated, default 0) |

Note: `invoices.tier_id` stays — it's snapshotting which **category** the customer was in, which is still useful for reporting.

The constraint `invoices_tier_override_consistent` is renamed to `invoices_sale_discount_consistent`. The constraint `invoices_tier_override_no_tier_id` is **dropped** entirely (no longer applicable — tier and discount are now independent concepts).

### 1.4 UI consequence

| Surface | Before (v2.2) | After (v2.3) |
|---|---|---|
| POS totals (default) | Auto-renders "Tier discount (Wholesale 5%)" line when customer selected | No auto-discount line. **"Apply discount"** link/button visible. |
| POS totals (with discount applied) | "Manual override (10%) −120" | "Discount (10%) −120" with [Edit] / [Remove] |
| Discount modal title | "Override discount for this sale only" | **"Apply discount to this sale"** |
| Settings → Customer Tiers | Edit name, discount %, default | Edit name, default. **No discount field.** |
| Customer create/edit | Tier picker (with discount info) | Tier picker (categorization only) |
| Customer chip on POS / khata | Tier name + discount % | Tier name only ("Wholesale") |
| Sale detail | "Tier discount (Wholesale 5%) −60" or "Manual override (10%) −120" | "Discount (10%) −120" or "Discount (fixed) −200" or no line |

### 1.5 Discount state lifecycle (the bug fix)

The cart's discount state is **scoped to the in-progress sale**. It clears on:
- Successful sale submit
- Customer change (selecting a different customer or going back to walk-in)
- Explicit "Remove" click in the totals area
- Page navigation away from POS (full state reset)

It **persists** across:
- Adding/removing/editing cart lines
- Editing service charge
- Editing payment amount

This matches the user's expectation: discount is per-sale, not per-cart-mutation.

### 1.6 Why this is the right call

- Real-world negotiations are per-sale, not per-customer
- Cashiers want quick "take 100 off" or "10% off this one" without configuring a tier first
- Per-line discount + sale-level discount + cashier price edit covers 95% of real cases
- Tiers as categories still useful for visual differentiation in customer lists

---

## 2. Overhead allocation rounding fix

### 2.1 The bug, walked through

User's stock-in: Redmi X7 (qty 56 @ 1,250) + iPhone 16 (1 Box of 14 @ 14,000) + delivery 1,000.

```
Items subtotal       = 56 × 1,250 + 14,000        = 84,000
Overhead             = 1,000

Per-line allocation:
  Redmi share        = 1,000 × 70,000 / 84,000    = 833.333...
  iPhone share       = 1,000 × 14,000 / 84,000    = 166.666...

Sum (full precision)                              = 1,000.00     ✓

Rounded to 2 decimals (PKR precision):
  Redmi              = 833.33
  iPhone             = 166.67
Sum (rounded)                                     = 1,000.00     ✓

Per-base-unit overhead (when stored as overhead_per_unit):
  Redmi              = 833.33 / 56                = 14.88     (UI showed 15 — bug)
  iPhone             = 166.67 / 14                = 11.91     (UI showed 12 — bug)

Round-trip check:
  Correct values:    14.88 × 56 + 11.91 × 14      = 1,000.02   ≈ 1,000
  Buggy whole-num:   15 × 56   + 12 × 14          = 1,008      ≠ 1,000   ✗
```

Two distinct issues:
1. **UI rounded to whole rupees** instead of 2 decimals (display bug)
2. **Storing `overhead_per_unit` loses precision** (data model bug)

### 2.2 The fix

Switch the storage column. Instead of storing `overhead_per_unit` (which compounds rounding), store **`line_overhead_amount`** (the total overhead allocated to this line). Per-unit is derived for display only.

Schema change in §7. Function rewrite in §8.1.

### 2.3 Largest-remainder rounding for exact reconciliation

Even with `line_overhead_amount` stored as 2 decimals, multi-line allocations can drift by a paisa or two. Use **largest-remainder method**:

```
1. Compute each line's share with full precision
2. Round each to 2 decimals
3. Sum the rounded values
4. The difference (input total − sum) goes to the line with the largest absolute share
```

This guarantees `Σ line_overhead_amount = overhead_subtotal` exactly. Implementation in §8.1.

### 2.4 Display

Per-unit overhead in stock-in detail and audit views:
```
overhead_per_unit_display = line_overhead_amount / qty_in_base
```
Format with 2 decimals.

User's example post-fix:
- Redmi: `Rs 14.88 / unit`
- iPhone: `Rs 11.91 / unit`

Storage: `line_overhead_amount` = 833.33 + 166.67 = 1,000.00 exactly. Display rounding is only at the cosmetic layer.

---

## 3. Stock-in form fixes

### 3.1 Per-piece cost display when buying in packs

When the unit selector is a pack (Box, Carton, etc.), show a small derived value beneath the unit cost field:

```
#  Product           Unit              Qty   Unit cost     Per piece    Line total ✕
1  iPhone 16       ▼ [Box (14) ▼]      1     14,000        Rs 1,000      14,000     ×
                                                            (= 14,000 ÷ 14)
2  Redmi X7        ▼ [Each ▼]          56    1,250         —             70,000     ×
```

**Rules:**
- "Per piece" only renders when a pack (`base_qty > 1`) is selected.
- Computed live as `unit_cost / pack.base_qty`. Display 2 decimals.
- Helps the user sanity-check "did I enter the right per-pack price?"
- Read-only; not editable.
- Mobile: per-piece appears as a small sub-line under the unit cost field.

### 3.2 Search by name only

The current `search_products` function (per v1.5) searches both name and type. The user reports type-based matches are noise (types are too generic). Rewrite to name-only:

```sql
create or replace function public.search_products(
  p_query text,
  p_limit int default 10,
  p_offset int default 0
) returns setof public.products
language plpgsql security definer set search_path = public as $$
declare v_shop_id uuid := public.current_shop_id();
        v_q text := coalesce(trim(p_query), '');
begin
  if v_shop_id is null then return; end if;

  set local pg_trgm.similarity_threshold = 0.2;

  if length(v_q) = 0 then
    return query
      select * from public.products
      where shop_id = v_shop_id and is_active
      order by updated_at desc
      limit p_limit offset p_offset;
    return;
  end if;

  return query
    select p.* from public.products p
    where p.shop_id = v_shop_id
      and p.is_active
      and (
        p.name % v_q                          -- trigram fuzzy match
        OR p.name ilike '%' || v_q || '%'     -- substring fallback
      )
    order by
      case when p.name ilike v_q || '%' then 0 else 1 end,  -- prefix wins
      similarity(p.name, v_q) desc nulls last,
      length(p.name)
    limit p_limit offset p_offset;
end;
$$;
```

> **Search accuracy debug checklist for Phase A:**
> - Confirm `pg_trgm` extension is installed.
> - Confirm GIN index `idx_products_name_trgm` on `products(name gin_trgm_ops)` exists (was specified in v1.5 — verify it actually landed).
> - Test with single-word and multi-word queries.
> - Test with leading/trailing whitespace (`v_q := trim(...)`).
> - Test partial-prefix matches ("iph" should find "iPhone 16").
> - The combined `%` (trigram) + `ilike` filter ensures both fuzzy AND substring matches surface — not just one.

### 3.3 Supplier dropdown width

Current: dropdown is too narrow, truncates supplier names.

Fix: in the design-system Select primitive (or wherever the supplier picker is rendered):
- `min-width: 280px` on desktop
- Full-width on mobile
- Long names truncate with ellipsis but tooltip shows full name on hover

Use `frontend-design` skill conventions for the dropdown anatomy. Match the customer combobox shape from v1.4/v2.1.

### 3.4 Bidirectional cost calc preserved

v1.9's bidirectional calc (qty/unit cost/line total — fill any two, third computes) still works. Per-piece display in §3.1 is purely derived and read-only; doesn't affect the calc.

---

## 4. Stock invoice display fixes

### 4.1 NaN in `#` column

Frontend bug — row index is being read from a property that doesn't exist on the row data, evaluating as `NaN`. Fix: derive serial from the array index in JSX.

```jsx
{purchaseItems.map((item, idx) => (
  <Row key={item.id}>
    <Cell>{idx + 1}</Cell>
    {/* ... */}
  </Row>
))}
```

Same fix on the additional-costs table (also showed NaN per user report).

### 4.2 Column restructure

Current columns confuse users:
```
# | Product | Quantity | Unit cost | Overhead/unit | Effective cost | Line total
```

The "Line total" doesn't include overhead, but "Effective cost" does — visually inconsistent.

**New columns:**
```
# | Product | Qty | Unit cost | Subtotal | Overhead | Total
```

Where:
- **Unit cost**: per the unit transacted in (per box / per each / per carton). For pack lines, primary cell shows "Rs 14,000 / box" with smaller secondary "(Rs 1,000 / piece)" beneath.
- **Subtotal**: `qty × unit_cost` — what was paid to the supplier for this line, excluding overhead.
- **Overhead**: `line_overhead_amount` — the share of additional costs allocated to this line.
- **Total**: `subtotal + overhead` — fully landed cost for this line.

Effective per-unit cost (`(subtotal + overhead) / qty_in_base`) is shown in a small info popover on the row, not as a primary column. It's useful but secondary.

Mobile: stack into card layout per v1.7. Each card shows product name (bold), qty, unit cost, then a small "Subtotal Rs X · Overhead Rs Y · Total Rs Z" line.

### 4.3 Overhead distribution explanatory note

Below the additional-costs section in the stock-in form **and** at the top of the additional-costs section in the stock-in detail page, render a small info note:

```
ⓘ How additional costs are handled
   These costs (delivery, labor, customs, etc.) are distributed across
   products by line value. A product worth more of the bill absorbs a
   larger share. This affects each product's average cost so your profit
   reports reflect the true cost of inventory.
```

Use the v1.7 info-callout primitive. Plain language, no jargon. Translate to Urdu in the i18n pass.

### 4.4 "Effect on inventory" wording — replace Δ symbol

Current header: `Δ`. Lay-users don't recognize this symbol.

**New header:** "Cost change" with a small info tooltip: "The change in this product's average cost after adding this stock-in."

Cell rendering:
- Positive change (avg cost went up): "+Rs 745 ▲" (subtle directional arrow)
- Negative change (avg cost went down): "−Rs 200 ▼"
- No change: "Rs 0" or "—"

Plain wording, directional arrows readable on mobile too. No reliance on `Δ` symbol anywhere.

---

## 5. Product form fixes

### 5.1 Number input step = 1, no decimal arrow steps

Both the **opening cost** and **selling price** fields currently use `step="0.01"` so up/down arrows shift by 1 paisa. Change to `step="1"`.

```jsx
<Input
  type="number"
  step="1"
  min="0"
  inputMode="numeric"
  value={value}
  onChange={...}
/>
```

For display formatting:
- Use `Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 })` for PKR amounts in lists/receipts/invoices.
- Allow up to 2 decimals on **input** (some products may have legitimately fractional prices), but the up/down step is whole rupees.

This applies to:
- Product create/edit form (price, opening_cost)
- Stock-in form (unit cost, overhead amounts)
- POS line price edit
- Per-line discount fixed amount
- Service charge

### 5.2 Pagination on products list

Per v1.5, server-side pagination was specced for `/products` (50 per page). Verify it's actually implemented:

1. Inspect `/products` page.
2. With > 50 products in the test account, verify:
   - Page shows 50 items
   - Pagination controls (Previous / Next or page numbers) appear
   - Next page loads next 50
   - URL reflects page state (`?page=2`)
3. If missing, implement per the v1.5 spec.

If the test account has < 50 products, seed more via direct SQL to test:

```sql
-- Test-account seed for pagination verification (remove after)
insert into public.products (shop_id, name, type, price, stock, base_unit_id)
select
  v_shop_id,
  'Test product ' || generate_series,
  'test',
  100,
  10,
  (select id from public.units_of_measure where shop_id = v_shop_id and code = 'each')
from generate_series(1, 60);
```

---

## 6. POS / Cart fixes

### 6.1 Sale-discount popup — kept, renamed, reset-on-submit

**Renamed** from "Override discount for this sale only" to **"Apply discount to this sale"**. The model is now: there's no auto-discount to "override"; the cashier is just applying a one-off discount.

#### 6.1.1 Trigger

A small **"Apply discount"** link in the totals area (visible whenever no discount is applied):

```
Items subtotal       1,200
Service charge   [    200  ]
─────────────────────────────
Total                1,400                 [Apply discount]
```

Click → opens the modal.

#### 6.1.2 Modal

```
Apply discount to this sale

  Discount type:  ● Percentage    ○ Fixed amount
  
  Value:          [ ___ ] %        (label adjusts: "%" or "PKR")
  
  Items subtotal:        1,200
  Discount:             −60        (live preview)
  Service charge:        200
  Total:                 1,340

  This sale only — clears after submit.
  
  [ Cancel ]    [ Apply ]
```

#### 6.1.3 Totals area when discount is applied

```
Items subtotal       1,200
Discount (10%)      −120                   [Edit]  [Remove]
Service charge   [   200   ]
─────────────────────────────
Total                1,280
```

- "Edit" reopens the modal with current values pre-filled.
- "Remove" clears the discount immediately, no confirmation needed.
- For fixed-amount discounts: "Discount (fixed) −200".

#### 6.1.4 State lifecycle (the bug fix)

The discount state **clears** on:
- Successful sale submit ✓ (the user's reported bug)
- Customer change
- Explicit "Remove" click
- Navigation away from POS

It **persists** across:
- Adding / removing / editing cart lines
- Editing service charge
- Editing payment amount

Implementation note: the discount state lives in POS-page-level state (Zustand / Context / wherever the cart state lives). On successful `record_sale` response, dispatch an action that clears `saleDiscount` along with `cart` and `customer` (the existing post-sale reset).

### 6.2 Customer dropdown improvements

#### 6.2.1 Boundary / visual separation

Issue: customer combobox merges visually into the cart card; users have trouble seeing where the picker ends.

Fix per v1.7 design system:
- Wrap the customer picker in a dedicated `<Card>` or boxed container with a subtle border
- Clear margin between the picker and the cart line list
- Distinct background tone (use `--surface-2` or equivalent token)

Layout sketch:
```
┌─ Customer ────────────────────────────────────────┐
│  ● Ahmed Khan       [Wholesale]    +92 300 1234567│
│                                          [Change ✕]│
└────────────────────────────────────────────────────┘

┌─ Cart ─────────────────────────────────────────────┐
│  iPhone 14   ...                                   │
│  Cable       ...                                   │
└────────────────────────────────────────────────────┘
```

#### 6.2.2 Customer category chip

When a customer is selected, render their tier as a chip beside the name. Distinct chip colors per category (configured via design system tokens):
- Walk-in: neutral gray
- Wholesale: blue
- VIP: purple/gold
- Custom tiers: cycle through the v1.7 chip palette by hash of name

The chip is **purely visual**. No discount, no pricing impact. Cashier sees at a glance who they're serving.

In the customer dropdown list (open state), each row shows: name + chip + phone.
```
Ahmed Khan         [Wholesale]    +92 300 1234567
Tariq Mehmood      [VIP]          +92 333 5678901
Walk-in customer   [Walk-in]
```

#### 6.2.3 Walk-in differentiation

The current dropdown shows generic "Walk-in customers" with no way to distinguish.

Fix:
- "Walk-in" is a special pseudo-customer (represents `customer_id = null` on the invoice)
- Always pin "Walk-in customer" to the top of the dropdown
- Always shows its [Walk-in] chip
- Recent named customers come below

If the user later wants distinct walk-in entries (e.g., named "Walk-in 1pm" / "Walk-in 2pm" for tracking), that's a separate feature out of scope here.

### 6.3 POS cart card column structure

#### 6.3.1 Column titles

Cart line items lack column headers. Add them at the top of the cart:

```
Product                     Qty   Price       Total
iPhone 14   [edit]           1    100,000   100,000   ✕
Cable USB-C [edit]           5    200          1,000  ✕
```

Headers in design-system caption typography. Right-align numeric columns.

#### 6.3.2 Add button position

Move the "Add product" button (`+`) to the **rightmost** column of the product list / search results, not interleaved with product info.

Layout:
```
Product list / search results
┌────────────────────────────────────────────────────┐
│ Name             Stock        Price          [+]   │
│ iPhone 14        50 each      100,000        [+]   │
│ Cable USB-C      120 each     200            [+]   │
└────────────────────────────────────────────────────┘
```

The `+` is the primary affordance for "add to cart". Right column. Click → adds 1 base unit at the default price.

#### 6.3.3 Pack quick-add buttons

For products with packs defined (per v2.1), the quick-add buttons currently sit inline next to the product. Polish:

- Place them **below** the product name, not crowding the line
- Consistent button styling per v1.7 design system (secondary variant)
- Smaller secondary button style, distinct from the primary `+`
- Show the pack short label clearly

```
┌────────────────────────────────────────────────────┐
│ Chocolate Bar                Stock: 5 cartons      │
│ Rs 12 each                                  [ + ]  │
│ Quick add: [+1 Box (10)]  [+1 Carton (100)]        │
└────────────────────────────────────────────────────┘
```

For scan-only products (per v2.1 §5.4), hide the primary `[+]`; only quick-add appears:
```
┌────────────────────────────────────────────────────┐
│ Specialty Chocolate          Stock: 10 boxes       │
│ Scan only                                          │
│ Quick add: [+1 Box (10)]                           │
└────────────────────────────────────────────────────┘
```

---

## 7. Schema migration

Single migration `00XX_v23_fixes.sql`. Idempotent regardless of v2.2 build state.

```sql
-- =========================================================
-- 1. CUSTOMER TIER REVERT — drop discount_percent
-- =========================================================
alter table public.customer_tiers drop column if exists discount_percent;

-- =========================================================
-- 2. INVOICE DISCOUNT COLUMNS — rename tier_* to sale_discount_*
-- =========================================================
-- Drop the constraint that linked tier_id and override (no longer applicable)
alter table public.invoices
  drop constraint if exists invoices_tier_override_no_tier_id;

-- Rename columns (idempotent — checks if old name exists first)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'invoices'
             and column_name = 'tier_override_type') then
    alter table public.invoices rename column tier_override_type to sale_discount_type;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'invoices'
             and column_name = 'tier_override_value') then
    alter table public.invoices rename column tier_override_value to sale_discount_value;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'invoices'
             and column_name = 'tier_discount_percent_snapshot') then
    alter table public.invoices rename column tier_discount_percent_snapshot
                                          to sale_discount_percent_snapshot;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'invoices'
             and column_name = 'tier_discount_amount') then
    alter table public.invoices rename column tier_discount_amount to sale_discount_amount;
  end if;
end $$;

-- If v2.2 was never built, create the columns directly with new names
alter table public.invoices
  add column if not exists sale_discount_type text
    check (sale_discount_type is null or sale_discount_type in ('percent', 'fixed')),
  add column if not exists sale_discount_value numeric(12,2)
    check (sale_discount_value is null or sale_discount_value >= 0),
  add column if not exists sale_discount_percent_snapshot numeric(5,2)
    check (sale_discount_percent_snapshot is null
           or (sale_discount_percent_snapshot >= 0 and sale_discount_percent_snapshot <= 100)),
  add column if not exists sale_discount_amount numeric(12,2) not null default 0
    check (sale_discount_amount >= 0);

-- Rename / recreate the consistency constraint
alter table public.invoices
  drop constraint if exists invoices_tier_override_consistent;
alter table public.invoices
  drop constraint if exists invoices_sale_discount_consistent;
alter table public.invoices
  add constraint invoices_sale_discount_consistent check (
    (sale_discount_type is null and sale_discount_value is null)
    or
    (sale_discount_type is not null and sale_discount_value is not null)
  );

-- =========================================================
-- 3. OVERHEAD ALLOCATION — switch storage column
-- =========================================================
alter table public.purchase_items
  add column if not exists line_overhead_amount numeric(12,2) not null default 0
    check (line_overhead_amount >= 0);

-- Backfill from existing overhead_per_unit (best-effort; legacy rows may have
-- minor rounding drift, but new rows will be exact via largest-remainder method)
update public.purchase_items
set line_overhead_amount = round(overhead_per_unit * qty_in_base, 2)
where line_overhead_amount = 0
  and coalesce(overhead_per_unit, 0) > 0;

-- Keep overhead_per_unit column for now (deprecated). Drop in a future cleanup migration.

-- =========================================================
-- 4. PRODUCT SEARCH — name-only index hygiene
-- =========================================================
create extension if not exists pg_trgm;
create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);

-- If a (name || type) combined index from v1.5 exists, drop it — it's noise now:
drop index if exists idx_products_name_type_trgm;
```

After applying: regenerate `database.ts`.

---

## 8. Function updates

### 8.1 `record_purchase` — largest-remainder overhead allocation

Read v2.1's version via MCP. Key changes:

- Compute `line_overhead_amount` per line using **largest-remainder method** so the sum reconciles exactly to `overhead_subtotal`
- Store `line_overhead_amount` (the new source of truth)
- Also populate `overhead_per_unit` for backward compat (= `line_overhead_amount / qty_in_base`)
- Per-base-unit cost calculation uses `line_overhead_amount`, not `overhead_per_unit × qty`

Implementation pattern in PL/pgSQL (collect line decisions, apply correction, then write):

```sql
declare
  -- Pre-pass: collect line shares
  v_lines_array record[];                 -- conceptually; actual impl can use temp table
  v_largest_idx int := 1;
  v_largest_value numeric(12,2) := 0;
  v_running_sum numeric(12,2) := 0;
  v_correction numeric(12,2);
  i int;
begin
  -- ... compute items_subtotal and overhead_subtotal as before ...

  -- Pre-allocate line shares (first-pass)
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    v_item := p_items->i;
    -- compute line_value (qty × cost, pack-aware)
    -- compute line_share = round(overhead_subtotal × line_value / items_subtotal, 2)
    -- track largest line by line_value
    -- store line_share into a temp table or array indexed by i
    v_running_sum := v_running_sum + v_line_share;
    if v_line_value > v_largest_value then
      v_largest_value := v_line_value;
      v_largest_idx := i;
    end if;
  end loop;

  -- Apply correction to the largest line
  v_correction := v_overhead_subtotal - v_running_sum;
  -- update temp[v_largest_idx].line_share += v_correction
  -- (correction is typically a few paisa)

  -- Main pass: do all the inserts with corrected shares
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    -- read line_share from temp[i]
    -- compute v_per_base_unit_cost = (line_total + line_share) / qty_in_base
    -- INSERT into purchase_items with line_overhead_amount = line_share
    -- UPDATE products with WAC using v_per_base_unit_cost
  end loop;
end;
```

For the actual implementation, use a TEMPORARY TABLE inside the function rather than arrays — easier to query/update by index in PL/pgSQL.

**Key invariant after the function completes:**
```sql
select sum(line_overhead_amount) from purchase_items where purchase_id = v_purchase_id
-- must equal v_overhead_subtotal exactly
```

Add to the §3.9 audit query suite from v2.1:

```sql
-- Overhead reconciliation check — should return zero rows
select pi.purchase_id,
       sum(pi.line_overhead_amount) as line_sum,
       p.overhead_subtotal
from public.purchase_items pi
join public.purchases p on p.id = pi.purchase_id
group by pi.purchase_id, p.overhead_subtotal
having abs(sum(pi.line_overhead_amount) - p.overhead_subtotal) > 0.01;
```

### 8.2 `record_sale` rewrite — drop tier auto-discount, keep manual sale discount

Read v2.2's version via MCP. Key changes:

- Drop tier auto-resolution logic (looking up customer's tier, applying discount_percent)
- Rename parameters: `p_tier_override_type` → `p_sale_discount_type`, `p_tier_override_value` → `p_sale_discount_value`
- Sale discount is **always applied from the parameters** (never auto-derived from customer)
- `invoices.tier_id` is **still populated** with `customers.tier_id` at sale time (for chip display on past invoices)

```sql
create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric(12,2) default 0,
  p_service_charge numeric(12,2) default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
    -- Per-item shape (line discount fields are optional):
    -- {"product_id": "...", "qty": 5, "price_at_sale": 100,
    --  "line_discount_type": "percent" | "fixed" | null,
    --  "line_discount_value": 10}
  p_sale_discount_type text default null,    -- 'percent' | 'fixed' | null
  p_sale_discount_value numeric(12,2) default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_sale_discount_percent_snapshot numeric(5,2);
  v_sale_discount_amount numeric(12,2) := 0;
  v_post_discount_items numeric(12,2);
  v_total numeric(12,2);
  v_credit numeric(12,2);
  v_payment_type text;
  v_customer_tier_id uuid;
  v_item jsonb;
  v_product record;
  v_qty int;
  v_line_subtotal numeric(12,2);
  v_line_discount_type text;
  v_line_discount_value numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_total numeric(12,2);
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_amount_paid < 0 then raise exception 'amount_paid_negative'; end if;
  if p_service_charge < 0 then raise exception 'service_charge_negative'; end if;

  -- Validate sale discount params consistency
  if (p_sale_discount_type is null) <> (p_sale_discount_value is null) then
    raise exception 'sale_discount_type_and_value_must_both_be_set_or_neither';
  end if;
  if p_sale_discount_type is not null
     and p_sale_discount_type not in ('percent', 'fixed') then
    raise exception 'invalid_sale_discount_type';
  end if;
  if p_sale_discount_type = 'percent'
     and (p_sale_discount_value < 0 or p_sale_discount_value > 100) then
    raise exception 'sale_discount_percent_out_of_range';
  end if;
  if p_sale_discount_type = 'fixed' and p_sale_discount_value < 0 then
    raise exception 'sale_discount_fixed_negative';
  end if;

  -- Snapshot customer's tier for invoice (informational, no pricing impact)
  if p_customer_id is not null then
    select tier_id into v_customer_tier_id
    from public.customers
    where id = p_customer_id and shop_id = v_shop_id;
  end if;

  -- Pass 1: items subtotal with line discounts (logic unchanged from v2.2)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_subtotal := (v_item->>'qty')::int * (v_item->>'price_at_sale')::numeric;

    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    v_line_discount_value := case
      when v_item->>'line_discount_value' is null then null
      else (v_item->>'line_discount_value')::numeric
    end;

    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      if v_line_discount_value < 0 or v_line_discount_value > 100 then
        raise exception 'line_discount_percent_out_of_range';
      end if;
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    elsif v_line_discount_type = 'fixed' then
      if v_line_discount_value < 0 then
        raise exception 'line_discount_fixed_negative';
      end if;
      if v_line_discount_value > v_line_subtotal then
        raise exception 'line_discount_exceeds_line_subtotal';
      end if;
      v_line_discount_amount := v_line_discount_value;
    else
      raise exception 'invalid_line_discount_type';
    end if;

    v_line_total := v_line_subtotal - v_line_discount_amount;
    v_items_subtotal := v_items_subtotal + v_line_total;
  end loop;

  -- Apply sale-level discount (no auto-tier — only what was passed in)
  if p_sale_discount_type = 'percent' then
    v_sale_discount_percent_snapshot := p_sale_discount_value;
    v_sale_discount_amount := round(v_items_subtotal * p_sale_discount_value / 100, 2);
  elsif p_sale_discount_type = 'fixed' then
    v_sale_discount_percent_snapshot := null;
    if p_sale_discount_value > v_items_subtotal then
      raise exception 'sale_discount_fixed_exceeds_items_subtotal';
    end if;
    v_sale_discount_amount := p_sale_discount_value;
  else
    v_sale_discount_percent_snapshot := null;
    v_sale_discount_amount := 0;
  end if;

  v_post_discount_items := v_items_subtotal - v_sale_discount_amount;
  v_total := v_post_discount_items + p_service_charge;

  -- Payment / customer guards (per v1.6)
  if p_amount_paid > v_total then raise exception 'amount_paid_exceeds_total'; end if;
  v_credit := v_total - p_amount_paid;
  v_payment_type := case
    when v_credit = 0 then 'cash'
    when p_amount_paid = 0 then 'credit'
    else 'partial'
  end;
  if v_credit > 0 and p_customer_id is null then
    raise exception 'customer_required_for_credit';
  end if;

  -- Insert invoice
  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type, amount_paid, notes,
    cashier_id,
    tier_id,                                    -- categorization snapshot (no pricing impact)
    sale_discount_type, sale_discount_value,
    sale_discount_percent_snapshot, sale_discount_amount
  ) values (
    v_shop_id, p_customer_id, v_total, p_service_charge, v_payment_type, p_amount_paid, p_notes,
    v_user_id,
    v_customer_tier_id,
    p_sale_discount_type, p_sale_discount_value,
    v_sale_discount_percent_snapshot, v_sale_discount_amount
  ) returning id into v_invoice_id;

  -- Pass 2: insert sale_items, decrement stock (logic unchanged from v2.2)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select id, stock, avg_cost, price into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
    for update;
    if not found then raise exception 'product_not_in_shop'; end if;
    if v_product.price is null then raise exception 'product_not_sellable'; end if;

    v_qty := (v_item->>'qty')::int;
    v_line_subtotal := v_qty * (v_item->>'price_at_sale')::numeric;

    if v_product.stock < v_qty then
      raise exception 'insufficient_stock for product %', v_product.id;
    end if;

    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    v_line_discount_value := case
      when v_item->>'line_discount_value' is null then null
      else (v_item->>'line_discount_value')::numeric
    end;
    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    else
      v_line_discount_amount := v_line_discount_value;
    end if;

    insert into public.sale_items (
      invoice_id, product_id, qty, price_at_sale, cost_at_sale,
      line_discount_type, line_discount_value, line_discount_amount
    ) values (
      v_invoice_id, v_product.id, v_qty,
      (v_item->>'price_at_sale')::numeric, v_product.avg_cost,
      v_line_discount_type, v_line_discount_value, v_line_discount_amount
    );

    update public.products set stock = stock - v_qty, updated_at = now()
    where id = v_product.id;
  end loop;

  -- Ledger entry if credit (v1.6 logic, using v_total which is post-discount)
  if v_credit > 0 then
    insert into public.ledger_entries (
      shop_id, customer_id, invoice_id, amount, type, occurred_at
    ) values (
      v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit', now()
    );
  end if;

  return v_invoice_id;
end;
$$;
```

> **Two correctness anchors carried over from v2.2:**
> 1. `v_total` is post-all-discounts. Payment math, ledger, customer outstanding all use this.
> 2. `cost_at_sale` per line is unaffected by any discount. Cost is what the unit cost the shop, regardless of selling price.

### 8.3 `search_products` — name-only

Per §3.2 above. Same structural shape as v1.5's function; just drop the type-matching clause. Also handle whitespace-only queries cleanly.

### 8.4 Reporting view update

The `invoice_with_discount_detail` view from v2.2 needs the column rename. Recreate:

```sql
create or replace view public.invoice_with_discount_detail as
select
  i.*,
  t.name as tier_name,
  -- Pre-discount items subtotal (computable from existing fields)
  (i.total + i.sale_discount_amount - i.service_charge) as items_subtotal_pre_discount,
  -- Discount source label (for UI rendering)
  case
    when i.sale_discount_type = 'percent' then 'sale_discount_percent'
    when i.sale_discount_type = 'fixed'   then 'sale_discount_fixed'
    else                                       'no_discount'
  end as discount_source
from public.invoices i
left join public.customer_tiers t on t.id = i.tier_id;
```

---

## 9. Implementation order

1. **Discovery report in chat** (Phase A).
2. **Migration applied** (§7), `database.ts` regenerated.
3. **Backend functions:**
   - `record_purchase` rewrite (§8.1) with largest-remainder allocation.
   - `record_sale` rewrite (§8.2) — drop tier auto-discount, accept `p_sale_discount_*`.
   - `search_products` rewrite (§8.3) — name only.
   - `invoice_with_discount_detail` view recreated (§8.4).
4. **Run §8.1 audit query** in MCP — should pass on existing data after backfill.
5. **Stock-in form fixes** (§3): per-piece display, supplier dropdown width, search results in product picker.
6. **Stock-in detail page fixes** (§4): NaN, column restructure, overhead note, "Cost change" wording.
7. **Product form fixes** (§5): step values, pagination check.
8. **POS / cart fixes** (§6): rename popup ("Apply discount"), reset state on submit, customer dropdown rebuild, cart column titles, add-button placement, quick-add design.
9. **i18n updates** for all new/renamed strings.
10. **Manual smoke test** (§11) — specifically reproduce user's stock-in scenario.
11. **Update CLAUDE.md** (§12) with v2.3 line + gotchas.
12. **Report back** with: schema diff, audit query results, what was reverted vs. fixed.

---

## 10. Acceptance criteria

- [ ] CLAUDE.md updated with v2.3 line and reversion gotchas (§12).
- [ ] Phase A discovery report posted: v2.2 build state, bug repro evidence, plan.

**Customer tier scope reduction:**
- [ ] `customer_tiers.discount_percent` column dropped.
- [ ] Settings → Customer Tiers page no longer shows discount field.
- [ ] POS totals does **not** auto-apply a discount when a customer is selected.
- [ ] Customer dropdown shows tier name as a chip per §6.2.2.

**Sale-discount popup (kept, renamed, fixed state):**
- [ ] Popup title is "Apply discount to this sale" (not "Override discount...").
- [ ] Trigger is "Apply discount" link in totals area.
- [ ] Modal supports Percent and Fixed amount.
- [ ] Discount line in totals shows "Discount (10%) −120" or "Discount (fixed) −200" with [Edit] / [Remove].
- [ ] **State resets on sale submit** (the user's reported bug).
- [ ] State resets on customer change.
- [ ] State persists across cart line edits within the same sale.

**Schema rename:**
- [ ] Invoices columns renamed: `tier_override_type` → `sale_discount_type`, `tier_override_value` → `sale_discount_value`, `tier_discount_percent_snapshot` → `sale_discount_percent_snapshot`, `tier_discount_amount` → `sale_discount_amount`.
- [ ] `invoices.tier_id` retained (categorization snapshot).
- [ ] `invoices_tier_override_no_tier_id` constraint dropped.
- [ ] `invoices_sale_discount_consistent` constraint exists.
- [ ] `record_sale` populates `sale_discount_*` (not `tier_*`).

**Overhead allocation:**
- [ ] `purchase_items.line_overhead_amount` column added and populated.
- [ ] Sum of `line_overhead_amount` per purchase reconciles **exactly** to `purchases.overhead_subtotal` for new stock-ins.
- [ ] User's reproduction scenario shows: Redmi 14.88/unit, iPhone 11.91/unit, totaling 1,000.00 PKR overhead exactly.
- [ ] Audit query in §8.1 returns zero rows.

**Stock-in form:**
- [ ] Per-piece cost displays beneath unit cost field when a pack > 1 is selected.
- [ ] Supplier dropdown is wide enough to show full supplier names without truncation.
- [ ] Bidirectional cost calc still works.

**Stock-in detail:**
- [ ] `#` column shows 1, 2, 3, … (not NaN) on items table and additional-costs table.
- [ ] Columns: # / Product / Qty / Unit cost / Subtotal / Overhead / Total. Subtotal + Overhead = Total.
- [ ] Overhead distribution explanatory note rendered.
- [ ] "Effect on inventory" column header is "Cost change" (not "Δ"). Cells show "+Rs X" / "−Rs X" / "—".

**Search:**
- [ ] `search_products` queries `name` only.
- [ ] Trigram + ilike combo returns relevant results for partial queries (e.g., "iph" finds "iPhone 16").
- [ ] Whitespace handled (leading/trailing trimmed; empty query returns recent products).

**Product form:**
- [ ] Number inputs (price, opening_cost) use `step="1"`.
- [ ] Display formatting is whole rupees in lists/receipts/invoices.
- [ ] Products list page paginates server-side (50 per page) per v1.5 spec.

**POS / cart UI:**
- [ ] Customer picker is in its own bordered card, visually distinct from the cart.
- [ ] Customer name + tier chip renders when selected.
- [ ] Customer dropdown rows show name + chip + phone.
- [ ] "Walk-in customer" pinned to top of dropdown with chip.
- [ ] Cart line items have column headers (Product / Qty / Price / Total).
- [ ] Add-to-cart `+` button is in rightmost column of product list.
- [ ] Pack quick-add buttons placed below product info.
- [ ] Scan-only products hide primary `+`; only quick-add appears.

**General:**
- [ ] No new console errors in either language.
- [ ] All v1.3–v2.2 acceptance criteria still pass (where v2.2 features remain after reversion).
- [ ] Manual test for user's stock-in scenario passes (§11.1).

---

## 11. Manual test matrix

### 11.1 The user's reproduction scenario
- Account `muhammad.ali.dev97@gmail.com` (or fresh test account).
- Stock-in: Redmi X7 (qty 56, unit cost 1,250), iPhone 16 (1 × Box of 14, unit cost 14,000), delivery overhead 1,000.
- Submit. Open stock-in detail.
- **Verify per-unit overhead:** 14.88 (Redmi) and 11.91 (iPhone). NOT 15 and 12.
- **Verify line totals:** Redmi subtotal 70,000 + overhead 833.33 = total 70,833.33. iPhone subtotal 14,000 + overhead 166.67 = total 14,166.67. Sum overhead column = 1,000.00 exactly.
- **Verify `#` column:** shows 1, 2 (not NaN).
- **Verify per-piece cost** under iPhone unit cost: "Rs 14,000 per box (Rs 1,000 per piece)".
- **Verify overhead note** rendered below additional-costs section.
- **Verify "Cost change" column header** (not Δ).

### 11.2 Customer tier reversion + chip
- Open `/settings/tiers`. Verify no "Discount %" field; only Name + Default fields.
- Edit Walk-in tier name. Save. No error.
- Open POS. Pick a customer with non-default tier (e.g., Wholesale).
- Verify chip "Wholesale" shows next to customer name.
- Verify totals show: Items subtotal + Service charge + Total. **No auto-discount line.** "Apply discount" link visible.

### 11.3 Sale-discount popup (the kept feature)
- Pick a customer. Cart total (items): 1,200.
- Click "Apply discount". Modal opens with title "Apply discount to this sale".
- Type: Percent. Value: 10. Apply.
- Verify totals shows "Discount (10%) −120" with [Edit] / [Remove] inline.
- Click [Edit] — modal reopens with 10% pre-filled. Change to 15. Apply.
- Verify totals updates to "Discount (15%) −180".
- Click [Remove] — discount line disappears.
- Apply 200 fixed. Verify "Discount (fixed) −200".
- Try 5,000 fixed (exceeds 1,200 items subtotal) — modal rejects with friendly error.
- Submit sale.
- **Verify discount state cleared** — start new sale, Apply discount link is back to no-state, no pre-filled values.

### 11.4 Discount state lifecycle
- Apply 10% discount. Add another cart line. Verify discount persists.
- Edit service charge to 100. Verify discount still applied.
- Change customer (pick a different one). Verify discount **cleared**.
- Apply 50 fixed. Click "Remove". Verify cleared. No state lingering.

### 11.5 Search
- In stock-in form's product picker, type "iph". Verify "iPhone 16" appears as top result.
- Type "redm". Verify "Redmi X7" appears.
- Type "phone" — should match iPhone (and any product with "phone" in name).
- Type a product type like "mobile" (assumed only in `type` field). Verify products are NOT returned.

### 11.6 POS UI
- Open POS. Add a customer. Verify customer card has clear visual border, separate from cart.
- Search for a product. Verify search results are a list with `[+]` button on right column.
- For a product with packs, verify quick-add buttons render below product line.
- For a scan-only product, verify primary `+` is hidden; only quick-add buttons render.
- Cart line: verify column headers Product / Qty / Price / Total appear above the line list.

### 11.7 Product form
- Open product create form. Click up arrow on price field. Verify increments by 1 PKR (not 0.01).
- Same for opening cost field.
- Save product with price 100, opening stock 10 at cost 50. List shows whole-number formatting.

### 11.8 Pagination
- Navigate to `/products`. With > 50 products, verify page shows 50 and pagination controls work. URL reflects page state.

### 11.9 Sale detail (past sale with discount)
- Open a sale where discount was applied.
- Verify totals shows "Discount (10%) −120" or "Discount (fixed) −200" on the invoice display.
- For a sale without discount, no line renders.

### 11.10 Cross-shop isolation
- Account B sees zero of Account A's tier reversion changes.

---

## 12. CLAUDE.md update

Append to versioned PRDs section:

```
- v2.3: fixes from v2.1/v2.2 testing — overhead allocation rounding (largest-remainder method), customer tier auto-discount REMOVED (manual sale discount popup KEPT), schema rename invoices.tier_* → sale_discount_*, search by name only, multiple POS/stock-in UX polish, products list pagination verified
```

Add to **Open ToDos / Known gaps**:

```
- products.cost legacy column still not dropped
- ledger_entries.paid_at legacy column still not dropped
- purchase_items.overhead_per_unit column deprecated by v2.3 but not yet dropped (kept for backward compat; remove in a future cleanup migration)
```

Add to **Gotchas**:

```
- Customer tier auto-discount was tried in v2.2 and REMOVED in v2.3. customer_tiers table remains for categorization (chip display in POS / customer list). discount_percent column is gone. Do NOT reintroduce auto-applied tier discounts unless explicitly asked.
- The MANUAL sale-time discount popup IS kept (renamed "Apply discount"). Cashier triggers per-sale, % or PKR. State resets on submit, customer change, and explicit Remove.
- Invoice columns were renamed in v2.3: tier_override_* → sale_discount_*, tier_discount_amount → sale_discount_amount. The invoices.tier_id column remains for categorization snapshot only.
- Per-line discounts (sale_items.line_discount_*) and sale-level discount (invoices.sale_discount_*) are distinct. Both can apply on the same sale. Stacking order: line discounts first (per line), then sale discount on items_subtotal_post_line_discounts.
- Overhead allocation in record_purchase uses largest-remainder method to ensure sum of line_overhead_amount = overhead_subtotal exactly. Don't switch back to per-unit storage — it loses precision.
- Search products by name only. The type field is too generic to be useful in fuzzy match.
```

Update **Versioned PRDs** v2.2 entry:

```
- v2.2: customer tiers + line discounts + manual override (PARTIALLY REVERTED in v2.3 — tier auto-discount removed; manual sale discount popup retained and renamed)
```

---

## 13. Out of scope

- **Per-customer discount memory** ("Ahmed got 5% off last time, default to that"). Explicitly not what the user wants.
- **Volume / quantity-break discounts.** Future.
- **Bulk allocation overrides** (manually set overhead per line). Default proportional is right for now.
- **Multi-currency.**
- **Returns / refunds.**
- **Test infrastructure.** Skipped per user instruction.
- **Dropping deprecated columns** (`overhead_per_unit`, etc.). Defer to a future cleanup.

---

*End of v2.3 fixes spec.*
