# MVP v2.0 — Units of Measure & Pack Pricing (Retail / Hybrid)

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline) and v1.3–v1.9 fix specs.
**Stack:** unchanged — React + Supabase (via Supabase MCP) + react-i18next.
**Type:** **Capability expansion.** Realistic effort: 2–3 weeks.

> **Strategic framing.** Today the system handles single-unit POS only. To pitch to wholesalers and hybrid sellers (the dominant segment at places like Hall Road), we need to transact in cartons and boxes — without breaking the retailer flow. The pattern: every product has a **base unit** (the smallest atom) plus optional **packs** (a carton = N base units, a box = M base units). Stock is tracked internally in base units; users transact in whichever unit is appropriate; conversions are deterministic. **A unit is sellable if and only if it has a price set** — this is the single mental model for "what shows up at the register."

---

## 0. How to work this ticket

### Phase A — Discovery

1. **Re-read** `PRD.md` and recent fix specs (`v1.5`, `v1.8`, `v1.9`). Read `CLAUDE.md` at project root.
2. **Skills check** — same routine as v1.9. Use `frontend-design` skill for UI guidance.
3. **Inspect live schema via MCP**:
   - Current `products`, `sale_items`, `purchase_items`, `record_sale`, `record_purchase`.
   - Verify v1.9's `purchase_items.overhead_per_unit` and snapshot columns.
4. **Sample data** for migration planning:
   ```sql
   select count(*) as products,
          count(*) filter (where stock > 0) as products_with_stock
   from public.products;
   select count(*) from public.sale_items;
   select count(*) from public.purchase_items;
   ```
5. **Discovery report in chat** — schema state, migration data scale, plan, then proceed.

### Phase B — Schema migration first

Single migration `00XX_v20_units_of_measure.sql`. Apply via MCP, regenerate `database.ts`. **The most invasive migration since v1.2** — every transaction-shaped table gets new columns.

### Phase C — Backend functions

Update `record_sale`, `record_purchase`, `create_product_with_opening_stock`. Add UoM/pack management RPCs.

### Phase D — Frontend

In the order in §11. **Retailer flow gains zero clicks** — that's the headline UX constraint.

### Phase E — Verification

Manual smoke test with both personas (retail, hybrid) on two accounts. Update CLAUDE.md.

---

## 1. The strategic framing

### Why this matters
- **Pure retail TAM in Pakistan:** small. Most shops at Hall Road, Saddar, Liberty are mixed.
- **Hybrid (the dominant segment):** buys cartons from importers, sells some cartons to small retailers, sells some units to walk-ins. Currently doing mental math on conversions every transaction.
- **Software is mostly Excel + Tally** for this segment. Tally can do UoM but the UX is brutal. A clean POS with native carton↔unit conversion and accurate avg cost is uncommon — this is the moat.

### One catalog, any unit
**"One product description. Your choice of pack sizes. Transact in any unit. Stock math always accurate."**

A wholesaler defining "Carton of 72" once means every cashier just picks "Carton" at the register — no mental math, no spreadsheets, no errors. A hybrid seller can sell the same iPhone case as 1 carton (to a small shop) or 5 units (to a walk-in) on the same day from the same screen.

### What changes for retailers (the constraint)
**Nothing they can see, by default.** Products are created with a single base unit and no packs. The POS, stock-in, and product list look identical to today. Pack-level UI surfaces only appear when packs are defined on a product.

**The retailer flow must not gain a single extra click.**

---

## 2. Architectural approach

We use the standard ERP pattern — single product, multiple UoMs.

| Approach | Description | Why we picked it / didn't |
|---|---|---|
| **A. Single product, multiple UoMs** | Product has a base unit + optional packs. Stock in base units. Transactions specify UoM. | **Picked.** Industry standard (Odoo, SAP). Single source of truth. Scales cleanly. |
| B. Multiple linked products | Separate "Soap Bar" / "Soap Box" / "Soap Carton" products linked by parent/bundle. | Rejected. SKU proliferation, decrement bugs, audit confusion. |
| C. Just a text label | "Unit description" field. All transactions in base units. Users multiply in their head. | Rejected — defeats the point. |

### Mental model
- A **product** is the SKU.
- Every product has exactly one **base unit**.
- A product may have **packs** above the base unit. Each pack has a `base_qty` (e.g., carton = 72 base units) and **optionally a price**.
- **Stock is always stored in base units.** "12 cartons of 72" is stored as `stock = 864`.
- **Transactions store both** the pack used and the base-unit equivalent. Pack info is for display + audit; base-unit qty is for math.

### The pricing rule (the most important rule in this spec)

> **A unit (base or pack) is sellable if and only if its price is set.**

No fallback to "base price × multiplier." If you didn't set a carton price, the carton is not sellable at the register. This is intentional — it forces explicit pricing decisions and avoids footguns where forgotten configuration produces nonsense prices at scale.

The corollary: a product can have packs that are **stock-in only** (no sell price). This is what enables the mobile-shop pattern: stock in cartons of 50 phones, sell only as units.

### The snapshot rule
When a sale or purchase line references a pack, **snapshot the pack's `base_qty` onto the line item at transaction time**. Same pattern as v1.3's `cost_at_sale`. Future edits to pack definitions don't break historical math.

---

## 3. Two personas, one product model

We support two personas. Both use the same data model — the difference is which prices are filled in.

### Retail
- Products have only a **base unit** with a price. No packs defined.
- Stock-in is always in base units. POS shows the existing single-line shape.
- **Zero changes** they see vs. today.

### Hybrid
- Products have a base unit, optionally with a price. Optionally one or more packs, optionally with prices.
- The **price-set / not-set** pattern produces all the variants the user actually needs:

| Pattern | Use case | Base unit price | Pack prices |
|---|---|---|---|
| **Mobile shop** | Buy carton of 50 phones, sell only as units (any customer) | ✅ Set | ❌ None set on packs |
| **FMCG / soap shop** | Buy in cartons, sell cartons / boxes / units | ✅ Set | ✅ Set on every pack you sell |
| **Pure wholesaler within hybrid** | Sell only cartons, never units | ❌ Not set | ✅ Set on Carton (and maybe Box) |
| **Mixed product mix** | Some products only available in cartons, others single units | Mixed per product | Mixed per product |

There is no separate "wholesale-only" persona — that case is just a hybrid shop where the base unit has no price.

### Persona setting (light touch)

A new field `shops.business_type` with values `retail | hybrid`. Captured at onboarding (default `retail`). Drives **only** UX defaults:
- Whether the "Packs" section in the product form is collapsed (retail) or expanded (hybrid)
- Whether the POS pack selector renders by default (only matters when packs are defined anyway)

It does **not** restrict capabilities. A retailer can define packs at any time and the system follows.

---

## 4. Schema changes

Single migration `00XX_v20_units_of_measure.sql`.

### 4.1 `units_of_measure` (per shop)

```sql
create table if not exists public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text not null,           -- 'each', 'kg', 'box', 'carton', 'dozen'
  name text not null,           -- 'Each', 'Kilogram', 'Box', 'Carton', 'Dozen'
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
```

### 4.2 `product_packs`

```sql
create table if not exists public.product_packs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit_id uuid not null references public.units_of_measure(id) on delete restrict,
  base_qty integer not null check (base_qty > 1),
    -- Must be > 1 — the base unit itself isn't stored as a pack
  price numeric(12,2) check (price is null or price >= 0),
    -- THE PRICING RULE: NULL = not sellable as this pack. Stock-in still allowed.
  is_default_purchase boolean not null default false,
  is_default_sale boolean not null default false,
    -- is_default_sale can only be true if price is not null. Enforced at function level.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_pack_default_purchase
  on public.product_packs (product_id) where is_default_purchase and is_active;
create unique index if not exists uq_pack_default_sale
  on public.product_packs (product_id) where is_default_sale and is_active;

create unique index if not exists uq_pack_product_unit
  on public.product_packs (product_id, unit_id) where is_active;

create index if not exists idx_pack_product on public.product_packs (product_id) where is_active;

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
```

### 4.3 `products` changes

```sql
-- Add base unit reference
alter table public.products
  add column if not exists base_unit_id uuid references public.units_of_measure(id);

-- THE PRICING RULE: products.price becomes nullable.
-- Null = base unit is not sellable. Stock-in still allowed in base units.
alter table public.products alter column price drop not null;
```

After this change, the rule **"a product must have at least one priced unit"** is enforced by RPC (it's a cross-table invariant that's awkward to encode as a DB constraint). See §5.1.

### 4.4 `shops`: business type (two values)

```sql
alter table public.shops
  add column if not exists business_type text not null default 'retail'
    check (business_type in ('retail', 'hybrid'));
```

### 4.5 `sale_items`: pack snapshot columns

```sql
alter table public.sale_items
  add column if not exists pack_id uuid references public.product_packs(id),
  add column if not exists pack_qty integer,           -- "2 cartons"
  add column if not exists pack_base_qty_snapshot integer,  -- "72 base units per carton at the time"
  add column if not exists qty_in_base integer;        -- = pack_qty × pack_base_qty_snapshot, or = qty if no pack

alter table public.sale_items
  add constraint sale_items_pack_consistent check (
    (pack_id is null and pack_qty is null and pack_base_qty_snapshot is null)
    or
    (pack_id is not null and pack_qty is not null and pack_base_qty_snapshot is not null
     and pack_qty > 0 and pack_base_qty_snapshot > 1)
  );
```

### 4.6 `purchase_items`: same shape

```sql
alter table public.purchase_items
  add column if not exists pack_id uuid references public.product_packs(id),
  add column if not exists pack_qty integer,
  add column if not exists pack_base_qty_snapshot integer,
  add column if not exists qty_in_base integer;

alter table public.purchase_items
  add constraint purchase_items_pack_consistent check (
    (pack_id is null and pack_qty is null and pack_base_qty_snapshot is null)
    or
    (pack_id is not null and pack_qty is not null and pack_base_qty_snapshot is not null
     and pack_qty > 0 and pack_base_qty_snapshot > 1)
  );
```

### 4.7 Backfill

```sql
-- 1. Default 'each' UoM per shop
insert into public.units_of_measure (shop_id, code, name)
select s.id, 'each', 'Each'
from public.shops s
where not exists (
  select 1 from public.units_of_measure u
  where u.shop_id = s.id and u.code = 'each'
);

-- 2. Set every product's base_unit_id
update public.products p
set base_unit_id = u.id
from public.units_of_measure u
where u.shop_id = p.shop_id
  and u.code = 'each'
  and p.base_unit_id is null;

alter table public.products alter column base_unit_id set not null;

-- 3. Backfill qty_in_base on existing transactions
update public.sale_items set qty_in_base = qty where qty_in_base is null;
alter table public.sale_items alter column qty_in_base set not null;

update public.purchase_items set qty_in_base = qty where qty_in_base is null;
alter table public.purchase_items alter column qty_in_base set not null;

-- 4. Indexes
create index if not exists idx_sale_items_qty_in_base on public.sale_items (product_id, qty_in_base);
create index if not exists idx_purchase_items_qty_in_base on public.purchase_items (product_id, qty_in_base);
```

> **Key invariant after migration:** every existing transaction has `qty_in_base = qty`. New transactions can have `qty_in_base ≠ qty` when a pack is used. Existing `products.price` values are kept; only **new** product creation can choose to leave it null.

### 4.8 Append-only enforcement

`sale_items` and `purchase_items` are already append-only per v1.6/v1.8. Verify the trigger still applies after the alters. The new columns are part of the immutable record.

---

## 5. Backend functions

### 5.1 The "at least one priced unit" invariant

A product must have at least one of: `products.price IS NOT NULL`, OR at least one active pack with `price IS NOT NULL`. Otherwise the product is unsellable and shouldn't be saved.

Helper:

```sql
create or replace function public.assert_product_sellable(p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count
  from (
    select 1 from public.products
      where id = p_product_id and price is not null
    union all
    select 1 from public.product_packs
      where product_id = p_product_id and price is not null and is_active
  ) s;
  if v_count = 0 then
    raise exception 'product_must_have_at_least_one_priced_unit'
      using hint = 'Set a base price or a pack price';
  end if;
end;
$$;
```

The RPCs that mutate price/pack data (`update_product`, `define_pack`, `update_pack`, `deactivate_pack`) call this at the end of their transaction.

### 5.2 Pack management RPCs

**`define_pack(p_product_id, p_unit_id, p_base_qty, p_price, p_default_purchase, p_default_sale)`**
- Validates product belongs to shop.
- **Rejects `is_default_sale = true` if `price is null`** — a pack with no price can't be the default sale unit.
- Inserts pack. Unique partial indexes auto-reject duplicate defaults.
- Returns new pack id.

**`update_pack(p_pack_id, p_price, p_default_purchase, p_default_sale)`**
- `base_qty` is **immutable** once defined. Locked.
- `unit_id` is **immutable**.
- Only `price`, `is_default_*`, and `is_active` are editable.
- Rejects `is_default_sale = true` if updated price is null.
- Calls `assert_product_sellable` at the end.

**`deactivate_pack(p_pack_id)`** — sets `is_active = false`. Historical transactions keep references; future transactions can't use it. Calls `assert_product_sellable` at the end.

### 5.3 `record_sale` rewrite

Read current via MCP. Drop and recreate.

```sql
create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric(12,2) default 0,
  p_service_charge numeric(12,2) default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
    -- shape, two variants per line:
    --   without pack: {"product_id": "...", "qty": 5, "price_at_sale": 50000}
    --   with pack:    {"product_id": "...", "pack_id": "...", "pack_qty": 2, "price_at_sale": 480}
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_total numeric(12,2) := 0;
  v_credit numeric(12,2);
  v_payment_type text;
  v_item jsonb;
  v_product record;
  v_pack record;
  v_pack_id uuid;
  v_pack_qty int;
  v_pack_base_qty_snapshot int;
  v_qty_in_base int;
  v_line_total numeric(12,2);
  v_base_price numeric(12,2);
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  -- Compute total
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item ? 'pack_id' and v_item->>'pack_id' is not null then
      v_pack_qty := (v_item->>'pack_qty')::int;
      v_line_total := v_pack_qty * (v_item->>'price_at_sale')::numeric;
    else
      v_line_total := (v_item->>'qty')::int * (v_item->>'price_at_sale')::numeric;
    end if;
    v_total := v_total + v_line_total;
  end loop;
  v_total := v_total + p_service_charge;

  -- (overpayment guard, customer rules, payment_type derivation — same as v1.6)
  -- ...

  -- Insert invoice
  -- ...

  -- Process items
  for v_item in select * from jsonb_array_elements(p_items) loop
    select id, stock, avg_cost, price into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
    for update;
    if not found then raise exception 'product_not_in_shop'; end if;

    -- Resolve pack and compute qty_in_base
    if v_item ? 'pack_id' and v_item->>'pack_id' is not null then
      v_pack_id := (v_item->>'pack_id')::uuid;
      v_pack_qty := (v_item->>'pack_qty')::int;

      select id, base_qty, price into v_pack
      from public.product_packs
      where id = v_pack_id and product_id = v_product.id and is_active;
      if not found then raise exception 'pack_not_found_or_inactive'; end if;

      -- THE PRICING RULE — pack must have a price to be sellable
      if v_pack.price is null then
        raise exception 'pack_not_sellable: this pack has no sell price set';
      end if;

      v_pack_base_qty_snapshot := v_pack.base_qty;
      v_qty_in_base := v_pack_qty * v_pack_base_qty_snapshot;
    else
      -- No pack — selling base units. Verify base unit is sellable.
      if v_product.price is null then
        raise exception 'base_unit_not_sellable: this product has no base price set';
      end if;
      v_pack_id := null;
      v_pack_qty := null;
      v_pack_base_qty_snapshot := null;
      v_qty_in_base := (v_item->>'qty')::int;
    end if;

    -- Stock check using qty_in_base
    if v_product.stock < v_qty_in_base then
      raise exception 'insufficient_stock for product %', v_product.id;
    end if;

    -- Insert sale_item with full snapshot
    insert into public.sale_items (
      invoice_id, product_id, qty, price_at_sale, cost_at_sale,
      pack_id, pack_qty, pack_base_qty_snapshot, qty_in_base
    ) values (
      v_invoice_id,
      v_product.id,
      v_qty_in_base,
      (v_item->>'price_at_sale')::numeric,
      v_product.avg_cost,
      v_pack_id, v_pack_qty, v_pack_base_qty_snapshot, v_qty_in_base
    );

    -- Decrement stock by qty_in_base, NEVER by qty or pack_qty
    update public.products set stock = stock - v_qty_in_base, updated_at = now()
    where id = v_product.id;
  end loop;

  -- Ledger entry if credit (v1.6 logic)
  -- ...

  return v_invoice_id;
end;
$$;
```

> **The single most important line in this entire spec:** stock decrements by `qty_in_base`. Never by `qty`, never by `pack_qty`. Every test must verify this.

### 5.4 `record_purchase` rewrite — and the worked example

Same surgery as `record_sale`. Accept pack info. Stock += `qty_in_base`. avg_cost calculation uses **per-base-unit cost**, computed from the pack-level cost_at_purchase.

#### The math, walked through

This is the user's "10 cartons of chargers" scenario. Suppose:

- Product: USB-C Charger
- Pack defined: "Carton" with `base_qty = 100` (because each carton has 10 boxes × 10 chargers = 100 chargers)
- Stock-in: 10 cartons at 800 PKR per carton
- No additional overhead (for clarity — overhead from v1.9 still applies on top if present)

Frontend submits:
```json
{
  "items": [{
    "product_id": "...",
    "pack_id": "...",         // the carton pack
    "pack_qty": 10,
    "cost_at_purchase": 800   // per carton
  }]
}
```

Function computes:
```
qty_in_base        = pack_qty × pack.base_qty       = 10 × 100 = 1,000 base units
line_total         = pack_qty × cost_at_purchase    = 10 × 800 = 8,000 PKR
per_base_unit_cost = line_total / qty_in_base       = 8,000 / 1,000 = 8 PKR per charger
```

`per_base_unit_cost` is what feeds into the WAC formula:
```
new_avg_cost = (old_stock × old_avg_cost + qty_in_base × per_base_unit_cost) / (old_stock + qty_in_base)
```

If stock was 0 before: new avg cost = **8 PKR per charger**. Stock = **1,000 chargers**.

The supplier's per-carton invoice price (800) is preserved on the `purchase_items` row for audit (`cost_at_purchase = 800`, `pack_qty = 10`, `pack_base_qty_snapshot = 100`). The **landed per-base-unit cost (8 PKR)** is what `avg_cost` reflects on the product.

#### Why this is the standard ERP answer

The user asked "usually how things work in ERPs? Per unit avg?" — yes, exactly. Every major ERP I've worked with uses this pattern:
- **Stock is always tracked in base units.**
- **Cost is always tracked per base unit (avg / FIFO / LIFO — we use moving avg).**
- **Sale price is whatever you charge, in whatever unit you charge it in.**
- **Profit per line = (price_at_sale × pack_qty) − (avg_cost × qty_in_base).**

The supplier's per-carton invoice price is just an input. Total cost ÷ total base units = per-unit landed cost. Every other number flows from there.

#### What if the supplier sometimes invoices per box, sometimes per carton?

Same math, one level down. If the supplier sent boxes (50 boxes at 80 PKR each):
- `pack` selected = "Box" (`base_qty = 10`)
- `pack_qty = 50`, `cost_at_purchase = 80`
- `qty_in_base = 500`, `line_total = 4,000`, `per_base_unit_cost = 8`

**Same per-unit landed cost.** The unit is just *how the supplier billed you*. The system normalizes everything to base units behind the scenes.

#### Function sketch

```sql
-- Inside record_purchase, per item:

if v_item ? 'pack_id' and v_item->>'pack_id' is not null then
  v_pack_id := (v_item->>'pack_id')::uuid;
  v_pack_qty := (v_item->>'pack_qty')::int;

  select id, base_qty into v_pack
  from public.product_packs
  where id = v_pack_id and product_id = v_product.id and is_active;
  if not found then raise exception 'pack_not_found_or_inactive'; end if;

  -- Note: stock-in does NOT require pack.price to be set.
  -- A "stock-in only" pack (price = NULL) is still purchasable.

  v_pack_base_qty_snapshot := v_pack.base_qty;
  v_qty_in_base := v_pack_qty * v_pack_base_qty_snapshot;
  v_line_total := v_pack_qty * (v_item->>'cost_at_purchase')::numeric;
else
  v_qty_in_base := (v_item->>'qty')::int;
  v_line_total := v_qty_in_base * (v_item->>'cost_at_purchase')::numeric;
end if;

-- Per-base-unit cost (the figure that drives WAC and avg_cost)
v_per_base_unit_cost := v_line_total / v_qty_in_base;

-- Then v1.9 overhead allocation runs on top, expressed per base unit:
--   v_per_base_unit_cost_with_overhead = v_per_base_unit_cost + overhead_per_unit
-- where overhead_per_unit = (this line's overhead share) / v_qty_in_base

-- WAC update on products.avg_cost uses v_per_base_unit_cost_with_overhead.
-- products.stock += v_qty_in_base.
-- products.last_purchase_cost = (v_item->>'cost_at_purchase')::numeric  -- supplier's quoted price, NOT landed
```

### 5.5 `create_product_with_opening_stock` update

Accept `p_base_unit_code` (default `'each'`). Resolve to `base_unit_id`. Opening stock is in base units (no pack support at creation — define packs after).

**At create time, base price is required.** The pricing-rule flexibility (a product with no base price, only pack prices) kicks in once you can edit packs. This keeps the create flow simple. To configure the mobile-shop pattern (no carton sale price), the user creates the product with a base price + base stock, then defines the carton pack with no price.

### 5.6 Stock display helper view

```sql
create or replace view public.product_stock_display as
select
  p.id as product_id,
  p.shop_id,
  p.stock as base_qty,
  bu.code as base_unit_code,
  bu.name as base_unit_name,
  p.price as base_price,           -- nullable
  -- For each pack defined, compute "how many full packs fit in current stock"
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'pack_id', pk.id,
      'unit_code', u.code,
      'unit_name', u.name,
      'base_qty', pk.base_qty,
      'price', pk.price,
      'whole_packs', floor(p.stock / pk.base_qty)::int,
      'remainder_base', (p.stock % pk.base_qty)::int,
      'is_sellable', (pk.price is not null)
    ) order by pk.base_qty desc), '[]'::jsonb)
    from public.product_packs pk
    join public.units_of_measure u on u.id = pk.unit_id
    where pk.product_id = p.id and pk.is_active
  ) as pack_breakdown
from public.products p
join public.units_of_measure bu on bu.id = p.base_unit_id;
```

---

## 6. UI changes

### 6.1 Product create / edit form — Packs section

Expandable section below the existing fields. Collapsed by default for `retail` business type, expanded for `hybrid`.

```
Base unit:    [Each ▼]    (locked after first transaction)
Sell price:   [____]      (leave blank if not sold as base units)

▾ Packs (optional)
   Define larger units you transact in. Stock and avg cost stay in base units.

   ┌────────────────────────────────────────────────────────────────┐
   │ Unit       Contains    Sell price   Default for           ✕    │
   │ [Box ▼]    [12] each   [____]       ☐ purchase ☐ sale         │
   │ [Carton ▼] [72] each   [____]       ☑ purchase ☐ sale         │
   │ [+ Add pack]                                                   │
   └────────────────────────────────────────────────────────────────┘

   ⓘ Tip: Leave a sell price blank to use this pack only for stock-in
     (e.g., you buy in cartons but sell only as units).
```

**Rules:**
- **Sell price blank = not sellable as that unit.** Field hint reinforces this.
- "Contains N each" — the `base_qty`. Locked once any transaction references this pack (small "🔒 in use" indicator).
- Default-for-purchase: at most one pack. Default-for-sale: at most one pack, and only available when sell price is set.
- "+ Add pack" creates a new row. Unit dropdown lists existing UoMs + "+ Create new unit" footer.
- **At least one priced unit required.** Form-level validation: if base price is null and no pack has a price, show error "Set a base price or a pack price."

### 6.2 Stock-in form — pack selector per line

Each line gets a unit selector after the product picker:

```
#  Product           Unit         Qty  Unit cost  Line total ✕
1  iPhone 13       ▼ [Carton ▼]   10   800        8,000        ×
```

- Unit selector defaults to the product's `is_default_purchase` pack, falling back to base unit if none.
- Switching unit doesn't auto-convert qty.
- "Unit cost" label reflects unit: "per carton" / "per box" / "per each".
- Line total = qty × unit cost (in whatever unit).
- **All packs are available for stock-in regardless of sell price** — even non-sellable packs (price = NULL) appear in the picker. This is the key UX for the mobile-shop case.
- Behind the scenes on submit, line is sent with `pack_id + pack_qty + cost_at_purchase`, or `qty + cost_at_purchase` for base.

Bidirectional cost calc from v1.9 still works.

### 6.3 POS — pack selector per cart line

```
[+] iPhone 13 case   Stock: 12 cartons + 0 each
                     [Each ▼]  Qty: 1   Price: 75   Line: 75
```

- Default unit per line: `is_default_sale` pack (which always has a price), else base unit if priced.
- **Only sellable units appear in the dropdown.** A pack with price = NULL is hidden from POS. This is the rule that produces the mobile-shop UX automatically.
- When unit changes, price re-defaults to that pack's `price` (or `products.price` for base).
- Stock indicator shows compound view by default for products with packs.
- Adding a new line via the `+` button uses the default sale unit.

### 6.4 Product list — stock display

Default column: stock in base units ("864 each").

Toggle in header: **Show stock as: [Base units] | [Compact] | [Compound]**
- Base: "864 each"
- Compact: largest priced pack that fits exactly, else base ("12 cartons" or "864 each")
- Compound: full breakdown ("12 cartons + 0 each")

User preference in `localStorage`. Default = base.

### 6.5 Sale / khata / purchase detail views

Show pack info as additional context on lines:
- POS receipt: "iPhone case × 2 cartons (= 144 each) @ 540 = 1,080"
- Sale detail: "iPhone case — 2 cartons × 540 = 1,080" (with `(144 each)` muted)
- Khata "For" column (v1.6): unchanged on the list; pack info appears on detail click.
- Purchase detail: similar — pack qty + base equivalent in muted text.

### 6.6 Onboarding update

Onboarding wizard adds one question:

```
Do you sell in cartons or boxes?
○ No, just individual units (Retail)
○ Yes, in cartons / boxes / both (Hybrid)
```

Sets `shops.business_type`. Default = retail. Editable later in `/settings`.

---

## 7. Migration & backward compatibility

### 7.1 Hard rules

- **Existing flows keep working.** Every product seeded with `base_unit = 'each'`, no packs. Retail flow unchanged.
- **Existing transactions stay intact.** Backfill sets `qty_in_base = qty` and pack columns to NULL.
- **Existing `products.price` values preserved** — non-null on backfilled rows. Only new products can choose a null base price.
- **Existing RPC contracts accept the old shape.** A line item with `qty` and no `pack_id` works as today.

### 7.2 Frontend migration order (independently deployable stages)

1. **Stage 1 — invisible foundation.** Schema + RPC updates. UI unchanged. Retail flow unaffected.
2. **Stage 2 — packs section in product form.** Hybrid sellers can define packs. POS still uses base only (until packs referenced).
3. **Stage 3 — pack selectors in POS and stock-in.** Light up only when a product has packs. Retailers see no UI change.
4. **Stage 4 — stock display modes, onboarding question, settings tweaks.** Polish.

Each stage is independently deployable.

---

## 8. Reports & analytics implications

### 8.1 Stays correct without changes
- Avg cost (per base unit, always): correct.
- Profit per sale: correct. Revenue is `pack_qty × price` or `qty × price`; cost is `qty_in_base × cost_at_sale`.
- Stock totals: correct, in base units.

### 8.2 Care needed in existing displays
- Sales list (v1.3) "items count" stays as `count(sale_items)`. Don't change to sum of `qty_in_base`.
- Dashboard "today's sales total" sums `invoices.total` — unchanged, correct.

### 8.3 Net new dimensions enabled (v2.1+ candidates)
- "Sales by unit type" — cartons vs. units mix.
- "Margin by unit" — where margin is actually higher.
- Customer-tier reports (v2.1).

---

## 9. Edge cases (verify each)

- **Selling a partial carton.** Blocked by integer constraint. UX error if user types 0.5.
- **Compound display across boundary.** Stock 145 base, carton = 72 → "2 cartons + 1 each" (145 = 2×72 + 1). Verify in LTR and RTL.
- **Pack edited mid-sale.** Submit uses snapshot at compute time. Acceptable.
- **Pack `base_qty` change after first transaction.** Blocked.
- **Deactivated pack on historical sales.** Pack stays referenced via `on delete restrict`. Display with "🗄️ archived" badge.
- **Two cashiers on same product, different units.** Both go through `record_sale` with `for update`. Stock check uses `qty_in_base`. Loser gets `insufficient_stock`.
- **Stock-in with overhead (v1.9) on a pack purchase.** Per-base-unit overhead = total per-line overhead / `qty_in_base`. Math composes — verify.
- **Customer khata in money, not units.** Ledger amounts are PKR regardless of transacted unit. v1.6 unchanged.
- **Reverse a pack-based sale.** Reversal is ledger-only (money). No automatic stock restoration. Returns flow still out of scope.
- **Product with no priced unit.** Blocked by `assert_product_sellable` invariant. Can't save.
- **Mobile-shop case (verified end-to-end).** Base price set, carton has `base_qty = 50` and price = NULL. POS shows only Each. Stock-in shows both Each and Carton. Selling 1 phone decrements stock by 1.
- **Pure-wholesale-pattern product.** Base price = NULL, carton has price set. POS shows only Carton. Stock-in shows both. Customer can never buy a single unit from this product even with negotiation — by design.

---

## 10. i18n keys (additions)

```jsonc
// locales/en/units.json (new)
{
  "title": "Units",
  "base_unit": "Base unit",
  "base_unit_price": "Base unit price",
  "base_unit_price_optional_help": "Leave blank if you don't sell individual units.",
  "pack": "Pack",
  "packs": "Packs",
  "contains": "Contains {{count}} {{unitName}}",
  "default_for_purchase": "Default for purchase",
  "default_for_sale": "Default for sale",
  "in_use_locked": "In use — base quantity is locked",
  "add_pack": "+ Add pack",
  "add_unit": "+ Create new unit",
  "remove_pack": "Remove pack",
  "stock_in_only_help": "Leave a sell price blank to use this pack only for stock-in (e.g., buy in cartons, sell as units).",
  "stock_display": {
    "label": "Show stock as",
    "base": "Base units",
    "compact": "Compact",
    "compound": "Compound"
  },
  "errors": {
    "duplicate_unit": "This unit is already defined for this product.",
    "base_qty_invalid": "Pack must contain at least 2 base units.",
    "base_qty_locked": "Cannot change pack contents after first transaction.",
    "default_already_set": "Another pack is already the default.",
    "default_sale_needs_price": "A pack can only be the default sale unit if it has a sell price.",
    "no_priced_unit": "Set a base price or at least one pack price — every product needs at least one sellable unit.",
    "pack_not_sellable": "This pack doesn't have a sell price.",
    "base_unit_not_sellable": "This product doesn't have a base price set."
  }
}

// locales/en/business_type.json (new)
{
  "question": "Do you sell in cartons or boxes?",
  "retail": "No, just individual units (Retail)",
  "hybrid": "Yes, in cartons / boxes / both (Hybrid)",
  "help_retail": "You sell single items at the register. Stock-in is also in single units.",
  "help_hybrid": "You stock in cartons/boxes and may sell at any level. We'll show pack tools where needed."
}

// locales/en/pos.json (additions)
{
  "cart": {
    "unit_label": "Unit",
    "stock_compound": "{{cartons}} cartons + {{each}} each"
  }
}

// locales/en/purchases.json (additions)
{
  "form": {
    "unit_per_line": "Unit",
    "unit_cost_per_pack": "per {{unitName}}"
  }
}
```

Mirror in `locales/ur/*`. Note: "carton" / "box" are common loanwords in Pakistani Urdu — confirm with user whether to transliterate or translate.

---

## 11. Implementation order

1. **Discovery report** in chat (§Phase A).
2. **Migration applied** (§4), `database.ts` regenerated.
3. **Stage 1 deploy:** schema + RPCs only. Verify retail flow unchanged.
4. **Pack management RPCs** (§5.2).
5. **Product create/edit form** Packs section (§6.1) with the price-as-sellability rule.
6. **`record_sale` and `record_purchase` rewrites** (§5.3, §5.4). Old shape still works.
7. **POS pack selector** (§6.3) — only renders when sellable packs exist.
8. **Stock-in pack selector** (§6.2) — shows all packs (sellable or not).
9. **Stock display modes** (§6.4).
10. **Sale / khata / purchase detail screens** show pack info (§6.5).
11. **Onboarding business-type question** (§6.6) + settings page.
12. **i18n pass.**
13. **Manual smoke test** with both personas (§13).
14. **Update CLAUDE.md** with v2.0 line + open todos.
15. **Report back.**

---

## 12. Acceptance criteria

- [ ] CLAUDE.md updated with v2.0 line.
- [ ] Migration applied: every shop has default `each` UoM; every product has `base_unit_id`; every existing line has `qty_in_base = qty`.
- [ ] **Retailer flow unchanged.** A retailer creating a product (base price only, no packs), selling base units, stocking in base units sees the exact same UI as v1.9. No new dropdowns, no new fields.
- [ ] **Pricing rule enforced everywhere.** A pack with price = NULL is hidden in POS dropdowns but visible in stock-in dropdowns. Trying to sell it via direct RPC raises `pack_not_sellable`.
- [ ] **At-least-one-priced-unit** rule enforced. Cannot save a product with all prices null.
- [ ] **Mobile-shop scenario works.** Product with base price + carton (base_qty = 50, price NULL): stock-in 2 cartons → stock = 100 base. POS shows only Each. Sell 5 units → stock = 95.
- [ ] **FMCG scenario works.** Product with base price + box (12) + carton (72), all priced. Stock-in 3 cartons → stock = 216. POS lets cashier swap unit per line. Mixed cart works.
- [ ] **Stock decrements by `qty_in_base`** in every test, never by `qty` or `pack_qty`.
- [ ] **Stock-in math.** The chargers worked example (10 cartons × 100 base/carton @ 800/carton) produces stock = 1,000, avg_cost = 8.
- [ ] **Pack snapshot.** After a sale uses pack X, editing pack X's `base_qty` is rejected. Editing `price` is allowed and only affects future sales.
- [ ] **Deactivating a used pack** works; historical lines render with archived indicator.
- [ ] **Stock display toggle** (base/compact/compound) works and persists.
- [ ] **Onboarding** asks the two-option business-type question. Settings allows editing.
- [ ] Every existing v1.3–v1.9 acceptance criterion still passes.
- [ ] No new console errors in either language, in either business mode.
- [ ] RLS isolates shops including UoMs and packs.

---

## 13. Manual test matrix (two personas)

### 13.1 Retail flow (regression)
- Account A configured as retail.
- Create "USB Cable", base unit Each, base price 200, no packs. Opening stock 50.
- Sell 3 cables at 200, cash. Stock = 47.
- Stock-in 20 cables at 150 each. avg_cost updates, stock = 67.
- **Verify zero pack UI surfaces anywhere.**

### 13.2 Hybrid — mobile shop pattern
- Account B configured as hybrid.
- Create "iPhone 14", base unit Each, base price 100,000. Add pack "Carton" with base_qty = 50, price = NULL (stock-in only).
- Stock-in 1 carton at 4,500,000 (per carton). Verify: stock = 50 base, avg_cost = 90,000.
- Open POS, add iPhone to cart. **Verify only "Each" appears in unit dropdown.**
- Sell 1 phone at 100,000 (default), cash. Sell another at 95,000 (cashier negotiates per v1.3). Verify both record correctly. Stock = 48.

### 13.3 Hybrid — FMCG pattern
- Account B (same shop).
- Create "Laundry Soap", base unit Each, base price 75. Add Box pack (base_qty = 12, price 750). Add Carton pack (base_qty = 72, price 4,200). Carton default purchase, Each default sale.
- Stock-in 3 cartons at 4,000 per carton with 600 delivery overhead.
- Verify: stock = 216, avg_cost ≈ 56.94 (= (3×4000 + 600)/216 = 12,600/216).
- Mixed-cart sale: 1 carton + 5 base units in one invoice. Verify both lines snapshot correctly. Stock = 139 base = 1 carton + 67 each in compound display.

### 13.4 Hybrid — pure wholesale pattern (within hybrid persona)
- Account B (same shop).
- Create "Generic Charger", base price NULL, Carton pack (base_qty = 100, price 1,200) — only sold by carton.
- Stock-in 5 cartons at 800 each. Verify avg_cost = 8 per base unit, stock = 500.
- Open POS. **Verify only "Carton" appears in unit dropdown.** Cannot add an "Each" line — base price isn't set.
- Sell 2 cartons at 1,200 each. Stock = 300 base = 3 cartons.

### 13.5 Cross-shop isolation
- Account C (separate shop) sees zero of A/B's units, packs, products, transactions.

### 13.6 Edge cases
- Try to save a product with base price NULL and no packs — blocked.
- Try to set a pack as "default for sale" with no price — blocked.
- Try to change a pack's base_qty after using it — blocked.
- Try to delete a pack with history — blocked (FK restrict).
- Spoof a `pack_id` from another product in `record_sale` — rejected.

---

## 14. Out of scope for this round

- **Editable `base_qty` after use.** Locked.
- **Returns / refunds with pack-aware stock restoration.** Returns out of scope; design must handle pack snapshots when added.
- **Per-customer pricing tiers** ("Customer X always gets wholesale rate"). **This is v2.1.**
- **Volume discounts** ("buy 5 cartons, get 5% off"). Future.
- **Pack-level reorder points / low-stock alerts.** Stretch.
- **Multi-level pack hierarchies recorded explicitly.** Current model treats every pack as flat-to-base. Hierarchy is a UI concept, not a data concept.
- **Bulk pack import / template library.** Future.
- **Test infrastructure.** Still skipped.

---

*End of v2.0 units of measure & pack pricing spec.*
