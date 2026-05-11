# MVP v2.5 — Product Detail Page, Category Entity, Row Actions

**Audience:** Claude Code
**Companion to:** `PRD.md` and v1.3–v2.3 specs.
**Stack:** unchanged.
**Type:** Feature addition + schema rename + UX polish.
**Realistic effort:** 3–4 days.

> **Three things in this ticket.** A clickable product detail page (full page in `/products`, drawer in POS). The `products.type` column promoted to a proper `product_categories` table per shop, with inline create + search. A category filter on the products list. Plus small polish: eye icon for row action, "Actions" column rename, "Add to cart" column rename with centered button.

---

## 0. How to work this ticket

### Phase A — Discovery (mandatory before code)

1. **Read `CLAUDE.md`** and recent fix specs (`v2.1`, `v2.2`, `v2.3`). Update `CLAUDE.md` at the end of this ticket.
2. **Skills check** — use `frontend-design` skill at `/mnt/skills/public/frontend-design/SKILL.md` for component primitives, table patterns, drawer pattern, and form layouts. If a skill specifically for routing/drawer patterns exists in `/mnt/skills/`, read it too. Otherwise default to `frontend-design`.
3. **Inspect live schema via MCP.** Specifically:
   - `products` table — confirm current `type` column shape and the unique index on `(shop_id, lower(trim(name)), lower(trim(type)))` from v1.5.
   - Whether v2.3's column renames landed (`invoices.sale_discount_*`).
   - Whether `purchase_items.line_overhead_amount` was added per v2.3.
   - Whether any `product_categories` table exists (it shouldn't).
4. **Map the current UI surface:**
   - `/products` list — where do you go when you click a row currently? What's the rightmost column? Where is the edit icon?
   - POS module's product picker — same questions.
   - Product create/edit form — current `type` field shape (free text? dropdown? combobox?).
5. **Sample current category data:**
   ```sql
   select distinct lower(trim(type)) as category, count(*) as products
   from public.products
   where shop_id = (select id from public.shops where /* the test shop */ limit 1)
   group by 1 order by 2 desc;
   ```
   The output tells us how much migration data exists per shop.
6. **Generate `tasks.md`** at the project root before any code. See §13 for the structure.
7. **Generate `decisions/` folder** at the project root. See §13.
8. **Discovery report in chat** — schema state, current UI inventory, category data sample, plan, then proceed.

### Phase B — Schema migration first

Single migration `00XX_v25_categories_and_detail.sql`. Apply via MCP, regenerate `database.ts`.

### Phase C — Backend functions

Add category management RPCs. Update product CRUD. Update product search to include category filter.

### Phase D — Frontend

In the order in §10.

### Phase E — Verification

Manual smoke test for all six items. Update `CLAUDE.md`.

---

## 1. Product detail page

### 1.1 Two surfaces, two patterns

| Where | Pattern | Why |
|---|---|---|
| `/products` (list) | **Full page route** at `/products/:id`. Browser back works. Deep-linkable. | Owner is in admin context, not transacting. Navigation away is fine. |
| POS module | **Right-side drawer** overlay. Cart state stays intact. Drawer dismisses with X or Esc. | Cashier mid-sale must not lose cart context. |

### 1.2 Detail page contents (same on both surfaces)

```
┌─ Product details ───────────────────────────────────┐
│  [eye icon]  iPhone 14                              │
│              [Electronics]  ★ Active                │
│                                          [ Edit ]   │
├─────────────────────────────────────────────────────┤
│  Name              iPhone 14                        │
│  Category          Electronics                      │
│  Sell price        Rs 100,000 per each              │
│  Stock             50 each (1 carton + 0 each)      │
│  Avg cost          Rs 90,000                        │
│  Last purchase     Rs 90,000                        │
│  Scan only         No                               │
│  Created           May 5, 2026                      │
│  Last updated      May 9, 2026                      │
├─ Packs (if any) ────────────────────────────────────┤
│  Unit       Contains    Default purchase    ⚙        │
│  Carton     50 each     ★                  Edit     │
│                              [+ Add pack]           │
├─ Recent activity ───────────────────────────────────┤
│  Stock-in May 9 — +1 carton (50 each) from Chen     │
│  Sale May 8 — 2 each to Ahmed                       │
│  ...                                                 │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- "Edit" button (top-right) reveals the edit form (either as a modal or by transitioning the view into edit mode — pick whichever fits the v1.7 design system; my recommendation is modal for `/products/:id`, inline form swap for POS drawer).
- Eye icon next to the product name is just decorative on the detail page itself — it's the affordance shown on the list (per §3).
- Stock displays in base units + compound view per v2.1 §5.2.
- Packs section reuses the pattern from v2.1 §5.3.
- Recent activity is the last 10 stock-in / sale rows referencing this product. Order by occurred_at desc.

### 1.3 POS drawer specifics

- Trigger: clicking a product row in POS's product list opens the drawer.
- Drawer slides in from the right (or bottom on mobile).
- Background dims slightly; cart is still visible behind it.
- Esc / X / clicking the dimmed area closes the drawer.
- Inside the drawer: same content as the full page, plus a primary "+ Add to cart" button at the bottom that adds 1 base unit and closes the drawer.
- Editing from the drawer: opens the edit form as a nested view inside the drawer (don't navigate away).

### 1.4 No cart-loss guarantee

If the cashier opens a product, edits the price, saves, and closes the drawer — the cart state must be exactly as they left it. Cart state lives in POS-page-level state (Zustand / Context). The drawer is a presentational overlay only; it does not mount/unmount the cart.

---

## 2. Eye icon row action (full row clickable + explicit icon)

### 2.1 Row affordance

Every product row in both the `/products` list and the POS product picker:

- **The entire row is clickable**, cursor pointer on hover, subtle hover background per v1.7
- **An eye icon** sits in the leftmost or near-leftmost column position (after the # serial if shown) as an explicit visual affordance — "click to view"
- Eye icon uses Lucide `Eye` or equivalent
- Hover on icon shows tooltip "View details"
- Clicking the row OR the eye icon does the same thing — opens the detail surface

### 2.2 Edit removed from the list

- The pen/edit icon currently in the last column of `/products` is **removed entirely**
- Edit happens from the detail page only (via the Edit button)
- This keeps the list lean and pushes users into a coherent view-then-edit flow

### 2.3 POS row click behavior

- Same: entire row clickable + eye icon
- Opens the drawer (per §1.3)
- The primary `+` button (from v2.3 §6.3.2) stays in the rightmost column as a separate affordance — clicking it adds to cart without opening the drawer

So in POS, each row has **two affordances**: eye icon (or row click) opens drawer; `+` button adds directly to cart. Quick-add pack buttons (per v2.3 §6.3.3) also stay.

---

## 3. Products list column rename — "Actions"

### 3.1 Column structure

```
#  [Eye]  Name           Category       Stock        Price       Actions
1  👁     iPhone 14      Electronics    50 each      100,000      ⋮
2  👁     USB Cable      Accessories    120 each     200          ⋮
```

- "Actions" is the new column header (replacing whatever was there, likely "Edit")
- The cell contains a kebab menu icon (`MoreVertical` from Lucide)
- Wait — per user clarification, **no kebab menu**. The user wants the eye icon to be the row trigger. The "Actions" column instead contains nothing visible per-row currently; it just exists as a header for any future row-level actions (archive, duplicate). For now, leave the Actions column **empty per row** with just the header — or remove it entirely if Claude Code finds that cleaner.

> **Discovery note for Claude Code:** since edit moved to the detail page and viewing moved to the eye icon / row click, there's currently no per-row action that needs a column. Two valid approaches: (a) keep the "Actions" column header empty for now (placeholder for future row actions like Archive), or (b) drop the column entirely. **Default to (b) — drop the column.** Less noise. If the user later asks for row-level archive, add it back then.

### 3.2 Header / column order

`#` (optional, only if v1.5 implemented row numbers) — Eye — Name — Category — Stock — Price

Right-align numeric columns. Eye column is narrow (40-48px), enough for the icon + click target.

---

## 4. POS rightmost column rename — "Add to cart"

### 4.1 Column header

The rightmost column where the primary `+` button lives (per v2.3 §6.3.2) gets a header:

```
Name             Stock        Price          Add to cart
iPhone 14        50 each      100,000             [+]
Cable USB-C      120 each     200                 [+]
```

- Header text: "Add to cart"
- Use v1.7 caption typography for the header
- The `+` button is **center-aligned** within the column cell
- Click → adds 1 base unit at default price (unchanged behavior)

### 4.2 Pack quick-add buttons (no change)

Pack quick-add buttons (per v2.3 §6.3.3) stay below the product info on their own line. They are not in the "Add to cart" column — that column is for the primary single-tap add. Quick-add chips occupy a separate row beneath the main product line.

---

## 5. Category entity (rename `products.type` → `category_id` FK)

### 5.1 New table: `product_categories`

```sql
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_name_not_blank check (length(trim(name)) > 0)
);

-- Case-insensitive uniqueness within a shop, only among active categories
create unique index if not exists uq_category_shop_name
  on public.product_categories (shop_id, lower(trim(name))) where is_active;

-- Trigram for fuzzy search in the dropdown
create extension if not exists pg_trgm;
create index if not exists idx_category_name_trgm
  on public.product_categories using gin (name gin_trgm_ops);

create index if not exists idx_category_shop_active
  on public.product_categories (shop_id, is_active) where is_active;

alter table public.product_categories enable row level security;

create policy "categories_shop_read" on public.product_categories
  for select using (shop_id = (select public.current_shop_id()));
create policy "categories_shop_write" on public.product_categories
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

drop trigger if exists product_categories_touch on public.product_categories;
create trigger product_categories_touch
  before update on public.product_categories
  for each row execute function public.touch_updated_at();
```

### 5.2 `products` table changes

```sql
-- Add the FK column (nullable initially for backfill)
alter table public.products
  add column if not exists category_id uuid references public.product_categories(id) on delete restrict;

create index if not exists idx_products_category
  on public.products (category_id) where category_id is not null;
```

### 5.3 Backfill — convert existing `type` values to category rows

```sql
-- For each shop, create category rows from distinct existing type values
insert into public.product_categories (shop_id, name)
select distinct p.shop_id, trim(p.type)
from public.products p
where p.type is not null and length(trim(p.type)) > 0
on conflict do nothing;
-- (no actual conflict since the unique index handles it; ON CONFLICT for safety)

-- Link each product to its category by matching on name within shop
update public.products p
set category_id = c.id
from public.product_categories c
where c.shop_id = p.shop_id
  and lower(trim(c.name)) = lower(trim(p.type))
  and p.category_id is null;
```

### 5.4 Make `category_id` required (after backfill verification)

Run the verification first:

```sql
-- Should return zero rows
select id, name, shop_id, type from public.products where category_id is null;
```

If zero rows: enforce NOT NULL:

```sql
alter table public.products alter column category_id set not null;
```

If non-zero: investigate. There may be products with NULL/blank type values that need attention before the constraint can apply. In that case, create a "Uncategorized" category per shop and assign those products to it before applying the constraint.

### 5.5 Drop the unique-name-and-type constraint, recreate against category_id

v1.5 added `unique (shop_id, lower(trim(name)), lower(trim(type)))`. We need the equivalent for category_id:

```sql
-- Drop old constraint
drop index if exists uq_products_shop_name_type;

-- Create new constraint scoped by category
create unique index if not exists uq_products_shop_name_category
  on public.products (shop_id, lower(trim(name)), category_id)
  where is_active;
```

Two products can have the same name as long as they're in different categories within the same shop. Same as before with `type`.

### 5.6 Deprecate `products.type` column

Keep the `type` column for now (backward compatibility — if any UI code still reads it during the rollout). Mark as deprecated in CLAUDE.md gotchas. Drop in a future cleanup migration after a quiet period.

### 5.7 Empty seed (per user decision)

**No default categories** are seeded for new shops. The shop owner creates them as they go, via the inline "+ Create new category" in the product form.

### 5.8 Existing shops with no categories (new feature on existing data)

After backfill, existing shops have categories derived from their existing `type` values. If a shop somehow had products with NULL type (shouldn't happen if v1.2 enforced NOT NULL), the verification in §5.4 catches it.

---

## 6. Category management RPCs

### 6.1 `search_categories(p_query, p_limit, p_offset)`

Returns categories ordered by usage (most-used first), with optional fuzzy filter.

```sql
create or replace function public.search_categories(
  p_query text default null,
  p_limit int default 10,
  p_offset int default 0
) returns table (
  id uuid,
  name text,
  product_count bigint
)
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_q text := coalesce(trim(p_query), '');
begin
  if v_shop_id is null then return; end if;

  set local pg_trgm.similarity_threshold = 0.2;

  if length(v_q) = 0 then
    -- Default: top 10 by usage
    return query
      select c.id, c.name, count(p.id) as product_count
      from public.product_categories c
      left join public.products p on p.category_id = c.id and p.is_active
      where c.shop_id = v_shop_id and c.is_active
      group by c.id, c.name
      order by product_count desc, c.name asc
      limit p_limit offset p_offset;
  else
    -- Fuzzy search
    return query
      select c.id, c.name, count(p.id) as product_count
      from public.product_categories c
      left join public.products p on p.category_id = c.id and p.is_active
      where c.shop_id = v_shop_id
        and c.is_active
        and (c.name % v_q OR c.name ilike '%' || v_q || '%')
      group by c.id, c.name
      order by
        case when c.name ilike v_q || '%' then 0 else 1 end,
        similarity(c.name, v_q) desc nulls last,
        product_count desc,
        c.name asc
      limit p_limit offset p_offset;
  end if;
end;
$$;
```

### 6.2 `create_category_inline(p_name)`

For the "+ Create new category" affordance in the product form. Returns new id; rejects duplicates within shop.

```sql
create or replace function public.create_category_inline(p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_id uuid;
  v_trimmed text := trim(p_name);
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if length(v_trimmed) = 0 then raise exception 'category_name_blank'; end if;

  insert into public.product_categories (shop_id, name)
  values (v_shop_id, v_trimmed)
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'category_already_exists';
end;
$$;
```

### 6.3 `update_category(p_id, p_name, p_is_active)`

Standard update. Validates uniqueness within shop. Can deactivate.

### 6.4 `search_products` update — accept category filter

Update v2.3's `search_products` to also accept `p_category_id` for the list filter:

```sql
create or replace function public.search_products(
  p_query text,
  p_category_id uuid default null,
  p_limit int default 50,
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
      where shop_id = v_shop_id
        and is_active
        and (p_category_id is null or category_id = p_category_id)
      order by updated_at desc
      limit p_limit offset p_offset;
    return;
  end if;

  return query
    select p.* from public.products p
    where p.shop_id = v_shop_id
      and p.is_active
      and (p_category_id is null or p.category_id = p_category_id)
      and (p.name % v_q OR p.name ilike '%' || v_q || '%')
    order by
      case when p.name ilike v_q || '%' then 0 else 1 end,
      similarity(p.name, v_q) desc nulls last,
      length(p.name)
    limit p_limit offset p_offset;
end;
$$;
```

Plus a matching `search_products_count(p_query, p_category_id)` for pagination totals.

### 6.5 Product create/edit RPC updates

`create_product_with_opening_stock` (per v1.5) accepts a `p_category_id` parameter now instead of (or in addition to) `p_type`. Same for any update_product equivalent. The function validates the category belongs to the shop.

---

## 7. Frontend — products list filter

### 7.1 Filter bar above the table

```
┌─ Products ──────────────────────────────────────────┐
│  Search [____________]  Category [All ▼]            │
└─────────────────────────────────────────────────────┘
```

- **Single-select** category dropdown per user decision
- First option: "All categories" (clears filter)
- Then: top 10 categories by usage (from `search_categories` with empty query)
- "Search categories…" inline filter at the top of the dropdown for shops with many categories
- URL-driven: `?category_id=...` so back button works and shareable

### 7.2 Filter behavior

- Selecting a category triggers a new server-side query via `search_products(p_query, p_category_id, ...)`
- Pagination resets to page 1 on filter change
- Combined with search query: both apply simultaneously (AND)
- "Clear filter" reverts to "All categories"

### 7.3 Empty state

When a filter returns zero products: friendly empty state with "No products in this category" and a link to clear the filter.

---

## 8. Product form — category combobox

### 8.1 Field placement

The product create/edit form's "Type" field is replaced by a "Category" combobox:

```
Name *                    [_______________]
Category *                [Search category... ▼]
Sell price (per unit) *   [_______________]
Opening stock (qty)       [_______________]
Opening stock (cost/unit) [_______________]
☐ Scan-only
```

### 8.2 Combobox behavior

- On focus: shows top 10 categories by usage (empty query → `search_categories` with no query)
- Typing: debounced 250ms, calls `search_categories(query)`
- Footer: **"+ Create new category"** affordance
- Click "+ Create new category" → small inline modal:
  ```
  New category
    Name *  [_______________]
    [ Cancel ]    [ Create ]
  ```
- On save: calls `create_category_inline`, auto-selects the new category in the form

### 8.3 Required field

Category is **required** (per user decision in plan). Form validation rejects submit without a category.

### 8.4 Reusing the combobox

This is the same shape as the supplier combobox (v1.9), the customer combobox (v1.4), and the product combobox (v1.5 → v2.1). Reuse the `<Combobox>` primitive — don't fork.

---

## 9. Schema migration order (single file, single transaction)

```sql
-- 00XX_v25_categories_and_detail.sql

-- 1. Create product_categories table + RLS + indexes + trigger
-- 2. Add products.category_id (nullable)
-- 3. Backfill: insert distinct types as categories per shop
-- 4. Backfill: link products to their categories
-- 5. Verify zero NULL category_id rows (Phase A audit query)
-- 6. Set products.category_id NOT NULL
-- 7. Drop the old (shop_id, name, type) unique index
-- 8. Create new (shop_id, name, category_id) unique index
-- 9. Create category management functions
-- 10. Update search_products to accept p_category_id
-- 11. Update create_product_with_opening_stock to accept p_category_id
```

After applying: regenerate `database.ts`.

> **`products.type` column is NOT dropped** in this migration. Keep for one cycle in case any read-path still references it. Drop in a v2.6 cleanup migration. Add to CLAUDE.md open todos.

---

## 10. Implementation order

1. **Discovery report in chat** (Phase A) — schema state, current UI, category data sample.
2. **Generate `tasks.md`** at project root (§13). Update as work proceeds.
3. **Migration applied** (§9). Run verification query. Confirm zero NULL category_id rows.
4. **Regenerate `database.ts`.**
5. **Category management RPCs** (§6).
6. **Product detail page** at `/products/:id` (§1).
7. **Product detail drawer in POS** (§1.3).
8. **Eye icon affordance on product rows** (§2) — both `/products` and POS.
9. **Remove edit icon from list** (§2.2).
10. **Drop "Actions" column** from products list (§3.1) — per discovery note default.
11. **Add "Add to cart" header + center the `+` button** in POS (§4).
12. **Category combobox in product form** (§8).
13. **Category filter on products list** (§7).
14. **i18n updates** for new strings (Category, Add to cart, eye-icon tooltip, etc.).
15. **Manual smoke test** (§12).
16. **Update CLAUDE.md** (§14) with v2.5 line + gotchas.
17. **Record decisions** in `decisions/` folder (§13).
18. **Report back** with: schema diff, screenshots, decisions log.

---

## 11. Acceptance criteria

- [ ] `tasks.md` and `decisions/` folder created and maintained throughout the ticket.
- [ ] CLAUDE.md updated with v2.5 line and gotchas.
- [ ] Phase A discovery report posted with schema state, UI inventory, category data sample.

**Product detail page:**
- [ ] Clicking a product row in `/products` navigates to `/products/:id`. Browser back button works.
- [ ] Detail page shows all fields per §1.2.
- [ ] "Edit" button on detail page opens an edit form. Saving updates the product and refreshes the detail view.
- [ ] Clicking a product row in POS opens a right-side drawer (or bottom sheet on mobile).
- [ ] POS drawer dismisses with X / Esc / clicking the dimmed background.
- [ ] **Cart state is preserved** when the drawer opens, edit happens, and drawer closes.
- [ ] Drawer has a primary "+ Add to cart" button at the bottom that adds 1 base unit and closes.

**Eye icon row action:**
- [ ] Every row in `/products` has a visible eye icon (Lucide `Eye` or equivalent).
- [ ] Every row in the POS product list has a visible eye icon.
- [ ] Eye icon has tooltip "View details".
- [ ] Clicking the eye icon OR clicking anywhere on the row opens the detail surface (full page in `/products`, drawer in POS).
- [ ] The old edit icon is removed from `/products` list rows.

**Column changes:**
- [ ] In `/products`: "Actions" column dropped per discovery default. Eye column added in early position.
- [ ] In POS: rightmost column has header "Add to cart". The `+` button is center-aligned within its cell.
- [ ] Pack quick-add buttons (v2.3 §6.3.3) still render below product info, unchanged behavior.

**Category entity (rename + entity):**
- [ ] `product_categories` table exists with RLS, trigram index, uniqueness constraint per shop.
- [ ] Every existing product has a `category_id` populated from backfill.
- [ ] `products.category_id` is NOT NULL.
- [ ] Old unique index on `(shop_id, name, type)` dropped; new index on `(shop_id, name, category_id)` exists.
- [ ] `products.type` column retained (deprecated; documented in CLAUDE.md for future drop).

**Category UI:**
- [ ] Product create/edit form has a "Category" combobox (replacing "Type").
- [ ] Combobox shows top 10 categories by usage when empty / focused.
- [ ] Typing triggers fuzzy search via `search_categories`.
- [ ] "+ Create new category" footer creates a new category inline and auto-selects.
- [ ] Category is required for product creation/edit.
- [ ] Two products can share the same name in different categories within a shop.

**Category filter:**
- [ ] Products list has a category filter dropdown (single-select).
- [ ] First option: "All categories" (clears filter).
- [ ] Filter combined with search works (AND logic).
- [ ] Pagination resets to page 1 on filter change.
- [ ] Filter state in URL: `?category_id=...`.

**RLS / cross-shop:**
- [ ] Account B sees zero of Account A's categories.
- [ ] Cannot reference another shop's category by spoofing `category_id`.

**General:**
- [ ] No new console errors in either language.
- [ ] All v1.3–v2.3 acceptance criteria still pass.
- [ ] Pagination on `/products` (per v1.5) still works.

---

## 12. Manual test matrix

### 12.1 Detail page — `/products`
- Open `/products`. Verify list shows products with eye icon.
- Click anywhere on a row. Verify `/products/:id` opens.
- Verify detail page shows all fields (name, category, sell price, stock, avg cost, etc.).
- Click "Edit". Modal opens with editable form. Change sell price. Save.
- Verify detail page reflects the new price.
- Browser back: returns to `/products` list with scroll position preserved.

### 12.2 Detail drawer — POS
- Open POS. Search for a product. Add it to cart (use `+` button).
- Click the same product's row. Drawer opens.
- Edit price in drawer. Save.
- Close drawer. Verify cart still has the product with its original cart price (cart line is independent of catalog price — v1.3).
- Click another product's row. Drawer opens. Click "+ Add to cart" at bottom. Drawer closes. Cart now has both products.

### 12.3 Eye icon
- Hover the eye icon on a row. Tooltip "View details" appears.
- Click only the icon (not the rest of the row). Detail opens.
- Same in POS.

### 12.4 Column cosmetics
- `/products`: verify rightmost column is no longer the edit icon. "Actions" column dropped.
- POS: verify rightmost column header is "Add to cart". `+` button is center-aligned.

### 12.5 Category management
- Create a new product. Open category combobox. Empty state shows top categories or empty list (depending on shop's history).
- Type "Elec". Verify "Electronics" appears (or fuzzy match).
- Click "+ Create new category". Modal opens.
- Enter "Test Category". Save. New category appears selected in the form.
- Try creating "test category" (different case). Verify rejected: `category_already_exists`.
- Save the product. Verify it appears with the new category in the list.

### 12.6 Category filter
- `/products`: open category filter. Verify dropdown shows top 10 categories.
- Select "Electronics". List filters. URL shows `?category_id=...`.
- Combine with search "iph". List shows only iPhones in Electronics.
- Refresh page. URL state preserved; filter still applied.
- Select "All categories". Filter cleared.

### 12.7 Category required + uniqueness
- Try to save a product with no category selected. Form rejects with error.
- Two products in same shop, same name, different categories: both can exist.
- Two products in same shop, same name, same category: rejected with friendly error.

### 12.8 Backfill verification
- For an existing shop with products: confirm every product's `category` (as shown in the list) matches its old `type` value.
- Distinct types from before became category rows after migration.

### 12.9 Cross-shop isolation
- Account B sees zero of A's categories in the dropdown or filter.

---

## 13. `tasks.md` and `decisions/` folder

### 13.1 `tasks.md` at project root

Created before any code. Structure:

```markdown
# v2.5 Implementation Tasks

## Status legend
🟦 not started · 🟨 in progress · ✅ done · ❌ blocked

## Phase B — Schema migration
- 🟦 Create product_categories table + RLS + indexes
- 🟦 Add products.category_id column
- 🟦 Backfill: insert distinct types as categories
- 🟦 Backfill: link products to categories
- 🟦 Run verification query (zero NULL category_id)
- 🟦 Set products.category_id NOT NULL
- 🟦 Replace unique index (type → category_id)

## Phase C — Backend functions
- 🟦 search_categories RPC
- 🟦 create_category_inline RPC
- 🟦 update_category RPC
- 🟦 Update search_products to accept p_category_id
- 🟦 Update search_products_count
- 🟦 Update create_product_with_opening_stock to accept p_category_id
- 🟦 Regenerate database.ts

## Phase D — Frontend
- 🟦 Product detail page at /products/:id
- 🟦 Product edit modal/form on detail page
- 🟦 Product detail drawer in POS
- 🟦 Add to cart button in drawer
- 🟦 Eye icon on /products rows
- 🟦 Eye icon on POS product rows
- 🟦 Row click = open detail (both surfaces)
- 🟦 Remove edit icon from /products
- 🟦 Drop "Actions" column from /products
- 🟦 "Add to cart" header in POS
- 🟦 Center-align the + button in POS
- 🟦 Category combobox in product form
- 🟦 "+ Create new category" inline modal
- 🟦 Category filter dropdown on /products
- 🟦 i18n keys: en + ur

## Phase E — Verification
- 🟦 Manual smoke test §12
- 🟦 Update CLAUDE.md
- 🟦 Record decisions in decisions/
- 🟦 Final report in chat with screenshots
```

Update statuses as work progresses. Keep at root of repo.

### 13.2 `decisions/` folder

Created at project root. Each significant decision = one markdown file. Naming: `YYYY-MM-DD-short-slug.md`.

For this ticket, expected files:

```
decisions/
├── 2026-05-11-products-type-renamed-to-category-entity.md
├── 2026-05-11-product-detail-routing-pattern.md
├── 2026-05-11-actions-column-dropped-from-products-list.md
└── 2026-05-11-eye-icon-as-primary-row-action.md
```

Each file follows this structure:

```markdown
# Decision: <title>

**Date:** YYYY-MM-DD
**Ticket:** v2.5
**Status:** Accepted

## Context
What problem we were solving. The state of the system before.

## Decision
What we decided. Concrete: schema shape, UI pattern, API contract.

## Alternatives considered
What else was on the table. Why rejected.

## Consequences
What this enables, what it locks in, what migration debt it creates.
```

These files survive across tickets. Future-Claude reads them to reconstruct the why.

### 13.3 Why this matters

Long-running projects accumulate decisions that are obvious in the moment and incomprehensible six months later. CLAUDE.md captures *what* the project is. `decisions/` captures *why* the project is the way it is. The combination is what makes context management cheap when Claude Code starts a new session.

---

## 14. CLAUDE.md update

Append to versioned PRDs section:

```
- v2.5: product detail page (full route in /products, drawer in POS), eye icon row action, products.type promoted to product_categories entity per shop, category filter on products list
```

Add to **Open ToDos / Known gaps**:

```
- products.type column deprecated by v2.5; not yet dropped. Remove in a future cleanup migration after confirming no read-path references it.
```

Add to **Gotchas**:

```
- Product categories are per-shop entities (product_categories table). The old products.type free-text column is deprecated. Always use category_id FK.
- Two products in the same shop can share a name as long as they're in different categories. The unique index is on (shop_id, lower(trim(name)), category_id).
- Product detail page: full route at /products/:id when navigating from the list; right drawer when triggered from POS. POS drawer must preserve cart state. Never mount/unmount the cart when toggling the drawer.
- Row click on product list = open detail. Eye icon is the explicit visual affordance. No edit icon in the list — edit happens from the detail page.
```

Update **Versioned PRDs** v2.4 entry (which doesn't exist — design refresh was deliberately skipped):

```
- v2.4: design refresh — DEFERRED. v1.7 design system remains current. Revisit after real-world feedback from paying shops.
```

---

## 15. Out of scope

- **Category hierarchy** (Electronics > Phones > Smartphones). Flat categories only. If a real customer asks, add `parent_category_id` later.
- **Category-level pricing rules** ("VAT 10% on Electronics"). Future.
- **Category-level reporting** ("revenue by category"). Future — data is now there for it.
- **Bulk product re-categorization.** No bulk action UI; admin re-categorizes one at a time via the edit form. Acceptable for SME tier with hundreds of products. Bulk later if needed.
- **Multi-category products** (a product in multiple categories). One category per product, by FK. If a real use case emerges, that's a substantial v3 redesign.
- **Archived category recovery** (soft-deleted categories with products still referencing them). FK is ON DELETE RESTRICT so deletion is blocked; deactivation works.
- **Tests / test infrastructure.** Still skipped per user instruction.

---

*End of v2.5 spec.*
