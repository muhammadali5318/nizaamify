# MVP v2.8 — Batch Tracking, FEFO, Supplier Warranty & Expiry Alerts

**Audience:** Claude Code
**Companion to:** `PRD.md` and v1.3–v2.7 specs.
**Stack:** unchanged.
**Type:** Capability addition — per-product opt-in.
**Realistic effort:** 2 weeks.
**Prerequisite:** v2.6 (variant refactor) shipped and stable. v2.7 (variant UI) recommended but not strictly required.
**Companion future tickets:** v2.9 (serial tracking — solves mobile panels, premium electronics), v2.10 (inventory adjustments + RTV). Schema choices here MUST avoid trapping either.

> **What this ships.** Per-product opt-in batch tracking. When `products.has_batches = true`, every stock-in records a batch with `batch_no`, `manufactured_date`, `expiry_date`, `supplier_warranty_days`, and `cost_per_unit`. Sales of batched products auto-decrement using **FEFO** (First Expire First Out) — the oldest non-expired batch gets sold first. Cashier can override per cart line if needed. Dashboard surfaces "expiring soon" and "supplier warranty expiring soon" alerts, with shop-level default thresholds and per-product overrides. Non-batched products (cables, cricket bats, the 99% case) work exactly as today.

---

## 0. How to work this ticket

### Phase A — Discovery (mandatory before code)

1. **Confirm v2.6 is shipped.** Run all v2.6 §6 audit queries — must all return zero rows. If any fail, fix v2.6 first.
2. **Read `CLAUDE.md`** and recent fix specs (`v2.6`, `v2.7` if shipped). Read `decisions/` files relevant to variants, append-only ledger discipline, and snapshot patterns.
3. **Skills check** — `frontend-design` for UI work. Check for date-handling or alert-system skills in `/mnt/skills/`.
4. **Inspect live schema via MCP.** Confirm:
   - `product_variants` table from v2.6 (this ticket adds batches keyed on variant_id).
   - `purchase_items.variant_id` populated (per v2.6).
   - `sale_items.variant_id` populated (per v2.6).
   - `invoice_financials` view from v2.6's Stage 2 hardening — batches will need to flow into this view's cost calculation.
5. **Identify candidate test products.** This feature is invisible for shops that don't enable it. Need at least one product flagged `has_batches = true` for testing. If none exists, create one in the test account during setup.
6. **Generate `tasks.md`** entries appending v2.8 phases.
7. **Generate `decisions/`** entries scaffolded (see §14).
8. **Discovery report in chat** — v2.6 audit status, schema state, plan, then proceed.

### Phase B — Schema migration

Single migration `00XX_v28_batch_tracking.sql`. Apply via MCP. Includes the audit-checkpoint pattern.

### Phase C — Backend functions

`record_purchase` updated to handle batch capture for batched products. `record_sale` updated for FEFO decrement. New batch management RPCs. Alert query functions. Updates to `invoice_financials` view.

### Phase D — Frontend

Three major surfaces: stock-in form (batch fields when applicable), POS cart line (batch indicator + override), dashboard expiry/warranty widget.

### Phase E — Verification

Manual smoke test covering batched and non-batched products. FEFO scenarios. Override scenarios. Alert dashboard. Update CLAUDE.md.

---

## 1. Mental model

Three concepts that look related but stay separate:

| Concept | This ticket (v2.8) | Future tickets |
|---|---|---|
| **Batch** — same product, multiple receipts, each with own cost/expiry/warranty | ✅ THIS TICKET | — |
| **Serial** — every individual unit uniquely identified (iPhone IMEI, mobile panel) | ❌ explicitly out of scope | v2.9 |
| **Adjustments / RTV** — what to do with expired or damaged stock | ❌ basic write-off via deactivation only | v2.10 |

A product is **either** batched (v2.8) **or** serialized (v2.9) **or** neither. Mutually exclusive per user decision. Most products are neither — the current behavior is unchanged.

### Per-product opt-in

`products.has_batches = false` by default. The vast majority of products stay this way (cables, cricket bats, mobile chargers, electronics without expiry). The shop owner flips the flag for specific products (cosmetics, food, dairy, medicines, supplements, mobile panels with supplier warranty).

When the flag is true:
- Stock-in captures batch_no, dates, supplier warranty.
- Stock-on-hand is the sum of `qty_remaining` across active batches.
- Sales auto-decrement using FEFO (override allowed per line).
- Dashboard surfaces alerts.
- `avg_cost` becomes a weighted average across active batches (math unchanged from v2.6 weighted-average semantics — each new batch contributes proportionally).

When false:
- Everything works exactly as today / v2.7.

### What "supplier-facing warranty" means here

Per user clarification, the warranty we're tracking is the **supplier-to-shop** warranty — "I bought 50 mobile panels with 3-month warranty from the supplier; I can claim replacements within those 3 months." Not the customer-facing warranty.

This means:
- `supplier_warranty_days` on the batch row, captured at stock-in.
- `warranty_expires_at` = `received_at + supplier_warranty_days` (computed).
- Dashboard alert when warranty is expiring on batches with remaining stock.
- Implication: if a customer returns a defective unit and the shop owner wants to RTV (return to vendor), they have a window to act. RTV workflow is v2.10.

The customer-facing warranty (shop-to-customer commitment) is a separate concept, deferred.

---

## 2. Worked examples

### 2.1 Cosmetics shop (the canonical batch case)

- Product: "Brand X Foundation 30ml"
- `has_batches = true`, shop-level expiry threshold 30 days, per-product override = 60 days (cosmetics expire slowly; 60-day window is more useful)
- Stock-in May 1: 100 units, batch_no `BX-FND-2603`, manufactured 2026-03-01, expiry 2027-03-01, supplier_warranty_days = 0 (no return possible for cosmetics typically).
- Stock-in June 1: 80 more units, batch_no `BX-FND-2605`, manufactured 2026-05-01, expiry 2027-05-01.
- Sells throughout July: each sale decrements the older batch first (`BX-FND-2603`) until exhausted, then `BX-FND-2605`.
- January 2027 dashboard alert: "Brand X Foundation — batch BX-FND-2603 (52 units remaining) expires in 60 days."

### 2.2 Mobile panel shop (supplier warranty case)

- Product: "Generic 6.1" LCD Panel"
- `has_batches = true`
- Stock-in: 50 panels, batch_no `PANEL-2605`, manufactured nullable (panels don't have a manufactured date the supplier shares), expiry nullable (panels don't expire), `supplier_warranty_days = 90`, cost_per_unit 4,000.
- `received_at = 2026-05-15`, so `warranty_expires_at = 2026-08-13`.
- Sells panels throughout May, June, July.
- Dashboard alert on 2026-07-29: "Panel batch PANEL-2605 (12 units remaining) supplier warranty expires in 15 days."
- Shop owner takes action: counts defective stock on hand, contacts supplier for RTV before warranty window closes. (RTV is v2.10 — for now, shop owner just gets the heads-up.)

### 2.3 Dairy / fast-moving expiry

- Product: "Olper's Milk 1L"
- `has_batches = true`, shop-level threshold 30 days, per-product override = 3 days (short shelf life).
- Stock-in: 50 cartons daily.
- Most batches sell out within 3-4 days; alerts fire on whichever batch hasn't moved.
- FEFO ensures oldest milk leaves first naturally.

### 2.4 Cricket bat (NOT batched — control case)

- Product: "Cricket Bat MRF Wizard"
- `has_batches = false`
- Stock-in works exactly as v2.7 (or v2.6). No batch fields. No FEFO logic.
- Sales work exactly as today.
- Dashboard widget doesn't include this product.

The 99% case stays unchanged.

---

## 3. Schema changes

Single migration `00XX_v28_batch_tracking.sql`.

### 3.1 `products` opt-in flag + alert threshold override

```sql
alter table public.products
  add column if not exists has_batches boolean not null default false,
  add column if not exists expiry_alert_days int
    check (expiry_alert_days is null or expiry_alert_days > 0),
    -- per-product override of shop-level default. null = use shop default.
  add column if not exists warranty_alert_days int
    check (warranty_alert_days is null or warranty_alert_days > 0);

-- Mutual exclusion with future has_serials flag — enforced at the application layer
-- when v2.9 ships. For now, only has_batches exists. Document the rule.
```

### 3.2 `shops` shop-level alert defaults

```sql
alter table public.shops
  add column if not exists default_expiry_alert_days int not null default 30
    check (default_expiry_alert_days > 0),
  add column if not exists default_warranty_alert_days int not null default 30
    check (default_warranty_alert_days > 0);
```

### 3.3 `inventory_batches` — new table

```sql
create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
    -- batches are per-variant per v2.6; for single-variant products this points
    -- at the default variant.
  batch_no text not null,
    -- supplier's batch code, or auto-generated if supplier didn't provide one.
    -- See §4.1 for auto-generation pattern.
  purchase_item_id uuid references public.purchase_items(id) on delete set null,
    -- which stock-in line created this batch (audit trail).
  supplier_id uuid references public.suppliers(id),
    -- denormalized for fast alert queries — survives if purchase is archived.
  qty_received int not null check (qty_received > 0),
  qty_remaining int not null check (qty_remaining >= 0),
    -- decrements on sale; never goes negative.
    -- enforced by record_sale's FEFO logic and the v1.6 append-only discipline.
  cost_per_unit numeric(12,2) not null check (cost_per_unit >= 0),
    -- per-base-unit cost INCLUDING v1.9 overhead allocation (landed cost).
    -- snapshot at stock-in. immutable.
  manufactured_date date,
    -- nullable — not all batched products have a known manufactured date.
  expiry_date date,
    -- nullable — not all batched products expire (panels with warranty only).
  supplier_warranty_days int check (supplier_warranty_days is null or supplier_warranty_days >= 0),
    -- e.g., 90 = 90-day window from received_at.
  warranty_expires_at date,
    -- computed at insert: received_at + supplier_warranty_days.
    -- stored rather than computed-on-read to enable fast alert queries.
  received_at date not null default current_date,
  is_active boolean not null default true,
    -- false when batch is fully consumed OR manually deactivated (e.g., expired/damaged).
    -- separate from qty_remaining = 0 (a batch can have qty_remaining = 0 and stay active
    -- briefly for audit; gets deactivated by a periodic cleanup or manual action).
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch_no_not_blank check (length(trim(batch_no)) > 0),
  constraint batch_qty_remaining_lte_received check (qty_remaining <= qty_received)
);

-- Uniqueness: same batch_no twice for the same variant in the same shop is a data entry error
create unique index if not exists uq_batch_variant_batchno
  on public.inventory_batches (variant_id, lower(trim(batch_no))) where is_active;

-- Hot path: FEFO query selects active batches for a variant ordered by expiry, then received
create index if not exists idx_batch_fefo
  on public.inventory_batches (variant_id, expiry_date nulls last, received_at)
  where is_active and qty_remaining > 0;

-- Alert queries: batches expiring soon, warranty expiring soon
create index if not exists idx_batch_expiry_active
  on public.inventory_batches (expiry_date)
  where is_active and qty_remaining > 0 and expiry_date is not null;

create index if not exists idx_batch_warranty_active
  on public.inventory_batches (warranty_expires_at)
  where is_active and qty_remaining > 0 and warranty_expires_at is not null;

create index if not exists idx_batch_variant on public.inventory_batches (variant_id);

alter table public.inventory_batches enable row level security;

-- RLS scoped through variant → product → shop
create policy "batches_shop_read" on public.inventory_batches
  for select using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.shop_id = (select public.current_shop_id())
    )
  );
create policy "batches_shop_write" on public.inventory_batches
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

drop trigger if exists inventory_batches_touch on public.inventory_batches;
create trigger inventory_batches_touch
  before update on public.inventory_batches
  for each row execute function public.touch_updated_at();
```

### 3.4 `sale_items.batch_id` — which batch this line drew from

```sql
alter table public.sale_items
  add column if not exists batch_id uuid references public.inventory_batches(id) on delete restrict;

-- For non-batched products: NULL.
-- For batched products: NOT NULL after the v2.8 record_sale rewrite.
-- Don't enforce NOT NULL at the DB level (legacy rows pre-v2.8 are all NULL).
-- Enforce in the function: when variant.has_batches = true, batch_id must be set.

create index if not exists idx_sale_items_batch
  on public.sale_items (batch_id) where batch_id is not null;
```

### 3.5 `purchase_items.batch_id` — which batch this stock-in created

```sql
alter table public.purchase_items
  add column if not exists batch_id uuid references public.inventory_batches(id) on delete set null;

create index if not exists idx_purchase_items_batch
  on public.purchase_items (batch_id) where batch_id is not null;
```

### 3.6 Auto-deactivation trigger when qty_remaining hits zero

```sql
create or replace function public.batch_auto_deactivate_if_empty() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.qty_remaining = 0 and new.is_active then
    -- Don't auto-deactivate immediately; keep active briefly for audit visibility
    -- A periodic cleanup or manual action deactivates batches that have been empty
    -- for more than 90 days. For now, leave is_active alone here.
    -- (Implementation decision: simpler to let the UI filter on qty_remaining > 0
    --  for "active stock" displays.)
    null;
  end if;
  return new;
end;
$$;

-- No trigger attached — see comment. Decision file documents this.
```

### 3.7 Append-only enforcement

`inventory_batches` is mostly append-only — only `qty_remaining` (decremented by sales), `is_active` (manual deactivation), and `notes` should be mutable post-insert. Enforce via trigger:

```sql
create or replace function public.batch_immutable_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.id is distinct from new.id then raise exception 'batch_id_immutable'; end if;
  if old.variant_id is distinct from new.variant_id then raise exception 'batch_variant_immutable'; end if;
  if old.batch_no is distinct from new.batch_no then raise exception 'batch_no_immutable'; end if;
  if old.qty_received is distinct from new.qty_received then raise exception 'batch_qty_received_immutable'; end if;
  if old.cost_per_unit is distinct from new.cost_per_unit then raise exception 'batch_cost_immutable'; end if;
  if old.manufactured_date is distinct from new.manufactured_date then raise exception 'batch_mfg_date_immutable'; end if;
  if old.expiry_date is distinct from new.expiry_date then raise exception 'batch_expiry_immutable'; end if;
  if old.supplier_warranty_days is distinct from new.supplier_warranty_days then raise exception 'batch_warranty_days_immutable'; end if;
  if old.warranty_expires_at is distinct from new.warranty_expires_at then raise exception 'batch_warranty_date_immutable'; end if;
  if old.received_at is distinct from new.received_at then raise exception 'batch_received_at_immutable'; end if;
  return new;
end;
$$;

drop trigger if exists inventory_batches_immutable on public.inventory_batches;
create trigger inventory_batches_immutable
  before update on public.inventory_batches
  for each row execute function public.batch_immutable_fields();
```

Allowed mutations: `qty_remaining`, `is_active`, `notes`, `updated_at`.

---

## 4. Backend functions

### 4.1 Auto batch number generation

When supplier doesn't provide a batch number, suggest one. Pattern:

```
<SHOP-PREFIX>-<PRODUCT-PREFIX>-<YYMMDD>-<SEQUENCE>
e.g.,  HAFIZ-FND-260605-001
```

A helper function:

```sql
create or replace function public.suggest_batch_no(
  p_variant_id uuid,
  p_received_at date default current_date
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_shop_prefix text;
  v_product_prefix text;
  v_date_part text;
  v_sequence int;
  v_candidate text;
begin
  -- Pull shop name prefix (first 5 alphanumeric chars, uppercase)
  select upper(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))
  into v_shop_prefix
  from public.shops
  where id = (
    select p.shop_id from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = p_variant_id
  );
  v_shop_prefix := substr(coalesce(v_shop_prefix, 'SHOP'), 1, 5);

  -- Product name prefix
  select upper(regexp_replace(p.name, '[^a-zA-Z0-9]', '', 'g'))
  into v_product_prefix
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id;
  v_product_prefix := substr(coalesce(v_product_prefix, 'PROD'), 1, 4);

  v_date_part := to_char(p_received_at, 'YYMMDD');

  -- Find next sequence number for this variant on this date
  select coalesce(max(
    (regexp_match(batch_no, '-(\d+)$'))[1]::int
  ), 0) + 1
  into v_sequence
  from public.inventory_batches
  where variant_id = p_variant_id
    and batch_no like v_shop_prefix || '-' || v_product_prefix || '-' || v_date_part || '-%';

  v_candidate := v_shop_prefix || '-' || v_product_prefix || '-' || v_date_part || '-' || lpad(v_sequence::text, 3, '0');
  return v_candidate;
end;
$$;
```

UI calls this to pre-fill the batch_no field. User can override.

### 4.2 `record_purchase` rewrite

Read v2.6's version (which already handles variants and v2.3's largest-remainder overhead allocation). Extend to handle batches.

Key additions:

```
For each line item:
  If variant's product.has_batches = true:
    Require batch info on the line:
      - batch_no (required; auto-suggested by frontend if user didn't provide)
      - manufactured_date (optional)
      - expiry_date (optional)
      - supplier_warranty_days (optional, defaults to 0)
    Compute warranty_expires_at = received_at + supplier_warranty_days (if days > 0)
    Compute cost_per_unit = (line_total + line_overhead_amount) / qty_in_base
      (using v2.3 largest-remainder math)
    INSERT INTO inventory_batches with these values
    UPDATE purchase_items SET batch_id = <new batch id>
  Else (has_batches = false):
    Unchanged from v2.6 behavior. No batch_id set.
  Update variant.stock and variant.avg_cost as usual.
    avg_cost calculation includes the new batch's cost_per_unit weighted
    by qty_in_base, per existing v2.6 WAC formula. Math is unchanged —
    batches contribute to avg_cost identically to non-batch stock.
```

Items payload extended:

```json
{
  "items": [
    {
      "variant_id": "...",
      "qty": 100,
      "cost_at_purchase": 4000,
      "pack_id": "...",
      "pack_qty": 1,
      "batch": {
        "batch_no": "PANEL-2605",
        "manufactured_date": null,
        "expiry_date": null,
        "supplier_warranty_days": 90
      }
    }
  ]
}
```

The `batch` object is **required** when the variant's product has `has_batches = true`. Function raises `batch_info_required_for_batched_product` otherwise.

### 4.3 `record_sale` rewrite — FEFO

This is the biggest change in this ticket. Read v2.6's record_sale (which already handles variants, line discounts, and sale-level discounts post-v2.3 hardening). Extend for FEFO.

Per cart line:

```
1. Lock the variant FOR UPDATE (per v2.6 — unchanged).
2. Check variant.stock >= qty (per v2.6 — unchanged).
3. If variant.product.has_batches = true:
   a. If cart line provided batch_id (manual override): use that batch.
      Verify batch belongs to variant, is active, has qty_remaining >= qty.
   b. Else: FEFO selection. Pick batches in this order:
      - is_active = true AND qty_remaining > 0
      - Order by: expiry_date ASC NULLS LAST, then received_at ASC, then id ASC.
      - Walk batches in order, allocating qty from each until total qty is satisfied.
        If one batch covers the line: one sale_item row, with batch_id set.
        If multiple batches: split into multiple sale_item rows
          (e.g., line for 10 units across batches with 4 and 6 remaining → 2 rows).
   c. cost_at_sale on each sale_item row = the batch's cost_per_unit
      (NOT variant.avg_cost — this is the v2.8 change to cost_at_sale snapshot logic).
      This ensures invoice_financials profit math uses the actual batch cost.
   d. Decrement each affected batch's qty_remaining.
4. Else (has_batches = false): unchanged from v2.6.
   cost_at_sale = variant.avg_cost (snapshot per v2.6).
   batch_id = NULL.
5. Decrement variant.stock by total qty (unchanged from v2.6).
```

> **Critical correctness rule:** `cost_at_sale` for batched-product lines is the **batch's specific `cost_per_unit`**, not the variant's avg_cost. This is what makes profit accurate when the shop sells from a batch that cost a different price than the rolling average. Document in `decisions/2026-05-12-batch-cost-vs-avg-cost-on-sales.md`.

The line-splitting behavior (a single cart line of 10 units becoming 2 sale_items if it spans two batches) is invisible to the cashier — the receipt and sale detail show one logical line with a note "From batches X and Y" or similar. The data model preserves the truth; the UI summarizes it.

### 4.4 FEFO override at sale time

POS cart line gets an optional **"Pick batch"** affordance (small link, see §5.2). Clicking opens a small popover:

```
Pick batch for Brand X Foundation 30ml

  BX-FND-2603  (52 remaining, expires 2027-03-01) [oldest, default]
  BX-FND-2605  (78 remaining, expires 2027-05-01)
                                          [ Use this batch ]
```

The cashier picks one; the cart line stores `batch_id`. On submit, `record_sale` honors the override.

If the override batch doesn't have enough qty (`qty > qty_remaining`), `record_sale` rejects with `selected_batch_insufficient`. The cashier picks a different batch, or removes the override to let FEFO multi-batch-split.

### 4.5 `invoice_financials` view update (from v2.6 hardening)

The single-source-of-truth view from v2.6's Stage 2 hardening computes profit as `revenue − Σ(cost_at_sale × qty)`. With v2.8, `cost_at_sale` on batched-product sales is the per-batch cost (per §4.3 rule). The view doesn't need a structural change — it already reads `cost_at_sale` from `sale_items`. Profit is automatically accurate.

Verify by inspection: open the view's SQL. Confirm it reads `sale_items.cost_at_sale` directly. No special-case logic for batched products needed.

### 4.6 Expiry and warranty alert queries

Two reportable views for dashboard consumption:

```sql
create or replace view public.batches_expiring_soon as
select
  b.id as batch_id,
  b.batch_no,
  b.qty_remaining,
  b.expiry_date,
  (b.expiry_date - current_date) as days_until_expiry,
  v.id as variant_id,
  p.id as product_id,
  p.name as product_name,
  p.shop_id,
  coalesce(p.expiry_alert_days, s.default_expiry_alert_days) as alert_window_days
from public.inventory_batches b
join public.product_variants v on v.id = b.variant_id
join public.products p on p.id = v.product_id
join public.shops s on s.id = p.shop_id
where b.is_active
  and b.qty_remaining > 0
  and b.expiry_date is not null
  and b.expiry_date - current_date <= coalesce(p.expiry_alert_days, s.default_expiry_alert_days);

create or replace view public.batches_warranty_expiring_soon as
select
  b.id as batch_id,
  b.batch_no,
  b.qty_remaining,
  b.warranty_expires_at,
  (b.warranty_expires_at - current_date) as days_until_warranty_expires,
  b.supplier_id,
  s.name as supplier_name,
  v.id as variant_id,
  p.id as product_id,
  p.name as product_name,
  p.shop_id,
  coalesce(p.warranty_alert_days, sh.default_warranty_alert_days) as alert_window_days
from public.inventory_batches b
join public.product_variants v on v.id = b.variant_id
join public.products p on p.id = v.product_id
join public.shops sh on sh.id = p.shop_id
left join public.suppliers s on s.id = b.supplier_id
where b.is_active
  and b.qty_remaining > 0
  and b.warranty_expires_at is not null
  and b.warranty_expires_at - current_date <= coalesce(p.warranty_alert_days, sh.default_warranty_alert_days)
  and b.warranty_expires_at >= current_date;
  -- Excludes already-expired warranty — those are an "RTV window closed" state
  -- and surface differently (see batches_warranty_already_expired for v2.10).
```

Both views are read by the dashboard widget (§5.5). They respect per-product overrides on the alert window.

### 4.7 Manual batch deactivation

```sql
create or replace function public.deactivate_batch(
  p_batch_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_shop_id uuid := public.current_shop_id();
        v_qty_remaining int;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  -- Verify batch belongs to shop and grab qty_remaining
  select b.qty_remaining into v_qty_remaining
  from public.inventory_batches b
  join public.product_variants v on v.id = b.variant_id
  join public.products p on p.id = v.product_id
  where b.id = p_batch_id and p.shop_id = v_shop_id;

  if not found then raise exception 'batch_not_in_shop'; end if;

  -- If qty_remaining > 0, this is effectively a write-off.
  -- Reduce variant.stock by qty_remaining (the batch's stock disappears).
  -- v2.10 will introduce a formal inventory_adjustments record for this;
  -- for now, do the stock decrement here with a note in the batch.
  if v_qty_remaining > 0 then
    update public.product_variants
    set stock = stock - v_qty_remaining, updated_at = now()
    where id = (select variant_id from public.inventory_batches where id = p_batch_id);
  end if;

  update public.inventory_batches
  set is_active = false,
      qty_remaining = 0,
      notes = case
        when p_reason is null then notes
        when notes is null then 'Deactivated: ' || p_reason
        else notes || E'\n' || 'Deactivated: ' || p_reason
      end,
      updated_at = now()
  where id = p_batch_id;
end;
$$;
```

UI exposes this as "Write off batch" on the batch detail (§5.4). Reasons can be free-text for now ("expired," "damaged," "returned to vendor"). v2.10 will formalize reasons as an enum and add an `inventory_adjustments` table.

> **Note for future v2.10:** when `inventory_adjustments` lands, `deactivate_batch` should be rewritten to insert an adjustment row instead of directly decrementing `variant.stock`. The adjustment becomes the source of truth; stock is computed/cached from adjustments + sales + purchases. For v2.8, direct decrement is acceptable — document the transition path in `decisions/2026-05-12-batch-deactivation-temporary-pattern.md`.

---

## 5. Frontend

### 5.1 Product create/edit form

Add the **Inventory behavior** section near the bottom of the form:

```
─ Inventory behavior ───────────────────────────────────
  ☐ Has batches (track batch numbers, expiry, supplier warranty)

  (when checked, the fields below appear:)

  Expiry alert window  [ ___ days ]    (leave blank for shop default: 30)
  Warranty alert window [ ___ days ]   (leave blank for shop default: 30)
```

**Mutual exclusion preview** (forward compat with v2.9): when v2.9's `has_serials` flag ships, the UI must show the two as mutually exclusive (checking one disables the other). For v2.8, just `has_batches` exists. Document this expected UX in `decisions/`.

**Existing products** can flip `has_batches` from false → true ONLY if `variant.stock = 0` for all variants. Why: existing stock has no batch records; flipping the flag with stock on hand creates orphan inventory that doesn't fit FEFO. The frontend enforces this with a clear error: "Sell or write off existing stock before enabling batch tracking."

Reverse direction (true → false) is allowed only when no active batches exist. Same UX guard.

### 5.2 Stock-in form — batch fields per line

When the variant on a stock-in line has `has_batches = true`, the line expands to show batch fields:

```
#  Product           Unit       Qty   Unit cost  Line total ✕
1  Brand X Foundation Each      100   500        50,000      ×
   ┌─ Batch info ─────────────────────────────────────────┐
   │ Batch no *        [BX-FND-260605-001]   (suggested)  │
   │ Manufactured      [____/__/____]                     │
   │ Expiry *          [____/__/____]                     │
   │ Supplier warranty [0] days                           │
   └──────────────────────────────────────────────────────┘
```

- Batch no is required, pre-filled with `suggest_batch_no` RPC. User can override.
- Manufactured date optional.
- Expiry date marked required IF the user hasn't checked "no expiry" for this batch (small toggle). Cosmetics-without-expiry is unusual but possible for non-perishable items.
- Supplier warranty in days, defaults to 0. If 0, no warranty alerts will fire for this batch.
- For variants with `has_batches = false`, the batch info section doesn't render. Line behaves as v2.6/v2.7.

**For variant-matrix stock-in (per v2.7 §7) of a batched product:** each cell in the matrix needs its own batch info, OR the batch info is captured once at the matrix level and applies to every cell. Most real cases: same supplier shipment → same batch metadata across colors/sizes. So: **one batch info block at the matrix level, applies to all cells.** Document in `decisions/`.

### 5.3 POS cart line — batch indicator and override

For a cart line of a batched product, the line shows a small batch indicator:

```
Product                              Qty   Price       Total
Brand X Foundation                    2    750         1,500   ✕
  Batch BX-FND-260605-001 (oldest)         [Pick batch]
```

- The default state shows the FEFO-selected batch with "(oldest)" label.
- "[Pick batch]" is a small link that opens a batch picker popover (per §4.4 UX).
- After override: "Batch BX-FND-260801-001 (selected)" with a "[Reset to FEFO]" link.
- For non-batched products: no batch line renders.

### 5.4 Product detail page — batch breakdown

v2.5's product detail page (full route at `/products/:id`) gets a new section for batched products:

```
─ Batches ────────────────────────────────────────────
  Active batches (3):

  Batch no              Received    Expiry      Warranty exp  Qty remaining   Cost   Action
  BX-FND-260605-001     Jun 5       Mar 1, 27   —             52 / 100        500    Write off
  BX-FND-260801-001     Aug 1       May 1, 27   —             78 / 80         520    Write off
  BX-FND-261015-001     Oct 15      Jul 15, 27  —             100 / 100       510    Write off

  ─── Inactive batches (5 — collapsed by default) ───
  [+ Show inactive]
```

- Active batches sorted by expiry asc (FEFO order).
- Inactive batches (qty=0 or deactivated) collapsed; expandable.
- "Write off" opens a confirmation dialog. On confirm, calls `deactivate_batch` with a reason field.
- The product header still shows total `stock` summed across active batches.
- Avg cost shown per the variant's `avg_cost` (weighted average across batches).

For non-batched products: this section doesn't render.

### 5.5 Dashboard — expiry & warranty alerts widget

A new dashboard widget aggregates the two alert views:

```
─ Inventory alerts ────────────────────────────────────
  
  ⚠ Expiring soon (5)            [View all]
    Brand X Foundation — batch BX-FND-260605 (52 units) expires in 23 days
    Olper's Milk — batch OLP-MLK-260828 (12 units) expires in 2 days
    ...

  ⚠ Supplier warranty expiring (2)            [View all]
    Generic 6.1" LCD Panel — batch PANEL-2605 (12 units) warranty ends in 8 days
    ...

  ✓ No expired stock currently
```

- Surfaces from `batches_expiring_soon` and `batches_warranty_expiring_soon`.
- Items in each list sorted by urgency (fewest days first).
- "View all" goes to a filtered list (`/inventory/expiring`, `/inventory/warranty`).
- If both lists empty, widget collapses to a positive state.

The widget is **only relevant for shops with at least one batched product**. For shops where no product has `has_batches = true`, hide the widget entirely. Don't show a sad-empty-state "you have no batched products" — that's noise. The widget appears the moment a shop enables their first batched product.

### 5.6 Settings — shop-level alert defaults

In `/settings`, add a small section:

```
─ Inventory alerts ─────────────────────────────────────
  Default expiry alert window   [ 30 ] days
  Default supplier warranty alert window [ 30 ] days

  (per-product overrides available on each product's detail page)
```

Editing these values updates `shops.default_expiry_alert_days` and `shops.default_warranty_alert_days`. Future-dated batches re-evaluate against new thresholds automatically (views compute on read).

### 5.7 Sale detail — show batch info on lines

For sale_item rows with a `batch_id`, display the batch number on the sale detail page:

```
─ Items ──────────────────────────────────────────────
  #  Product                  Qty   Price    Cost   Total
  1  Brand X Foundation        2    750     500     1,500
       Batch BX-FND-260605-001
  2  USB Cable                 5    200     150     1,000
```

(Cost is included in this sample for the audit example; actual UI may or may not show cost per line depending on user role — defer that to a separate decision.)

For multi-batch lines (a single cart line that became 2 sale_item rows because it spanned 2 batches), display as one logical line with both batches noted:

```
  1  Brand X Foundation        10   750     —       7,500
       From batches BX-FND-260605 (4 units) + BX-FND-260801 (6 units)
```

This is the case I flagged in §4.3 — the UI summarizes; the data model preserves the split.

---

## 6. i18n keys (additions)

```jsonc
// locales/en/batches.json (new)
{
  "title": "Batches",
  "fields": {
    "batch_no": "Batch no",
    "manufactured_date": "Manufactured",
    "expiry_date": "Expiry",
    "supplier_warranty_days": "Supplier warranty (days)",
    "qty_received": "Qty received",
    "qty_remaining": "Qty remaining",
    "cost_per_unit": "Cost per unit",
    "received_at": "Received"
  },
  "indicators": {
    "oldest": "oldest",
    "selected": "selected",
    "pick_batch": "Pick batch",
    "reset_to_fefo": "Reset to FEFO",
    "active_batches_count": "{{count}} active batches",
    "inactive_batches_count": "{{count}} inactive batches",
    "show_inactive": "+ Show inactive"
  },
  "actions": {
    "write_off": "Write off",
    "write_off_confirm_title": "Write off batch {{batchNo}}",
    "write_off_confirm_body": "This removes {{qty}} units from stock. Provide a reason.",
    "write_off_reason_label": "Reason",
    "write_off_reason_placeholder": "Expired / Damaged / Returned to vendor / ..."
  },
  "stock_in_section_title": "Batch info",
  "no_expiry_toggle": "No expiry date",
  "errors": {
    "batch_required_for_batched_product": "Batch info is required for this product.",
    "batch_no_required": "Batch number is required.",
    "duplicate_batch_no": "A batch with this number already exists for this product.",
    "cannot_enable_batches_with_stock": "Sell or write off existing stock before enabling batch tracking.",
    "cannot_disable_batches_with_active_batches": "Deactivate all batches before disabling batch tracking.",
    "selected_batch_insufficient": "The selected batch doesn't have enough stock. Pick a different batch or let the system choose."
  }
}

// locales/en/products.json (additions)
{
  "inventory_behavior": {
    "section_title": "Inventory behavior",
    "has_batches_toggle": "Has batches (track batch numbers, expiry, supplier warranty)",
    "has_batches_help": "Enable for products like cosmetics, food, medicines, or anything with supplier warranty.",
    "expiry_alert_days_label": "Expiry alert window (days)",
    "expiry_alert_days_help": "Leave blank for shop default ({{default}} days)",
    "warranty_alert_days_label": "Warranty alert window (days)",
    "warranty_alert_days_help": "Leave blank for shop default ({{default}} days)"
  }
}

// locales/en/dashboard.json (additions)
{
  "inventory_alerts": {
    "title": "Inventory alerts",
    "expiring_soon": "Expiring soon",
    "expiring_soon_count_one": "{{count}} batch",
    "expiring_soon_count_other": "{{count}} batches",
    "warranty_expiring": "Supplier warranty expiring",
    "warranty_expiring_count_one": "{{count}} batch",
    "warranty_expiring_count_other": "{{count}} batches",
    "no_alerts": "No expiry or warranty alerts right now",
    "view_all": "View all",
    "expires_in_days_one": "expires in {{count}} day",
    "expires_in_days_other": "expires in {{count}} days",
    "warranty_ends_in_days_one": "warranty ends in {{count}} day",
    "warranty_ends_in_days_other": "warranty ends in {{count}} days"
  }
}

// locales/en/settings.json (additions)
{
  "inventory_alerts": {
    "section_title": "Inventory alerts",
    "default_expiry_label": "Default expiry alert window (days)",
    "default_warranty_label": "Default supplier warranty alert window (days)"
  }
}

// locales/en/pos.json (additions)
{
  "cart": {
    "batch_label": "Batch",
    "batch_oldest": "oldest",
    "batch_selected": "selected",
    "pick_batch": "Pick batch",
    "reset_to_fefo": "Reset to FEFO",
    "batch_picker_title": "Pick batch for {{productName}}",
    "batch_picker_use": "Use this batch"
  }
}
```

Mirror in `locales/ur/*`. "Batch", "expiry", "warranty" can stay as English loanwords (common in Pakistani Urdu retail context) or get Urdu translations — confirm with user. Recommendation: keep English transliterations since the underlying concepts are loanwords already in the trade vocabulary.

---

## 7. Implementation order

1. **Discovery report** in chat (Phase A).
2. **Append to `tasks.md`** with v2.8 phases.
3. **Migration applied** (§3): products flags, shops defaults, inventory_batches table, sale_items.batch_id, purchase_items.batch_id, immutable trigger, indexes.
4. **Regenerate `database.ts`.**
5. **Backend:**
   - `suggest_batch_no` helper RPC.
   - `record_purchase` rewrite (§4.2) for batch creation.
   - `record_sale` rewrite (§4.3) for FEFO with override and line-splitting.
   - `deactivate_batch` RPC (§4.7).
   - `batches_expiring_soon` and `batches_warranty_expiring_soon` views (§4.6).
   - Verify `invoice_financials` view (from v2.6 Stage 2) reads `cost_at_sale` from `sale_items` correctly — no structural change needed but explicit verification in audit (§9).
6. **Frontend:**
   - Product create/edit form: Inventory behavior section (§5.1).
   - Stock-in form: batch fields per line, matrix-level batch info for variant matrices (§5.2).
   - POS cart line: batch indicator + pick batch popover (§5.3).
   - Product detail page: batches section with write-off (§5.4).
   - Dashboard inventory alerts widget (§5.5).
   - Settings → Inventory alerts defaults (§5.6).
   - Sale detail: batch info on lines (§5.7).
7. **i18n updates** (§6).
8. **Manual smoke test** (§10).
9. **Update `CLAUDE.md`** (§13).
10. **Write decision files** (§14).
11. **Final report in chat** with: screenshots of batched stock-in, FEFO sale, override sale, alert widget, sale detail with batch info; audit query results.

---

## 8. Forward compatibility — what v2.9 and v2.10 will add

This section exists to make the v2.8 schema choices defensible against future tickets. **Do not implement any of this in v2.8.** Listed so Claude Code understands why certain v2.8 decisions look "over-prepared."

### v2.9 — Serial tracking (mobile panels, premium electronics)

- New table `inventory_units` (id, variant_id, serial_no, status, supplier_warranty_days, warranty_expires_at, purchase_item_id, sold_to_sale_item_id, ...)
- `products.has_serials boolean` flag, mutually exclusive with `has_batches`.
- Stock-in for serial products: cashier enters/scans serials.
- Sale of serial products: cashier picks the specific unit (or scans serial).
- `sale_items.unit_id` (FK to inventory_units) — analogous to `sale_items.batch_id`.
- Warranty tracking analogous to batch warranty.

**v2.8 must not preclude v2.9 by:**
- Calling the batch fields anything generic like "lot_id" that would collide. They're explicitly `batch_*`.
- Making `sale_items.batch_id` required at the DB level — would block v2.9 from adding `unit_id` with the same constraint pattern.
- Coupling FEFO logic to other parts of the system in ways that don't generalize. FEFO is for batches; serial selection is per-unit. Two distinct code paths in `record_sale`.

### v2.10 — Inventory adjustments, RTV, formal write-off workflow

- New table `inventory_adjustments` (id, variant_id, batch_id?, unit_id?, qty_change, reason enum, notes, adjusted_at, adjusted_by).
- Reasons: `expired`, `damaged`, `rtv`, `count_correction`, `shrinkage`, plus shop-extensible.
- RTV workflow: select batches/units to return, generate RTV note, track credit pending from supplier.
- `deactivate_batch` is rewritten in v2.10 to create an `inventory_adjustments` row instead of directly decrementing stock.

**v2.8 must not preclude v2.10 by:**
- Hard-coding the deactivation logic in non-replaceable ways. The current `deactivate_batch` function is the v2.8 contract; v2.10 changes its implementation but keeps the signature.
- Storing write-off reasons as free text in a way that prevents enum migration later. The `notes` field is text; v2.10 will introduce a structured `reason` enum.
- Treating variant.stock as the source of truth in ways that conflict with a future "stock = sum of inventory_transactions" model. For v2.8, variant.stock is still authoritative — but the audit query suite (§9) verifies it equals the sum of (purchases − sales) across batches.

---

## 9. Audit queries

Adds to v2.6 Stage 2 audit suite. Run after every batched stock-in and periodically:

```sql
-- Audit 1: variant.stock = sum of qty_remaining across active batches + non-batched stock
-- (For variants with at least one batch, the math should reconcile.)
with batch_totals as (
  select v.id as variant_id,
         coalesce(sum(case when b.is_active and p.has_batches then b.qty_remaining else 0 end), 0) as batch_stock,
         v.stock as variant_stock,
         p.has_batches
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.inventory_batches b on b.variant_id = v.id
  group by v.id, v.stock, p.has_batches
)
select * from batch_totals
where has_batches and variant_stock <> batch_stock;
-- Must return zero rows.

-- Audit 2: every sale_items row of a batched product has a batch_id
select si.id, si.invoice_id, si.variant_id
from public.sale_items si
join public.product_variants v on v.id = si.variant_id
join public.products p on p.id = v.product_id
where p.has_batches and si.batch_id is null
  and si.created_at > '2026-05-12';  -- date when v2.8 ships; older rows are legacy NULL
-- Must return zero rows.

-- Audit 3: invoice_financials profit accuracy with batched products
-- Re-verify the v2.6 Stage 2 invariant against the batch cost source of truth.
-- (Specific shape depends on the invoice_financials view; spirit is: profit matches
--  manual computation for any sale that drew from batches.)

-- Audit 4: no batch has qty_remaining > qty_received
select * from public.inventory_batches where qty_remaining > qty_received;
-- Must return zero rows.

-- Audit 5: batch immutability — check that no UPDATE has touched immutable fields
-- (Implicit — the trigger prevents this. Verify the trigger is attached.)
select tgname from pg_trigger where tgname = 'inventory_batches_immutable';
-- Must return one row.

-- Audit 6: alert views return reasonable counts
select count(*) from public.batches_expiring_soon;
select count(*) from public.batches_warranty_expiring_soon;
-- Sanity: should be plausible (not zero in a shop with batched stock, not 10x the product count).
```

Add all six to the project's audit query suite. Document in CLAUDE.md.

---

## 10. Manual test matrix

### 10.1 Setup
- Account A. Confirm v2.6 audit queries pass.
- Create variant attribute "Volume" with values "30ml", "50ml" (for §10.5).
- Set shop default expiry alert to 30 days, warranty alert to 30 days.

### 10.2 Non-batched product (regression)
- Create "USB Cable", no batch flag. Stock-in 50 at 100 each.
- Verify product detail has no Batches section.
- POS sale 3 cables. Verify cart line has no batch indicator.
- Stock = 47 after sale. `cost_at_sale` = variant.avg_cost (per v2.6).

### 10.3 Batched product creation
- Create "Brand X Foundation 30ml", category Cosmetics, price 750, scan-only OFF, base unit Each.
- In Inventory behavior section, toggle "Has batches" ON.
- Expiry alert window: 60. Warranty alert window: leave blank (uses shop default 30).
- Save.

### 10.4 Stock-in with batch
- Stock-in form, pick "Brand X Foundation". Verify batch fields appear.
- Batch no auto-suggested as "HAFIZ-BRAN-260512-001" or similar. Override to "BX-FND-260512-001".
- Manufactured: leave blank. Expiry: 2027-05-12. Supplier warranty: 0 days.
- Qty: 100. Unit cost: 500.
- No additional overhead. Submit.
- Verify:
  - `inventory_batches` row created with the right fields.
  - `purchase_items.batch_id` set.
  - `variant.stock` = 100, `variant.avg_cost` = 500.
  - Audit 1 reconciles.

### 10.5 Multi-batch FEFO
- Stock-in another 80 units, batch_no "BX-FND-260601-001", expiry 2027-06-01, cost 520.
- variant.stock = 180. avg_cost recomputes via WAC: (100×500 + 80×520) / 180 ≈ 508.89.
- POS sell 60 units. Cart line shows "Batch BX-FND-260512 (oldest)".
- Submit. Verify:
  - sale_item.batch_id = batch1's id.
  - sale_item.cost_at_sale = 500 (the batch's cost, NOT 508.89 the avg).
  - batch1.qty_remaining = 40. variant.stock = 120.

### 10.6 Multi-batch line split
- POS sell 60 more. Cart line shows "Batch BX-FND-260512 (oldest)" by default.
- But qty 60 > batch1.qty_remaining (40). The system splits:
  - Sale_item 1: 40 units at cost 500.
  - Sale_item 2: 20 units at cost 520.
- UI in sale detail shows "From batches BX-FND-260512 (40 units) + BX-FND-260601 (20 units)".
- Verify: batch1.qty_remaining = 0, batch2.qty_remaining = 60, variant.stock = 60.
- Invoice total reflects 60 × 750 = 45,000 (price unchanged regardless of split).
- invoice_financials profit = 45,000 − (40×500 + 20×520) = 45,000 − 30,400 = 14,600.

### 10.7 FEFO override
- POS sell 5 units of Foundation. Default FEFO would pick batch2 (since batch1 is empty).
- Override: pick batch1. System rejects with `selected_batch_insufficient` (batch1.qty_remaining = 0).
- Reset to FEFO. Submit. Verify drawn from batch2.

### 10.8 Try to override to a different shop's batch (cross-shop attack)
- Account B has their own batch with id `xxx`.
- Account A POS, try to pass batch_id = `xxx` via direct RPC.
- Verify rejected.

### 10.9 Toggle has_batches on existing product with stock
- Create "Cricket Bat", no batch. Stock 10.
- Try to flip "Has batches" ON.
- Verify rejected with friendly error: "Sell or write off existing stock before enabling batch tracking."
- Sell all 10. Now flip ON. Verify works.

### 10.10 Supplier warranty alert
- Create "Mobile Panel" with has_batches ON, expiry alert N/A, warranty alert blank (uses shop default 30).
- Stock-in 50 panels, batch_no "PANEL-2605", no expiry, supplier_warranty_days = 90.
- Verify warranty_expires_at = received_at + 90 days.
- Wait or manually set received_at to 65 days ago via direct SQL (test-only).
- Verify dashboard widget shows: "Mobile Panel — batch PANEL-2605 (50 units) warranty ends in 25 days".

### 10.11 Expiry alert
- Foundation batch with expiry 2026-06-10 (assume current date is 2026-05-12, so 29 days out).
- Foundation product has expiry_alert_days = 60.
- Verify dashboard shows the alert.
- Change expiry_alert_days on the product to 14. Verify alert disappears (29 > 14 means no alert).

### 10.12 Write off batch
- Foundation batch1 with qty_remaining = 0. Click "Write off" on product detail.
- Reason: "Expired". Confirm.
- Verify batch1.is_active = false. variant.stock unchanged (qty was 0 anyway).
- Try write-off on batch2 with qty_remaining = 60.
- Reason: "Damaged". Confirm.
- Verify batch2.is_active = false, batch2.qty_remaining = 0, variant.stock decreased by 60.

### 10.13 Variant matrix stock-in (composition with v2.7)
- Foundation with variants: Volume × Color (assume both attributes exist).
- Stock-in matrix mode. Batch info captured once at the matrix level.
- Apply: each non-empty cell creates a purchase_items row tied to the same batch.
- Verify all sale_items from those cells reference the same batch_id.

### 10.14 invoice_financials profit accuracy
- Run audit 3 manually: pick a few invoices that drew from batches. Verify profit matches `revenue − Σ(cost_at_sale × qty)` using batch costs, not avg_cost.

### 10.15 Cross-shop isolation
- Account B sees zero of A's batches, alerts.

---

## 11. Acceptance criteria

- [ ] v2.6 audit queries all pass (Phase A confirmation).
- [ ] `tasks.md` and `decisions/` maintained.
- [ ] CLAUDE.md updated with v2.8 line and gotchas.

**Schema:**
- [ ] `inventory_batches` table exists with RLS, indexes, immutable trigger, immutability for variant_id/batch_no/qty_received/cost/dates/warranty.
- [ ] `products.has_batches`, `products.expiry_alert_days`, `products.warranty_alert_days` columns exist.
- [ ] `shops.default_expiry_alert_days`, `shops.default_warranty_alert_days` columns exist.
- [ ] `sale_items.batch_id`, `purchase_items.batch_id` columns exist with appropriate indexes.

**Non-batched products (regression):**
- [ ] Create, stock-in, sell unchanged from v2.6/v2.7.
- [ ] No batch UI surfaces anywhere for non-batched products.

**Batched product creation:**
- [ ] Inventory behavior section appears on product create/edit form.
- [ ] Toggling has_batches ON shows per-product alert window fields.
- [ ] Cannot enable has_batches on a product with active stock.
- [ ] Cannot disable has_batches on a product with active batches.

**Stock-in:**
- [ ] Batch fields appear for batched products on stock-in lines.
- [ ] Batch number auto-suggested via `suggest_batch_no`; user can override.
- [ ] Manufactured date optional; expiry required (unless "no expiry" toggle); supplier warranty in days.
- [ ] `record_purchase` rejects without batch info for batched products.
- [ ] `warranty_expires_at` computed correctly on insert.
- [ ] Variant matrix stock-in (v2.7) captures one batch per matrix that applies to all cells.

**FEFO sale flow:**
- [ ] Default sale of batched product picks oldest-by-expiry batch automatically.
- [ ] `sale_items.batch_id` populated; `sale_items.cost_at_sale` = batch's `cost_per_unit`.
- [ ] Multi-batch line split works: a single cart line that exceeds one batch creates multiple sale_items.
- [ ] UI summarizes split lines as one logical line on sale detail.
- [ ] `batches.qty_remaining` decremented correctly per affected batch.
- [ ] `variant.stock` decremented by total qty (unchanged from v2.6).

**FEFO override:**
- [ ] "Pick batch" link in cart line opens batch picker popover.
- [ ] Picker shows active batches sorted by FEFO order with qty remaining and expiry.
- [ ] Selecting a batch stores override in cart state.
- [ ] `record_sale` honors the override; rejects with `selected_batch_insufficient` if qty exceeds chosen batch.
- [ ] "Reset to FEFO" link clears the override.

**Profit accuracy:**
- [ ] `invoice_financials.gross_profit` for batched-product sales uses batch's `cost_per_unit`, not variant's avg_cost.
- [ ] Audit 1, 2, 3, 4, 5, 6 (§9) all pass.

**Dashboard alerts:**
- [ ] Inventory alerts widget appears on dashboard when shop has at least one batched product.
- [ ] Widget hidden entirely when no batched products exist.
- [ ] Expiring-soon list respects per-product or shop-default threshold.
- [ ] Warranty-expiring list respects per-product or shop-default threshold.
- [ ] Already-expired warranty excluded from this widget (deferred to v2.10).

**Write-off:**
- [ ] `deactivate_batch` function works; decrements variant.stock if qty_remaining > 0.
- [ ] Write-off button on product detail page with reason field.
- [ ] Inactive batches collapsed by default on product detail.

**Settings:**
- [ ] Shop-level alert defaults editable in `/settings`.
- [ ] Changes reflect in alert widget on next refresh.

**Sale detail:**
- [ ] Batch number shown beneath product name on sale_item rows.
- [ ] Multi-batch lines summarized.

**Backward compatibility:**
- [ ] All v1.3–v2.7 acceptance criteria still pass.
- [ ] Cross-shop RLS confirmed.

**General:**
- [ ] No new console errors.
- [ ] Performance: `record_sale` of a 5-line cart with mixed batched/non-batched products within 10% of pre-v2.8 timings.

---

## 12. Out of scope

- **Serial tracking.** Mobile panels with individual IMEIs/serial numbers. v2.9 — schema must be additive on top of v2.8.
- **Formal inventory adjustments** (expired/damaged/RTV reason enum, adjustment ledger). v2.10.
- **RTV (Return to Vendor) workflow.** v2.10.
- **Customer-facing warranty** (shop-to-customer commitment captured at sale). Separate future feature.
- **Already-expired stock workflow.** Shown in a separate view when v2.10 ships.
- **Bulk batch import.** Future.
- **Batch-level reorder points.** Future.
- **Batch expiry email/SMS notifications.** Dashboard widget only for v2.8. Notifications are infra work.
- **Mutual exclusion enforcement at DB level with has_serials.** v2.9 will add the constraint; v2.8 only has `has_batches`.
- **Test infrastructure.** Still skipped.

---

## 13. CLAUDE.md update

Append to versioned PRDs section:

```
- v2.8: batch tracking (per-product opt-in via has_batches). Stock-in captures batch_no + manufactured + expiry + supplier_warranty_days. Sales use FEFO (First Expire First Out) with manual override per cart line. Dashboard surfaces expiring-soon and supplier-warranty-expiring alerts. Shop-level alert thresholds with per-product override. cost_at_sale on batched-product sales is the batch's cost_per_unit (not variant.avg_cost) for accurate profit per batch.
```

Add to **Open ToDos**:

```
- v2.9 (serial tracking) and v2.10 (inventory adjustments + RTV) are sequenced after v2.8 and dependent on its schema decisions. has_serials flag is reserved on products; mutual exclusion with has_batches enforced at the application layer when v2.9 ships.
- deactivate_batch directly decrements variant.stock. When v2.10 lands, rewrite to insert into inventory_adjustments and let stock derive from the adjustment ledger.
- Notifications (email/SMS) for expiry alerts deferred; dashboard widget is the v2.8 surface.
```

Add to **Gotchas**:

```
- For batched products, sale_items.cost_at_sale is the SPECIFIC BATCH's cost_per_unit, not the variant's avg_cost. This is what makes profit accurate when batches have different costs. invoice_financials view reads cost_at_sale directly so no special-casing is needed in the view, but anyone writing new profit math must respect this rule.
- A single cart line can produce multiple sale_items rows when it spans multiple batches. The UI summarizes ("From batches X + Y"); the data model preserves the split. Don't assume sale_items rows are 1:1 with cart lines.
- FEFO ordering: active batches with qty_remaining > 0, ordered by expiry_date ASC NULLS LAST, then received_at ASC, then id ASC. Use the idx_batch_fefo index.
- Batches are append-only via trigger. variant_id, batch_no, cost_per_unit, dates, warranty_days are immutable. Only qty_remaining, is_active, and notes can be updated.
- Toggle has_batches ON: requires zero stock on the variant. Toggle OFF: requires zero active batches. UI enforces.
- v2.9 and v2.10 schema choices are documented in v2.8 §8 — adding either should not require migrations to v2.8 columns.
```

---

## 14. Decision files to create in `decisions/`

1. `2026-05-12-batches-vs-serials-mutually-exclusive.md` — per-product, not coexistent; rationale.
2. `2026-05-12-fefo-override-ux-pick-batch-link.md` — UX choice B (manual override per line); rationale.
3. `2026-05-12-batch-cost-vs-avg-cost-on-sales.md` — sale_items.cost_at_sale uses batch.cost_per_unit for batched products; explicit decision.
4. `2026-05-12-multi-batch-line-split-data-model.md` — one cart line can become multiple sale_items rows when spanning batches; UI summarizes.
5. `2026-05-12-batch-deactivation-temporary-pattern.md` — deactivate_batch directly decrements variant.stock pending v2.10's inventory_adjustments ledger.
6. `2026-05-12-shop-level-alert-defaults-with-product-overrides.md` — two-level configuration; rationale.
7. `2026-05-12-batch-immutability-rules.md` — which fields are mutable post-insert, which aren't.

Add more as judgment calls surface during implementation.

---

*End of v2.8 spec.*
