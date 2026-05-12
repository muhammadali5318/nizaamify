# MVP v2.2 — Customer Tiers & Discount Lines

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline) and v1.3–v2.1 specs.
**Stack:** unchanged — React + Supabase (via Supabase MCP) + react-i18next.
**Type:** **Capability addition** — depends on v2.1 being shipped first.
**Realistic effort:** ~1 week.

> **What this solves.** Three real shopkeeper needs around discounts that today are either invisible or awkward:
> 1. **Relationship-rate pricing.** Some customers always pay a different rate ("Ahmed gets the wholesale rate"). Today you adjust each line price manually — works but is error-prone and untracked.
> 2. **Line-specific discounts.** "I'll give you 10% off the phone but not the case." or "This box has a damaged label, take 200 off that one." Line-level reasoning that needs a clear audit trail, separate from a typo'd unit price.
> 3. **Sale-time negotiation that doesn't fit %.** "Round it down, take 50 off the bag" — fixed-amount discounts at the register, on top of any tier rate.
>
> v2.2 introduces **customer tiers** (named percentage groups, applied automatically), **per-line discounts** (% or PKR, optional, per cart line), and **manual override** for tier discount at sale time (% or PKR). All three coexist with a clean, documented stacking order.

---

## 0. How to work this ticket

### Phase A — Discovery

1. **Confirm v2.1 is shipped and stable** before starting. v2.2 doesn't depend on UoM math but does depend on the v1.4 partial-payments shape and v1.6 ledger discipline being firm.
2. **Re-read** `MVP_FIXES_v1.4.md` (customers, partial payments, snapshot pattern), `v1.6.md` (ledger), `v2.1` (stock-in units; confirms `sale_items` has no pack columns), and recent specs. Read `CLAUDE.md`.
3. **Skills check** — `frontend-design` for UI guidance.
4. **Inspect live schema via MCP**:
   - `customers` columns after v1.4.
   - `invoices` columns after v1.4 and v1.6 (`amount_paid`, `notes`, etc.).
   - `sale_items` shape after v2.1 (qty, price_at_sale, cost_at_sale — confirm NO pack columns; v2.1 explicitly leaves sale_items unchanged from v1.4/v1.6).
   - `record_sale` function body — read it before designing the rewrite.
5. **Sample data**:
   ```sql
   select count(*) as customers from public.customers;
   select count(*) as invoices_with_customer
     from public.invoices where customer_id is not null;
   ```
6. **Discovery report in chat** — schema state, plan, then proceed.

### Phase B — Schema migration first

Single migration `00XX_v21_customer_tiers_and_discounts.sql`. Apply via MCP, regenerate `database.ts`.

### Phase C — Backend functions

Update `record_sale` to apply tier discount + line discounts. Add tier management RPCs.

### Phase D — Frontend

Settings page for tier management, customer form update, POS line discount controls, POS totals area, sale-detail rendering.

### Phase E — Verification

Manual smoke test with two accounts. Update CLAUDE.md.

---

## 1. Mental model

### What a tier is
A **named pricing group** with a default percentage discount, scoped to one shop. Examples:
- Walk-in (0%) — the default tier
- Wholesale (5%)
- VIP (3%)
- Staff (10%)

### How discounts compose at sale time
Three discount mechanisms coexist. They stack in this exact order:

```
1. Negotiated unit price (v1.3)        — cashier edits the per-unit price
2. Per-line discount (v2.2, NEW)        — % or PKR off this specific line
3. Tier or override discount (v2.2)     — % or PKR off the items subtotal
```

**Math:**
```
line_subtotal     = qty × price_at_sale     (price already reflects any negotiation)
line_discount     = % × line_subtotal  OR  fixed PKR amount   (capped at line_subtotal)
line_total        = line_subtotal − line_discount

items_subtotal    = Σ line_total

tier_discount     = % × items_subtotal  OR  fixed PKR amount   (capped at items_subtotal)
                    Source: customer's tier, default tier (walk-in), or manual override

total             = items_subtotal − tier_discount + service_charge
```

The **tier discount applies only to items, not service charge** (see §2.2). Per-line discounts also don't touch service charge — there are no "lines" for service.

### Snapshot rule (continuing the v1.x discipline)
Every invoice **snapshots the discount mechanics** at the moment of sale:
- Per-line: `line_discount_type` + `line_discount_value` + `line_discount_amount` on `sale_items`
- Invoice level: `tier_id`, `tier_override_type`, `tier_override_value`, `tier_discount_percent_snapshot`, `tier_discount_amount` on `invoices`

Future tier edits, future product price edits, future per-tier % adjustments — none of these rewrite history.

---

## 2. Design decisions worth flagging

### 2.1 Tier discounts are %-only. Manual overrides are % OR PKR.

**Tiers:** percent only.
A tier represents a relationship rate. "Wholesale gets 5%" is how shopkeepers describe it. A fixed-amount tier ("Wholesale gets 100 off everything") would be a footgun: trivially consumes a small sale, looks ridiculous on a large one. Forcing percent at the tier level keeps tiers semantically clean.

**Manual overrides:** percent or fixed.
At the register, the cashier might want to:
- Apply a custom percent for a special sale ("today only, 15% off")
- Round down to a flat number ("just take 200 off the total")
- Cap a discount at a specific PKR amount ("100 off, that's it")

The override modal supports both modes via a type toggle.

### 2.2 Discounts apply to items only, not service charge

When an invoice has a service charge (v1.4 service-only sales), no discount mechanism touches it.
- Service is labor — discounting labor isn't typically what shopkeepers mean.
- Most service charges are negotiated at entry time anyway; double-discounting feels wrong.

If a real customer asks for "discount on service too" later, that's a one-flag addition. Not now.

### 2.3 Per-line discount is distinct from price editing

v1.3 already lets the cashier edit a line's unit price. So why also add a discount field?

**Audit and reporting.** A line price edit looks like the cashier corrected a wrong price. A discount line looks like a deliberate gift. They mean different things to a shop owner reviewing the day's sales. "How much did we discount this month?" is answerable when discounts are explicit, not when they're hidden in price edits.

**Customer-facing clarity.** A receipt showing "Phone 100,000, less 5,000 discount = 95,000" feels different to the customer than "Phone 95,000." Same money, different perceived value.

**Stacking with tiers.** A line discount for "this specific phone is on sale" naturally stacks with a tier discount for "Ahmed always gets wholesale." Squashing both into a manipulated unit price loses that distinction.

So both mechanisms exist. Cashiers use whichever fits the moment.

### 2.4 Stacking order is fixed and explicit

The order in §1 (negotiated price → line discount → tier discount → service charge added) is fixed. We do **not** support reordering, do **not** support "apply tier first, then line discount on the tier-reduced price." Reasons:
- One canonical order = one set of arithmetic = one set of test cases.
- The chosen order matches the natural mental model: per-line is about that thing; tier is about the whole sale; service is added last.
- Anyone wanting different math can pick the override mechanism that produces the same final number.

### 2.5 Discount % range: 0–100. PKR amounts: 0 to subtotal.

**Percent:**
- 0–100 hard limit (CHECK constraint).
- Soft warning at >30% in the UI ("Are you sure? That's a very high discount").
- Negative percent (= markup) not supported. To charge a tier *more*, set a higher base price and give them 0%.

**Fixed PKR:**
- Cannot exceed the subtotal it's applied to (line subtotal for line discounts, items subtotal for tier override). Function rejects with a friendly error.
- Negative not supported. Same reasoning.

### 2.6 No tier-level price overrides per pack or per product

Already excluded in §10 out-of-scope. Big-retail B2B contract-pricing systems (Oracle Retail, SAP) do per-tier-per-product price tables. For SMB Pakistan, flat-percent + per-line discount + manual override covers ~95% of real cases. The combinatorial complexity of per-product tier pricing isn't worth the engineering for this market.

---

## 3. Schema changes

Single migration `00XX_v21_customer_tiers_and_discounts.sql`.

### 3.1 `customer_tiers` table

```sql
create table if not exists public.customer_tiers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tier_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists uq_tier_shop_name
  on public.customer_tiers (shop_id, lower(trim(name))) where is_active;

create unique index if not exists uq_tier_default_per_shop
  on public.customer_tiers (shop_id) where is_default and is_active;

create index if not exists idx_customer_tiers_shop on public.customer_tiers (shop_id) where is_active;

alter table public.customer_tiers enable row level security;

create policy "tiers_shop_read" on public.customer_tiers
  for select using (shop_id = (select public.current_shop_id()));
create policy "tiers_shop_write" on public.customer_tiers
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

drop trigger if exists customer_tiers_touch on public.customer_tiers;
create trigger customer_tiers_touch
  before update on public.customer_tiers
  for each row execute function public.touch_updated_at();
```

### 3.2 `customers`: add tier reference

```sql
alter table public.customers
  add column if not exists tier_id uuid references public.customer_tiers(id);

create index if not exists idx_customers_tier
  on public.customers (tier_id) where tier_id is not null;
```

### 3.3 `invoices`: tier + override snapshot columns

```sql
alter table public.invoices
  -- Which tier was used. NULL when manually overridden.
  add column if not exists tier_id uuid references public.customer_tiers(id),
  -- The percent that was effectively applied. NULL for fixed-amount overrides.
  add column if not exists tier_discount_percent_snapshot numeric(5,2)
    check (tier_discount_percent_snapshot is null
           or (tier_discount_percent_snapshot >= 0 and tier_discount_percent_snapshot <= 100)),
  -- Final PKR amount of the invoice-level discount (always populated, defaults 0).
  add column if not exists tier_discount_amount numeric(12,2) not null default 0
    check (tier_discount_amount >= 0),
  -- Override metadata. NULL when the customer's tier was used as-is.
  add column if not exists tier_override_type text
    check (tier_override_type is null or tier_override_type in ('percent', 'fixed')),
  -- The user-entered value at override time (% or PKR), preserved for audit.
  add column if not exists tier_override_value numeric(12,2)
    check (tier_override_value is null or tier_override_value >= 0);

-- An override invoice has both type and value; a non-override has neither
alter table public.invoices
  add constraint invoices_tier_override_consistent check (
    (tier_override_type is null and tier_override_value is null)
    or
    (tier_override_type is not null and tier_override_value is not null)
  );

-- An override invoice has tier_id = NULL; a non-override may have tier_id set (or be a walk-in)
alter table public.invoices
  add constraint invoices_tier_override_no_tier_id check (
    tier_override_type is null or tier_id is null
  );

create index if not exists idx_invoices_tier on public.invoices (tier_id) where tier_id is not null;
```

### 3.4 `sale_items`: per-line discount columns

```sql
alter table public.sale_items
  add column if not exists line_discount_type text
    check (line_discount_type is null or line_discount_type in ('percent', 'fixed')),
  add column if not exists line_discount_value numeric(12,2)
    check (line_discount_value is null or line_discount_value >= 0),
  add column if not exists line_discount_amount numeric(12,2) not null default 0
    check (line_discount_amount >= 0);

-- Either a line has a discount (type + value + amount > 0 allowed)
-- or it has no discount (all three fields null/0)
alter table public.sale_items
  add constraint sale_items_line_discount_consistent check (
    (line_discount_type is null and line_discount_value is null and line_discount_amount = 0)
    or
    (line_discount_type is not null and line_discount_value is not null)
  );

-- Percent discounts must be 0-100
alter table public.sale_items
  add constraint sale_items_line_discount_percent_range check (
    line_discount_type is distinct from 'percent'
    or (line_discount_value >= 0 and line_discount_value <= 100)
  );
```

> **`line_discount_amount` cap:** the constraint that `line_discount_amount <= qty × price_at_sale` is enforced **at function level** (not as a SQL CHECK), because it crosses columns and the function has the values at hand.

### 3.5 Seed default tiers per shop

```sql
insert into public.customer_tiers (shop_id, name, discount_percent, is_default, notes)
select s.id, 'Walk-in', 0, true, 'Default tier for walk-in customers'
from public.shops s
where not exists (
  select 1 from public.customer_tiers t
  where t.shop_id = s.id and lower(trim(t.name)) = 'walk-in'
);

insert into public.customer_tiers (shop_id, name, discount_percent, notes)
select s.id, 'Wholesale', 5, 'Resellers and small shopkeepers'
from public.shops s
where not exists (
  select 1 from public.customer_tiers t
  where t.shop_id = s.id and lower(trim(t.name)) = 'wholesale'
);

insert into public.customer_tiers (shop_id, name, discount_percent, notes)
select s.id, 'VIP', 3, 'Loyal regular customers'
from public.shops s
where not exists (
  select 1 from public.customer_tiers t
  where t.shop_id = s.id and lower(trim(t.name)) = 'vip'
);
```

### 3.6 Backfill existing customers

Existing customers get assigned to the shop's default tier (Walk-in, 0% discount). This is a true no-op since Walk-in is 0%:

```sql
update public.customers c
set tier_id = t.id
from public.customer_tiers t
where t.shop_id = c.shop_id
  and t.is_default
  and t.is_active
  and c.tier_id is null;
```

### 3.7 Append-only enforcement

`invoices` and `sale_items` are already append-only per v1.6/v1.8. Verify the trigger covers the new columns. They are immutable post-insert.

---

## 4. Backend functions

### 4.1 Tier management RPCs

**`define_tier(p_name, p_discount_percent, p_is_default, p_notes)`**
- Validates uniqueness within shop (case-insensitive name).
- If `p_is_default = true`, atomically un-defaults any existing default.
- Returns new tier id.

**`update_tier(p_tier_id, p_name, p_discount_percent, p_is_default, p_notes)`**
- All four fields editable.
- If `p_is_default = true`, atomically un-defaults the existing default.
- **Editing `discount_percent` does NOT rewrite historical invoices** — they keep their snapshots.

**`deactivate_tier(p_tier_id)`** — sets `is_active = false`.
- Cannot deactivate a tier that's currently `is_default = true`. Designate another default first.
- Customers on the deactivated tier are reassigned to the default tier (with a row count returned for the UI to show as a toast).

**`set_default_tier(p_tier_id)`** — convenience to atomically swap the default.

### 4.2 `record_sale` rewrite

Read the v2.1 version via MCP. Drop and recreate to apply line discounts + tier discount. The new shape:

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
    --  "line_discount_value": 10 (% or PKR)}
    -- Sales are always in base units per v2.1 — no pack columns on sale_items.
  p_tier_override_type text default null,    -- 'percent' | 'fixed' | null
  p_tier_override_value numeric(12,2) default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_tier_id uuid;
  v_tier_discount_percent_snapshot numeric(5,2);
  v_tier_discount_amount numeric(12,2);
  v_post_discount_items numeric(12,2);
  v_total numeric(12,2);
  v_credit numeric(12,2);
  v_payment_type text;
  v_item jsonb;
  v_product record;
  v_qty int;
  v_line_subtotal numeric(12,2);
  v_line_discount_type text;
  v_line_discount_value numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_total numeric(12,2);
begin
  -- Standard guards
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_amount_paid < 0 then raise exception 'amount_paid_negative'; end if;
  if p_service_charge < 0 then raise exception 'service_charge_negative'; end if;

  -- Validate override params consistency
  if (p_tier_override_type is null) <> (p_tier_override_value is null) then
    raise exception 'override_type_and_value_must_both_be_set_or_neither';
  end if;
  if p_tier_override_type is not null
     and p_tier_override_type not in ('percent', 'fixed') then
    raise exception 'invalid_override_type';
  end if;
  if p_tier_override_type = 'percent'
     and (p_tier_override_value < 0 or p_tier_override_value > 100) then
    raise exception 'override_percent_out_of_range';
  end if;
  if p_tier_override_type = 'fixed' and p_tier_override_value < 0 then
    raise exception 'override_fixed_negative';
  end if;

  -- ============================================================
  -- Pass 1: compute per-line totals (with line discounts)
  -- This pass also validates everything before any DB writes.
  -- ============================================================
  for v_item in select * from jsonb_array_elements(p_items) loop
    -- Compute line subtotal — sales are always in base units per v2.1
    v_line_subtotal := (v_item->>'qty')::int * (v_item->>'price_at_sale')::numeric;

    -- Line discount
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

  -- ============================================================
  -- Resolve tier discount (or override)
  -- ============================================================
  if p_tier_override_type is not null then
    -- Manual override
    v_tier_id := null;
    if p_tier_override_type = 'percent' then
      v_tier_discount_percent_snapshot := p_tier_override_value;
      v_tier_discount_amount := round(v_items_subtotal * p_tier_override_value / 100, 2);
    else
      -- Fixed
      v_tier_discount_percent_snapshot := null;
      if p_tier_override_value > v_items_subtotal then
        raise exception 'override_fixed_exceeds_items_subtotal';
      end if;
      v_tier_discount_amount := p_tier_override_value;
    end if;
  elsif p_customer_id is not null then
    -- Use customer's tier
    select c.tier_id, t.discount_percent
    into v_tier_id, v_tier_discount_percent_snapshot
    from public.customers c
    left join public.customer_tiers t on t.id = c.tier_id and t.is_active
    where c.id = p_customer_id and c.shop_id = v_shop_id;
    -- Customer with no/inactive tier → fall back to default
    if v_tier_discount_percent_snapshot is null then
      select id, discount_percent into v_tier_id, v_tier_discount_percent_snapshot
      from public.customer_tiers
      where shop_id = v_shop_id and is_default and is_active;
    end if;
    v_tier_discount_percent_snapshot := coalesce(v_tier_discount_percent_snapshot, 0);
    v_tier_discount_amount := round(v_items_subtotal * v_tier_discount_percent_snapshot / 100, 2);
  else
    -- Walk-in: use default tier
    select id, discount_percent into v_tier_id, v_tier_discount_percent_snapshot
    from public.customer_tiers
    where shop_id = v_shop_id and is_default and is_active;
    v_tier_discount_percent_snapshot := coalesce(v_tier_discount_percent_snapshot, 0);
    v_tier_discount_amount := round(v_items_subtotal * v_tier_discount_percent_snapshot / 100, 2);
  end if;

  v_post_discount_items := v_items_subtotal - v_tier_discount_amount;
  v_total := v_post_discount_items + p_service_charge;

  -- ============================================================
  -- Payment / customer-required guards (per v1.6)
  -- ============================================================
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
  if p_customer_id is not null then
    perform 1 from public.customers
      where id = p_customer_id and shop_id = v_shop_id;
    if not found then raise exception 'customer_not_in_shop'; end if;
  end if;

  -- ============================================================
  -- Insert invoice with full snapshot
  -- ============================================================
  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type, amount_paid, notes,
    cashier_id,
    tier_id, tier_discount_percent_snapshot, tier_discount_amount,
    tier_override_type, tier_override_value
  ) values (
    v_shop_id, p_customer_id, v_total, p_service_charge, v_payment_type, p_amount_paid, p_notes,
    v_user_id,
    v_tier_id, v_tier_discount_percent_snapshot, v_tier_discount_amount,
    p_tier_override_type, p_tier_override_value
  ) returning id into v_invoice_id;

  -- ============================================================
  -- Pass 2: insert sale_items with full snapshot, decrement stock
  -- Sales are in base units per v2.1 — no pack handling needed
  -- ============================================================
  for v_item in select * from jsonb_array_elements(p_items) loop
    -- Lock product row, validate
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

    -- Recompute line discount (same logic as Pass 1)
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

    -- Decrement stock
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

> **Two correctness anchors:**
> 1. **`v_total` is post-all-discounts.** Payment math, ledger, customer outstanding all use this. A partial payment on a discounted sale creates a ledger debit of the post-discount remainder, which is what the customer actually owes.
> 2. **`cost_at_sale` per line is unaffected by any discount.** Cost is what the unit cost the shop, regardless of selling price. Profit per line is `(line_total) − (cost_at_sale × qty)` — the discount reduces the revenue side of the equation, not the cost side. (Per-line gross margin reports in v3+ may further apportion the tier discount across lines for fully accurate margin attribution. For v2.2 we treat tier discount as an invoice-level deduction.)

### 4.3 Reporting helper view

```sql
create or replace view public.invoice_with_discount_detail as
select
  i.*,
  t.name as tier_name,
  -- Pre-discount items subtotal (computable from existing fields)
  (i.total + i.tier_discount_amount - i.service_charge) as items_subtotal_pre_tier_discount,
  -- Discount source label (for UI rendering)
  case
    when i.tier_override_type = 'percent' then 'manual_override_percent'
    when i.tier_override_type = 'fixed'   then 'manual_override_fixed'
    when i.tier_id is not null            then 'customer_tier'
    else                                       'no_discount'
  end as discount_source
from public.invoices i
left join public.customer_tiers t on t.id = i.tier_id;
```

---

## 5. Frontend changes

### 5.1 Settings → Customer Tiers (new page)

Path: `/settings/tiers`. Tier list, edit, archive, set-default. List shows live customer counts per tier. Soft warning icon for discount > 30%. Walk-in (default) cannot be archived without designating another default first.

### 5.2 Customer create/edit form

Add **Tier** field after phone:

```
Name *      [_______________]
Phone *     [_______________]
Tier        [Walk-in ▼]
Address     [_______________]
Notes       [_______________]
```

- Default for new customers: shop's default tier.
- Tier dropdown shows active tiers, sorted by discount % descending.

### 5.3 POS — line-level controls

Each cart line, on desktop, shows the qty stepper, price (editable per v1.3), and a small **discount affordance** that toggles a compact discount input:

```
─ iPhone 13 case  ──────────  Stock: 12 each ─
  [Each ▼]   Qty: [− 2 +]   Price: [540]    Line: 1,080
                                      ⓘ Add discount

(after clicking "ⓘ Add discount")

─ iPhone 13 case  ──────────  Stock: 12 each ─
  [Each ▼]   Qty: [− 2 +]   Price: [540]    Line: 1,080
   Line discount: ● %  ○ PKR    [10] %        −108
                                                 [×]
   Line total: 972
```

**Behavior:**
- Toggle "Add discount" reveals the controls. Toggle it again (or click ×) to remove the discount entirely (sets type/value/amount back to null/0).
- Type toggle: Percent or PKR (radio).
- Value input: numeric, validated per type (0–100 if %, 0–lineSubtotal if fixed).
- Live computed amount and line total.
- The unit price stays untouched — discount is a separate concept from price (§2.3).

**Mobile:** the line is stacked vertically. Tap the line opens an **Edit line** sheet containing all controls (qty, price, unit, discount). Closes on save. Same data, denser presentation.

### 5.4 POS — totals area

The right-pane totals block:

```
Subtotal (products)        1,200
Tier discount (Wholesale 5%)  −60      ⓘ Override
Service charge        [    200  ]
─────────────────────────────────
Total                      1,340
```

- The tier discount line **only renders when the discount > 0**. Walk-in 0% → no line.
- Label shows tier name + percent for percent discounts. For fixed-amount overrides it shows "Manual override: −200" with no percent.
- "ⓘ Override" link opens the override modal.

#### Override modal

```
Override discount for this sale only

  Discount type:  ● Percentage    ○ Fixed amount
                  
  Value:          [ ___ ] %        (label adjusts based on type)
  
  Items subtotal:        1,200
  Discount:             −60        (live preview)
  Service charge:        200
  Total:                 1,340

  This sale only · The customer's tier returns to default afterwards.

  [ Reset ]    [ Cancel ]    [ Apply override ]
```

**Behavior:**
- Type toggle adjusts the value's unit (% or PKR).
- Live preview shows the computed total below the inputs.
- "Apply override" stores the override on the in-progress sale; the totals area updates.
- "Reset" clears the override; the totals area reverts to the customer's tier (or default).
- The override is **not persisted to the customer** — it applies only to this sale.

### 5.5 Sale detail (`/sales/:id`)

**Items table:**
```
#  Product            Qty   Unit price   Line subtotal   Discount    Line total
1  iPhone 13 case      2        540           1,080      10% (−108)        972
2  Cable USB-C         5         200          1,000          —           1,000
                                                                            ───
                                              Items subtotal:           1,972
```

A "Discount" column is added; renders dash when no line discount, "10% (−108)" or "−200 (fixed)" when present.

**Totals block:**
```
Items subtotal             1,972
Tier discount (Wholesale 5%)  −99      ← snapshot, may differ from current tier %
Service charge                200
─────────────────────────────────
Total                       2,073
Amount paid (cash)            500
On credit                    1,573
```

For overridden invoices: "Manual override (10%)" or "Manual override (fixed)". Hovering the line shows: "Tier at sale time: Wholesale 5%. Customer's current tier: Wholesale 5%."

### 5.6 Customer detail (khata view)

In the header (v1.6), show the current tier as a small chip:
```
Ahmed Khan
+92 300 1234567 · Wholesale (5%)
```

### 5.7 i18n keys (additions)

```jsonc
// locales/en/tiers.json (new)
{
  "title": "Customer Tiers",
  "subtitle": "Customers in each tier automatically get the matching discount on items at checkout.",
  "fields": {
    "name": "Name",
    "discount_percent": "Discount %",
    "is_default": "Default tier",
    "notes": "Notes"
  },
  "labels": {
    "default_badge": "default",
    "customers_count_one": "{{count}} customer",
    "customers_count_other": "{{count}} customers",
    "high_discount_warning": "Are you sure? That's a very high discount.",
    "moved_to_default_one": "{{count}} customer moved to {{tierName}}.",
    "moved_to_default_other": "{{count}} customers moved to {{tierName}}."
  },
  "actions": {
    "new_tier": "+ New tier",
    "edit": "Edit",
    "archive": "Archive",
    "set_default": "Set as default"
  },
  "errors": {
    "duplicate_name": "A tier with this name already exists.",
    "cannot_archive_default": "Set another tier as default first.",
    "discount_out_of_range": "Discount must be between 0 and 100.",
    "name_required": "Name is required."
  }
}

// locales/en/pos.json (additions)
{
  "line": {
    "add_discount": "Add discount",
    "remove_discount": "Remove discount",
    "discount_type": "Line discount",
    "discount_percent_label": "%",
    "discount_fixed_label": "PKR",
    "line_subtotal": "Line subtotal",
    "line_discount": "Line discount",
    "line_total": "Line total"
  },
  "totals": {
    "tier_discount": "Tier discount",
    "tier_discount_with_name": "Tier discount ({{name}} {{percent}}%)",
    "manual_override_percent": "Manual override ({{percent}}%)",
    "manual_override_fixed": "Manual override",
    "override_link": "Override",
    "override_modal_title": "Override discount for this sale only",
    "override_type_label": "Discount type",
    "override_type_percent": "Percentage",
    "override_type_fixed": "Fixed amount",
    "override_value_label": "Value",
    "override_apply": "Apply override",
    "override_reset": "Reset",
    "override_cancel": "Cancel",
    "override_help": "This sale only — the customer's tier returns to default afterwards."
  },
  "errors": {
    "line_discount_percent_out_of_range": "Discount must be between 0% and 100%.",
    "line_discount_exceeds_line": "Discount cannot exceed the line subtotal.",
    "override_percent_out_of_range": "Override percent must be between 0 and 100.",
    "override_fixed_exceeds_items": "Override amount cannot exceed the items subtotal."
  }
}

// locales/en/customers.json (additions)
{
  "fields": {
    "tier": "Tier"
  },
  "tier_chip_label": "{{name}} ({{percent}}%)"
}

// locales/en/sales.json (additions)
{
  "items": {
    "columns": {
      "discount": "Discount",
      "line_subtotal": "Line subtotal",
      "line_total": "Line total"
    },
    "discount_percent_display": "{{percent}}% (−{{amount}})",
    "discount_fixed_display": "−{{amount}} (fixed)",
    "no_discount": "—"
  },
  "totals": {
    "tier_discount": "Tier discount ({{name}} {{percent}}%)",
    "manual_override_percent": "Manual override ({{percent}}%)",
    "manual_override_fixed": "Manual override (fixed)"
  },
  "tooltip": {
    "tier_at_time_of_sale": "Tier at sale time: {{snapshot}}. Customer's current tier: {{current}}."
  }
}
```

Mirror in `locales/ur/*`. "Tier" doesn't have a clean Urdu equivalent; "گاہک کا گروپ" (customer group) or "قیمت کا گروپ" (price group) work — confirm with user. "Discount" is commonly "رعایت" or the loanword "ڈسکاؤنٹ".

---

## 6. Edge cases & defensive notes

- **Customer assigned to a deactivated tier.** Defensive: function falls back to the default tier (§4.2 logic).
- **No default tier exists.** Backfill seeds one. If a user deletes the default's row directly via SQL, the function falls back to 0% rather than crashing.
- **Override with 0%** = explicitly disable any discount. Different from "no override" (use tier). Both produce 0 discount; the audit trail differs.
- **Override percent > 100 or < 0.** Function rejects.
- **Override fixed > items_subtotal.** Function rejects with `override_fixed_exceeds_items_subtotal`.
- **Line discount fixed > line_subtotal.** Function rejects with `line_discount_exceeds_line_subtotal`.
- **Line discount on a service-only sale.** Service-only sales have no items. The cart has zero lines. No line discount possible. Tier discount also evaluates to zero (items subtotal is zero). Service charge stands alone.
- **Tier deleted after a sale.** FK is `references customer_tiers(id)` without ON DELETE CASCADE. Hard-delete is rejected. Use `deactivate_tier`. Historical invoices keep working — the row exists, just inactive.
- **Editing a tier's percent after sales.** Affects future sales only. Past invoices show their snapshot. Verified in §9.8.
- **Line discount + tier discount together.** Stack per §1. Verified in §9.6.
- **Round-half-even.** Postgres `round(numeric, 2)` is banker's rounding. PKR is whole-rupee in practice for most shops, so two-decimal rounding rarely surprises. Document as is.
- **Concurrency: two cashiers, same customer, same time.** Each invoice is a separate transaction with its own snapshot. No contention on the customer/tier rows themselves.
- **A negotiated unit price + per-line discount + tier discount on the same line.** Stacks correctly. Cashier entered a fair price; took 10% off as a per-line gesture; Ahmed's tier 5% applies on top of everything. Each transformation is logged.

---

## 7. Implementation order

1. **Discovery report** in chat.
2. **Migration applied**: tiers table, customer.tier_id, invoice snapshot columns (incl. override type/value), sale_items line discount columns, default-tier seed, customer backfill.
3. **Tier management RPCs**: `define_tier`, `update_tier`, `deactivate_tier`, `set_default_tier`.
4. **Settings → Customer Tiers page** (§5.1). Build before touching POS for testability.
5. **Customer form update** (§5.2) — tier picker.
6. **`record_sale` rewrite** (§4.2) — line discounts + tier discount + override.
7. **POS line discount controls** (§5.3) — per-line discount toggle + inputs (desktop inline / mobile sheet).
8. **POS totals area + override modal** (§5.4).
9. **Sale detail rendering** (§5.5) — discount column on items, snapshot rendering on totals.
10. **Customer detail tier chip** (§5.6).
11. **i18n pass.**
12. **Manual smoke test** (§9 matrix).
13. **Update CLAUDE.md** with v2.2 line.
14. **Report back.**

---

## 8. Acceptance criteria

- [ ] CLAUDE.md updated with v2.2 line.
- [ ] Migration applied; default tiers seeded; existing customers assigned to default tier.
- [ ] **Behavior unchanged for existing customers and existing sales.** Default tier is 0%; pre-v2.2 sale math is identical.
- [ ] **Tiers work end-to-end.** Selecting a customer in POS shows their tier discount line in totals (only when discount > 0). Submit records the snapshot.
- [ ] **Line discounts work end-to-end.** Cashier can add a percent OR fixed line discount per cart line. Discount renders on the cart, on the receipt, and on the sale detail.
- [ ] **Manual override works for percent.** Override modal allows percent input; override is reflected in totals; submit records `tier_override_type='percent'` with snapshot.
- [ ] **Manual override works for fixed.** Override modal type toggle to PKR; override caps at items subtotal; submit records `tier_override_type='fixed'`, `tier_discount_percent_snapshot=null`.
- [ ] **Stacking order verified.** Negotiated unit price → per-line discount → tier discount → service charge added. Math matches the worked examples in §9.
- [ ] **Snapshots are immutable.** Editing a tier's percent does not change historical invoices. Editing a product's price does not change historical line subtotals. Both verified in §9.8.
- [ ] **Bounds enforced everywhere.** Line/tier percent in [0, 100]. Line fixed ≤ line subtotal. Tier override fixed ≤ items subtotal. All friendly errors when violated.
- [ ] **Walk-in (no customer)** sales use the default tier's discount.
- [ ] **Service-only sales** (no items): tier discount = 0; no discount line renders. Per-line discount UI not applicable (no lines).
- [ ] **Partial payment math is post-discount.** Credit balance = post-discount total − amount paid. Verified in §9.7.
- [ ] **Reversal of discounted sale**: ledger entry already reflects post-discount amount → v1.6 reversal flow unchanged.
- [ ] **Archive tier**: customers reassigned to default tier; toast shows count. Cannot archive the current default.
- [ ] **Append-only**: cannot UPDATE or DELETE a sale_item or invoice row directly.
- [ ] **RLS isolates tiers per shop.** Account B cannot see A's tiers, customer assignments, or discounted invoices.
- [ ] All v1.3–v2.1 acceptance criteria still pass.
- [ ] No new console errors in either language.

---

## 9. Manual test matrix

### 9.1 Tier management
- Account A: open `/settings/tiers`. Walk-in / Wholesale / VIP appear with seeded discounts.
- Edit Wholesale to 7%. Save.
- Create new tier "Bulk" 10%. Verify it appears.
- Try to create another "Wholesale" — blocked with friendly error.
- Try to archive Walk-in (default) — blocked.
- Set Bulk as default; archive Walk-in — succeeds; toast shows count of moved customers.

### 9.2 Customer assignment
- Edit existing Ahmed → set tier Wholesale (7%). Save.
- Create Tariq → tier defaults to Bulk.
- Customer detail shows tier chip.

### 9.3 POS sale with tier (no overrides, no line discounts)
- Pick Ahmed (Wholesale 7%). Cart: phone 1,000 × 1, case 500 × 1.
- Items subtotal: 1,500. Tier discount (Wholesale 7%): −105. Service: 200. Total: 1,595.
- Cash 1,595 → submit. Sale detail confirms.

### 9.4 POS walk-in (no customer)
- Clear customer. Bulk is default (10%).
- Cart: 2,000. Tier discount (Bulk 10%): −200. Total: 1,800.

### 9.5 Manual override — percent
- Pick Tariq (Bulk 10%). Cart 2,000.
- Override modal: percent, 0. Apply.
- Discount line disappears. Total: 2,000. Submit.
- Sale detail shows "Manual override (0%)".

### 9.6 Per-line discount + tier — full stack
- Pick Ahmed (Wholesale 7%).
- Add line 1: phone, qty 2, price 1,000. Items only at this point: 2,000.
- Edit line 1: change price to 950 (negotiation). Line subtotal: 1,900.
- Add per-line discount on line 1: percent, 10%. Line discount = 190. Line total = 1,710.
- Add line 2: case, qty 1, price 500. No line discount. Line total = 500.
- Items subtotal: 1,710 + 500 = 2,210.
- Tier discount (Wholesale 7%): −155 (round(2,210 × 0.07, 2) = 154.70).
- Total = 2,055.30. Service charge 0. Submit.
- Sale detail shows: line 1 with "10% (−190)" in discount column; tier discount line "Wholesale 7%" −154.70.

### 9.7 Partial payment with stacked discount
- Pick a customer, 5% tier. Cart total pre-discount items: 1,000.
- Add a per-line fixed discount of 50 to one line. Items subtotal: 950.
- Tier discount: 950 × 0.05 = 47.50. Total: 902.50.
- Pay 500. Credit = 402.50.
- Ledger entry has amount 402.50 (post-all-discounts).

### 9.8 Snapshots survive edits
- After §9.3, edit Wholesale tier to 12%.
- Open Ahmed's prior sale detail — discount line still shows "Wholesale 7%" (snapshot at sale time).
- New sale to Ahmed now uses 12%.
- Edit a product's price; old sale items show old `price_at_sale` snapshot.

### 9.9 Manual override — fixed
- Pick a customer with 10% tier. Cart items subtotal 1,000.
- Override modal: fixed, 250. Apply. Discount: −250. Total: 750.
- Try fixed override of 1,500 — blocked with `override_fixed_exceeds_items_subtotal`.
- Submit the 250 override; sale detail shows "Manual override (fixed) −250".

### 9.10 Edge cases
- Try line fixed discount > line subtotal — blocked.
- Try line percent of 110 — blocked.
- Toggle line discount off after entering — line returns to no-discount state cleanly.
- Service-only sale: try to add a line discount — UI doesn't allow (no line); tier discount evaluates to 0.
- Append-only: directly UPDATE invoices.tier_discount_amount via SQL — blocked by trigger.

### 9.11 Cross-shop isolation
- Account B sees zero of A's tiers, customer assignments, discounted invoices, or override audit trail.

---

## 10. Out of scope for this round

- **Per-product tier price overrides.** Rejected per §2.6.
- **Volume tiers / quantity breakpoints.** "Buy 10+, get 5% off." Future.
- **Time-bounded promotions.** "Wholesale tier gets 7% during November." Future.
- **Per-pack tier overrides.** Out of scope.
- **Discount on service charge.** Items only. Add a flag if a real customer asks.
- **Discount caps.** "Max 500 off per sale." Future, if needed.
- **Negative discounts (markups).** Use higher base prices instead.
- **Multi-tier customers.** One tier per customer.
- **Auto-promotion based on lifetime spend.** Future.
- **Discount-attribution on per-line margin reports.** v3+.
- **Test infrastructure.** Still skipped.

---

*End of v2.2 customer tiers & discount lines spec.*
