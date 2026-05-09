# MVP Enhancements — v1.5

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline), `MVP_FIXES_v1.3.md` (avg cost + sales module), `MVP_FIXES_v1.4.md` (partial payments + customer search).
**Stack:** unchanged — React + Supabase (via Supabase MCP) + react-i18next.

> Patch-on-top spec. The MVP is live with paying-shape customers in mind ("thousands of products"). Investigate first, then make the smallest correct change for each item. **No margin for sloppy concurrency or sloppy migrations.**

---

## 0. How to work this ticket

### Phase A — Discovery (read before writing code)

1. **Re-read** `PRD.md`, `MVP_FIXES_v1.3.md`, `MVP_FIXES_v1.4.md`. Skip if you've already loaded them this session.
2. **Inspect the live Supabase schema via MCP.** Specifically confirm:
   - Current `products` columns, indexes, and constraints. Whether `cost` and `avg_cost` both still exist.
   - Whether `pg_trgm` is already installed (v1.4 added it).
   - The current `record_purchase` and `record_sale` function bodies — read them, don't assume.
   - Existing unique constraints on `products` (there's a `unique` from v1.2 on something — check exactly what).
3. **Audit existing product data.** Run via MCP:
   ```sql
   -- Find rows that would conflict with the new unique constraint
   select shop_id, lower(trim(name)) as norm_name, count(*)
   from public.products
   group by shop_id, lower(trim(name))
   having count(*) > 1;

   -- Total products and how many have stock
   select count(*), count(*) filter (where stock > 0) from public.products;
   ```
   **If any duplicates exist, stop and report to the user** before applying the migration. The user decides the de-dup strategy. Do not invent one.
4. **Map the relevant frontend surfaces:**
   - `/products` list — current pagination (or lack of), columns, action placement.
   - `/pos` — current product picker (dropdown? grid? table?).
   - Cart component — find where qty is increment/decremented; identify the input type causing the "point" increments (likely `<input type="number">` with a fractional step, or a UI library control with step < 1).
   - Subtotal/service-charge ordering in the payment composer.
5. **Discovery report in chat** before any code: schema state, duplicate report, current POS/products structure, plan. Then proceed.

### Phase B — Schema migration first

Single migration: `00XX_v15_product_type_search_and_opening_stock.sql`. Apply via MCP, regenerate `src/types/database.ts`.

### Phase C — Backend functions

`search_products`, `search_products_count`, and `create_product_with_opening_stock`. Update `record_purchase` only if needed for the `is_opening` flag.

### Phase D — Frontend changes

In the order in §10.

### Phase E — Verification

Manual smoke test with two accounts. Test pagination at scale (seed ≥ 200 products on one account). No Playwright / unit tests.

---

## 1. Feature scope

### 1.1 `products.type` and `products.description`

Add two fields:
- `type text not null` — e.g., "LCD Panel", "Battery", "Charging Cable". Required, used as a discriminator alongside name.
- `description text null` — optional free text.

### 1.2 Composite uniqueness on (name, type), case- and whitespace-insensitive

A product is uniquely identified within a shop by **(normalized name, normalized type)**. "Redmi X7" + "LCD Panel" can exist exactly once per shop. "redmi x7" + "lcd panel" is the same row. "Redmi  X7  " (extra spaces) is also the same row.

Normalization rule:
- Lowercase
- Trim leading/trailing whitespace
- Collapse internal whitespace to a single space

Enforced at **two layers**:
- **Trigger** that normalizes `name` and `type` before insert/update so storage is canonical.
- **Functional unique index** on `(shop_id, lower(trim(regexp_replace(name, '\s+', ' ', 'g'))), lower(trim(regexp_replace(type, '\s+', ' ', 'g'))))` — defense in depth in case the trigger is bypassed.

### 1.3 Opening stock at product creation

When a product is created, the form **optionally** captures:
- Opening stock quantity (integer ≥ 0, default 0)
- Opening cost per unit (numeric ≥ 0, default 0)

If both > 0, the system records this as a `purchases` row with `source = 'Opening Stock'` and a new flag `is_opening = true`, so:
- `products.stock` is seeded.
- `products.avg_cost` is seeded via the same WAC path used by real stock-ins (avoiding a parallel code path).
- Reports can filter opening stock out of "real" purchase analytics.
- The audit trail makes sense ("where did the initial 50 units come from?").

For **existing products** with `stock > 0` and **no purchase history**, the migration creates synthetic `Opening Stock` purchase rows so the audit trail is consistent going forward. See §2.6.

### 1.4 Server-side pagination on `/products`

50 products per page. The current full-table fetch dies once a shop has thousands of products.

- Use Supabase `.range(start, end)` with `count: 'exact'` for total count.
- URL-driven: `?page=1&q=...` so refresh and back-button work.
- Page 1 is `1`, not `0`, in the URL. Internal math is zero-indexed.

> **Honest caveat on `count: 'exact'`:** at very large scale (tens of millions of rows) `exact` becomes slow because Postgres has to scan the index. For MVP scale (thousands per shop, RLS-scoped), `exact` is correct and fast. If a single shop ever crosses ~100K products, switch to `count: 'estimated'` and live with approximate totals on page footers. Note this as a future-watch.

### 1.5 Fuzzy product search

Server-side search by name and type with typo tolerance and partial matching. Backed by `pg_trgm` and GIN indexes. Exposed as RPC `search_products`. Used by **both** the `/products` list and the POS product picker.

Behavior:
- Empty query → list all products (filtered by `is_active = true`), ordered by name, paginated.
- Non-empty query → return rows with substring match (ILIKE) **or** trigram similarity above threshold, ordered by relevance, paginated.
- "Relevance" = max similarity score across `name`, `type`, and `name || ' ' || type` against the query. Substring matches get a synthetic boost so exact prefix matches sort above fuzzy matches.

### 1.6 POS module redesign

Replace whatever the current product picker is (dropdown, grid, etc.) with a **table-with-search** that mirrors the `/products` list layout. The two screens stay as separate routes but share the same table component (different action column).

**`/pos` table (left panel):**
- Action column **first** with a single round **+** button per row → adds 1 unit to cart.
- Subsequent columns: Name, Type (as a small badge), Stock (with a "low" indicator at ≤ 5), Price, Avg cost (muted).
- Search input above the table, fuzzy.
- Pagination at bottom, 50/page.

**Cart (right panel)** — see §1.7 for redesign details.

### 1.7 Cart UX fixes

Three concrete problems to fix and a broader polish:

1. **Quantity stepper increments by decimals** — replace the spinner-arrow `<input type="number">` (or whichever control is causing it) with a **custom round +/- stepper that increments by integers only**. Direct typing into the qty field is allowed but constrained to non-negative integers. Disable `−` at qty=1 (clicking again should remove the line via the explicit ×). Disable `+` at qty=`product.stock`.

2. **Subtotal placement** — Subtotal (the products-only line total) currently appears below Service charge. Move it **above**. The display order is:
   ```
   Subtotal (products)        1,200
   Service charge       [    200  ]
   ─────────────────────────────────
   Total                      1,400
   ```
   Subtotal is read-only computed. Service charge is editable. This is the natural reading order for the cashier.

3. **Layman-friendly UI** — broader polish, called out specifically:
   - Larger touch targets on +/- (minimum 40×40).
   - Each cart line shows: product name, type badge, "Stock: X left" subline, qty stepper, unit price (still editable per v1.3), line total. Remove (×) button on the leading edge.
   - Empty-cart state with a clear illustration or icon and copy: "Add products from the left to start a sale."
   - "Modified price" badge from v1.3 stays.
   - Keyboard: Enter on qty input commits and moves focus to the next line. Esc clears focus.

---

## 2. Schema changes

Single migration: `00XX_v15_product_type_search_and_opening_stock.sql`.

### 2.1 Pre-flight checks

Before applying the migration, the discovery in Phase A must confirm there are zero `(shop_id, lower(trim(name)))` duplicates. If duplicates exist, **abort and report them**. The user must rename or merge before the unique constraint can land.

If no duplicates exist, proceed with the migration in this exact order — column adds, normalization function, trigger, backfill, then constraints.

### 2.2 Add columns

```sql
alter table public.products
  add column if not exists type text,
  add column if not exists description text;

alter table public.purchases
  add column if not exists is_opening boolean not null default false;
```

`type` is added nullable first so backfill can fill it. We'll make it `not null` after backfill in §2.5.

### 2.3 Normalization function + trigger

```sql
create or replace function public.normalize_product_text(s text)
returns text
language sql
immutable
as $$
  select case
    when s is null then null
    else trim(regexp_replace(s, '\s+', ' ', 'g'))
  end;
$$;

create or replace function public.products_normalize_trigger()
returns trigger
language plpgsql
as $$
begin
  new.name := public.normalize_product_text(new.name);
  new.type := public.normalize_product_text(new.type);
  -- description is free-form, just trim leading/trailing
  if new.description is not null then
    new.description := trim(new.description);
    if new.description = '' then new.description := null; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_normalize on public.products;
create trigger products_normalize
  before insert or update of name, type, description on public.products
  for each row execute function public.products_normalize_trigger();
```

### 2.4 Backfill `type` for existing products

Two-step strategy. The default `'General'` is a placeholder — the user is expected to revisit and assign real types via the edit form. Surface this in the UI as a small warning badge on rows with `type = 'General'` for the first week post-migration.

```sql
-- Step 1: normalize existing names
update public.products set name = public.normalize_product_text(name) where name is not null;

-- Step 2: seed type
update public.products set type = 'General' where type is null;

-- Step 3: lock type as required
alter table public.products alter column type set not null;
alter table public.products add constraint products_type_not_blank check (length(type) > 0);
alter table public.products add constraint products_name_not_blank check (length(name) > 0);
```

### 2.5 Composite unique index (case- and whitespace-insensitive)

```sql
-- The trigger already canonicalizes inputs, so a plain unique on (shop_id, lower(name), lower(type)) is enough.
-- But we keep the regexp_replace inside the index too as defense-in-depth — if anyone bypasses the trigger
-- (e.g., COPY, raw SQL by an admin), the index still rejects duplicates.
create unique index if not exists uq_products_shop_name_type
  on public.products (
    shop_id,
    lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(type), '\s+', ' ', 'g'))
  )
  where is_active = true;
```

> **Why `where is_active = true`?** A soft-archived product shouldn't block a new product with the same name+type. If you don't yet soft-delete (just hard-delete), drop the partial predicate.

### 2.6 Synthetic opening-stock backfill

For existing products that currently have stock but no purchase history, create a single synthetic `Opening Stock` purchase row each so the audit trail is consistent. Skip products that already have at least one `purchases` row.

```sql
-- One opening-stock purchase per product that has stock and zero purchases
with seed as (
  select
    p.shop_id,
    p.id as product_id,
    p.stock as qty,
    coalesce(p.avg_cost, p.cost, 0) as cost_each
  from public.products p
  where p.stock > 0
    and not exists (
      select 1
      from public.purchase_items pi
      join public.purchases pu on pu.id = pi.purchase_id
      where pi.product_id = p.id
    )
),
new_purchases as (
  insert into public.purchases (shop_id, total_cost, source, note, purchase_date, cashier_id, is_opening)
  select
    s.shop_id,
    s.qty * s.cost_each,
    'Opening Stock',
    'Auto-generated during v1.5 migration',
    current_date,
    sh.owner_user_id,
    true
  from seed s
  join public.shops sh on sh.id = s.shop_id
  returning id, shop_id
)
insert into public.purchase_items (purchase_id, product_id, qty, cost_at_purchase)
select np.id, s.product_id, s.qty, s.cost_each
from new_purchases np
join seed s on s.shop_id = np.shop_id;
```

> Verify the row counts after running. If the migration synthesizes a different number of `purchases` than the count of products needing seeding, something is off — investigate before continuing.

### 2.7 Trigram indexes for fuzzy search

```sql
create extension if not exists pg_trgm;

create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);
create index if not exists idx_products_type_trgm
  on public.products using gin (type gin_trgm_ops);

-- For combined-field search
create index if not exists idx_products_name_type_trgm
  on public.products using gin ((name || ' ' || type) gin_trgm_ops);

-- For pure pagination (no search) the existing shop_id index is fine,
-- but ensure ordering by name is supported:
create index if not exists idx_products_shop_name_active
  on public.products (shop_id, name) where is_active = true;
```

### 2.8 Honest column-cleanup note

The legacy `products.cost` column is still around from v1.2. It's now ambiguously redundant with `avg_cost` and `last_purchase_cost`. **Don't drop it in this migration** — too many places might still read it, and dropping it during a feature migration risks breakage. Add a follow-up ticket "v1.6: drop products.cost" after this round audits all reads.

---

## 3. Backend functions

### 3.1 `search_products` RPC

Handles both empty-query listing and fuzzy search. Includes pagination.

```sql
create or replace function public.search_products(
  p_query text default null,
  p_limit int default 50,
  p_offset int default 0,
  p_only_in_stock boolean default false
) returns table (
  id uuid,
  name text,
  type text,
  description text,
  price numeric(12,2),
  avg_cost numeric(12,2),
  last_purchase_cost numeric(12,2),
  stock integer,
  is_active boolean,
  relevance real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
begin
  if v_shop_id is null then
    raise exception 'no_shop_for_user';
  end if;

  -- Normalize query the same way we normalize stored values
  v_query := nullif(trim(coalesce(p_query, '')), '');

  -- Adjust trigram threshold for this query: 0.2 is more permissive than the 0.3 default,
  -- which catches more typos at the cost of a few false positives.
  perform set_limit(0.2);

  return query
  with base as (
    select p.*
    from public.products p
    where p.shop_id = v_shop_id
      and p.is_active = true
      and (not p_only_in_stock or p.stock > 0)
  ),
  scored as (
    select
      b.*,
      case
        when v_query is null then 0::real
        else greatest(
          -- Exact prefix gets a strong boost
          case when b.name ilike v_query || '%' then 1.0::real else 0.0::real end,
          case when b.type ilike v_query || '%' then 0.9::real else 0.0::real end,
          -- Substring match gets a moderate boost
          case when b.name ilike '%' || v_query || '%' then 0.8::real else 0.0::real end,
          case when b.type ilike '%' || v_query || '%' then 0.7::real else 0.0::real end,
          -- Trigram similarity for typo tolerance
          similarity(b.name, v_query),
          similarity(b.type, v_query),
          similarity(b.name || ' ' || b.type, v_query)
        )
      end as relevance
    from base b
  )
  select
    s.id, s.name, s.type, s.description,
    s.price, s.avg_cost, s.last_purchase_cost,
    s.stock, s.is_active, s.relevance
  from scored s
  where v_query is null or s.relevance > 0.2
  order by
    case when v_query is null then 0 else 1 end,  -- when no query, ignore relevance entirely
    s.relevance desc,
    s.name asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;
```

### 3.2 `search_products_count` RPC

Same filter logic, just returns the total count for pagination.

```sql
create or replace function public.search_products_count(
  p_query text default null,
  p_only_in_stock boolean default false
) returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
  v_count bigint;
begin
  if v_shop_id is null then
    raise exception 'no_shop_for_user';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  if v_query is null then
    select count(*) into v_count
    from public.products p
    where p.shop_id = v_shop_id
      and p.is_active = true
      and (not p_only_in_stock or p.stock > 0);
  else
    select count(*) into v_count
    from public.products p
    where p.shop_id = v_shop_id
      and p.is_active = true
      and (not p_only_in_stock or p.stock > 0)
      and (
        p.name ilike '%' || v_query || '%'
        or p.type ilike '%' || v_query || '%'
        or p.name % v_query
        or p.type % v_query
        or (p.name || ' ' || p.type) % v_query
      );
  end if;

  return v_count;
end;
$$;
```

> The two-RPC pattern beats fetching all rows and counting client-side, but it does run two queries. Acceptable at MVP scale. If you ever need to optimize, fold count into the main query as a window function (`count(*) over () as total_count` on each row) — it's one round-trip but adds the count to every row.

### 3.3 `create_product_with_opening_stock` RPC

One function so opening stock and product creation are atomic. The frontend always calls this — no direct `INSERT INTO products` from the client.

```sql
create or replace function public.create_product_with_opening_stock(
  p_name text,
  p_type text,
  p_description text default null,
  p_price numeric(12,2) default 0,
  p_opening_stock integer default 0,
  p_opening_cost numeric(12,2) default 0
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_purchase_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_price < 0 then raise exception 'price_negative'; end if;
  if p_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
  if p_opening_cost < 0 then raise exception 'opening_cost_negative'; end if;

  -- The trigger normalizes name/type. The unique index catches duplicates with a friendly error code.
  insert into public.products (shop_id, name, type, description, price, stock, avg_cost, cost)
  values (v_shop_id, p_name, p_type, p_description, p_price, 0, 0, 0)
  returning id into v_product_id;

  -- If opening stock provided, route it through a purchase so avg_cost and stock update via WAC
  if p_opening_stock > 0 then
    insert into public.purchases (shop_id, total_cost, source, note, purchase_date, cashier_id, is_opening)
    values (v_shop_id, p_opening_stock * p_opening_cost, 'Opening Stock', 'Initial inventory', current_date, v_user_id, true)
    returning id into v_purchase_id;

    insert into public.purchase_items (purchase_id, product_id, qty, cost_at_purchase)
    values (v_purchase_id, v_product_id, p_opening_stock, p_opening_cost);

    update public.products
    set stock = p_opening_stock,
        avg_cost = p_opening_cost,
        last_purchase_cost = p_opening_cost,
        cost = p_opening_cost,
        updated_at = now()
    where id = v_product_id;
  end if;

  return v_product_id;
end;
$$;
```

Frontend:
```ts
const { data, error } = await supabase.rpc('create_product_with_opening_stock', {
  p_name: name,
  p_type: type,
  p_description: description ?? null,
  p_price: price,
  p_opening_stock: openingStock ?? 0,
  p_opening_cost: openingCost ?? 0,
});
```

On unique-violation error (Postgres `23505`, constraint name `uq_products_shop_name_type`), surface as inline form error: "A product with this name and type already exists." Translate via i18n.

### 3.4 `record_purchase` patch

If the existing function doesn't accept an `is_opening` flag, add an optional parameter (default `false`) so the regular stock-in flow stays unchanged but advanced flows can mark opening stock. Most stock-ins won't pass it.

---

## 4. RLS sanity check

All new functions are `security definer` and resolve `current_shop_id()`. None of them accept a `shop_id` parameter — that prevents a malicious caller from passing another shop's id.

After applying the migration, verify with two accounts that `search_products` and `search_products_count` for Account B never return Account A's rows, even with a query that would otherwise match.

---

## 5. Frontend changes

### 5.1 Shared `<ProductTable>` component

Build one component used by both `/products` and `/pos`. Differs only in the action column.

**Props:**
```ts
type ProductTableProps = {
  // Renderer for the action cell, lets each screen drop in its own buttons
  renderActions: (row: ProductRow) => React.ReactNode;
  // Initial state from URL
  initialQuery?: string;
  initialPage?: number;
  // Optional: filter to only-in-stock items (POS uses this true)
  onlyInStock?: boolean;
  // Sticky search bar on top? POS does, /products does
  showSearch?: boolean;
  pageSize?: number; // default 50
};
```

**Internals:**
- React Query for `search_products` and `search_products_count`, keyed by `[query, page, onlyInStock]`.
- Debounced search input (250ms).
- Loading skeleton rows on initial fetch and on page change.
- Empty state with two variants: "No products yet" (when total = 0) and "No products match your search" (when total > 0 but page is empty).
- URL sync: `?q=...&page=...` via React Router's `useSearchParams`.

**Columns (in order, LTR — mirror automatically in RTL via logical properties):**

1. Action (first) — slot from `renderActions`
2. Name (bold) + Type badge below
3. Stock (number, with red "Low" pill at ≤ 5, gray "Out" pill at 0)
4. Price
5. Avg cost (muted, smaller)
6. Last purchase cost (muted, smaller, shown only on wider screens)

The `description` field is **not** shown in the list — it's only on the detail / edit view. Lists need to be scannable.

### 5.2 `/products` screen

- Page title "Products" with a "+ New product" CTA in the header.
- `<ProductTable>` with `renderActions` returning Edit and Delete icon buttons.
- Edit opens `/products/:id/edit` (or a side drawer — pick whatever the existing UX uses, just be consistent).
- Delete is **soft-delete** (`is_active = false`) with confirmation. Hard-delete only when the product has zero `sale_items` AND zero `purchase_items` references.

Product create / edit form:
- Name (required, normalized on blur for visual feedback — show "redmi  x7 " becoming "Redmi X7" so users learn the rules)

  Actually, **don't** auto-capitalize on the server side — the trigger only trims and collapses whitespace. Capitalization is the user's choice but matched case-insensitively. Mention this in the field hint.
- Type (required, free text). To help avoid typo-driven duplicates, add a small autocomplete sourced from the user's existing types: `select distinct type from products where shop_id = current_shop_id()`. Surface as a datalist or combobox.
- Description (optional, multiline, max 1000 chars).
- Price (required, ≥ 0).
- **Opening stock section** — only visible on the **create** form, not on edit. Two fields:
  - Opening quantity (integer ≥ 0, default 0)
  - Opening cost per unit (numeric ≥ 0, default 0)
  Helper text: "Optional. Use this to seed your initial inventory without recording a purchase."

On submit, call `create_product_with_opening_stock`. On unique-violation, show inline error.

### 5.3 `/pos` screen redesign

Two-pane layout:

**Left pane — products picker** (uses `<ProductTable>` with `onlyInStock={true}`):
- Action column = round `+` button (40×40, prominent). Click adds 1 unit of that product to the cart.
- If clicking `+` for a product already in the cart, increment its qty by 1 (don't add a duplicate line).
- If qty would exceed stock, show a small toast and don't increment.
- Search at the top, sticky.
- Pagination at the bottom.

**Right pane — cart** (see §5.4).

On narrow screens (< 1024px), the two panes stack — picker on top, cart below — and the cart sticks to the bottom with a "View cart (N items, Total: X)" collapsed bar that expands on tap.

### 5.4 Cart redesign

Per-line layout (top to bottom):
```
[× Remove]  Product Name                   Stock: 12 left
            [Type badge]                              Modified  ← if price was edited
            [ − ]  [ 2 ]  [ + ]   ×   [ 500 ]   =   1,000
```

Quantity stepper:
- Round buttons, 40×40, with a clear `−` and `+` glyph (not arrows).
- Increment/decrement by **integer 1**.
- Disable `−` at 1 (clicking again does nothing — explicit Remove handles deletion).
- Disable `+` when `qty === product.stock`.
- The middle field is a number input, integer-only, validated on blur. Out-of-range → snap back to last valid value.

Below the cart, the totals block in this exact order:
```
Subtotal (products)        1,200
Service charge       [    200  ]
─────────────────────────────────
Total                      1,400

Amount paid          [    600  ]   [Pay full] [Pay nothing]
On credit                    800

Customer    [Search...                  ▼]
Notes       [Optional notes...           ]

[Complete partial sale (600 paid · 800 credit)]
```

(Customer picker / notes / amount paid all from v1.4 — they stay; only ordering and visual polish change here.)

Empty cart state — large icon, calm copy: "Pick products from the left to start a sale." On narrow screens, "Tap a product above to start a sale."

### 5.5 Service-only sale path (no regression)

The service-only flow from v1.4 stays. With the redesign:
- The cart is empty → totals show Subtotal: 0, but Service charge can still be entered → Total = service charge.
- "Complete sale" button stays enabled as long as `(items > 0 OR service_charge > 0)`.
- The notes field is the natural place to describe the service.

### 5.6 i18n keys (additions)

```jsonc
// locales/en/products.json (additions)
{
  "fields": {
    "type": "Type",
    "type_placeholder": "e.g. LCD Panel, Battery, Charging Cable",
    "type_hint": "Used together with name to uniquely identify the product",
    "description": "Description",
    "description_optional": "Description (optional)",
    "opening_stock": "Opening stock (optional)",
    "opening_qty": "Opening quantity",
    "opening_cost": "Opening cost per unit",
    "opening_help": "Use this to seed your initial inventory without recording a purchase."
  },
  "badges": {
    "low_stock": "Low",
    "out_of_stock": "Out",
    "modified_price": "Modified",
    "default_type_warning": "Type was set to 'General' during migration — please review"
  },
  "errors": {
    "duplicate_name_type": "A product with this name and type already exists.",
    "name_required": "Name is required",
    "type_required": "Type is required"
  },
  "actions": {
    "new_product": "+ New product",
    "edit": "Edit",
    "archive": "Archive",
    "delete": "Delete"
  }
}

// locales/en/pos.json (additions)
{
  "picker": {
    "search_placeholder": "Search products by name or type",
    "no_results": "No products match your search",
    "no_products_yet": "No products yet — add some on the Products page",
    "add_to_cart": "Add to cart",
    "stock_label_one": "{{count}} in stock",
    "stock_label_other": "{{count}} in stock",
    "low_stock_warning": "Only {{count}} left",
    "out_of_stock_warning": "Out of stock"
  },
  "cart": {
    "empty_title": "Cart is empty",
    "empty_help": "Pick products from the left to start a sale.",
    "empty_help_mobile": "Tap a product above to start a sale.",
    "subtotal_products": "Subtotal (products)",
    "remove_line": "Remove",
    "qty_label": "Quantity",
    "stock_remaining": "Stock: {{count}} left"
  },
  "search": {
    "showing": "Showing {{from}}–{{to}} of {{total}}",
    "page": "Page {{page}} of {{totalPages}}",
    "previous": "Previous",
    "next": "Next"
  }
}
```

Mirror in `locales/ur/*` consistent with existing terminology.

---

## 6. Edge cases & defensive notes

These are the corners I expect to bite if not handled. Treat each as a verification checkpoint.

- **Concurrent product creation racing the unique index.** Two cashiers click "Save" at the same instant on identical name+type. One succeeds, the other gets `23505`. The frontend must handle this gracefully — show the error, don't crash, don't double-submit. Disable the submit button while the mutation is pending.
- **Search query with regex/glob characters.** A user typing `100%` or `Note_4` must not blow up the query. Trigram is regex-free and safe; ILIKE is parameterized through the RPC, so `%` and `_` are treated as content, not wildcards, **inside the function body**. Verify by searching `100%` and confirming results are sane.
- **Pagination drifting under concurrent inserts.** While paginating, another cashier adds 5 products. Your "page 2" rows shift. This is acceptable for MVP — note it as a known minor inconsistency. The fix (cursor-based pagination) is overkill until users complain.
- **Stock decrement after concurrent sales.** Already handled by `for update` in `record_sale`. Confirm no path bypasses the RPC and writes `products.stock` directly from the client. If you find one, fix it.
- **Opening stock at edit time.** Opening stock is **only** at creation. Don't allow editing the opening stock fields after the fact — that would silently rewrite history. If a shop owner asks for "let me fix the opening number," the right answer is a regular stock adjustment (out of scope for v1.5; flag for v1.6).
- **Type backfill collisions.** If two existing products had the same name and now both get `type = 'General'`, the unique index will refuse the constraint. Discovery in §A.3 should catch this; if it doesn't, the constraint creation will fail loudly. **Don't** silently rename one — abort and ask the user.
- **The cart's "Stock: 12 left" indicator going stale.** If the user adds qty 8 to cart and the product's actual remaining stock is 12, the picker should show "12" but the cart's `+` should disable at 12 (not at 12 minus what's in cart). Decide which: I recommend **picker shows raw stock; cart disables `+` at `product.stock`** (i.e., total qty in this cart line can't exceed total available stock). The race is mitigated by the `for update` lock at sale time — worst case the sale fails with `insufficient_stock` and the user re-tries.
- **Empty `description` field stored as `''` vs `null`.** The trigger normalizes empty string to null. Verify on the frontend you're sending `null` (or letting the trigger handle it) — don't send `''` and expect uniqueness behavior to differ.

---

## 7. Performance notes

- The trigram GIN indexes make ILIKE-with-wildcards and `%` similarity O(log n)-ish at the cost of larger index size. Acceptable.
- `count(*)` with a complex WHERE doesn't always use indexes optimally. At 100K+ rows per shop, watch this. Ship now, monitor later.
- The `set_limit(0.2)` call inside `search_products` is per-session, not persistent. Don't worry about resetting it.
- Server-side pagination with `OFFSET` degrades linearly (~10K is fine, ~1M is not). Out of scope for MVP.

---

## 8. Out of scope for this round

- Cursor-based pagination (only when OFFSET starts hurting).
- Soft-delete columns added to all tables (only `products.is_active` exists; that's enough).
- A separate stock-adjustment flow for correcting historical numbers (write-off / shrinkage). Flag for v1.6.
- Bulk product import (CSV). Flag for v1.6.
- Product images / barcodes. Already deferred per PRD §18.
- Dropping legacy `products.cost` column. Follow-up.
- Test infrastructure. Still skipped per user instruction.

---

## 9. Implementation order

1. **Discovery report** in chat (§Phase A). Include the duplicate audit query results, current schema diff vs. PRD, and the source of the current `record_purchase` and `record_sale`.
2. **If duplicates exist, stop.** Report to user, get resolution, then continue.
3. **Migration `00XX_v15_*.sql`** in this exact order:
   - Add columns (`type`, `description`, `is_opening`).
   - Normalization function + trigger.
   - Backfill `type = 'General'` for existing rows.
   - Make `type` not null.
   - Composite unique index.
   - Synthetic opening-stock backfill.
   - Trigram indexes.
4. **Backend functions:** `search_products`, `search_products_count`, `create_product_with_opening_stock`. Patch `record_purchase` if needed.
5. **Regenerate `database.ts`.**
6. **Manual sanity in SQL:** call `search_products('redm', 50, 0)`, `search_products(null, 10, 0)`, and the count function. Verify ordering and row counts.
7. **Build `<ProductTable>`** as a shared component. URL sync, debounced search, pagination.
8. **`/products` screen** uses `<ProductTable>` with edit/delete actions. Update create/edit form: type required + autocomplete, description, opening-stock section on create only.
9. **`/pos` screen** uses `<ProductTable>` with the `+` action. Wire `+` to cart-add.
10. **Cart redesign:** integer stepper, subtotal-above-service-charge ordering, polished empty state, "Stock: X left" subline, accessible touch targets.
11. **Verify service-only sale still works** end-to-end with the new layout.
12. **i18n pass:** every new string in EN + UR. Manual scan for hard-coded strings on the new screens.
13. **Manual smoke test** with two accounts:
    - **Account A:**
      - Migrate with at least 5 existing products (some with stock, some without). Confirm backfill set `type = 'General'` and synthetic opening-stock rows appeared in `/purchases` only for products that had stock and no prior purchases.
      - Create a new product with `type = 'LCD Panel'` and opening stock 10 @ 50. Verify product list shows it, stock = 10, avg cost = 50. Verify a row appeared in `/purchases` with source = 'Opening Stock'.
      - Try to create the same product again → friendly inline error.
      - Try to create "  redmi  x7  " + "  LCD Panel  " → friendly inline error (whitespace + case insensitive).
      - Seed at least 200 dummy products (script in SQL or quick admin loop). Browse `/products` page 4 — confirm pagination works, count is correct.
      - Search "redm" → fuzzy hits. Search "100%" → no crash. Search "" → all products listed.
      - Open `/pos`. Click `+` on three products. Confirm cart adds them. Click `+` again on one — qty increments, not a duplicate line. Try to exceed stock — blocked with toast.
      - In the cart, use the `−` and `+` buttons — each step changes qty by exactly 1, no decimals. Try typing `2.5` — snaps to `2` or `3`.
      - Subtotal renders **above** service charge.
      - Complete a partial sale, a service-only sale, and a cash sale with the new POS. Verify all match v1.4 behavior.
    - **Account B:**
      - Confirm zero of A's data leaks via `/products`, `/pos`, `search_products`, `search_products_count`.
14. **Report back** with: schema diff, what discovery surfaced, dummy data script (so the user can re-seed if needed), any spec ambiguities you resolved.

---

## 10. Acceptance criteria

The patch is done when **all** of the following hold:

- [ ] `products.type` is required, normalized (trim + collapse whitespace), and case-insensitive when checking uniqueness.
- [ ] `(shop_id, normalized_name, normalized_type)` is unique. Two attempts to create "Redmi X7" + "LCD Panel" in the same shop, in any case or whitespace, fail with a friendly inline error.
- [ ] `products.description` exists and is optional.
- [ ] Existing products that had no `type` were backfilled to `'General'` and surface a small "review type" badge.
- [ ] Existing products with stock but no purchase history have a synthetic `Opening Stock` purchase row visible in `/purchases`.
- [ ] New product creation supports optional opening stock + opening cost in a single atomic call. The product's `stock` and `avg_cost` are correctly seeded.
- [ ] `/products` paginates server-side, 50 per page, with URL sync (`?q=...&page=...`).
- [ ] Fuzzy search via `search_products` returns typo-tolerant results ranked by relevance. Substring and prefix matches sort above pure trigram matches.
- [ ] Search query containing `%`, `_`, or special characters does not crash and returns sensible results.
- [ ] `/pos` and `/products` use the same `<ProductTable>` component, with action column **first** and a `+` button per row in POS.
- [ ] Clicking `+` on a product in POS adds 1 to the cart, or increments an existing line. Stock cap is enforced.
- [ ] Cart quantity stepper increments/decrements by **exactly 1**. No decimal increments anywhere.
- [ ] In the cart totals, **Subtotal (products)** appears **above** Service charge.
- [ ] All v1.4 sale flows (cash, credit, partial, service-only, walk-in) still work end-to-end with the new POS layout.
- [ ] No new console errors on any new or modified screen, in either language.
- [ ] RLS still isolates shops. Account B's `search_products` returns zero rows from Account A regardless of query.

---

*End of v1.5 enhancements spec.*
