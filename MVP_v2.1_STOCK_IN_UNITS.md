# MVP v2.1 — Stock-In Unit Handling (Simplified)

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline) and v1.3–v1.9 fix specs.
**Supersedes:** `MVP_v2.0_UNITS_OF_MEASURE.md`. v2.0 was spec'd but not built. v2.1 is the version that actually ships.
**Stack:** unchanged — React + Supabase (via Supabase MCP) + react-i18next.
**Type:** Capability addition — stock-in only.
**Realistic effort:** 3–4 days.

> **The core simplification.** v2.0 made packs first-class **transaction units** — sales lines stored "2 cartons" with snapshot columns, the POS had per-line unit selectors, and every pack had a sell price. After conversation with the shop owner, that's overkill for SMB cash-and-carry. The simpler truth: **packs are how stock comes in. Sales are always in base units.** A box scan adds 10 chocolates to the cart at the per-unit price, not "1 box at the box price." This collapses ~60% of v2.0's surface and matches how every cash-and-carry actually behaves.

---

## 0. How to work this ticket

### Phase A — Discovery

1. **Re-read** `PRD.md`, `MVP_FIXES_v1.5.md` (product create flow + WAC), `v1.9.md` (stock-in form, supplier picker, overhead). Read `CLAUDE.md`.
2. **Confirm v2.0 was not built.** If any v2.0 schema (`product_packs.price`, `sale_items.pack_id`, `shops.business_type`, etc.) actually landed, we have cleanup to do. If v2.0 stopped at the spec stage, we go straight from v1.9 baseline. **Report which it is in the discovery report.**
3. **Inspect live schema via MCP**:
   - Current `products`, `purchases`, `purchase_items` shape after v1.9.
   - Current `record_purchase` body — read it before designing the rewrite.
   - Verify `pg_trgm` is installed (from v1.4/v1.5).
4. **Reproduce the compound display bug.** User reports: 66 iPhones in stock, carton size 12, display shows "5 cartons + 5 each". Math should be 5 × 12 + 6 = 66, so display should be "5 cartons + 6 each". Run via MCP:
   ```sql
   -- For a product where you can reproduce the bug:
   select id, name, stock from public.products where stock = 66;
   ```
   Identify whether the bug is in:
   - The DB / view (returns wrong breakdown JSON)
   - The frontend (computes its own breakdown instead of using the view)
   - The stock value itself (off-by-one somewhere upstream)
   Report root cause in the discovery report.
5. **Discovery report in chat** — v2.0 build status, schema state, root cause of the compound display bug, plan, then proceed.

### Phase B — Schema migration first

Single migration `00XX_v21_stock_in_units.sql`. Apply via MCP, regenerate `database.ts`. If any v2.0 partial schema exists, the migration also drops the unwanted columns first (see §3.7).

### Phase C — Backend functions

Update `record_purchase` to accept a `pack_id` per line. Add lightweight pack-management RPCs. **`record_sale` is NOT touched in this ticket** — it stays exactly as v1.6/v1.4 left it. That's the whole point.

### Phase D — Frontend

In the order in §10. The product form gets **no Packs section** (deliberately removed from v2.0's design). All pack management happens at stock-in time.

### Phase E — Verification

Manual smoke test with two accounts. Update CLAUDE.md.

---

## 1. The mental model

> **Sales and stock are always in base units. Packs are stock-in shortcuts.**

That's the entire model. Five concrete consequences:

1. **One sell price per product**, expressed per base unit. No pack-level prices.
2. **At stock-in**, the user picks the unit they're receiving in (Each / Box / Carton / whatever). The system normalizes to base units for stock + cost math.
3. **At sale**, the cashier types a quantity (in base units) at the per-unit price. v1.3's editable unit price still works for negotiation. v2.2 (formerly v2.1) adds tier discounts on top.
4. **Stock display** can show a compound view ("5 cartons + 6 each") as a *display abstraction* on the product list. This doesn't change how stock is stored or transacted — it's just a viewer's shortcut.
5. **Pack size changes** (the rare case where a supplier ships 12 instead of 10) are handled by **defining a new pack and deactivating the old one**. No per-line overrides. The old pack stays referenced by historical purchase_items.

This deliberately drops v2.0's complications:
- No `pack_id` / `pack_qty` / `pack_base_qty_snapshot` on sale_items
- No POS unit selector per cart line
- No `is_default_sale` flag on packs
- No sell price on packs (the `price` column doesn't exist on `product_packs`)
- No `business_type` setting on shops (the UX is the same for retail and hybrid)
- No multi-level nesting (`parent_pack_id`) — flat-to-base only
- No "pricing rule" (price = sellability) — moot when packs aren't sellable

If a future SaaS customer asks for B2B-style "carton on the receipt" or pack-level sale pricing, it's an additive feature. For now, SME tier doesn't need it.

---

## 2. Worked examples (the user's scenarios)

### 2.1 Mobile shop — buy carton, sell units

- Product: iPhone 14, base unit Each, sell price 100,000 PKR
- User defines a pack inline at stock-in: "Carton" with `base_qty = 50`, no price (packs don't have prices)
- Stock-in: 1 carton at 4,500,000 (per-carton cost from supplier)
- Function computes: `qty_in_base = 1 × 50 = 50`, `per_base_unit_cost = 4,500,000 / 50 = 90,000`
- Stock = 50 base units, avg_cost = 90,000

POS unchanged from v1.9: cashier adds iPhone, qty 1, price 100,000 (default) or 95,000 (negotiated). Stock decrements by 1. Profit per unit = 100,000 − 90,000 = 10,000.

### 2.2 Cash-and-carry chocolate — buy cartons, sell boxes/cartons

- Product: Chocolate Bar, base unit Each, sell price 12 PKR
- User defines two packs: "Box" with `base_qty = 10`, "Carton" with `base_qty = 100`
- Stock-in: 10 cartons at 800 each (per the v1.9 worked example)
- Per-base-unit cost = 8,000 / 1,000 = 8 PKR/bar

A customer buys "1 box of chocolate":
- Cashier types qty 10 (or scans the box → frontend looks up base_qty and adds 10 base units to the cart at the per-unit price)
- Cart line: Chocolate Bar × 10 @ 12 = 120
- Receipt shows "Chocolate Bar × 10 @ 12.00 = 120"

A customer buys "1 carton":
- Cashier types qty 100 (or scans the carton → adds 100)
- Cart line: Chocolate Bar × 100 @ 12 = 1,200
- Receipt shows "Chocolate Bar × 100 @ 12.00 = 1,200"

Same product, same per-unit price, different quantity. **The pack's role is entry-time only — once it's in the cart, it's just chocolate.**

If the shop wants different effective prices per pack (e.g., "carton-buyers get 11 each instead of 12"), that's a v2.2 customer-tier discount or the cashier negotiates the unit price down on the line per v1.3. The pack itself doesn't carry pricing.

### 2.3 The "I can't sell loose chocolate" case

If the shop owner only wants the cashier to be able to add chocolate via box-scan or carton-scan (never single-unit), that's a UX rule, not a data rule. We'll surface this in the POS as a **"scan-only unit" toggle on the product** — see §6.1. By default, all products allow direct quantity entry; some shops will enable scan-only mode for products where partial units shouldn't be sold.

This is much simpler than v2.0's "pack price = sellable" rule, and produces the same outcome.

---

## 3. Schema changes

Single migration `00XX_v21_stock_in_units.sql`.

### 3.1 `units_of_measure` table (per shop)

```sql
create table if not exists public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text not null,           -- 'each', 'box', 'carton', 'dozen', 'kg'
  name text not null,           -- 'Each', 'Box', 'Carton', 'Dozen', 'Kilogram'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uom_code_format check (code = lower(trim(code)) and code ~ '^[a-z][a-z0-9_]*$')
);

create unique index if not exists uq_uom_shop_code
  on public.units_of_measure (shop_id, code) where is_active = true;

alter table public.units_of_measure enable row level security;

create policy "uom_shop_read" on public.units_of_measure
  for select using (shop_id = (select public.current_shop_id()));
create policy "uom_shop_write" on public.units_of_measure
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

drop trigger if exists units_of_measure_touch on public.units_of_measure;
create trigger units_of_measure_touch
  before update on public.units_of_measure
  for each row execute function public.touch_updated_at();
```

### 3.2 `product_packs` table (simplified — no price, no `is_default_sale`)

```sql
create table if not exists public.product_packs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit_id uuid not null references public.units_of_measure(id) on delete restrict,
  base_qty integer not null check (base_qty > 1),
    -- Must be > 1 — the base unit isn't stored as a pack
  is_default_purchase boolean not null default false,
    -- Pre-selects this pack on the stock-in form for this product
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one default purchase pack per product
create unique index if not exists uq_pack_default_purchase
  on public.product_packs (product_id) where is_default_purchase and is_active;

-- A product can't have two active packs with the same unit
create unique index if not exists uq_pack_product_unit
  on public.product_packs (product_id, unit_id) where is_active;

create index if not exists idx_pack_product
  on public.product_packs (product_id) where is_active;

alter table public.product_packs enable row level security;

create policy "packs_shop_read" on public.product_packs
  for select using (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  );
create policy "packs_shop_write" on public.product_packs
  for all using (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  ) with check (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  );

drop trigger if exists product_packs_touch on public.product_packs;
create trigger product_packs_touch
  before update on public.product_packs
  for each row execute function public.touch_updated_at();
```

> **What's NOT here vs. v2.0:** `price` column, `is_default_sale` column. Packs are stock-in shortcuts, period.

### 3.3 `products`: base unit reference + scan-only flag

```sql
alter table public.products
  add column if not exists base_unit_id uuid references public.units_of_measure(id),
  add column if not exists is_scan_only boolean not null default false;
    -- When true, POS doesn't allow direct quantity entry; cashier must scan a pack.
    -- For shops that don't want loose-unit sales (e.g., wholesale-only chocolate).
```

`base_unit_id` becomes NOT NULL after backfill (§3.6).

### 3.4 `purchase_items`: pack snapshot columns

```sql
alter table public.purchase_items
  add column if not exists pack_id uuid references public.product_packs(id),
  add column if not exists pack_qty integer,
    -- Qty in the pack's unit (e.g., "10" if user entered 10 cartons)
  add column if not exists pack_base_qty_snapshot integer,
    -- The pack's base_qty at the moment of stock-in. Snapshotted for history.
  add column if not exists qty_in_base integer;
    -- = pack_qty × pack_base_qty_snapshot (with pack), or = qty (no pack)

alter table public.purchase_items
  add constraint purchase_items_pack_consistent check (
    (pack_id is null and pack_qty is null and pack_base_qty_snapshot is null)
    or
    (pack_id is not null and pack_qty is not null and pack_base_qty_snapshot is not null
     and pack_qty > 0 and pack_base_qty_snapshot > 1)
  );
```

`qty_in_base` becomes NOT NULL after backfill.

### 3.5 `sale_items`: NO changes

This is the deliberate simplification. Sales stay exactly as v1.4/v1.6/v1.9 left them. `record_sale` doesn't change. The POS doesn't change.

### 3.6 Backfill

```sql
-- 1. Default 'each' UoM per shop
insert into public.units_of_measure (shop_id, code, name)
select s.id, 'each', 'Each'
from public.shops s
where not exists (
  select 1 from public.units_of_measure u
  where u.shop_id = s.id and u.code = 'each'
);

-- 2. Set every product's base_unit_id to the shop's 'each' UoM
update public.products p
set base_unit_id = u.id
from public.units_of_measure u
where u.shop_id = p.shop_id
  and u.code = 'each'
  and p.base_unit_id is null;

alter table public.products alter column base_unit_id set not null;

-- 3. Backfill qty_in_base on existing purchase_items
update public.purchase_items set qty_in_base = qty where qty_in_base is null;
alter table public.purchase_items alter column qty_in_base set not null;

-- 4. Indexes
create index if not exists idx_purchase_items_qty_in_base
  on public.purchase_items (product_id, qty_in_base);
```

### 3.7 If v2.0 partial schema exists

Phase A discovery determines whether any v2.0 columns landed. If they did, drop them as part of this migration **before** adding the v2.1 columns:

```sql
-- Only run if v2.0 schema fragments exist. Discovery report determines this.
alter table public.sale_items
  drop column if exists pack_id,
  drop column if exists pack_qty,
  drop column if exists pack_base_qty_snapshot,
  drop column if exists qty_in_base;

alter table public.product_packs
  drop column if exists price,
  drop column if exists is_default_sale;

alter table public.shops
  drop column if exists business_type;

drop view if exists public.product_stock_display;  -- recreated in §3.8
```

If discovery shows v2.0 was clean spec-only, none of this runs.

### 3.8 Stock display view (with the bug fix baked in)

```sql
create or replace view public.product_stock_display as
select
  p.id as product_id,
  p.shop_id,
  p.stock as base_qty,
  bu.code as base_unit_code,
  bu.name as base_unit_name,
  p.is_scan_only,
  -- For each active pack defined, compute "how many full packs fit + remainder"
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'pack_id', pk.id,
      'unit_code', u.code,
      'unit_name', u.name,
      'base_qty', pk.base_qty,
      'whole_packs', floor(p.stock::numeric / pk.base_qty)::int,
      'remainder_base', (p.stock - floor(p.stock::numeric / pk.base_qty)::int * pk.base_qty)::int
    ) order by pk.base_qty desc), '[]'::jsonb)
    from public.product_packs pk
    join public.units_of_measure u on u.id = pk.unit_id
    where pk.product_id = p.id and pk.is_active
  ) as pack_breakdown
from public.products p
join public.units_of_measure bu on bu.id = p.base_unit_id;
```

> **Math sanity check:** for stock = 66, base_qty = 12:
> - `floor(66.0 / 12) = 5` → whole_packs = 5
> - `66 - 5 × 12 = 66 - 60 = 6` → remainder_base = 6
> - Display: "5 cartons + 6 each" ✓
>
> The frontend **must** consume this view's `pack_breakdown` directly. **Do not compute breakdowns in TypeScript.** That was very likely the source of the original bug.

### 3.9 Audit query for ongoing health

Add to the v1.8 audit suite:

```sql
-- Round-trip verification: whole_packs × base_qty + remainder must equal stock
select
  p.id, p.name, p.stock,
  pk.base_qty,
  floor(p.stock::numeric / pk.base_qty)::int as whole_packs,
  (p.stock - floor(p.stock::numeric / pk.base_qty)::int * pk.base_qty)::int as remainder,
  floor(p.stock::numeric / pk.base_qty)::int * pk.base_qty
    + (p.stock - floor(p.stock::numeric / pk.base_qty)::int * pk.base_qty)::int as round_trip_check
from public.products p
join public.product_packs pk on pk.product_id = p.id and pk.is_active
where p.stock > 0;
-- round_trip_check must always equal p.stock. If not, the math is wrong.
```

Append this to the user's quarterly health-check runbook.

---

## 4. Backend functions

### 4.1 `define_pack_inline(p_product_id, p_unit_id_or_code, p_unit_name, p_base_qty, p_is_default_purchase)`

The "Create new pack" affordance from the stock-in form. Flexible inputs:

- If `p_unit_id_or_code` is a UUID, use the existing UoM.
- If it's a string code (e.g., 'box'), look up the UoM in the shop, create it if missing using `p_unit_name` for display.
- Returns the new pack's id.

```sql
create or replace function public.define_pack_inline(
  p_product_id uuid,
  p_unit_code text,
  p_unit_name text,
  p_base_qty int,
  p_is_default_purchase boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_unit_id uuid;
  v_pack_id uuid;
  v_normalized_code text := lower(trim(p_unit_code));
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_base_qty <= 1 then raise exception 'base_qty_must_be_greater_than_one'; end if;

  -- Verify product belongs to shop
  perform 1 from public.products
    where id = p_product_id and shop_id = v_shop_id;
  if not found then raise exception 'product_not_in_shop'; end if;

  -- Resolve or create unit
  select id into v_unit_id
  from public.units_of_measure
  where shop_id = v_shop_id and code = v_normalized_code and is_active;

  if v_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, v_normalized_code, p_unit_name)
    returning id into v_unit_id;
  end if;

  -- If marking as default purchase, atomically un-default any existing default
  if p_is_default_purchase then
    update public.product_packs
    set is_default_purchase = false, updated_at = now()
    where product_id = p_product_id and is_default_purchase and is_active;
  end if;

  -- Insert the pack. Unique partial index will reject duplicate (product, unit) pairs.
  insert into public.product_packs (product_id, unit_id, base_qty, is_default_purchase)
  values (p_product_id, v_unit_id, p_base_qty, p_is_default_purchase)
  returning id into v_pack_id;

  return v_pack_id;
end;
$$;
```

### 4.2 `update_pack` and `deactivate_pack`

```sql
-- Update a pack's editable fields. base_qty is editable (per the discussion in v2.0):
-- snapshots on purchase_items keep history correct; current pack reflects current reality.
-- However, in practice, the recommended pattern when supplier pack size changes is to
-- DEACTIVATE the old pack and define a new one. This keeps the audit clearer.
create or replace function public.update_pack(
  p_pack_id uuid,
  p_base_qty int,
  p_is_default_purchase boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_product_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_base_qty <= 1 then raise exception 'base_qty_must_be_greater_than_one'; end if;

  select pp.product_id into v_product_id
  from public.product_packs pp
  join public.products p on p.id = pp.product_id
  where pp.id = p_pack_id and p.shop_id = v_shop_id;
  if not found then raise exception 'pack_not_in_shop'; end if;

  if p_is_default_purchase then
    update public.product_packs
    set is_default_purchase = false, updated_at = now()
    where product_id = v_product_id and is_default_purchase and is_active and id <> p_pack_id;
  end if;

  update public.product_packs
  set base_qty = p_base_qty,
      is_default_purchase = p_is_default_purchase,
      updated_at = now()
  where id = p_pack_id;
end;
$$;

create or replace function public.deactivate_pack(p_pack_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_shop_id uuid := public.current_shop_id();
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  update public.product_packs pp
  set is_active = false, is_default_purchase = false, updated_at = now()
  from public.products p
  where pp.id = p_pack_id and p.id = pp.product_id and p.shop_id = v_shop_id;
end;
$$;
```

### 4.3 `record_purchase` rewrite

Read the v1.9 version via MCP first. Drop and recreate to handle pack shorthand. The math walked through in v2.0 §5.4 stays correct — just simpler now because we don't need to coordinate with sale-side concerns.

```sql
create or replace function public.record_purchase(
  p_supplier_id uuid default null,
  p_purchase_date date default current_date,
  p_note text default null,
  p_items jsonb default '[]'::jsonb,
    -- per line, two variants:
    --   without pack: {"product_id": "...", "qty": 50, "cost_at_purchase": 90000}
    --   with pack:    {"product_id": "...", "pack_id": "...", "pack_qty": 1, "cost_at_purchase": 4500000}
  p_overhead_items jsonb default '[]'::jsonb,
  p_is_opening boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_overhead_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_overhead jsonb;
  v_product record;
  v_pack record;
  v_pack_id uuid;
  v_pack_qty int;
  v_pack_base_qty_snapshot int;
  v_qty_in_base int;
  v_line_total numeric(12,2);
  v_overhead_share numeric(12,2);
  v_per_base_unit_cost numeric(12,2);
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'empty_purchase'; end if;

  if p_supplier_id is not null then
    perform 1 from public.suppliers
      where id = p_supplier_id and shop_id = v_shop_id and is_active;
    if not found then raise exception 'supplier_not_in_shop'; end if;
  end if;

  -- Pass 1: compute subtotals
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item ? 'pack_id' and v_item->>'pack_id' is not null then
      v_pack_qty := (v_item->>'pack_qty')::int;
      v_line_total := v_pack_qty * (v_item->>'cost_at_purchase')::numeric;
    else
      v_line_total := (v_item->>'qty')::int * (v_item->>'cost_at_purchase')::numeric;
    end if;
    v_items_subtotal := v_items_subtotal + v_line_total;
  end loop;

  for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
    v_overhead_subtotal := v_overhead_subtotal + (v_overhead->>'amount')::numeric;
  end loop;

  -- Insert purchase header
  insert into public.purchases (
    shop_id, supplier_id, total_cost, items_subtotal, overhead_subtotal,
    source, note, purchase_date, cashier_id, is_opening
  ) values (
    v_shop_id, p_supplier_id,
    v_items_subtotal + v_overhead_subtotal,
    v_items_subtotal,
    v_overhead_subtotal,
    case when p_is_opening then 'Opening Stock'
         when p_supplier_id is not null then (select name from public.suppliers where id = p_supplier_id)
         else 'Direct purchase' end,
    p_note, p_purchase_date, v_user_id, coalesce(p_is_opening, false)
  ) returning id into v_purchase_id;

  -- Insert overhead items (audit trail)
  for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
    insert into public.purchase_overhead_items (purchase_id, category, amount, description)
    values (
      v_purchase_id, v_overhead->>'category',
      (v_overhead->>'amount')::numeric, v_overhead->>'description'
    );
  end loop;

  -- Pass 2: process line items, snapshot avg cost, update WAC
  for v_item in select * from jsonb_array_elements(p_items) loop
    select id, stock, avg_cost into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
    for update;
    if not found then raise exception 'product_not_in_shop'; end if;

    -- Resolve pack info
    if v_item ? 'pack_id' and v_item->>'pack_id' is not null then
      v_pack_id := (v_item->>'pack_id')::uuid;
      v_pack_qty := (v_item->>'pack_qty')::int;

      select id, base_qty into v_pack
      from public.product_packs
      where id = v_pack_id and product_id = v_product.id and is_active;
      if not found then raise exception 'pack_not_found_or_inactive'; end if;

      v_pack_base_qty_snapshot := v_pack.base_qty;
      v_qty_in_base := v_pack_qty * v_pack_base_qty_snapshot;
      v_line_total := v_pack_qty * (v_item->>'cost_at_purchase')::numeric;
    else
      v_pack_id := null;
      v_pack_qty := null;
      v_pack_base_qty_snapshot := null;
      v_qty_in_base := (v_item->>'qty')::int;
      v_line_total := v_qty_in_base * (v_item->>'cost_at_purchase')::numeric;
    end if;

    -- Allocate overhead per line value (v1.9 logic)
    if v_items_subtotal > 0 then
      v_overhead_share := round(v_overhead_subtotal * v_line_total / v_items_subtotal, 2);
    else
      v_overhead_share := 0;
    end if;

    -- Per-base-unit cost: (line_total + overhead_share) / qty_in_base
    v_per_base_unit_cost := round((v_line_total + v_overhead_share) / v_qty_in_base, 2);

    -- Insert purchase_item with snapshots
    insert into public.purchase_items (
      purchase_id, product_id, qty,
      cost_at_purchase, overhead_per_unit,
      pack_id, pack_qty, pack_base_qty_snapshot, qty_in_base,
      avg_cost_before, avg_cost_after
    ) values (
      v_purchase_id, v_product.id, v_qty_in_base,
      (v_item->>'cost_at_purchase')::numeric,
      round(v_overhead_share / v_qty_in_base, 2),
      v_pack_id, v_pack_qty, v_pack_base_qty_snapshot, v_qty_in_base,
      v_product.avg_cost,
      case
        when v_product.stock + v_qty_in_base = 0 then v_product.avg_cost
        when v_product.stock <= 0 then v_per_base_unit_cost
        else round(
          (v_product.stock * v_product.avg_cost + v_qty_in_base * v_per_base_unit_cost)
          / (v_product.stock + v_qty_in_base), 2)
      end
    );

    -- Update product stock + avg_cost (using effective per-base-unit cost) + last_purchase_cost
    update public.products
    set stock = stock + v_qty_in_base,
        avg_cost = case
          when stock + v_qty_in_base = 0 then avg_cost
          when stock <= 0 then v_per_base_unit_cost
          else round(
            (stock * avg_cost + v_qty_in_base * v_per_base_unit_cost)
            / (stock + v_qty_in_base), 2)
        end,
        last_purchase_cost = (v_item->>'cost_at_purchase')::numeric,
        updated_at = now()
    where id = v_product.id;
  end loop;

  return v_purchase_id;
end;
$$;
```

### 4.4 `record_sale` is unchanged

Worth restating: this ticket does **not** touch `record_sale`. It stays as v1.4/v1.6 left it. No pack handling, no unit selector, no extra columns. Sales are in base units.

---

## 5. Frontend changes

### 5.1 Stock-in form — pack selector per line

The line layout adds a unit selector right after the product picker:

```
#  Product            Unit              Qty   Unit cost    Line total ✕
1  iPhone 14         ▼ [Carton (50) ▼]  1     4,500,000    4,500,000   ×
2  USB Cable         ▼ [Each ▼]         50    150          7,500       ×
```

**Unit dropdown contents** for the selected product:
- Active packs for this product, ordered by `base_qty` descending
- Always includes "Each" at the bottom (the base unit) — even if the user defined explicit packs, they may want a one-off line in base units
- Footer: **"+ Create new pack"** — the user's most-asked feature

Default selection rules:
- If product has a pack with `is_default_purchase = true`: pre-select it
- Else: default to "Each"

**"Create new pack" modal** (small):
```
Add a new pack for: iPhone 14

  Unit name:    [Carton ▼]    or    [+ Create new unit]
  Contains:     [50] units (each)
  ☐ Make this the default for this product
                                 [ Cancel ]    [ Add pack ]
```

- Unit dropdown lists existing UoMs in the shop. "Create new unit" inline-creates a new one (e.g., "Dozen" with code 'dozen').
- "Contains" is the `base_qty`.
- Save calls `define_pack_inline`. On success, the new pack auto-selects in the line, and the modal closes.

**Per-line cost interpretation** (label adjusts):
- "Each" selected → "Unit cost" label = "Unit cost (per each)"
- "Carton (50)" selected → "Unit cost" label = "Unit cost (per carton)"
- Bidirectional cost calc from v1.9 still works — qty × unit cost = line total, in whatever unit.

**Submit** calls `record_purchase` with the new shape. Each line is sent as either pack-based or base-unit, per §4.3.

### 5.2 Product list — compound stock display

Stock column reads from `product_stock_display.pack_breakdown`. Display modes (toggle in page header):

- **Base units** (default): "66 each"
- **Compact**: largest pack that fits exactly, else base ("5 cartons + 6 each" → "66 each" since no exact fit)
- **Compound**: full breakdown ("5 cartons + 6 each")

User preference stored in `localStorage`. Default = base units.

The bug fix: **frontend never computes breakdown values.** The view returns the JSON; the frontend renders directly. If the user reports "5 cartons + 5 each" again, that's a DB / view issue, not a frontend issue — much easier to debug.

### 5.3 Product detail page — pack management

A **Packs** section on the product detail view (not in the product create form — pack management is post-creation, mostly through stock-in inline creation, but the detail page lets the user see/edit/deactivate them):

```
─ Packs ─────────────────────────────────────────────
  Defined packs for stocking in:

  ┌─────────────────────────────────────────────────┐
  │ Unit       Contains    Default purchase     ⚙  │
  │ Carton     50 each     ★                    Edit
  │ Box        10 each                          Edit
  └─────────────────────────────────────────────────┘
  [+ Add pack]
```

- Edit modal: same fields as create. Saves via `update_pack`.
- Deactivate via the gear menu. Confirms first.
- "Add pack" reuses the same modal.

This is a quieter UI than v2.0's full Packs section in the product form — most users will never visit it because inline pack creation at stock-in covers their needs.

### 5.4 Product create form — no Packs section

**Removed.** Pack management happens at stock-in (inline) or post-create on the detail page. The create form stays minimal:

```
Name *                   [_______________]
Type *                   [_______________]
Description              [_______________]
Sell price (per unit) *  [_______________]
Opening stock (qty)      [_______________]
Opening stock (cost/unit)[_______________]

☐ Scan-only (POS won't allow direct quantity entry)
```

The "Scan-only" checkbox is the §2.3 control. Default off. When on, the POS forces the cashier to use a pack-quantity affordance instead of typing a quantity directly (see §5.5).

### 5.5 POS — minimal change

The POS UI is **largely unchanged from v1.9**. Each cart line is product + qty (base units) + unit price + line total. v1.3's editable price still works.

**One small addition:** when adding a product to the cart, if the product has packs defined, show pack quick-add buttons next to the regular `+`:

```
[+] iPhone 14   Stock: 4 cartons + 32 each
                Quick-add:  [+1 each]  [+1 carton (50)]
```

Clicking "+1 carton (50)" adds 50 base units to the cart line in one click — shorthand for "the customer is buying a carton's worth." The cart line still shows qty 50 in base units; nothing pack-shaped is recorded.

For **scan-only products** (§5.4), the regular `+` button is hidden — only pack quick-add buttons appear. The cashier can't type qty 1 directly. They scan/click a pack, which adds the pack's `base_qty`. To buy 30 chocolates, the cashier clicks "+1 box" three times (30 = 3 × 10).

This is the simplest possible implementation of "no loose sales" without restructuring the cart data model. Nothing about the cart, sale_items, invoices, or reports changes.

### 5.6 Sale detail — no change

Sale detail shows lines exactly as v1.9. No pack info on receipts. "Chocolate × 50 @ 12 = 600." Period.

### 5.7 i18n keys (additions)

```jsonc
// locales/en/products.json (additions)
{
  "fields": {
    "is_scan_only": "Scan-only",
    "is_scan_only_help": "When enabled, the cashier cannot type a quantity at the register — they must scan or click a pack. Useful for products where loose-unit sales aren't allowed."
  },
  "packs": {
    "section_title": "Packs",
    "section_subtitle": "Defined packs for stocking in",
    "columns": {
      "unit": "Unit",
      "contains": "Contains",
      "default_purchase": "Default purchase"
    },
    "add_pack": "+ Add pack",
    "default_badge": "★",
    "edit": "Edit",
    "deactivate": "Deactivate"
  }
}

// locales/en/units.json (new)
{
  "title": "Units",
  "create_new_unit": "+ Create new unit",
  "fields": {
    "code": "Unit code",
    "name": "Unit name"
  },
  "errors": {
    "code_invalid": "Code must start with a letter and contain only lowercase letters, numbers, and underscores.",
    "duplicate_code": "A unit with this code already exists."
  }
}

// locales/en/purchases.json (additions)
{
  "form": {
    "unit_per_line": "Unit",
    "unit_cost_per_pack": "per {{unitName}}",
    "create_new_pack": "+ Create new pack",
    "create_pack_modal_title": "Add a new pack for: {{productName}}",
    "create_pack_unit_label": "Unit name",
    "create_pack_contains": "Contains {{count}} units (each)",
    "create_pack_default": "Make this the default for this product",
    "create_pack_save": "Add pack"
  }
}

// locales/en/products_list.json (additions, or in pos.json depending on file structure)
{
  "stock_display": {
    "label": "Show stock as",
    "base": "Base units",
    "compact": "Compact",
    "compound": "Compound"
  }
}

// locales/en/pos.json (additions)
{
  "cart": {
    "quick_add_label": "Quick-add",
    "quick_add_each": "+1 {{unitName}}",
    "quick_add_pack": "+1 {{unitName}} ({{baseQty}})",
    "scan_only_help": "This product is scan-only. Use the quick-add buttons."
  }
}
```

Mirror in `locales/ur/*`. "Pack" / "Carton" / "Box" are common Urdu loanwords; use as-is unless the user prefers Urdu translations.

---

## 6. Edge cases & defensive notes

- **Stock-in to a brand-new product with no packs defined.** The unit dropdown shows "Each" only, plus "Create new pack". User can stock in immediately in base units, or define a pack first and then stock in. Works either way.
- **Pack defined with `base_qty = 12`, supplier ships a batch of 10.** Recommended workflow: deactivate the old pack, create a new one with `base_qty = 10`. The old `base_qty = 12` packs stay on historical purchase_items via FK (deactivation doesn't break references). The user could also use `update_pack` to change `base_qty` if they're sure it's a permanent change — but the deactivate+create pattern is preferred for audit clarity.
- **A pack referenced by historical purchase_items is deactivated.** FK is `references product_packs(id)` (no cascade). The pack row stays. Display archives via `is_active = false`. Historical purchase detail shows the pack name with "🗄️ archived" badge.
- **Per-line `base_qty` override at stock-in.** Not supported in v2.1. The user enters `pack_qty` and the system uses the pack's current `base_qty`. If a particular shipment was different, define a new pack first. (The case where supplier pack sizes vary widely shipment-to-shipment is rare enough to handle this way.)
- **Compound stock display with mixed pack sizes from old shipments.** Display always uses the *current* pack's `base_qty` for breakdown. Snapshots on `purchase_items` are for cost/audit, not for live display.
- **Scan-only product with no packs defined.** The cashier can't add it to the cart at all (no quick-add buttons, no direct qty entry). Edge case worth flagging in the UI: show a soft warning on the product detail page when scan-only is on but no packs exist.
- **POS cart with mixed scan-only and regular products.** No conflict — each product follows its own rule.
- **Two cashiers stocking in the same product simultaneously.** Both go through `record_purchase` with `for update` lock on the product. Stock + avg_cost updates serialize correctly.
- **Product stock = 0, pack defined with base_qty = 12.** Display: "0 cartons + 0 each". Empty stock is a valid state.
- **Product with multiple packs, stock not divisible by largest pack.** Stock 65, packs Carton (50) and Box (10). Compound display: "1 carton + 1 box + 5 each" (65 = 1×50 + 1×10 + 5). The view's largest-first ordering produces the right breakdown automatically — verify in §9.

---

## 7. CLAUDE.md update

After this ticket, append a v2.1 line in the Versioned PRDs section:

```
- v2.1: stock-in unit handling — packs as stock-in shortcuts only, sales stay in base units, scan-only flag for restricted products. Supersedes v2.0 design.
```

Add a gotcha:

```
- product_packs has no `price` column (v2.0's design was scrapped). Pack pricing was determined to be overkill for SME tier. If a future B2B-style pack-pricing feature is needed, it's a v3 ticket.
```

Move "Drop legacy products.cost column" from open todos to "still open"; v2.1 doesn't address it.

Mark "v2.0 design" as superseded (note that the file `MVP_v2.0_UNITS_OF_MEASURE.md` is historical reference only).

---

## 8. Implementation order

1. **Discovery report** in chat (§Phase A). Include v2.0 build status, root cause of compound display bug, plan.
2. **Migration applied** (§3): drop any v2.0 fragments → create units_of_measure → create product_packs (simplified) → add products columns → add purchase_items columns → backfill → create stock display view.
3. **Backend functions:** `define_pack_inline`, `update_pack`, `deactivate_pack`. Rewrite `record_purchase` per §4.3.
4. **Regenerate `database.ts`.**
5. **Manual sanity in SQL:** call `record_purchase` with both shapes (with pack and without). Verify avg_cost math matches the worked examples in §2. Run the §3.9 round-trip audit query — must pass.
6. **Stock-in form:** unit dropdown per line, "Create new pack" modal, default selection, label-adjusts-by-unit cost field.
7. **Product list:** consume `pack_breakdown` from the view, add compound display toggle, ensure no frontend breakdown computation.
8. **Product detail page:** Packs section with edit/deactivate/add-pack.
9. **Product create form:** remove any v2.0 Packs section (if shipped). Add scan-only checkbox.
10. **POS quick-add buttons** for products with packs. Scan-only enforcement for flagged products.
11. **i18n pass.**
12. **Manual smoke test** (§9 matrix).
13. **Update CLAUDE.md** with v2.1 line and gotchas (§7).
14. **Report back.**

---

## 9. Manual test matrix

### 9.1 The compound display bug fix
- Account A. Create product "iPhone 16", base price 100,000.
- Stock in 66 base units (no pack).
- Define a pack: Carton, base_qty 12.
- Open product list, switch to Compound display.
- **Verify display: "5 cartons + 6 each"** (NOT "5 cartons + 5 each").
- Run §3.9 audit query — round_trip_check = stock for this product.

### 9.2 Inline pack creation at stock-in
- Account A. Create new product "Chocolate Bar", base price 12.
- Open stock-in form. Pick the product.
- Unit dropdown shows: "Each" + "+ Create new pack".
- Click "+ Create new pack". Modal opens.
- Pick unit "Carton" (or create new), base_qty 100, mark as default purchase.
- Save modal. Pack created. Auto-selected in the line.
- Enter pack_qty 10, cost 800 per carton.
- Submit stock-in. Verify: stock = 1,000 base, avg_cost = 8.

### 9.3 Mobile shop (carton stock-in, unit sale)
- Account A. Create "iPhone 14", base price 100,000.
- Define pack: Carton, base_qty 50.
- Stock-in: 1 carton at 4,500,000.
- Verify stock = 50, avg_cost = 90,000.
- POS: add iPhone 14 to cart. Quick-add buttons show: "+1 each", "+1 Carton (50)".
- Click "+1 each". Cart line: qty 1, price 100,000, total 100,000.
- Submit cash sale. Verify stock = 49.

### 9.4 Cash-and-carry chocolate (multiple packs, scan via quick-add)
- Account A. Create "Chocolate Bar", base price 12.
- Define packs: Carton (100), Box (10).
- Stock-in: 5 cartons at 800. Stock = 500, avg_cost = 8.
- POS: add chocolate to cart via "+1 Box (10)". Cart line: qty 10, price 12, total 120.
- Click "+1 Box" again. Cart line: qty 20, price 12, total 240.
- Verify cart, receipt, sale detail all show "Chocolate × 20 @ 12 = 240" — no pack info.
- Submit. Stock = 480.

### 9.5 Scan-only product
- Account A. Create "Specialty Chocolate", base price 50, **scan-only ON**. Define Box pack (10).
- Stock-in: 1 carton (define inline, base_qty 100) at 4,000.
- POS: try to add product to cart. Verify regular `+` button is hidden. Quick-add shows "+1 Box (10)" only.
- Click box → cart adds 10 base units. Submit.
- Try to type qty directly — UI doesn't allow.

### 9.6 Pack size change (recommended workflow)
- Account A. Existing chocolate has Carton (100). After §9.4, deactivate the Carton (100) pack via product detail page.
- Create new pack: Carton (120). Mark as default purchase.
- Open historical sale from §9.4: receipt still says "Chocolate × 20 @ 12" — no pack info, so it's unaffected.
- Open historical stock-in from §9.4 detail: shows "Carton (100)" with archived badge — snapshot survives.
- New stock-in defaults to Carton (120). Math uses 120 going forward.

### 9.7 Compound display with multiple packs
- Account A. Product with stock 165, packs: Carton (50), Box (10).
- Compound display: "3 cartons + 1 box + 5 each" (165 = 3×50 + 1×10 + 5).
- Verify §3.9 audit: round_trip_check = 165.

### 9.8 Cross-shop isolation
- Account B sees zero of A's units, packs, products, or stock-in transactions.

### 9.9 v2.0 schema cleanup (only if applicable)
- If discovery showed v2.0 fragments existed: verify after migration that `sale_items` does not have pack columns; `product_packs` does not have `price` or `is_default_sale`; `shops.business_type` is gone.
- Verify all v1.3–v1.9 sales flows still pass.

---

## 10. Acceptance criteria

- [ ] CLAUDE.md updated with v2.1 line. v2.0 marked superseded.
- [ ] Discovery report posted in chat including v2.0 build status, compound display bug root cause, and migration plan.
- [ ] Migration applied: every shop has default `each` UoM; every product has `base_unit_id` set; every existing `purchase_items` row has `qty_in_base = qty`; any v2.0 partial schema removed.
- [ ] **Compound display bug fixed.** Stock 66 with carton size 12 displays "5 cartons + 6 each". §3.9 audit query returns zero rows where round_trip_check ≠ stock.
- [ ] **Inline pack creation works.** "Create new pack" footer in stock-in unit dropdown opens a modal that creates a pack and auto-selects it.
- [ ] **`record_sale` is unchanged.** No new columns on `sale_items`. POS unit-selector behavior matches v1.9 except for the optional quick-add buttons.
- [ ] Stock-in form lets the user pick Each or any defined pack per line. Default selection respects `is_default_purchase`.
- [ ] Worked example: stock-in 10 cartons × 100/carton @ 800/carton produces stock = 1,000, avg_cost = 8 per base unit.
- [ ] Worked example: stock-in 1 carton × 50/carton @ 4,500,000/carton produces stock = 50, avg_cost = 90,000.
- [ ] Sale of one chocolate bar after stocking via box quick-add records a normal v1.9-shape `sale_items` row — no pack columns, just qty/price/cost.
- [ ] Scan-only product hides the regular `+` button in the POS; cashier can only quick-add via packs.
- [ ] Pack deactivation works; historical purchases keep references; UI shows archived badge.
- [ ] Frontend never computes pack breakdown — always reads from `product_stock_display` view.
- [ ] All existing v1.3–v1.9 acceptance criteria still pass.
- [ ] No new console errors in either language.
- [ ] RLS isolates shops including units_of_measure and product_packs.

---

## 11. Out of scope for this round

- **Per-line `base_qty` override at stock-in.** Pack-size variations are handled by defining a new pack (rare case, deliberate workflow).
- **Multi-level pack nesting** (carton contains 6 boxes which contains 12 units, recorded as a parent-child relationship). Flat-to-base only. If a chocolate distributor with deep hierarchies signs up, add `parent_pack_id` then.
- **Pack-level sell pricing.** Removed from v2.0 design entirely. v2.2 customer tiers handle bulk-buyer discounts at the customer level instead.
- **Pack-level reorder points** ("alert me when I have less than 1 carton left"). Flat low-stock indicator from v1.5 is enough.
- **Bulk pack import / template library.** Future.
- **Receipt-level pack display** ("Chocolate × 1 carton (100 each) @ 1,200"). Defer until a B2B customer asks. Receipts are in base units.
- **Returns / refunds with pack-aware stock restoration.** Returns out of scope app-wide.
- **Test infrastructure.** Still skipped per user instruction.

---

*End of v2.1 stock-in unit handling spec.*
