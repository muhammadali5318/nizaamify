# MVP v2.7 — Variant Management UI

**Audience:** Claude Code
**Companion to:** `PRD.md` and v1.3–v2.6 specs.
**Stack:** unchanged.
**Type:** User-visible feature on top of v2.6's silent refactor.
**Realistic effort:** 2 weeks.
**Prerequisite:** v2.6 must be shipped, audited, and stable.

> **What this ships.** Variant attributes (Color, Size, Storage, Volume, etc.) defined per shop. Product create/edit form gets a "Has variants?" toggle that opens a matrix of attribute combinations. Each generated variant has its own stock, price, and SKU (auto-suggested, free text). Stock-in supports a matrix entry mode for multi-variant products — receiving 50 tracksuits across 6 size/color combinations becomes a 6-cell grid, not 6 separate lines. POS variant picker for multi-variant products. All single-variant flows from v2.6 keep working unchanged.

---

## 0. How to work this ticket

### Phase A — Discovery (mandatory before code)

1. **Confirm v2.6 is shipped and stable.** Run all six audit queries from v2.6 §6 — must all return zero rows. If any fail, fix v2.6 first; do not proceed.
2. **Read** `CLAUDE.md` and recent fix specs (`v2.5`, `v2.6`).
3. **Skills check** — use `frontend-design` skill for matrix UI patterns, drawer pattern (already in use from v2.5), and form layouts. If a form-matrix or grid-input skill exists in `/mnt/skills/`, read it.
4. **Inspect live schema via MCP.** Confirm:
   - `product_variants` table populated with one default variant per product (per v2.6).
   - All transaction tables point to `variant_id` (per v2.6).
   - `product_categories` exists (per v2.5).
   - `units_of_measure` and `product_packs` exist (per v2.1, now keyed on variant_id per v2.6).
5. **Confirm the test sports shop data exists.** Have at least one shop with realistic SKU count for testing matrix flows. If not, seed via SQL.
6. **Generate `tasks.md`** entries for v2.7 (append, don't overwrite the v2.6 task list).
7. **Generate `decisions/`** entries (see §15).
8. **Discovery report in chat** — v2.6 audit status, schema state, plan, then proceed.

### Phase B — Schema migration

Single migration `00XX_v27_variant_attributes.sql`. Smaller than v2.6's. Adds three tables for the attribute system, no risky data rewrites.

### Phase C — Backend functions

New RPCs for attribute management and matrix-driven variant creation. Existing RPCs (`record_sale`, `record_purchase`) need minor extension to handle multi-variant products in the matrix stock-in flow.

### Phase D — Frontend

The bulk of this ticket. Three major UI surfaces:
1. Settings → Variant Attributes management page
2. Product create/edit form with the "Has variants?" toggle and matrix
3. Stock-in form with matrix entry mode

### Phase E — Verification

Manual smoke test of every variant scenario (tracksuits, yoga mats, tapes, mobile phones). Update CLAUDE.md.

---

## 1. The mental model (call out for Claude Code)

Three layers compose:

1. **Product (template)** — the SKU family. Name, category, description, type. No stock or price.
2. **Variant (concrete SKU)** — the sellable thing. Has stock, price, cost. Optionally has attribute values (e.g., Color=Red, Size=M).
3. **Pack (packaging shortcut for stock-in)** — defined per variant. "Red tape comes in rolls of 10."

A single-variant product has one variant with no attribute values. Multi-variant products have multiple variants each with a unique combination of attribute values.

Variants and packs **compose**. A track suit has color × size variants but no packs (you don't buy them by the carton). A tape has color variants and a "Roll of 10" pack per variant.

---

## 2. Examples (concrete cases from the user's sports shop)

| Product | Variant attributes | Variants generated | Packs |
|---|---|---|---|
| Track Suit AAA | Color (Black, Navy, Red) × Size (S, M, L, XL) | Up to 12 (user unchecks impossible combos) | None |
| Yoga Mat | Size (4mm, 6mm, 8mm) | 3 | None |
| Masking Tape | Color (Red, Blue, Green) | 3 | Roll = 10 base, defined per variant |
| Carom Board | Dimension (32", 36", 40") | 3 | None |
| iPhone 14 | Storage (128GB, 256GB) × Color (Black, White, Pink) | Up to 6 (user unchecks) | Each variant may have a Carton pack |

The garments shop (single-product type, simple matrix), the milk shop (single dimension, no matrix needed), the mobile shop (high-value variants with own prices), and the tape shop (variants + packs) are all served by the same model.

---

## 3. Schema changes

Single migration `00XX_v27_variant_attributes.sql`.

### 3.1 `variant_attributes` table — shop-wide attribute definitions

```sql
create table if not exists public.variant_attributes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,                   -- 'Color', 'Size', 'Storage', 'Volume', 'Dimension'
  display_order int not null default 0, -- in matrix UIs, Color first, Size second, etc.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variant_attr_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists uq_variant_attr_shop_name
  on public.variant_attributes (shop_id, lower(trim(name))) where is_active;

create index if not exists idx_variant_attr_shop
  on public.variant_attributes (shop_id, is_active) where is_active;

alter table public.variant_attributes enable row level security;

create policy "variant_attr_shop_read" on public.variant_attributes
  for select using (shop_id = (select public.current_shop_id()));
create policy "variant_attr_shop_write" on public.variant_attributes
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

drop trigger if exists variant_attributes_touch on public.variant_attributes;
create trigger variant_attributes_touch
  before update on public.variant_attributes
  for each row execute function public.touch_updated_at();
```

### 3.2 `variant_attribute_values` table — shop-wide pool of values

```sql
create table if not exists public.variant_attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.variant_attributes(id) on delete cascade,
  value text not null,                  -- 'Red', 'XL', '128GB', '4mm'
  display_order int not null default 0, -- so S/M/L/XL render in size order
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variant_value_not_blank check (length(trim(value)) > 0)
);

create unique index if not exists uq_variant_value_attr_value
  on public.variant_attribute_values (attribute_id, lower(trim(value))) where is_active;

create index if not exists idx_variant_value_attr
  on public.variant_attribute_values (attribute_id, is_active) where is_active;

alter table public.variant_attribute_values enable row level security;

-- RLS through the attribute → shop chain
create policy "variant_values_shop_read" on public.variant_attribute_values
  for select using (
    exists (select 1 from public.variant_attributes a
            where a.id = attribute_id and a.shop_id = (select public.current_shop_id()))
  );
create policy "variant_values_shop_write" on public.variant_attribute_values
  for all using (
    exists (select 1 from public.variant_attributes a
            where a.id = attribute_id and a.shop_id = (select public.current_shop_id()))
  ) with check (
    exists (select 1 from public.variant_attributes a
            where a.id = attribute_id and a.shop_id = (select public.current_shop_id()))
  );

drop trigger if exists variant_attribute_values_touch on public.variant_attribute_values;
create trigger variant_attribute_values_touch
  before update on public.variant_attribute_values
  for each row execute function public.touch_updated_at();
```

### 3.3 `product_variant_attribute_values` — links variants to their attribute combination

```sql
create table if not exists public.product_variant_attribute_values (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  attribute_value_id uuid not null references public.variant_attribute_values(id) on delete restrict,
  primary key (variant_id, attribute_value_id)
);

create index if not exists idx_pvav_variant on public.product_variant_attribute_values (variant_id);
create index if not exists idx_pvav_value on public.product_variant_attribute_values (attribute_value_id);

alter table public.product_variant_attribute_values enable row level security;

create policy "pvav_shop_read" on public.product_variant_attribute_values
  for select using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.shop_id = (select public.current_shop_id())
    )
  );
create policy "pvav_shop_write" on public.product_variant_attribute_values
  for all using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.shop_id = (select public.current_shop_id())
    )
  ) with check (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.shop_id = (select public.current_shop_id())
    )
  );
```

**Invariant** (enforced at function level): for a multi-variant product, every variant must reference exactly one value per attribute used by the product. e.g., if Track Suit AAA uses Color and Size, every variant must have one Color value and one Size value linked. Default variants (from v2.6) have zero attribute values — they're the "no variants defined" baseline.

### 3.4 `products` table — flag for whether the product has variant attributes

```sql
alter table public.products
  add column if not exists has_variants boolean not null default false;
  -- TRUE when product has multiple variants distinguished by attributes
  -- FALSE for single-variant products (uses the v2.6 default variant only)
```

Backfill is trivial — every existing product is `has_variants = false`. New products in v2.7 with the variant toggle set to true will flip this.

### 3.5 `product_variants` updates

Drop `is_default` from being required-true-for-single-variant. Reasoning: when `has_variants = true`, no variant is the "default" — they're all real. The `is_default` flag becomes meaningful only when `has_variants = false`.

```sql
-- Adjust the partial unique index from v2.6: only enforce one default
-- when has_variants = false on the product
drop index if exists uq_variant_default_per_product;
create unique index if not exists uq_variant_default_per_product
  on public.product_variants (product_id)
  where is_default
    and is_active
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and not p.has_variants
    );
```

> **PostgreSQL note:** partial indexes can't use subqueries in the WHERE clause directly. The actual implementation will need either a function-based check or a CHECK constraint at the row level. Implementation alternative: a trigger that enforces "at most one is_default variant per product when products.has_variants is false." Pick whichever pattern is cleanest in PL/pgSQL; document the choice in `decisions/`.

### 3.6 Audit checkpoint

After migration, run:

```sql
-- Every product with has_variants = false must have exactly one default variant
select p.id, p.name, count(v.id) as default_variants
from public.products p
left join public.product_variants v on v.product_id = p.id and v.is_default and v.is_active
where p.is_active and not p.has_variants
group by p.id, p.name
having count(v.id) <> 1;
-- Must return zero rows.
```

---

## 4. Backend functions

### 4.1 Attribute and value management RPCs

Standard CRUD pattern, similar to category management from v2.5:

- `create_variant_attribute(p_name, p_display_order)` — creates "Color" attribute for the shop.
- `update_variant_attribute(p_id, p_name, p_display_order, p_is_active)`.
- `deactivate_variant_attribute(p_id)` — only allowed if no active product uses it.
- `add_variant_value(p_attribute_id, p_value, p_display_order)` — adds "Red" to the Color attribute.
- `update_variant_value(p_id, p_value, p_display_order, p_is_active)`.
- `deactivate_variant_value(p_id)` — only allowed if no active variant references it.
- `search_variant_attributes(p_query)` — for shop-wide attribute pickers.
- `list_attribute_values(p_attribute_id)` — returns all active values for an attribute.

### 4.2 `create_product_with_variants` — the main creation flow

This is the new function powering the "Has variants?" product create flow:

```sql
create or replace function public.create_product_with_variants(
  p_name text,
  p_category_id uuid,
  p_default_price numeric(12,2),       -- prefills all variants; user can override per-variant later
  p_is_scan_only boolean default false,
  p_base_unit_code text default 'each',
  p_attribute_ids uuid[] default array[]::uuid[],
    -- Ordered: ['<color_attr_id>', '<size_attr_id>']
  p_variants jsonb default '[]'::jsonb
    -- Each variant:
    --   {"attribute_value_ids": ["<red_id>", "<m_id>"],
    --    "sku": "TS-RED-M" (optional),
    --    "price": 1200 (optional, defaults to p_default_price),
    --    "opening_stock": 0,
    --    "opening_cost": null}
) returns table (product_id uuid, variant_ids uuid[])
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_product_id uuid;
  v_base_unit_id uuid;
  v_variant jsonb;
  v_variant_id uuid;
  v_variant_ids uuid[] := array[]::uuid[];
  v_attr_value_id uuid;
  v_has_variants boolean := jsonb_array_length(p_variants) > 1
                            or array_length(p_attribute_ids, 1) > 0;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  -- guards (name not blank, category in shop, price non-negative, base unit resolves, etc.)
  -- ...

  insert into public.products (
    shop_id, name, category_id, is_scan_only, base_unit_id, has_variants
  ) values (
    v_shop_id, trim(p_name), p_category_id, p_is_scan_only, v_base_unit_id, v_has_variants
  ) returning id into v_product_id;

  -- Validate attribute_ids belong to shop and are active
  if v_has_variants then
    perform 1 from public.variant_attributes
    where shop_id = v_shop_id and is_active
      and id = any(p_attribute_ids);
    if not found then raise exception 'attribute_not_in_shop_or_inactive'; end if;

    if array_length(p_attribute_ids, 1) <> (
      select count(*) from public.variant_attributes
      where shop_id = v_shop_id and is_active and id = any(p_attribute_ids)
    ) then
      raise exception 'one_or_more_attributes_invalid';
    end if;
  end if;

  -- Insert variants
  for v_variant in select * from jsonb_array_elements(p_variants) loop
    -- For multi-variant products, verify variant has exactly one value per attribute
    if v_has_variants then
      if jsonb_array_length(coalesce(v_variant->'attribute_value_ids', '[]'::jsonb))
         <> array_length(p_attribute_ids, 1) then
        raise exception 'variant_must_have_one_value_per_attribute';
      end if;
    end if;

    -- Insert the variant
    insert into public.product_variants (
      product_id, sku, stock, price, cost, avg_cost,
      is_default, is_active
    ) values (
      v_product_id,
      nullif(trim(coalesce(v_variant->>'sku', '')), ''),
      coalesce((v_variant->>'opening_stock')::int, 0),
      coalesce((v_variant->>'price')::numeric, p_default_price),
      (v_variant->>'opening_cost')::numeric,
      coalesce((v_variant->>'opening_cost')::numeric, 0),
      not v_has_variants,            -- only single-variant products mark is_default = true
      true
    ) returning id into v_variant_id;

    v_variant_ids := array_append(v_variant_ids, v_variant_id);

    -- Link variant to attribute values (multi-variant products only)
    if v_has_variants then
      for v_attr_value_id in
        select (value::uuid)
        from jsonb_array_elements_text(v_variant->'attribute_value_ids') as t(value)
      loop
        insert into public.product_variant_attribute_values (variant_id, attribute_value_id)
        values (v_variant_id, v_attr_value_id);
      end loop;
    end if;

    -- Record opening stock as a purchase if any
    if coalesce((v_variant->>'opening_stock')::int, 0) > 0
       and (v_variant->>'opening_cost') is not null then
      perform public.record_purchase(
        null::uuid,
        current_date,
        'Opening stock',
        jsonb_build_array(jsonb_build_object(
          'variant_id', v_variant_id,
          'qty', (v_variant->>'opening_stock')::int,
          'cost_at_purchase', (v_variant->>'opening_cost')::numeric
        )),
        '[]'::jsonb,
        true
      );
    end if;
  end loop;

  return query select v_product_id, v_variant_ids;
end;
$$;
```

### 4.3 `add_variant_to_product` — for adding variants to an existing product

Real-world scenario: shop owner adds a "Yellow" color to an existing Track Suit AAA after the supplier introduces it. They need to add 4 new variants (one per size) without recreating the whole product.

```sql
create or replace function public.add_variant_to_product(
  p_product_id uuid,
  p_attribute_value_ids uuid[],
  p_sku text default null,
  p_price numeric(12,2) default null,
  p_opening_stock int default 0,
  p_opening_cost numeric(12,2) default null
) returns uuid
language plpgsql security definer set search_path = public as $$
-- ... validates product belongs to shop, has_variants = true, attribute values
-- ... resolved match the product's existing attributes
-- ... inserts variant + attribute value links + optional opening stock
$$;
```

### 4.4 `record_purchase` — already accepts variant_id (per v2.6); now used by the matrix UI

No changes to `record_purchase` from v2.6. The matrix UI in §6.3 generates one line per cell-with-quantity and calls `record_purchase` with the `variant_id` for each.

### 4.5 Stock display per variant + product summary view

The v2.6 view `product_with_default_variant` is for single-variant products. For multi-variant products, the UI needs to render variants individually. Add a companion view:

```sql
create or replace view public.product_variant_full as
select
  p.id as product_id,
  p.shop_id,
  p.name as product_name,
  p.category_id,
  p.has_variants,
  v.id as variant_id,
  v.sku,
  v.stock,
  v.price,
  v.cost,
  v.avg_cost,
  v.last_purchase_cost,
  v.is_default,
  v.is_active as variant_is_active,
  -- Aggregate attribute values into a JSON object: {"Color": "Red", "Size": "M"}
  (
    select coalesce(jsonb_object_agg(a.name, vv.value), '{}'::jsonb)
    from public.product_variant_attribute_values pvav
    join public.variant_attribute_values vv on vv.id = pvav.attribute_value_id
    join public.variant_attributes a on a.id = vv.attribute_id
    where pvav.variant_id = v.id
  ) as attributes,
  -- Compact display label: "Red / M" or "" for single-variant
  (
    select string_agg(vv.value, ' / ' order by a.display_order, a.name)
    from public.product_variant_attribute_values pvav
    join public.variant_attribute_values vv on vv.id = pvav.attribute_value_id
    join public.variant_attributes a on a.id = vv.attribute_id
    where pvav.variant_id = v.id
  ) as variant_label
from public.products p
join public.product_variants v on v.product_id = p.id
where p.is_active and v.is_active;
```

The `variant_label` column lets the UI render "Tracksuit AAA — Red / M" without needing to join the attribute tables on the frontend.

### 4.6 Updated `search_products`

Two changes:
- For single-variant products: return one row (the existing v2.6 compat-view shape).
- For multi-variant products: return the **product**, not the variants. The UI gets one row per product in the search results; clicking the row navigates to the product detail page where variants are listed.

```sql
-- search_products keeps returning product_with_default_variant for now.
-- For multi-variant products, the view returns the product row with NULL variant fields
-- (no default variant exists). The UI handles this by:
-- - Showing the product in the list with "X variants" badge instead of stock/price
-- - On click, opening the detail page with the variants table

-- Update product_with_default_variant to handle multi-variant products gracefully:
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
  p.created_at as product_created_at,
  p.updated_at as product_updated_at,
  -- For single-variant products, expose default variant fields
  -- For multi-variant products, these are null; UI shows aggregates instead
  v.id as variant_id,
  v.sku,
  v.stock,
  v.price,
  v.cost,
  v.avg_cost,
  v.last_purchase_cost,
  v.is_active as variant_is_active,
  -- Aggregates for multi-variant products
  (select count(*) from public.product_variants
   where product_id = p.id and is_active) as variant_count,
  (select sum(stock) from public.product_variants
   where product_id = p.id and is_active) as total_stock_all_variants,
  (select min(price) from public.product_variants
   where product_id = p.id and is_active and price is not null) as min_price,
  (select max(price) from public.product_variants
   where product_id = p.id and is_active and price is not null) as max_price
from public.products p
left join public.product_variants v
  on v.product_id = p.id and v.is_default and v.is_active and not p.has_variants;
```

For a multi-variant product, `v.stock` is NULL but `total_stock_all_variants` has the sum. The UI uses whichever applies.

---

## 5. Frontend — Settings → Variant Attributes

New page at `/settings/variant-attributes`. Manages the shop-wide attributes and their values.

### 5.1 Layout

```
─ Variant Attributes ───────────────────────────────────
  Define attributes like Color, Size, Storage that you'll
  reuse across products. Each attribute has a list of values.
                                            [+ New attribute]
  ┌───────────────────────────────────────────────────┐
  │ Color  (4 values)                  [Edit]  [⋮]    │
  │   Red · Blue · Green · Black                       │
  │   [+ Add value]                                    │
  └───────────────────────────────────────────────────┘
  ┌───────────────────────────────────────────────────┐
  │ Size   (5 values)                  [Edit]  [⋮]    │
  │   S · M · L · XL · XXL                             │
  │   [+ Add value]                                    │
  └───────────────────────────────────────────────────┘
  ┌───────────────────────────────────────────────────┐
  │ Storage (3 values)                 [Edit]  [⋮]    │
  │   64GB · 128GB · 256GB                             │
  │   [+ Add value]                                    │
  └───────────────────────────────────────────────────┘
```

### 5.2 Behavior

- "+ New attribute" opens a modal: Name + display order. Saves via `create_variant_attribute`.
- Each attribute card lists its values as pills/chips. "+ Add value" opens inline input.
- Edit attribute: modal with name + display order + bulk value editor.
- Kebab menu: Archive (rejected if any active variant uses it).
- Drag-handle for reorder (optional polish — defer if matrix UX is already heavy).
- Values inside an attribute have their own display order, so "S, M, L, XL" renders in size order, not alphabetical.

### 5.3 Empty state

For a brand-new shop with no attributes yet:
```
  You haven't defined any variant attributes yet.

  Examples: Color, Size, Storage, Volume, Dimension.

  Define attributes once, then reuse them across products.

                                      [+ New attribute]
```

---

## 6. Frontend — Product create/edit form with variant matrix

### 6.1 The "Has variants?" toggle

The v2.5 product create form gets a new toggle:

```
Name *                    [_____________]
Category *                [Search ▼]
Sell price (per unit) *   [_____________]
Opening stock (qty)       [_____________]
Opening stock (cost/unit) [_____________]
☐ Scan-only

☐ This product has variants (e.g., different colors, sizes)
```

When toggled on, the form replaces the single-stock/price section with the variant matrix builder.

### 6.2 Variant matrix builder

```
─ Variants ─────────────────────────────────────────
  Select up to 3 attributes for this product:

  [Color ▼]        Selected values:  ⊕ Red  ⊕ Blue  ⊕ Black
                                     [+ Add value]

  [Size ▼]         Selected values:  ⊕ S  ⊕ M  ⊕ L  ⊕ XL
                                     [+ Add value]

  [+ Add another attribute]


  ── Generated variants matrix ─────────────────────

                     S       M      L      XL
        Red         [✓]    [✓]    [✓]    [_]
        Blue        [✓]    [✓]    [✓]    [✓]
        Black       [✓]    [✓]    [✓]    [✓]

  11 variants will be created. Uncheck combinations
  you don't carry.

  Default price (Rs):   [1,200]
  (Pre-fills every variant. You can override per-variant below.)


  ── Variants list (review and adjust) ─────────────

  ┌──────────────────────────────────────────────────┐
  │ SKU            Variant         Price     Stock   │
  │ TS-RED-S       Red / S         1,200     [0]     │
  │ TS-RED-M       Red / M         1,200     [0]     │
  │ TS-RED-L       Red / L         1,200     [0]     │
  │ TS-BLU-S       Blue / S        1,200     [0]     │
  │ ...                                              │
  └──────────────────────────────────────────────────┘

  [ Cancel ]                       [ Create product ]
```

### 6.3 Behavior details

- **Attribute picker** at the top: combobox of existing shop attributes (Color, Size). "+ Add value" inline-creates new values for that attribute (e.g., supplier introduces "Maroon" → user adds it without leaving the form).
- **Maximum 3 attributes per product.** Reasoning: a 4-attribute matrix is 4-dimensional and confusing in any UI. Real-world cases fit in 1-3 dimensions. Document this as a decision.
- **Selected values** appear as removable chips (the ⊕ icon is a remove affordance). Clicking a chip removes that value from the matrix.
- **Matrix grid**: rows = first attribute's values, columns = second attribute's values. For single-attribute products, the matrix is one row. For three-attribute products, the matrix is a small grid per third-attribute-value (e.g., one matrix per color tab).
- **Checkboxes** in cells: checked by default. Uncheck to exclude that combination. Live count of "X variants will be created" at the bottom.
- **Default price** field: when filled, every variant in the list below pre-fills with this price. User can edit individual rows.
- **Variants list**: auto-generated from the checked matrix cells. SKU auto-suggested as `<product-prefix>-<value-codes>` (e.g., "TS-RED-M" from Track Suit + Red + M). Free-text, can override.
- **Stock per variant** at creation is optional (default 0). For shops opening with existing stock, they fill the stock column. The matrix-mode stock-in (§7) is the dominant way to receive stock, not the create form.

### 6.4 SKU auto-suggest pattern

```
Product name → first 2 chars (uppercase, no spaces): "Track Suit AAA" → "TR"
Attribute value → first 3 chars (uppercase): "Red" → "RED", "XL" → "XL"
Pattern: "TR-RED-M", "TR-BLK-XL"
```

If a SKU conflict arises within a shop (per the unique index), append a number suffix: "TR-RED-M-2". User can edit any time.

### 6.5 Edit existing product (multi-variant)

For an existing product with variants, the edit form shows:
- Product fields (name, category, etc.) at the top.
- Variants list with per-variant inline edits (SKU, price, archive).
- "+ Add variant" button that opens a small dialog with attribute value selectors — calls `add_variant_to_product`.
- No "Has variants?" toggle on existing products (can't reverse a variant product to single-variant cleanly).

### 6.6 Constraints on variant editing

- **Cannot change attribute composition** of an existing multi-variant product without recreating it. If shop needs to change from (Color × Size) to (Color × Size × Material), they recreate the product. Documented limitation.
- **Cannot delete a variant with transaction history** (FK restrict on sale_items/purchase_items). Deactivate instead. Same pattern as packs (v2.1).
- **Cannot change a variant's attribute values once it has transaction history.** Snapshot integrity. Same pattern as packs.

---

## 7. Frontend — Stock-in matrix mode

This is the headline UX of v2.7. The 50-tracksuit shipment becomes a 6-cell grid, not 6 separate cart lines.

### 7.1 Trigger

In the stock-in form, when a user picks a multi-variant product on a line, the line **expands into a matrix mode** instead of asking for variant + qty + cost on one line.

```
#  Product                        Unit       Qty       Cost      Total ✕
1  [Tracksuit AAA ▼]                                                  ×
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │             S       M       L       XL                        │
   │   Black    [_]    [_]    [_]    [_]                          │
   │   Navy     [_]    [_]    [_]    [_]                          │
   │   Red      [_]    [_]    [_]    [_]                          │
   │                                                              │
   │   [+ Add Color value]   [+ Add Size value]                   │
   │                                                              │
   │   Per-unit cost: [1,200]   (Apply to all cells with qty > 0) │
   │   ☐ Use per-cell pricing                                      │
   │                                                              │
   │   Total units: 0   Subtotal: 0                                │
   │                                                              │
   │   [ Cancel ]                              [ Apply matrix ]    │
   └──────────────────────────────────────────────────────────────┘
```

### 7.2 Behavior

- **Cells** show empty inputs. User types a quantity in each cell that's being received.
- **Per-unit cost** field below the matrix applies to every non-empty cell. This handles the 95% case where the supplier charged the same price across sizes/colors.
- **"Use per-cell pricing"** toggle: when ON, each cell gains its own small cost input next to the qty. For the rare case where colors or sizes have different supplier costs.
- **Live totals**: count of units (sum of all cells with qty), subtotal cost.
- **Inline value creation**: "+ Add Color value" and "+ Add Size value" let the user add a value to the attribute on the spot. This handles the supplier-sent-an-unexpected-color case. New value gets persisted via `add_variant_value` and a new variant gets created via `add_variant_to_product` (one variant per row/column for the new value, then user fills in the qty cells).
- **Apply matrix** → the matrix collapses into N stock-in line items (one per cell with qty > 0). They appear in the parent stock-in form's items list as regular lines. Each line shows `Tracksuit AAA — Black / M × 10 @ 1,200`. From here on, v1.9's bidirectional cost calc, v1.9's overhead allocation, and v2.3's largest-remainder math all work unchanged on the collapsed lines.
- **Cancel** → discards the matrix; the parent line is removed from the stock-in form.

### 7.3 Why the matrix collapses to normal lines

The matrix is purely a UI affordance. On submit, `record_purchase` receives one entry per variant — exactly the same shape as if the user had entered each variant on a separate line. This means:

- No new RPC needed for matrix stock-in (`record_purchase` from v2.6 is unchanged).
- Overhead allocation works correctly across the resulting lines.
- The stock-in detail page (v1.9) shows the lines as normal items, no special "matrix view" needed.
- Reports are unchanged.

### 7.4 Single-variant products in stock-in

Unchanged from v2.1. No matrix appears. The user picks the product, picks a unit (Each / Box / Carton), enters qty + cost. Same as before.

### 7.5 Tape-style products (variants + packs)

If a multi-variant product also has packs (e.g., Red Tape has a "Roll = 10" pack), the matrix cells each have a unit selector:

```
                  Roll          Each
       Red       [5 rolls]    [_]
       Blue      [3 rolls]    [_]
       Green     [_]          [_]
```

User picks "Roll" or "Each" per cell. The qty is in that cell's unit. 5 Red rolls = 50 base Red tapes received.

For the simpler tracksuit case with no packs, the unit selector disappears (defaults to Each, hidden).

### 7.6 Fallback if matrix is too complex

If the matrix UI proves too complex for the first release, fall back to a simpler "expanding line" pattern: picking a multi-variant product expands the line to show a vertical list of all variants with qty inputs. Less visual, same data outcome.

The discovery report should flag this if the design system primitives can't support the matrix cleanly. Document the choice in `decisions/`.

---

## 8. Frontend — POS variant picker

For multi-variant products, the cashier needs to pick which variant they're selling.

### 8.1 In the product list / search results

A multi-variant product shows as one row with a "X variants" badge instead of a stock count:

```
Name                Stock                 Price          Add to cart
Tracksuit AAA       11 variants        Rs 1,200 – 1,400      [...]
USB Cable           120 each           Rs 200                [+]
```

- Stock column shows "11 variants" (count of active variants).
- Price column shows the price range (min – max) if variants have different prices.
- "Add to cart" column shows a different affordance for multi-variant products: a `[...]` button that opens a variant picker, instead of the direct `[+]`.

### 8.2 Variant picker (when adding to POS cart)

Clicking the `[...]` button on a multi-variant product opens a small popover or sheet:

```
┌─ Tracksuit AAA — Pick variant ──────────────────────┐
│                                                     │
│          S         M         L         XL           │
│  Black  ◯ 5     ◯ 8      ◯ 0      ◯ 3              │
│  Navy   ◯ 4     ◯ 12     ◯ 6      ◯ 0              │
│  Red    ◯ 2     ◯ 7      ◯ 0      ◯ 1              │
│                                                     │
│  (stock shown in each cell. Click a cell to add.)   │
│                                                     │
│  [ Cancel ]                                         │
└─────────────────────────────────────────────────────┘
```

- Cells show **current stock** of that variant.
- Out-of-stock cells (0) are visually muted; clicking still works (creates a backorder line OR shows "out of stock" error per business rule — pick one and document).
- Clicking a cell adds 1 of that variant to the cart at its variant price.
- The popover closes after one selection. To add multiple variants, the cashier re-opens the picker.

### 8.3 In the cart

A cart line for a variant shows the variant label:

```
Product                          Qty   Price       Total
Tracksuit AAA — Red / M           1    1,200      1,200
```

Editing the cart line (per v1.3): qty and price are editable; the variant is not. To swap variant, remove the line and add a different one.

### 8.4 Receipt and sale detail

Receipt: "Tracksuit AAA — Red / M × 1 @ 1,200 = 1,200" (per v2.1 base-unit display convention).

Sale detail: same. The variant label comes from `product_variant_full.variant_label`.

---

## 9. Frontend — Product detail page (multi-variant)

v2.5's product detail page handled single-variant products. For multi-variant products, it shows the variants table:

```
─ Tracksuit AAA  ────────────────────────────────────
  [Electronics]  ★ Active                  [ Edit ]

  Category          Garments
  Type              Stockable
  Has variants      Yes (11)
  Total stock       57 across 11 variants
  Price range       Rs 1,200 – 1,400


─ Variants ─────────────────────────────────────────
  SKU         Variant          Price     Stock     Action
  TS-BLK-S    Black / S        1,200      5        Edit
  TS-BLK-M    Black / M        1,200      8        Edit
  TS-BLK-L    Black / L        1,200      0        Edit
  TS-BLK-XL   Black / XL       1,200      3        Edit
  TS-NVY-S    Navy / S         1,200      4        Edit
  ...
  [+ Add variant]
```

- Edit per row: small modal with price, SKU, archive toggle.
- "+ Add variant": dialog with attribute value selectors → `add_variant_to_product` RPC.
- Stock column: live from `product_variants.stock`. No editing here (stock changes via stock-in / sales, not by direct edit).

---

## 10. i18n keys (additions)

```jsonc
// locales/en/variants.json (new)
{
  "title": "Variants",
  "has_variants_toggle": "This product has variants (e.g., different colors, sizes)",
  "select_attributes": "Select up to 3 attributes for this product",
  "matrix_uncheck_help": "Uncheck combinations you don't carry.",
  "default_price_label": "Default price (Rs)",
  "default_price_help": "Pre-fills every variant. You can override per-variant below.",
  "variants_count_one": "{{count}} variant",
  "variants_count_other": "{{count}} variants",
  "variants_list_title": "Variants list (review and adjust)",
  "columns": {
    "sku": "SKU",
    "variant": "Variant",
    "price": "Price",
    "stock": "Stock",
    "action": "Action"
  },
  "add_variant": "+ Add variant",
  "add_attribute": "+ Add another attribute",
  "add_value": "+ Add value",
  "errors": {
    "max_3_attributes": "A product can have at most 3 attributes.",
    "duplicate_combination": "This combination already exists.",
    "attribute_not_in_shop": "This attribute isn't defined for your shop. Create it in Settings.",
    "variant_in_use_cannot_edit_attributes": "This variant has transaction history; attributes can't be changed."
  }
}

// locales/en/variant_attributes.json (new — for the settings page)
{
  "title": "Variant Attributes",
  "subtitle": "Define attributes like Color, Size, Storage that you'll reuse across products.",
  "new_attribute": "+ New attribute",
  "values_count_one": "{{count}} value",
  "values_count_other": "{{count}} values",
  "empty_state": "You haven't defined any variant attributes yet.",
  "examples": "Examples: Color, Size, Storage, Volume, Dimension.",
  "errors": {
    "in_use_cannot_archive": "This attribute is used by active products. Deactivate variants first.",
    "duplicate_name": "An attribute with this name already exists.",
    "duplicate_value": "This value already exists in {{attributeName}}."
  }
}

// locales/en/stock_in.json (additions)
{
  "matrix": {
    "title": "Receive variants",
    "per_unit_cost": "Per-unit cost",
    "per_unit_cost_help": "Applied to every cell with a quantity",
    "use_per_cell_pricing": "Use per-cell pricing",
    "total_units": "Total units",
    "subtotal": "Subtotal",
    "apply": "Apply matrix",
    "add_attribute_value": "+ Add {{attribute}} value"
  }
}

// locales/en/pos.json (additions)
{
  "variant_picker": {
    "title": "{{productName}} — Pick variant",
    "stock_in_cell": "Stock",
    "out_of_stock": "Out of stock"
  },
  "product_list": {
    "variants_badge": "{{count}} variants",
    "price_range": "Rs {{min}} – {{max}}"
  }
}
```

Mirror in `locales/ur/*`. Common variant terms (Color, Size, etc.) may stay as English loanwords or get Urdu translations — confirm with user.

---

## 11. Implementation order

1. **Discovery report** in chat (Phase A) — including v2.6 audit status.
2. **Append to `tasks.md`** with v2.7 phases.
3. **Migration applied** (§3). Run audit checkpoint.
4. **Regenerate `database.ts`.**
5. **Attribute management RPCs** (§4.1).
6. **Settings → Variant Attributes page** (§5). Build first so testing has a way to define attributes.
7. **`create_product_with_variants` RPC** (§4.2).
8. **`add_variant_to_product` RPC** (§4.3).
9. **`product_variant_full` view** (§4.5) and updated `product_with_default_variant` (§4.6).
10. **Product create/edit form**: "Has variants?" toggle + variant matrix builder (§6).
11. **Product detail page**: variants table for multi-variant products (§9).
12. **Stock-in matrix mode** (§7). Single biggest UX piece.
13. **POS variant picker** (§8).
14. **i18n updates** (§10).
15. **Manual smoke test** (§13).
16. **Update `CLAUDE.md`** (§17).
17. **Write decision files** (§15).
18. **Report back** with screenshots, audit results, and demonstration of the tracksuit + tape + iPhone variant flows.

---

## 12. Acceptance criteria

- [ ] v2.6 audit queries all return zero rows (confirmed in Phase A).
- [ ] `tasks.md` updated with v2.7 phases; `decisions/` files written (§15).
- [ ] CLAUDE.md updated with v2.7 line and gotchas.

**Variant attributes:**
- [ ] `variant_attributes`, `variant_attribute_values`, `product_variant_attribute_values` tables exist with RLS.
- [ ] Shop-wide attribute pool: Color/Size defined once, reusable across products.
- [ ] Settings → Variant Attributes page: create, edit, archive attributes; add/edit/archive values.
- [ ] Cannot archive an attribute used by an active variant.

**Product create flow:**
- [ ] "Has variants?" toggle appears on product create form.
- [ ] Toggle ON: matrix builder appears.
- [ ] User picks up to 3 attributes; can add values inline.
- [ ] Matrix renders correctly for 1, 2, and 3 attribute combinations.
- [ ] User can uncheck combinations to exclude.
- [ ] Default price pre-fills all variant rows in the review list.
- [ ] SKU auto-suggested but free-text editable.
- [ ] Create button calls `create_product_with_variants` and persists product + N variants + attribute links.
- [ ] Backend invariant: every variant on a multi-variant product has exactly one value per attribute.

**Product edit flow:**
- [ ] Existing multi-variant product can be edited: name, category, individual variant prices/SKU.
- [ ] "+ Add variant" works (calls `add_variant_to_product`).
- [ ] Cannot delete a variant with transaction history; deactivate works.
- [ ] Cannot change attribute composition on an existing multi-variant product (locked, documented).

**Stock-in matrix mode:**
- [ ] Picking a multi-variant product in stock-in opens the matrix.
- [ ] Matrix renders correctly for 1, 2 (and 3 if applicable) attributes.
- [ ] Per-unit cost field applies to every non-empty cell.
- [ ] "Use per-cell pricing" toggle exposes per-cell cost inputs.
- [ ] Inline "+ Add value" creates new attribute values and variants on the spot.
- [ ] Apply collapses the matrix into one stock-in line per non-empty cell.
- [ ] Each line records via `record_purchase` with the correct `variant_id`.
- [ ] v1.9 overhead allocation and v2.3 largest-remainder math work across the collapsed lines.

**POS:**
- [ ] Multi-variant products show "X variants" badge instead of single stock count.
- [ ] Add-to-cart affordance for multi-variant products is `[...]` (opens picker) not direct `[+]`.
- [ ] Variant picker shows current stock per cell.
- [ ] Clicking a cell adds 1 of that variant to the cart at variant price.
- [ ] Cart line displays variant label ("Red / M").
- [ ] Receipt and sale detail show variant label.

**Worked test cases (§13):**
- [ ] Tracksuit AAA (Color × Size) — full create, stock-in, sell flow works.
- [ ] Yoga Mat (Size only) — single-attribute matrix works.
- [ ] Masking Tape (Color + Roll pack) — variants + packs compose.
- [ ] iPhone 14 (Storage × Color, per-variant pricing) — per-variant price overrides work.

**Backward compatibility:**
- [ ] All single-variant flows (existing pre-v2.7 products) unchanged.
- [ ] All v1.3–v2.6 acceptance criteria still pass.
- [ ] RLS isolates attributes, values, and variants per shop.

**General:**
- [ ] No new console errors.
- [ ] No new RLS gaps (cross-shop test passes for all new tables).

---

## 13. Manual test matrix

### 13.1 Define attributes
- Account A: open `/settings/variant-attributes`.
- Create "Color" attribute. Add values: Black, Navy, Red.
- Create "Size" attribute. Add values: S, M, L, XL.
- Verify both appear with their value lists.

### 13.2 Create Tracksuit AAA (Color × Size)
- Open product create form. Toggle "Has variants?" ON.
- Pick attributes: Color, Size.
- Confirm matrix renders 3×4 = 12 cells.
- Uncheck Red/XL.
- Verify "11 variants will be created" count.
- Default price: 1,200.
- Review list shows 11 rows with auto-SKUs (TS-BLK-S, TS-BLK-M, ...) and price 1,200.
- Save. Verify product created with 11 variants.

### 13.3 Stock-in matrix (the 50-tracksuit case)
- Stock-in form, pick Tracksuit AAA. Matrix opens.
- Enter: Black/M = 10, Black/L = 8, Navy/M = 12, Navy/L = 10, Red/S = 6, Red/M = 4.
- Per-unit cost: 1,200.
- Verify total units = 50, subtotal = 60,000.
- Apply matrix. Verify 6 stock-in lines appear in the parent form.
- Add a delivery overhead of 600 PKR.
- Submit. Verify:
  - 6 `purchase_items` rows, each with correct `variant_id`.
  - `line_overhead_amount` sums exactly to 600.00 per v2.3 largest-remainder.
  - Each variant's stock and avg_cost updated correctly.

### 13.4 POS sale of a variant
- Open POS. Search Tracksuit. Verify it shows "11 variants" badge.
- Click `[...]`. Variant picker opens. Stock shown per cell.
- Click Black/M (stock 10). Cart line: Tracksuit AAA — Black / M × 1 @ 1,200.
- Submit cash sale. Verify stock decrements Black/M from 10 to 9.

### 13.5 Yoga Mat (single-attribute matrix)
- Create "Yoga Mat", has variants ON, attribute: Size only, values 4mm/6mm/8mm.
- Matrix is a single row of 3 cells. Confirm.
- Save. Stock-in matrix has one row, 3 cells.

### 13.6 Masking Tape (variants + packs compose)
- Create "Masking Tape", has variants ON, attribute: Color (Red, Blue, Green). Default price 50.
- After creation, navigate to the Red variant detail, add a "Roll" pack with base_qty 10.
- Stock-in matrix shows Color column. Each cell has a unit selector (Roll / Each).
- Enter Red = 5 rolls at cost 400.
- Apply. Verify Red variant stock = 50 base, avg_cost = 8 PKR per tape (per v2.1 pack math).

### 13.7 iPhone 14 (per-variant pricing)
- Create iPhone 14, attributes: Storage (128GB, 256GB) × Color (Black, White). 4 variants.
- Default price 250,000.
- In the variants list, edit 256GB rows to 280,000.
- Verify final variants: 2 × 250,000 + 2 × 280,000.

### 13.8 Add variant to existing product
- Open Tracksuit AAA detail page. Click "+ Add variant".
- Add: Color = Maroon (new value, inline-created), Size = M. Price 1,200.
- Verify new variant exists, attribute value "Maroon" added to shop.

### 13.9 Cannot break a variant with history
- Try to delete Black/M variant (has sale history from §13.4). Verify FK rejects.
- Deactivate works. Verify historical sale still references the (now inactive) variant.

### 13.10 Single-variant regression
- Create a normal product without variants ("USB Cable", price 200, no toggle).
- Stock-in via the normal (non-matrix) flow.
- Sell via normal POS `[+]`.
- Verify all flows unchanged from v2.6.

### 13.11 Cross-shop isolation
- Account B sees zero of A's attributes, values, variants.

---

## 14. Out of scope

- **More than 3 attributes per product.** Document limit; revisit if needed.
- **Bulk variant import** (CSV / Excel). v2.8 if shops demand it.
- **Variant-level reporting** (per-variant sales charts). v3+.
- **Cross-product attribute reports** ("How much Red did we sell across all products?"). v3+.
- **Variant images** (per-variant photos). v3+.
- **Variant-level barcodes / barcode scanning.** v3+.
- **Backorder handling** when selling out-of-stock variants. Document the chosen behavior (block sale OR allow negative stock).
- **Reordering points per variant.** Future.
- **Test infrastructure.** Still skipped.

---

## 15. Decision files to create in `decisions/`

1. `2026-05-12-variant-attributes-shop-wide-pool.md` — Shop-wide attribute pool vs. per-product attributes; chose shop-wide for reporting clarity.
2. `2026-05-12-max-3-attributes-per-product.md` — Limit at 3; documents reasoning (4D matrix is unusable).
3. `2026-05-12-stock-in-matrix-collapses-to-normal-lines.md` — Matrix UI emits standard `purchase_items` rows; no separate matrix data model.
4. `2026-05-12-variant-attribute-edit-locked-after-history.md` — Once a variant has transaction history, its attribute values are immutable.
5. `2026-05-12-pos-variant-picker-affordance.md` — Multi-variant products show `[...]` button instead of `[+]`; rationale.
6. `2026-05-12-sku-auto-suggest-pattern.md` — How SKUs are generated; user can override; uniqueness within shop.

Add more as judgment calls surface.

---

## 16. `tasks.md` structure (append to v2.6 list)

```markdown
# v2.7 Implementation Tasks (appended to v2.6 list)

## Phase B — Schema
- 🟦 Create variant_attributes table + RLS + triggers
- 🟦 Create variant_attribute_values table + RLS + triggers
- 🟦 Create product_variant_attribute_values link table + RLS
- 🟦 Add products.has_variants column
- 🟦 Update v2.6's uq_variant_default_per_product partial index
- 🟦 Audit checkpoint (single-variant products still have one default variant)

## Phase C — Backend
- 🟦 Attribute CRUD RPCs
- 🟦 Value CRUD RPCs
- 🟦 create_product_with_variants RPC
- 🟦 add_variant_to_product RPC
- 🟦 product_variant_full view
- 🟦 Update product_with_default_variant for multi-variant cases
- 🟦 Regenerate database.ts

## Phase D — Frontend
- 🟦 Settings → Variant Attributes page
- 🟦 Product create form: Has variants? toggle
- 🟦 Variant matrix builder
- 🟦 SKU auto-suggest
- 🟦 Variants list with per-row editing
- 🟦 Product detail page: variants table
- 🟦 "+ Add variant" dialog on existing products
- 🟦 Stock-in matrix mode
- 🟦 Matrix unit selector (for variants + packs)
- 🟦 Inline value creation in matrix
- 🟦 POS multi-variant product list rendering
- 🟦 POS variant picker
- 🟦 Cart line variant label rendering
- 🟦 Receipt + sale detail variant label

## Phase E — Verification
- 🟦 All §13 test cases
- 🟦 Cross-shop RLS
- 🟦 Update CLAUDE.md
- 🟦 Write decision files
- 🟦 Final report with screenshots
```

---

## 17. CLAUDE.md update

Append to versioned PRDs section:

```
- v2.7: variant management UI on top of v2.6 foundation. Shop-wide variant_attributes pool (Color, Size, etc.); product create form with "Has variants?" toggle and matrix builder; stock-in matrix mode for receiving multi-variant shipments; POS variant picker; per-variant pricing with default-price prefill.
```

Add to **Gotchas**:

```
- A product can have at most 3 variant attributes. UI enforces this. Documented limit; revisit if a real case demands more.
- Stock-in matrix is a UI affordance only. It collapses to standard purchase_items rows on submit. No separate matrix data model. v2.3 largest-remainder overhead allocation works across the resulting lines.
- Once a variant has transaction history, its attribute values are immutable. Same pattern as packs (v2.1) and ledger (v1.6). Deactivate and create new if attributes need to change.
- Multi-variant products in POS show "[...]" picker button instead of "[+]" direct add. Single-variant products keep the v2.3 "[+]" affordance.
- Receipt and sale detail render variant labels via product_variant_full.variant_label (e.g., "Red / M"). For single-variant products this is empty.
- SKU is optional and free-text. Auto-suggested at creation. Unique within a shop when set.
- Inline value creation: the stock-in matrix and product form both allow "+ Add value" without leaving the flow. Same pattern as "+ Create new pack" (v2.1), "+ Create new category" (v2.5), "+ Create new supplier" (v1.9).
```

Add to **Open ToDos / Known gaps**:

```
- v2.7 deferred items: bulk variant import (CSV), variant-level reporting, variant images, variant-level barcodes, backorder handling, variant-level reorder points.
```

---

*End of v2.7 spec.*
