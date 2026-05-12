# MVP Enhancements — v1.9 (Stock-In Hardening, Suppliers, Landed Cost)

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline) and v1.3–v1.8 fix specs.
**Stack:** unchanged — React + Supabase (via Supabase MCP) + react-i18next.

> Patch-on-top spec for the stock-in (purchases) module. Adds suppliers, landed-cost allocation for delivery / labor / overhead, bidirectional cost calculation, fuzzy product search inside the form, and fixes the broken "Effect on inventory" panel. Investigate first, then make the smallest correct change.

---

## 0. How to work this ticket

### Phase A — Discovery (read before writing code)

1. **Re-read** previous fix docs if not loaded this session, especially `MVP_FIXES_v1.5.md` (which built `record_purchase`, opening stock, and the avg_cost flow) and `MVP_FIXES_v1.8.md` (db hardening principles).
2. **CLAUDE.md check.** Look at the project root for `CLAUDE.md`. If it exists, read it — that's the project memory file. If it doesn't exist, **create it** in Phase B with the structure in §2. Update it at the end of this ticket and after every subsequent ticket. This is non-optional going forward.
3. **Skills check.** Run `find-skills` (or whatever the local skill discovery command is — try `npx skills list`, then check `/mnt/skills/` for installed skills). If a skill specifically helpful for this work exists (e.g., a forms skill, a data-table skill, or a stock/inventory ERP skill), read it. Otherwise default to the built-in `frontend-design` skill at `/mnt/skills/public/frontend-design/SKILL.md`. Note in the discovery report what skill was used.
4. **Inspect the live schema via MCP.** Specifically:
   - Current `purchases` and `purchase_items` columns and constraints.
   - Whether v1.5's `is_opening` flag and `avg_cost` / `last_purchase_cost` columns landed.
   - Current `record_purchase` function body — read it, don't assume.
   - Whether any supplier-like table already exists (it shouldn't, but check before adding a duplicate).
5. **Reproduce the "Effect on inventory" bug.** Open `/purchases/:id` for a recent stock-in. Take note of:
   - Whether avg_before / avg_after fields render at all.
   - Whether they show "—" or stale values or correct values.
   - Read the source query that powers this panel — is it computing on-the-fly or reading stored snapshots?
6. **Map the stock-in UI.** Find the form, the product picker (it's likely the broken dropdown the user mentioned), the cart-style item list, the totals area.
7. **Discovery report in chat** before any code:
   - Skills used.
   - Live schema state (especially the v1.5 columns).
   - Root cause of the Effect on Inventory bug.
   - Whether CLAUDE.md exists and what's in it.
   - Plan, then proceed.

### Phase B — Schema migration first

Single migration `00XX_v19_suppliers_landed_cost.sql`. Apply via MCP, regenerate `src/types/database.ts`. Then create or update CLAUDE.md.

### Phase C — Backend functions

Update `record_purchase` for landed-cost allocation. Add `search_suppliers`, `recent_suppliers`, `create_supplier_with_inline`. Update or add a view powering `/purchases/:id`.

### Phase D — Frontend

In the order in §11.

### Phase E — Verification

Manual smoke test with two accounts. Update CLAUDE.md with what shipped and what's deferred.

---

## 1. Mission summary

Five things land in this ticket:

1. **Searchable product picker inside the stock-in form**, using the same trigram fuzzy search as v1.5.
2. **Suppliers** as a first-class entity, so future supplier-comparison reports have a clean foundation.
3. **Bidirectional cost calculation** in the line-item editor — fill any two of (qty, unit cost, line total), compute the third.
4. **Landed-cost allocation** for delivery / labor / customs / other overhead, distributed pro-rata across line items so `avg_cost` reflects true unit economics.
5. **Stock-in list pagination + date filter (MTD default)** plus a fix to the broken "Effect on inventory" panel on the detail view.

Plus an audit pass on the whole module per `frontend-design` skill guidance, and CLAUDE.md maintenance going forward.

---

## 2. CLAUDE.md — project memory file (new artifact)

Create at the project root. This file is read by Claude Code at the start of every session. Keep it short, accurate, current.

**Required structure:**

```markdown
# CLAUDE.md — Project Memory

## What this project is
One-line description. Pakistani SMB POS + inventory + khata system.
Built solo with Claude Code. React + Supabase. PKR. EN/UR bilingual.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind + react-i18next + shadcn/ui
- Backend: Supabase (Auth, Postgres, RLS, pg_trgm)
- Tooling: Supabase MCP, GitHub MCP

## Key conventions
- All money: numeric(12,2), PKR, never float
- All timestamps: timestamptz
- Multi-tenancy: shop_id on every domain table, RLS-scoped via current_shop_id()
- SECURITY DEFINER functions: always set search_path = public
- RLS policies: wrap auth.uid() and current_shop_id() in (select ...) for plan caching
- Financial tables (invoices, sale_items, ledger_entries, purchases, purchase_items): append-only triggers
- Frontend: never compose multi-step writes; always call an RPC

## Versioned PRDs (build trail)
- v1.2: baseline — auth, onboarding, subscription, i18n
- v1.3: WAC, sales module, khata view enhancements
- v1.4: partial payments, customer expansion, walk-ins
- v1.5: product type uniqueness, opening stock, fuzzy search, POS redesign
- v1.6: ledger hardening — stored balance, reversals, occurred_at, append-only
- v1.7: design system revamp (mint→navy palette, Urdu font fix, DataTable primitive)
- v1.8: db hardening — RLS audit, search_path, FK indexes, locks, money precision
- v1.9: stock-in hardening, suppliers, landed-cost allocation

## Open ToDos / Known gaps
- Supabase free tier: no backups; move to Pro before any real customer goes live
- Drop legacy products.cost column (deferred from v1.5)
- Drop legacy ledger_entries.paid_at (deferred from v1.6)
- Advance payments (customer credit balance) — deferred from v1.4 §8
- Returns / refunds — deferred since v1.2

## How to run things
- Dev: `npm run dev`
- Migrations: applied via Supabase MCP, files in `supabase/migrations/`
- Type generation: after every migration, regenerate `src/types/database.ts`

## Gotchas / hard-earned lessons
- pg_trgm `set_limit(0.2)` is per-statement, not persistent; set it inside each search function
- Postgres unique indexes need WHERE is_active = true to allow re-using a name after archiving
- record_sale must lock products with FOR UPDATE before checking stock
- RLS auth.uid() should always be (select auth.uid()) — see v1.8

## When in doubt
Read the latest MVP_FIXES_v*.md spec first. The discovery phase exists for a reason.
```

**Update CLAUDE.md at the end of every ticket** with: what shipped (one line per change), any new gotcha discovered, any item moved from open-todo to done.

---

## 3. Suppliers — new entity

### 3.1 Schema

```sql
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  contact text,                    -- phone, optional
  address text,                    -- optional
  notes text,                      -- optional
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_name_not_blank check (length(trim(name)) > 0)
);

-- Case-insensitive uniqueness within a shop, only among active suppliers
create unique index if not exists uq_suppliers_shop_name
  on public.suppliers (shop_id, lower(trim(name)))
  where is_active = true;

-- Trigram index for fuzzy search at scale
create index if not exists idx_suppliers_name_trgm
  on public.suppliers using gin (name gin_trgm_ops);

-- updated_at trigger (reuse the helper from previous tickets if it exists)
drop trigger if exists suppliers_touch on public.suppliers;
create trigger suppliers_touch
  before update on public.suppliers
  for each row execute function public.touch_updated_at();
```

### 3.2 RLS

Standard shop-scoped pattern, with `(select ...)` wrapping per v1.8:

```sql
alter table public.suppliers enable row level security;

create policy "suppliers_shop_read" on public.suppliers
  for select using (shop_id = (select public.current_shop_id()));

create policy "suppliers_shop_write" on public.suppliers
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));
```

### 3.3 RPC functions

**`search_suppliers(p_query, p_limit, p_offset)`** — same shape as v1.5's `search_products`. Searches name + contact, returns rows ordered by relevance.

**`recent_suppliers(p_limit)`** — same shape as v1.4's `recent_customers`. Returns most-recently-used suppliers (joined to purchases.created_at) for empty-state dropdown.

**`create_supplier_inline(p_name, p_contact, p_address, p_notes)`** — used by the inline-create flow inside the stock-in form. Returns the new supplier id. Validates uniqueness, raises `duplicate_supplier_name` on conflict (caught by the frontend as a friendly inline error).

### 3.4 Add `supplier_id` to `purchases`

```sql
alter table public.purchases
  add column if not exists supplier_id uuid references public.suppliers(id);

create index if not exists idx_purchases_supplier
  on public.purchases (supplier_id) where supplier_id is not null;
```

`supplier_id` is **nullable** because:
- Opening stock entries (`is_opening = true`) have no real supplier.
- Quick stock-ins from a market trip might not be tied to a tracked supplier.
- Backward compat with existing rows.

The form requires it for non-opening stock-ins; the DB doesn't.

---

## 4. Searchable product picker inside the stock-in form

The current dropdown (presumably loading all products) breaks at 1,000+ products. Replace with the **same combobox pattern v1.4 used for customers and v1.5 for the POS picker** — debounced, server-paginated, fuzzy-search-backed.

**Behavior:**
- Empty state on focus → show 10 most-recently-stocked-in products for this shop. (RPC: `recent_purchase_products(p_limit)` — see §6.3.)
- As user types → debounced 250ms → call `search_products(query, limit=10, offset=0)` from v1.5.
- Each row: name (bold), type badge, stock (current), avg_cost (muted, smaller).
- Footer:
  - "Load more" if last response returned exactly 10.
  - **"+ Create new product"** — opens an inline modal that calls `create_product_with_opening_stock` from v1.5 with `opening_stock = 0` (because the stock-in itself will seed it). On modal save, the new product is auto-selected for the line.

**No `is_active = false` products** in the picker — same as the POS.

**Reuse, don't fork.** This should use the same `<ProductCombobox>` component (or whatever it's named in v1.7's design system) as POS. If POS is using a different shape, refactor to share. Don't ship two parallel implementations.

---

## 5. Bidirectional cost calculation per line item

Each line in the items list has three numeric fields: **qty**, **unit cost**, **line total**. Any two determine the third.

### 5.1 Calculation rules

The **last-edited** field stays put; the **other two** update if they can.

```
edits qty:
  if unit_cost is set → line_total = qty × unit_cost
  else if line_total is set → unit_cost = line_total / qty (qty > 0)

edits unit_cost:
  if qty is set → line_total = qty × unit_cost
  else if line_total is set → qty = line_total / unit_cost (unit_cost > 0)
                              # qty must be integer; round and warn if not exact

edits line_total:
  if qty is set → unit_cost = line_total / qty (qty > 0)
  else if unit_cost is set → qty = line_total / unit_cost (unit_cost > 0)
```

### 5.2 Edge cases

- **Qty must be a positive integer** (the schema constraint already enforces this). If a backwards-computed qty is fractional (e.g., total 1000, unit_cost 333), surface a small warning: "Unit cost doesn't divide evenly into total — adjust qty or unit cost." Don't silently round.
- **Unit cost / line total are numeric(12,2)** so two-decimal precision is the limit. Backwards-computed unit costs round to 2 decimals. If `qty × rounded_unit_cost ≠ line_total`, prefer to **keep line_total exact** and let unit_cost be the rounded display value (since avg_cost calculation later uses line_total / qty internally anyway — see §6.1).
- **Empty inputs**: don't compute. The line is incomplete; the form's submit guard rejects it.
- **Zero values**: qty = 0 isn't allowed (positive int). Unit cost = 0 is allowed (free / sample stock). Line total = 0 follows from unit_cost = 0.

### 5.3 UX details

- The three inputs are grouped visually as one logical unit. When one auto-updates, animate a brief subtle highlight (~200ms color flash) so the user sees what changed. This isn't decoration — it teaches the model.
- Tab order: qty → unit cost → line total → next row. Don't make users tab through computed fields if they don't want to.
- Mobile: stack vertically. Touch targets ≥ 44×44 per v1.7.

---

## 6. Landed cost — the additional-cost question

The user's question: *"I bought 10,000 PKR of stock, paid 9,000 delivery + 4,500 labor. How do I handle this?"*

### 6.1 Recommendation: pro-rata by line value (landed cost)

**This is the standard accounting treatment** — called "landed cost" or "freight-in capitalization." Overhead costs that are necessary to acquire inventory get added to inventory's cost basis, distributed proportionally across the line items they apply to.

**Formula:**
```
items_subtotal = sum(qty × unit_cost) over all lines
total_overhead = sum of all additional cost items

for each line:
  overhead_share = total_overhead × (line_total / items_subtotal)
  overhead_per_unit = overhead_share / qty
  effective_unit_cost = unit_cost + overhead_per_unit
```

**Worked example** (the user's numbers, scaled up):
```
Line 1: iPhone 13, qty 10, unit cost 50,000, line total 500,000
Line 2: iPhone 14, qty 5,  unit cost 80,000, line total 400,000
Items subtotal: 900,000

Overhead:
  Delivery: 9,000
  Labor:    4,500
Total overhead: 13,500

Allocation:
  Line 1 share: 13,500 × (500,000 / 900,000) = 7,500
  Line 2 share: 13,500 × (400,000 / 900,000) = 6,000

Per-unit overhead:
  Line 1: 7,500 / 10 = 750  → effective unit cost = 50,750
  Line 2: 6,000 / 5  = 1,200 → effective unit cost = 81,200

Avg-cost calculation uses 50,750 and 81,200, NOT 50,000 and 80,000.
```

**Why this is the right default:**
- Reflects true unit economics — the iPhone 13 actually cost the shop 50,750, not 50,000.
- Profit calculation downstream (`sale_price − cost_at_sale`) is more accurate.
- The `avg_cost` shown on the product list is what the unit *really* costs.
- Industry-standard for retail/wholesale.

**Why not other options:**
- **Pro-rata by quantity** (each unit gets equal share): only better when overhead correlates with units, not value. For most cases — delivery is cheaper per dollar of high-value goods than per dollar of low-value goods, so by-value is closer to reality.
- **Track as a separate expense** (don't allocate to inventory): undercounts product cost, overstates gross margin. Acceptable in some accounting treatments, but for a shop owner trying to figure out "what should I sell this for?" the answer should already include landed cost.
- **By weight or volume**: most accurate for delivery, but requires per-product weight data we don't have.

### 6.2 Schema

```sql
-- Track overhead items separately so they're auditable + reportable
create table if not exists public.purchase_overhead_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  category text not null check (category in ('delivery', 'labor', 'customs', 'packaging', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_overhead_purchase
  on public.purchase_overhead_items (purchase_id);

-- Snapshot per-line allocation on purchase_items
alter table public.purchase_items
  add column if not exists overhead_per_unit numeric(12,2) not null default 0
    check (overhead_per_unit >= 0);

-- Snapshot avg_cost before and after on purchase_items so the detail view
-- doesn't need to replay history (this is the §10 fix)
alter table public.purchase_items
  add column if not exists avg_cost_before numeric(12,2),
  add column if not exists avg_cost_after  numeric(12,2);

-- Update purchases for clarity. total_cost stays as the single grand total.
alter table public.purchases
  add column if not exists items_subtotal     numeric(12,2) not null default 0
    check (items_subtotal >= 0),
  add column if not exists overhead_subtotal  numeric(12,2) not null default 0
    check (overhead_subtotal >= 0);
-- Invariant maintained by record_purchase: total_cost = items_subtotal + overhead_subtotal
```

> **`is_active` and supplier_id changes already covered** in §3.4 — keep them in the same migration.

### 6.3 `record_purchase` rewrite

Read the current version via MCP first. Then drop and recreate to handle landed cost, supplier, and snapshot avg_cost-before/after.

```sql
create or replace function public.record_purchase(
  p_supplier_id uuid default null,
  p_purchase_date date default current_date,
  p_note text default null,
  p_items jsonb default '[]'::jsonb,
    -- shape: [{"product_id": "...", "qty": 10, "cost_at_purchase": 50000.00}, ...]
  p_overhead_items jsonb default '[]'::jsonb,
    -- shape: [{"category": "delivery", "amount": 9000, "description": "Truck rental"}, ...]
  p_is_opening boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_overhead_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_overhead jsonb;
  v_product record;
  v_overhead_share numeric(12,2);
  v_overhead_per_unit numeric(12,2);
  v_effective_unit_cost numeric(12,2);
begin
  -- Standard guards
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'empty_purchase'; end if;

  -- Validate supplier belongs to shop
  if p_supplier_id is not null then
    perform 1 from public.suppliers
      where id = p_supplier_id and shop_id = v_shop_id and is_active;
    if not found then raise exception 'supplier_not_in_shop'; end if;
  end if;

  -- Compute subtotals
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_items_subtotal := v_items_subtotal
      + (v_item->>'qty')::int * (v_item->>'cost_at_purchase')::numeric;
  end loop;

  for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
    v_overhead_subtotal := v_overhead_subtotal + (v_overhead->>'amount')::numeric;
  end loop;

  -- Insert purchase header
  insert into public.purchases (
    shop_id, supplier_id, total_cost, items_subtotal, overhead_subtotal,
    source, note, purchase_date, cashier_id, is_opening
  ) values (
    v_shop_id,
    p_supplier_id,
    v_items_subtotal + v_overhead_subtotal,
    v_items_subtotal,
    v_overhead_subtotal,
    case when p_is_opening then 'Opening Stock'
         when p_supplier_id is not null then (select name from public.suppliers where id = p_supplier_id)
         else 'Direct purchase' end,
    p_note,
    p_purchase_date,
    v_user_id,
    coalesce(p_is_opening, false)
  ) returning id into v_purchase_id;

  -- Insert overhead items (the audit trail of what costs were applied)
  for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
    insert into public.purchase_overhead_items (purchase_id, category, amount, description)
    values (
      v_purchase_id,
      v_overhead->>'category',
      (v_overhead->>'amount')::numeric,
      v_overhead->>'description'
    );
  end loop;

  -- Process line items: snapshot avg_before, allocate overhead, update WAC, snapshot avg_after
  for v_item in select * from jsonb_array_elements(p_items) loop
    -- Lock product for the WAC update (defense in depth per v1.8)
    select id, stock, avg_cost into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
    for update;

    if not found then raise exception 'product_not_in_shop'; end if;

    -- Compute this line's overhead share (proportional to line value)
    if v_items_subtotal > 0 then
      v_overhead_share := round(
        v_overhead_subtotal
          * ((v_item->>'qty')::int * (v_item->>'cost_at_purchase')::numeric)
          / v_items_subtotal,
        2
      );
    else
      v_overhead_share := 0;
    end if;

    v_overhead_per_unit := round(v_overhead_share / (v_item->>'qty')::int, 2);
    v_effective_unit_cost := (v_item->>'cost_at_purchase')::numeric + v_overhead_per_unit;

    -- Insert purchase_item with all snapshots
    insert into public.purchase_items (
      purchase_id, product_id, qty,
      cost_at_purchase, overhead_per_unit,
      avg_cost_before, avg_cost_after
    ) values (
      v_purchase_id,
      v_product.id,
      (v_item->>'qty')::int,
      (v_item->>'cost_at_purchase')::numeric,
      v_overhead_per_unit,
      v_product.avg_cost,
      -- avg_after computed via WAC using effective unit cost
      case
        when v_product.stock + (v_item->>'qty')::int = 0 then v_product.avg_cost
        when v_product.stock <= 0 then v_effective_unit_cost
        else round(
          (v_product.stock * v_product.avg_cost
           + (v_item->>'qty')::int * v_effective_unit_cost)
          / (v_product.stock + (v_item->>'qty')::int),
          2
        )
      end
    );

    -- Update product: stock + new avg_cost (using effective unit cost) + last_purchase_cost
    update public.products
    set
      stock = stock + (v_item->>'qty')::int,
      avg_cost = case
        when stock + (v_item->>'qty')::int = 0 then avg_cost
        when stock <= 0 then v_effective_unit_cost
        else round(
          (stock * avg_cost + (v_item->>'qty')::int * v_effective_unit_cost)
          / (stock + (v_item->>'qty')::int),
          2
        )
      end,
      last_purchase_cost = (v_item->>'cost_at_purchase')::numeric,
      updated_at = now()
    where id = v_product.id;
  end loop;

  return v_purchase_id;
end;
$$;
```

> **Note on `last_purchase_cost`:** stays as the supplier's quoted unit cost, *not* the effective landed cost. The two columns serve different purposes — `last_purchase_cost` answers "what did I pay the supplier per unit?", `avg_cost` answers "what does this unit really cost me on average?". Don't conflate them.

### 6.4 Backfill

For existing purchases (pre-v1.9):
- `items_subtotal = total_cost`, `overhead_subtotal = 0` (no overhead was tracked).
- `purchase_items.overhead_per_unit = 0`.
- `purchase_items.avg_cost_before` and `avg_cost_after` — these need replay computation, which is doable but tricky. **Pragmatic approach:** for existing rows, leave both as NULL. The detail view shows "—" honestly. New stock-ins from v1.9 onwards have correct snapshots.

```sql
update public.purchases
set items_subtotal = total_cost, overhead_subtotal = 0
where items_subtotal = 0 and overhead_subtotal = 0 and total_cost > 0;
```

### 6.5 Append-only enforcement

Per v1.6/v1.8, financial tables are append-only. Add the enforcement trigger to `purchase_overhead_items` if not already present. Reuse the existing `*_immutable()` pattern.

---

## 7. Stock-in form — full UX spec

### 7.1 Layout

```
┌─ Stock-in details ─────────────────────────────────┐
│  Date *      [____/__/____]                        │
│  Supplier *  [Search supplier...           ▼]      │
│  Note        [_______________________________]      │
└────────────────────────────────────────────────────┘

┌─ Items ────────────────────────────────────────────┐
│  #  Product           Qty  Unit cost  Line total ✕ │
│  1  [Search...   ▼]   10   50,000     500,000    × │
│  2  [Search...   ▼]    5   80,000     400,000    × │
│                                                    │
│  [+ Add another product]                           │
│                                                    │
│  Items subtotal:                          900,000  │
└────────────────────────────────────────────────────┘

┌─ Additional costs (optional)  ⓘ ───────────────────┐
│  #  Category   Description       Amount          ✕ │
│  1  Delivery   Truck rental      9,000           × │
│  2  Labor      Loading/unload    4,500           × │
│                                                    │
│  [+ Add cost]                                      │
│                                                    │
│  Overhead subtotal:                        13,500  │
│                                                    │
│  ⓘ Allocated proportionally across products by    │
│    line value. Affects each product's avg cost.    │
│    See note for details.                           │
└────────────────────────────────────────────────────┘

┌─ Total ────────────────────────────────────────────┐
│  Items subtotal:                          900,000  │
│  Overhead subtotal:                        13,500  │
│  ──────────────────────────────────────────────── │
│  Grand total:                             913,500  │
└────────────────────────────────────────────────────┘

  [ Cancel ]                       [ Save stock-in ]
```

### 7.2 Field rules

- **Date** — defaults to today. Date picker. Cannot be in the future.
- **Supplier** — combobox same shape as customer picker (§3.3 RPCs). Required for non-opening stock-ins. Has "+ Create new supplier" footer item.
- **Note** — free text, optional, max 1000 chars.

**Items list:**
- Always at least one row visible (rendered empty if list is empty).
- Each row has a serial number `#` in the leading column (the user explicitly asked for this — useful for verbal verification of long stock-ins).
- Product field is the combobox from §4.
- Qty/Unit cost/Line total — bidirectional per §5.
- Remove button (`×`) on each row, disabled when only one row exists (must have at least one).
- "+ Add another product" creates a new empty row.

**Additional costs list:**
- Identical structure to items list, but the columns are Category / Description / Amount.
- Category is a `<Select>` with the enum values from §6.2 (Delivery, Labor, Customs, Packaging, Other).
- Optional section — can be empty.

**Totals block** — read-only computed:
- Items subtotal = sum of line totals.
- Overhead subtotal = sum of additional cost amounts.
- Grand total = items subtotal + overhead subtotal.

### 7.3 Submit guards

- At least one item with all three fields filled.
- All qty values are positive integers.
- All cost values are non-negative numeric(12,2).
- If `additional_costs.length > 0`, every overhead row has category and amount set.
- Supplier required (unless `is_opening = true`, which the form doesn't expose — that's only used by the create-product flow from v1.5).

On submit failure, show inline errors next to the affected fields. Don't lose form state.

### 7.4 Submit

One RPC call to `record_purchase` with the new shape. On success, navigate to `/purchases/:id` (the detail view). On failure, show the error message via i18n.

---

## 8. Stock-in list (`/purchases`)

### 8.1 Filters

- **Date range**: presets (MTD default, Last 30 days, Last 90 days, This year, Custom). MTD = first day of current month → today, in user's local timezone.
- **Supplier**: combobox, optional, same shape as the form picker.
- **Includes opening stock**: checkbox, default off (most users want to filter these out). When off, the query excludes `is_opening = true` rows.

URL-driven so refresh + back-button work: `?from=YYYY-MM-DD&to=YYYY-MM-DD&supplier_id=...&page=1&include_opening=0`.

### 8.2 Pagination — server-side, **10 per page**

(v1.5 used 50/page for products. Stock-in is denser per row — supplier + date + total + items count + overhead — so 10 is right.)

Use the same pattern as v1.5:
- One RPC `search_purchases(p_from, p_to, p_supplier_id, p_include_opening, p_limit, p_offset)`.
- One RPC `search_purchases_count(...)` for the total.
- `<DataTable>` from v1.7 handles the rendering.

### 8.3 List columns

| # | Date | Supplier | Items | Items subtotal | Overhead | Total | Note |
|---|---|---|---|---|---|---|---|

- # = serial number per page (1–10).
- Items = count of distinct products (from `purchase_items` aggregate).
- Items subtotal / Overhead / Total — money columns, right-aligned.
- Note — truncated, shows full on hover.

Click row → `/purchases/:id`.

---

## 9. Stock-in detail (`/purchases/:id`) audit + Effect on Inventory fix

### 9.1 The current bug

User reports avg before / avg after not updating in the "Effect on inventory" section. Phase A discovery should confirm root cause; the most likely is one of:

1. **The view computes avg_before/after on-the-fly** by trying to replay history, and the logic is wrong or the "is most recent" check fails.
2. **The columns to snapshot weren't added** in v1.5 — the spec said to compute on-the-fly only for the most recent stock-in per product, with older ones showing "—". If the implementation made every row show "—", that's the bug.

**Fix**: stop replaying history. Snapshot at insert time per §6.2 (`avg_cost_before`, `avg_cost_after` columns on `purchase_items`). Always accurate, always cheap, no replay edge cases.

### 9.2 New layout

```
┌─ Stock-in #abc123  ╳ ──────────────────────────────┐
│  📅 May 15, 2026                                   │
│  🚚 Supplier: Chen's Wholesale                     │
│  👤 Recorded by: ahmed@shop.pk                     │
│  📝 "Monthly stock refill"                         │
└────────────────────────────────────────────────────┘

┌─ Items ────────────────────────────────────────────┐
│  #  Product       Qty  Unit cost  Overhead/u  Eff. cost  Line total │
│  1  iPhone 13     10   50,000     750         50,750     500,000    │
│  2  iPhone 14      5   80,000     1,200       81,200     400,000    │
│                                                                     │
│  Items subtotal:                                          900,000   │
└─────────────────────────────────────────────────────────────────────┘

┌─ Additional costs ─────────────────────────────────┐
│  #  Category   Description           Amount        │
│  1  Delivery   Truck rental          9,000         │
│  2  Labor      Loading/unloading     4,500         │
│                                                    │
│  Overhead subtotal:                       13,500   │
└────────────────────────────────────────────────────┘

┌─ Grand total ──────────────────────────────────────┐
│  Items subtotal:                          900,000  │
│  Overhead subtotal:                        13,500  │
│  Grand total:                             913,500  │
└────────────────────────────────────────────────────┘

┌─ Effect on inventory ──────────────────────────────┐
│  Product       Avg before    Avg after    Δ        │
│  iPhone 13     49,200        49,945       +745     │
│  iPhone 14     78,500        79,750       +1,250   │
└────────────────────────────────────────────────────┘
```

### 9.3 Notes section

If the purchase has notes, render prominently above the items table.

### 9.4 Effect on inventory math

Reads directly from `purchase_items.avg_cost_before` and `avg_cost_after` snapshots. The "Δ" column is `after - before`, color-coded (typically positive — overhead pushes avg_cost up; could be negative if buying at a lower price than current avg).

For pre-v1.9 rows where snapshots are NULL, show "—" in those cells — be honest, don't fabricate.

### 9.5 General UI/UX audit (per `frontend-design` skill)

While in this view, also fix:
- **Money formatting** consistent with v1.7 (Intl.NumberFormat with locale, PKR currency).
- **Date formatting** consistent with v1.7.
- **Table primitive** is the v1.7 `<DataTable>`. If this view was built before v1.7 and uses a custom table, migrate.
- **Loading states** — skeleton rows, not spinners.
- **Empty states** — for opening stocks with no items (shouldn't happen, but defensive).
- **RTL** — verify everything mirrors correctly with `lang="ur"`.

---

## 10. Schema migration order (single file, single transaction)

```sql
-- 00XX_v19_suppliers_landed_cost.sql

-- 1. Suppliers table + RLS + indexes + trigger
-- 2. Add supplier_id to purchases
-- 3. Add items_subtotal, overhead_subtotal to purchases
-- 4. Add overhead_per_unit, avg_cost_before, avg_cost_after to purchase_items
-- 5. Create purchase_overhead_items table + RLS + index
-- 6. Append-only trigger on purchase_overhead_items
-- 7. Backfill purchases.items_subtotal = total_cost where 0
-- 8. Recreate record_purchase function
-- 9. Add search_suppliers, recent_suppliers, create_supplier_inline functions
-- 10. Add search_purchases, search_purchases_count functions
-- 11. Add recent_purchase_products function
```

After applying: regenerate `database.ts`.

---

## 11. Frontend implementation order

1. **Discovery report + skills used in chat** (§Phase A).
2. **CLAUDE.md** created or updated (§2).
3. **Migration applied** (§10), `database.ts` regenerated.
4. **Suppliers screen** (`/suppliers`) — list with search, create form. Use the v1.7 `<DataTable>` and `<Field>` primitives.
5. **`<SupplierCombobox>` component** built once, reused in stock-in form and stock-in list filter.
6. **`<ProductCombobox>` reused** from POS in the stock-in form (or refactored to share if it isn't already shared).
7. **Stock-in form rebuild** per §7. Bidirectional cost calc, additional costs section, totals block, serial-numbered items.
8. **Stock-in list** with date filter, supplier filter, pagination per §8.
9. **Stock-in detail** redesigned per §9. Effect on Inventory reads from snapshots.
10. **i18n pass** — every new string in EN + UR (suppliers, overhead categories, "Effect on inventory", "Avg before / after / Δ", date filter presets, etc.).
11. **Manual smoke test** with two accounts (matrix in §13).
12. **Update CLAUDE.md** with what shipped, any gotcha discovered, remaining items.
13. **Report back** in chat with: schema diff, root cause of Effect on Inventory bug, any spec ambiguities resolved.

---

## 12. i18n keys (additions)

```jsonc
// locales/en/suppliers.json (new)
{
  "title": "Suppliers",
  "fields": {
    "name": "Name",
    "contact": "Contact",
    "address": "Address",
    "notes": "Notes"
  },
  "actions": {
    "new_supplier": "+ New supplier",
    "edit": "Edit",
    "archive": "Archive"
  },
  "errors": {
    "duplicate_name": "A supplier with this name already exists in your shop.",
    "name_required": "Supplier name is required"
  }
}

// locales/en/purchases.json (additions)
{
  "form": {
    "details_title": "Stock-in details",
    "items_title": "Items",
    "overhead_title": "Additional costs (optional)",
    "overhead_help": "Allocated proportionally across products by line value. Affects each product's average cost.",
    "totals_title": "Total",
    "items_subtotal": "Items subtotal",
    "overhead_subtotal": "Overhead subtotal",
    "grand_total": "Grand total",
    "add_product": "+ Add another product",
    "add_cost": "+ Add cost",
    "category": {
      "delivery": "Delivery",
      "labor": "Labor",
      "customs": "Customs",
      "packaging": "Packaging",
      "other": "Other"
    },
    "qty_must_divide_evenly": "Unit cost doesn't divide evenly into total — adjust qty or unit cost.",
    "submit": "Save stock-in",
    "submitting": "Saving…"
  },
  "list": {
    "filter": {
      "date_range": "Date range",
      "mtd": "This month",
      "last_30": "Last 30 days",
      "last_90": "Last 90 days",
      "this_year": "This year",
      "custom": "Custom",
      "supplier": "Supplier",
      "include_opening": "Include opening stock"
    },
    "columns": {
      "date": "Date",
      "supplier": "Supplier",
      "items": "Items",
      "items_subtotal": "Items subtotal",
      "overhead": "Overhead",
      "total": "Total",
      "note": "Note"
    }
  },
  "detail": {
    "header_title": "Stock-in #{{shortId}}",
    "recorded_by": "Recorded by",
    "items": "Items",
    "additional_costs": "Additional costs",
    "grand_total": "Grand total",
    "effect_on_inventory": "Effect on inventory",
    "avg_before": "Avg before",
    "avg_after": "Avg after",
    "delta": "Δ",
    "no_snapshot_help": "Snapshots are recorded for stock-ins from v1.9 onwards. Older entries show \"—\".",
    "service_only": "—"
  }
}
```

Mirror in `locales/ur/*` consistent with prior translations.

---

## 13. Manual test matrix

**Account A — happy paths:**
- Create supplier "Chen's Wholesale" with contact + address. Verify in /suppliers list.
- Open `/purchases/new`. Pick supplier. Add two product lines (use the new combobox; verify search works at 200+ products if seeded).
- Add overhead: 9,000 delivery + 4,500 labor.
- Verify items subtotal, overhead subtotal, grand total compute correctly in real-time.
- Test bidirectional: enter qty=10 + total=500,000 → unit cost auto-fills 50,000. Then change qty to 5 → total recomputes to 250,000.
- Submit. Land on `/purchases/:id`. Verify:
  - Header shows supplier, date, recorder, note.
  - Items table shows qty, unit cost, overhead/u, effective cost, line total.
  - Additional costs table shows the two overhead lines.
  - Totals match the form.
  - **Effect on inventory shows correct avg_before and avg_after.** (This is the headline fix.)

**Account A — edge cases:**
- Stock-in with no overhead — should work; overhead subtotal = 0; no per-line overhead.
- Stock-in with one overhead but no items — should be rejected (`empty_purchase`).
- Bidirectional with non-divisible: qty=3, total=1000 → warning shown.
- Inline create new supplier mid-form — modal opens, save, supplier auto-selected, form state preserved.
- Inline create new product mid-form — same.

**Account A — list & filters:**
- Default load of `/purchases` shows MTD only.
- Switch to "Last 90 days" — more rows appear.
- Toggle "Include opening stock" — opening rows appear/hide.
- Filter by supplier — only that supplier's rows.
- Pagination: with > 10 rows, page 2 works, URL updates.

**Account B (cross-shop):**
- Confirm B's supplier list, recent suppliers RPC, search suppliers RPC, search purchases RPC return zero rows from A.
- B can't reference A's supplier_id by spoofing the form (the function validates supplier-in-shop).

**Reconciliation:**
- After all the test purchases on A, products' `avg_cost` matches what record_purchase computed. Verify on a few products manually with the WAC formula.

---

## 14. Acceptance criteria

- [ ] CLAUDE.md exists at the project root with the structure in §2 and is updated at end of ticket.
- [ ] Skills check completed and documented; appropriate skill (frontend-design or other) used as guidance for UI work.
- [ ] Suppliers table, RLS, RPCs, indexes all in place. Two accounts can't see each other's suppliers.
- [ ] Stock-in form's product picker is a debounced combobox showing 10 results, with fuzzy match, "+ Create new product" footer, and reuses the same component as POS.
- [ ] Stock-in form's supplier picker is a debounced combobox, 10 results, with "+ Create new supplier" footer.
- [ ] Bidirectional cost calculation: editing any 2 of (qty, unit cost, line total) auto-computes the third. Last-edited wins.
- [ ] Additional costs section accepts unlimited rows with category and amount; subtotal computed live.
- [ ] Grand total = items subtotal + overhead subtotal, computed live.
- [ ] Submit invokes `record_purchase` with the new shape and persists overhead items, snapshot avg_cost_before / avg_cost_after, and the supplier link.
- [ ] Each line item's `purchase_items` row stores `cost_at_purchase` (supplier price) and `overhead_per_unit` (allocated overhead) separately; `avg_cost_before` and `avg_cost_after` are populated.
- [ ] Worked example verifies: 10@50,000 + 5@80,000 with 13,500 overhead allocates correctly (7,500 to line 1, 6,000 to line 2). Effective unit costs on the detail view: 50,750 and 81,200.
- [ ] Stock-in list defaults to MTD, paginates 10/page server-side, supports supplier filter and "include opening" toggle, URL-driven.
- [ ] Stock-in detail's "Effect on inventory" section shows accurate avg_before, avg_after, and Δ for stock-ins recorded in v1.9 onwards. For older rows shows "—" with a clear explanatory help text.
- [ ] Stock-in detail uses v1.7 design system primitives (`<DataTable>`, `<Field>`, `<Card>`).
- [ ] Stock-in numbering: each item row shows its serial number (#1, #2, …) in the leading column.
- [ ] No new console errors on any new or modified screen, in either language.
- [ ] All flows from earlier acceptance criteria still pass.
- [ ] CLAUDE.md updated with v1.9 line in the "Versioned PRDs" section, any new gotcha logged, any open todo addressed.

---

## 15. Out of scope for this round

- **Editing or deleting a stock-in after submission.** Append-only per v1.6/v1.8. If a correction is needed, a future "stock adjustment" flow handles it (separate design problem).
- **Per-supplier comparison reports.** Foundation laid in this ticket (`supplier_id` on purchases). UI is a future ticket.
- **By-weight or by-volume overhead allocation.** Pro-rata by line value is the default; the alternative requires per-product weight data we don't have.
- **Toggle to "track overhead as expense instead of allocating to inventory".** Adds UI complexity without clear MVP value. KISS.
- **Supplier balance / payable tracking** (the shop's debt to suppliers). Mirror of the customer khata, but it's its own design.
- **Multi-currency.** Single-currency PKR until further notice.
- **Test infrastructure.** Still skipped per user instruction.

---

*End of v1.9 stock-in hardening + suppliers + landed cost spec.*
