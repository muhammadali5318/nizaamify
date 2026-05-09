# MVP Enhancements — v1.4

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline) and `MVP_FIXES_v1.3.md` (avg cost, sales module, khata view).
**Stack:** unchanged — React + Supabase (via Supabase MCP) + react-i18next.

> Patch-on-top spec. The MVP is live. Investigate first, then make the smallest correct change for each item.

---

## 0. How to work this ticket

### Phase A — Discovery (read before writing code)

1. **Re-read `PRD.md` and `MVP_FIXES_v1.3.md`** so the current contract is fresh.
2. **Inspect the live Supabase schema via MCP** — the DB is the source of truth, not the migration files.
   - Confirm what shape `invoices`, `customers`, `ledger_entries`, and the `record_sale` function are in *right now*. v1.3 may or may not have landed exactly as spec'd.
   - List the `payment_type` enum's current values.
   - List indexes on `customers`.
3. **Map the relevant frontend surfaces:**
   - The POS cart submit handler and how it currently calls `record_sale`.
   - The customer picker component(s) — anywhere a customer is selected (POS, sales filters, khata).
   - The customer create form (inline in POS vs. on `/customers`).
   - The sale detail view (`/sales/:id`) — needs to show payment breakdown.
   - The khata detail view (`/customers/:id`) — needs to handle partial-payment debits.
4. **Write a short discovery report in chat** before touching code: "Here's the current state of `record_sale`, here's the customer picker setup, here's my plan." Then proceed.

### Phase B — Schema migration first

Single migration: `00XX_v14_partial_payments_and_customer_search.sql`. Apply via MCP, regenerate `src/types/database.ts`.

### Phase C — Backend functions

Rewrite `record_sale` once to handle the new model. The function is the contract — frontend just sends inputs.

### Phase D — Frontend changes

In the order in §6.

### Phase E — Verification

Manual smoke test with two accounts (cross-shop isolation must still hold). No Playwright / unit tests this round.

---

## 1. Feature scope

### 1.1 Split payments (partial cash + partial credit)

A single sale can mix cash and credit. Example: customer buys 1,000 PKR of goods, pays 500 cash, owes 500 on khata.

**Model decision:** drop the binary `payment_type` mindset. The truth is **how much was paid up front (`amount_paid`)** and the rest is automatically credit.

- `amount_paid = 0` → fully credit
- `amount_paid = total` → fully cash
- `0 < amount_paid < total` → partial
- `amount_paid > total` → invalid, reject
- `amount_paid < 0` → invalid, reject

`payment_type` stays as a derived label on read for display purposes only — extend the enum with `'partial'` so existing code paths that read it still work.

**Customer rules:**
- Fully cash → customer is **optional** (anonymous walk-in OK).
- Fully credit → customer is **required**.
- Partial → customer is **required** (since there's a credit balance to track).

**Ledger rules:**
- Create a `ledger_entries` debit row only when `total - amount_paid > 0`. The amount on that row is `total - amount_paid`, not `total`.
- Pure cash sale → no ledger entry.

### 1.2 Walk-in customers on cash sales

Cash sales should be linkable to a lightweight customer record (just **name + phone**). No address, no notes required. Same `customers` table — those fields are simply optional.

This means: cash sales without a customer → still allowed (true walk-in, no record). Cash sales with a customer → light-touch record. No new table, no `is_walk_in` flag — flags-as-categories age badly. The behavior of a customer is observed (do they have credit history?), not declared.

### 1.3 Customer fields expansion

Extend `customers`:
- `address text null` — optional for cash, recommended for credit.
- `notes text null` — free-text for anything (e.g., "owner's cousin", "always pays on Fridays").

These are the only schema changes for customers. Phone uniqueness within a shop **stays** as the natural identifier.

### 1.4 Edit customer

A customer detail form reachable from:
- `/customers` list (edit icon per row).
- `/customers/:id` (edit button in header).

Same fields as create. Phone change is allowed but must remain unique within the shop (the existing `unique (shop_id, phone)` constraint enforces this — surface the violation as a friendly inline error).

Do **not** allow hard-deleting customers that have any `ledger_entries` or `invoices`. For MVP, just hide the delete button when there's history; for clean customers (no history) allow delete with confirmation. No soft-delete column for now — keep it simple.

### 1.5 Scalable customer picker

The current dropdown loads every customer in the shop. With 1,000+ this dies. Replace with a **searchable, server-paginated combobox**.

**Behavior:**
- On open with empty query → show the **10 most recently used** customers (by latest invoice or ledger activity), then **10 most recent by `created_at`** as fallback if there's no activity yet.
- As the user types → debounce 250ms → query the server with `ILIKE` on `name` and `phone`, limit 10 results.
- "Load more" link at the bottom of the dropdown if more than 10 match (fetches next 10 via offset).
- "+ Add new customer" footer item, **always visible**, opens an inline create modal.
- Empty state: "No customers found. Add a new one?"

**Performance:**
- Add the `pg_trgm` extension and a GIN index on `customers.name` and `customers.phone` for fast substring search at any size.
- Don't write a custom RPC — direct Supabase queries are RLS-scoped and fine. Use:
  ```ts
  supabase
    .from('customers')
    .select('id, name, phone, address')
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .order('name')
    .range(offset, offset + 9);
  ```
  RLS already filters by shop. **Sanitize `q`** — escape `%` and `_` and any single quote — to avoid users typing `%` and accidentally getting full scans, and to prevent injection through the `or` filter string. PostgREST does parameterize, but the `or` filter is a single string assembled client-side, so be defensive.
- For the "most recently used" default list, a small RPC `recent_customers()` is cleaner than a complex client-side query — see §2.4.

### 1.6 Service-only sales + notes

Two related changes:

**(a) Allow zero-item sales with service_charge > 0.**
Customer brings their own broken phone, you only repair it. No products consumed, only labor. Today the POS likely requires at least one cart line. Relax that.

Validation:
- Either `items.length > 0` OR `service_charge > 0` must be true.
- If both are zero/empty → reject ("Sale must have at least one item or a service charge").
- Stock-affecting logic only runs when items are present.

**(b) Free-text notes per invoice.**
Add `invoices.notes text null`. Used for:
- Describing what service was performed ("replaced charging port, cleaned speaker").
- Any other context the cashier wants to record (custom discount reason, customer request, etc.).

Display the note on the sale detail view and (truncated, hover for full) in the sales list.

---

## 2. Schema changes

Single migration `00XX_v14_partial_payments_and_customer_search.sql`. Replace `XX` with the next number after the latest applied migration — confirm via MCP.

### 2.1 `invoices` table

```sql
-- Add the new columns
alter table public.invoices
  add column if not exists amount_paid numeric(12,2) not null default 0
    check (amount_paid >= 0),
  add column if not exists notes text;

-- Backfill amount_paid from existing payment_type
update public.invoices
set amount_paid = case
  when payment_type = 'cash' then total
  when payment_type = 'credit' then 0
  else amount_paid
end
where amount_paid = 0 and payment_type = 'cash';

-- Cross-field constraint: amount_paid cannot exceed total
alter table public.invoices
  add constraint invoices_amount_paid_lte_total
  check (amount_paid <= total);

-- Extend payment_type enum with 'partial' (Postgres requires a separate statement)
alter type public.payment_type_enum add value if not exists 'partial';
```

> The actual enum type name varies by your migration history. Check via MCP first — it might be inline-defined on the column. If it's a `text check (... in (...))` instead of an enum, just update the check constraint to include `'partial'`.

**Relax the customer-required constraint at the DB level:**
- Cash with customer is now legal.
- Partial requires customer.
- Credit requires customer.

Encode in `record_sale` (function-level check), not in a CHECK constraint, because it depends on derived `payment_type`.

### 2.2 `customers` table

```sql
alter table public.customers
  add column if not exists address text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- Trigram index for fast ILIKE search at any size
create extension if not exists pg_trgm;

create index if not exists idx_customers_name_trgm
  on public.customers using gin (name gin_trgm_ops);
create index if not exists idx_customers_phone_trgm
  on public.customers using gin (phone gin_trgm_ops);

-- For "most recently active customer" lookups
create index if not exists idx_ledger_entries_customer_created
  on public.ledger_entries (customer_id, created_at desc);
create index if not exists idx_invoices_customer_created
  on public.invoices (customer_id, created_at desc);
```

Trigger to keep `updated_at` fresh on customers (mirror what other tables do):
```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch
  before update on public.customers
  for each row execute function public.touch_updated_at();
```

If `touch_updated_at` already exists from earlier work, reuse it.

### 2.3 `record_sale` rewrite

Read the current function via MCP first. Then drop and recreate. **Do not** keep two versions side by side.

**New signature** (use named parameters with defaults so the frontend call is readable):

```sql
create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric(12,2) default 0,
  p_service_charge numeric(12,2) default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
  -- p_items shape: [{"product_id": "...", "qty": 2, "price_at_sale": 500.00}, ...]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_total numeric(12,2) := 0;
  v_credit numeric(12,2);
  v_payment_type text;
  v_item jsonb;
  v_product record;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_amount_paid < 0 then raise exception 'amount_paid_negative'; end if;
  if p_service_charge < 0 then raise exception 'service_charge_negative'; end if;

  -- Validate at least one revenue source
  if jsonb_array_length(p_items) = 0 and p_service_charge = 0 then
    raise exception 'empty_sale: a sale must have items or a service charge';
  end if;

  -- Compute total from items + service charge
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_total := v_total
      + (v_item->>'qty')::int
      * (v_item->>'price_at_sale')::numeric;
  end loop;
  v_total := v_total + p_service_charge;

  if p_amount_paid > v_total then
    raise exception 'amount_paid_exceeds_total';
  end if;

  v_credit := v_total - p_amount_paid;

  -- Derive payment_type label
  v_payment_type := case
    when v_credit = 0 then 'cash'
    when p_amount_paid = 0 then 'credit'
    else 'partial'
  end;

  -- Customer rules
  if v_credit > 0 and p_customer_id is null then
    raise exception 'customer_required_for_credit';
  end if;

  if p_customer_id is not null then
    perform 1 from public.customers
      where id = p_customer_id and shop_id = v_shop_id;
    if not found then raise exception 'customer_not_in_shop'; end if;
  end if;

  -- Insert invoice
  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id
  ) values (
    v_shop_id, p_customer_id, v_total, p_service_charge, v_payment_type,
    p_amount_paid, p_notes, v_user_id
  ) returning id into v_invoice_id;

  -- Process items: snapshot price+cost, decrement stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select id, stock, avg_cost into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and shop_id = v_shop_id
    for update;

    if not found then raise exception 'product_not_in_shop'; end if;
    if v_product.stock < (v_item->>'qty')::int then
      raise exception 'insufficient_stock for product %', v_product.id;
    end if;

    insert into public.sale_items (
      invoice_id, product_id, qty, price_at_sale, cost_at_sale
    ) values (
      v_invoice_id,
      v_product.id,
      (v_item->>'qty')::int,
      (v_item->>'price_at_sale')::numeric,
      v_product.avg_cost
    );

    update public.products
    set stock = stock - (v_item->>'qty')::int,
        updated_at = now()
    where id = v_product.id;
  end loop;

  -- Ledger entry only if there's a credit balance
  if v_credit > 0 then
    insert into public.ledger_entries (
      shop_id, customer_id, invoice_id, amount, type
    ) values (
      v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit'
    );
  end if;

  return v_invoice_id;
end;
$$;
```

Frontend calls:
```ts
supabase.rpc('record_sale', {
  p_customer_id: customerId ?? null,
  p_amount_paid: amountPaid,
  p_service_charge: serviceCharge,
  p_notes: notes ?? null,
  p_items: items,  // array of { product_id, qty, price_at_sale }
});
```

### 2.4 `recent_customers` helper (for empty-state dropdown)

```sql
create or replace function public.recent_customers(p_limit int default 10)
returns table (
  id uuid, name text, phone text, address text,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with shop as (select public.current_shop_id() as id)
  select
    c.id, c.name, c.phone, c.address,
    greatest(
      coalesce((select max(created_at) from public.invoices i where i.customer_id = c.id), 'epoch'),
      coalesce((select max(created_at) from public.ledger_entries l where l.customer_id = c.id), 'epoch'),
      c.created_at
    ) as last_activity_at
  from public.customers c, shop
  where c.shop_id = shop.id
  order by last_activity_at desc
  limit greatest(p_limit, 1);
$$;
```

> **Honest note:** the correlated subqueries are fine at MVP scale. With 50K+ invoices per shop they'd get slow — at that point switch to a denormalized `customers.last_activity_at` column updated by triggers. Not now.

---

## 3. Frontend changes

### 3.1 POS — payment composition

Replace the binary "Cash | Credit" toggle with a payment composer.

**Layout** (works in LTR and RTL — use logical properties):
- Cart on the left as today.
- Right-side panel with:
  - Subtotal (computed)
  - Service charge input (numeric, ≥ 0, defaults to 0)
  - **Total** (computed, large)
  - **Amount paid** input (numeric, 0 ≤ x ≤ total)
  - **On credit** (read-only computed: `total − amount_paid`, shown in muted color when 0, accent color when > 0)
  - Two quick-fill buttons next to "Amount paid": **Pay full** (sets to total) and **Pay nothing** (sets to 0). Save the cashier 4 keystrokes per credit sale.
  - Customer picker (see §3.4) — its required state is dynamic:
    - When `amount_paid >= total` → optional ("Walk-in").
    - When `amount_paid < total` → required, picker shows red asterisk and the submit is disabled until set.
  - Notes textarea (optional, multiline, max 1000 chars).
  - Submit button: label changes by composition — "Complete cash sale" / "Complete credit sale" / "Complete partial sale (X paid, Y credit)".

**Validation before submit:**
- At least one item OR service charge > 0.
- Amount paid in [0, total].
- Customer set if there's a credit portion.

**Cart line price editing** (carryover from v1.3) still applies.

### 3.2 Sales list & detail

**`/sales` list:**
- Existing columns stay. Update the **Payment** column to show the new label set: `Cash` / `Credit` / `Partial` (with the partial pill in a third color).
- Add a tooltip on the Payment cell showing `paid X of Y` for partial rows.
- Add a "Has notes" indicator (small icon) when `notes is not null`.
- Filter dropdown for payment type now has four options: All, Cash, Credit, Partial.

**`/sales/:id` detail:**
- Header gets a Notes block when present.
- Totals section restructured:
  ```
  Subtotal (items)        : 800
  Service charge          : 200
  ─────────────────────────────
  Total                   : 1,000
  Amount paid (cash)      : 500
  On credit               : 500   ← link to "View customer khata"
  ```
- For service-only sales (no items), the items table renders as an empty state: "No products — service charge only." with the `notes` field pulled prominently above it.

### 3.3 Customer create/edit form

Single component used in both inline (POS modal) and full-page (`/customers/new`, `/customers/:id/edit`) contexts.

Fields:
- Name (required, 2–100 chars)
- Phone (required, PK phone format from PRD)
- Address (optional, 0–250 chars)
- Notes (optional, 0–1000 chars)

In the **inline** context from POS, render only Name + Phone by default with an "Add address & notes" disclosure that expands the rest. Don't punish the cashier with a long form when they're mid-sale.

On phone uniqueness violation, surface as inline field error: "A customer with this phone already exists in your shop."

### 3.4 Customer picker (combobox)

Build (or replace the existing) customer picker as a controlled combobox.

**Component contract:**
```ts
type CustomerPickerProps = {
  value: string | null;            // customer id
  onChange: (id: string | null) => void;
  required?: boolean;
  // optional: when true, allows clearing back to null (for cash walk-ins)
  clearable?: boolean;
};
```

**Behavior:**
- On focus / open:
  - If query is empty → call `rpc('recent_customers', { p_limit: 10 })`.
  - If query is non-empty → run the ILIKE query (§1.5) with the sanitized term.
- Debounce input by 250ms.
- Show a loading row while fetching.
- Each row: name (bold), phone (muted), address (truncated, second line if present).
- Footer slot:
  - "Load more" if the last fetch returned exactly 10 (use offset pagination).
  - "+ Add new customer" — always visible, opens inline create modal. On modal save, the new customer is auto-selected.
- Keyboard navigation: ↑/↓ to move, Enter to select, Esc to close.
- Mobile: full-screen sheet rather than popover (touch targets matter).

**Implementation notes:**
- A11y: aria-combobox + aria-listbox + aria-activedescendant. Don't roll your own — use Radix UI Combobox or Headless UI Combobox if either is already in the codebase. If not, Radix Combobox is the lower-friction add.
- Cache the last few queries in React Query keyed on the trimmed query string. Stale time 30s — picker reuse is bursty.
- Sanitize the query: escape `%`, `_`, single quote before injecting into the `or` filter string. A small helper:
  ```ts
  const escapeIlike = (s: string) =>
    s.replace(/[\\%_]/g, (m) => `\\${m}`).replace(/'/g, "''");
  ```

### 3.5 Customer list & detail screens

**`/customers` list:**
- Show: name, phone, address (truncated), outstanding balance, last activity date.
- Add a search input that uses the same combobox query.
- Per-row actions: View, Edit. Delete only when `outstanding_balance = 0` AND `invoice_count = 0`.

**`/customers/:id`:**
- Header includes Edit button (→ `/customers/:id/edit`).
- Show address and notes near the contact info.
- Khata table from v1.3 stays.

### 3.6 i18n keys (additions)

```jsonc
// locales/en/pos.json (additions)
{
  "payment": {
    "subtotal": "Subtotal",
    "service_charge": "Service charge",
    "total": "Total",
    "amount_paid": "Amount paid",
    "on_credit": "On credit",
    "pay_full": "Pay full",
    "pay_nothing": "Pay nothing",
    "notes_placeholder": "Optional notes (e.g., service performed)"
  },
  "customer": {
    "walk_in": "Walk-in (no customer)",
    "required_for_credit": "Required for credit or partial sales",
    "add_new": "+ Add new customer",
    "no_results": "No customers found",
    "load_more": "Load more"
  },
  "submit": {
    "cash": "Complete cash sale",
    "credit": "Complete credit sale",
    "partial": "Complete partial sale ({{paid}} paid, {{credit}} credit)"
  },
  "errors": {
    "empty_sale": "Sale must have at least one item or a service charge",
    "amount_exceeds_total": "Amount paid cannot exceed total",
    "customer_required": "Customer is required for credit or partial sales"
  }
}

// locales/en/customers.json (additions)
{
  "fields": {
    "address": "Address",
    "notes": "Notes",
    "address_optional": "Address (optional)",
    "notes_optional": "Notes (optional)"
  },
  "actions": {
    "edit": "Edit customer",
    "delete": "Delete customer",
    "delete_blocked": "Cannot delete — customer has sales or ledger history"
  },
  "errors": {
    "phone_duplicate": "A customer with this phone already exists in your shop"
  },
  "show_more_fields": "Add address & notes"
}

// locales/en/sales.json (additions)
{
  "payment_label": {
    "cash": "Cash",
    "credit": "Credit",
    "partial": "Partial"
  },
  "partial_breakdown": "{{paid}} paid · {{credit}} on credit",
  "service_only": "No products — service charge only",
  "notes_label": "Notes"
}
```

Mirror all in `locales/ur/*` with Urdu translations consistent with the existing terminology (نقد, ادھار for credit, کھاتہ for the ledger). Add a translation for "Partial" — جزوی or نیم ادائیگی both work; pick one and stay consistent.

---

## 4. RLS sanity check

These changes don't add new tables, so RLS shouldn't need new policies. **However**, while you're in the schema:

- Confirm `recent_customers()` is `security definer` and uses `current_shop_id()` — it must not leak across shops.
- Confirm the trigram indexes don't accidentally let queries bypass RLS (they don't — RLS applies regardless of indexes — but verify by testing as Account B).

---

## 5. Out of scope for this round

Don't drift into these — log them as v1.5+ candidates if you spot them:

- Multiple payments over time on a partial sale (e.g., paying 200, then 200, then 100 over weeks). v1.4 captures only the *initial* `amount_paid`. Additional payments still go through the existing `receive_payment` flow against the customer's khata, which already aggregates correctly.
- Per-payment receipts / printed slips.
- Customer merging (duplicates from typos in phone numbers).
- Customer import/export.
- Soft-delete for customers.
- Editing or voiding a sale post-submission.
- A denormalized `customers.last_activity_at` column. Add when scale demands.
- Returns / refunds.
- Test infrastructure (still skipped per user instruction).

---

## 6. Implementation order

1. **Discovery report** in chat (§Phase A). Include the current `record_sale` source you read via MCP and which payment_type representation is in use (enum vs. text+check).
2. **Migration `00XX_v14_*.sql`** applied via MCP — schema changes + `record_sale` rewrite + `recent_customers` + indexes. Regenerate `database.ts`.
3. **Backfill verification:** 3–5 spot-checks that existing `cash` invoices now have `amount_paid = total` and `credit` invoices have `amount_paid = 0`. Verify the constraint fires by trying an over-pay through the function in SQL.
4. **Customer fields** — add `address` + `notes` to forms, list, and detail. Edit flow.
5. **Customer picker** rebuild as combobox with `recent_customers` + ILIKE search + "Add new" footer + load-more.
6. **POS payment composer** — replace the toggle. Wire to new `record_sale` signature. Submit-button label dynamic.
7. **Service-only sales** — relax the cart-required check; ensure submit goes through with empty items + service_charge > 0.
8. **Sales list & detail** updates — Partial label, breakdown row, notes display, service-only empty state.
9. **i18n pass** — every new string in EN + UR. Manual scan for hard-coded strings on the new/changed screens.
10. **Manual smoke test** with two accounts (Account A and Account B):
    - **Sale matrix on A:**
      - Cash sale, no customer (walk-in)
      - Cash sale with linked walk-in customer (name + phone only)
      - Credit sale with full khata customer (name, phone, address, notes)
      - Partial sale (700 paid of 1000, must require customer)
      - Service-only sale (no items, service charge 500, with notes)
      - Partial service-only sale (300 paid of 500 service charge)
    - **Verify on A:**
      - Sales list shows correct labels and breakdowns.
      - Sale detail shows correct totals math.
      - Khata for the credit / partial customers shows linked debits matching the credit portion only (not the full total).
      - Editing a customer updates name/phone/address/notes; phone-uniqueness error is friendly.
      - Customer picker: type to search returns matches; empty state shows recent; "Add new" inline-creates and auto-selects.
    - **Verify on B:**
      - `/customers`, picker, recent list, search results, sales list — none of A's data leaks anywhere.
11. **Report back** with: schema diff, what discovery surfaced, any spec ambiguities you resolved (and how), any unresolved bugs.

---

## 7. Acceptance criteria

The patch is done when **all** of the following hold:

- [ ] A sale can be cash-only, credit-only, partial, or service-only, and each path completes without errors and produces correct DB rows.
- [ ] Partial sale of 1000 (500 paid) creates exactly one `ledger_entries` debit row of **500** (not 1000), linked to the invoice.
- [ ] Cash sales can be linked to a customer with just name + phone, and can also remain a true walk-in (no customer).
- [ ] Credit and partial sales **cannot** be submitted without a customer — the constraint is enforced both client-side (disabled submit) and server-side (function raises).
- [ ] Customers have address and notes fields, both optional. The inline POS create form starts collapsed; the full form on `/customers` shows everything.
- [ ] Customers can be edited from list and detail views. Phone-uniqueness violation surfaces as a friendly inline error, not a 500.
- [ ] Customer picker fetches at most 10 rows per request. Empty state shows the 10 most recently active customers. Search uses trigram-backed ILIKE on name and phone.
- [ ] Picker query is sanitized (a customer named `100%` doesn't crash search; a phone with `_` searches literally).
- [ ] "Load more" appends the next 10 results.
- [ ] "+ Add new customer" footer is always visible and inline-creates without losing the in-progress sale.
- [ ] Service-only sale: zero items + service charge > 0 + notes is accepted, produces an invoice with the right total, and the sale detail renders the service-only empty state.
- [ ] Sales list and detail show the new `Partial` label and breakdown (`paid X of Y`).
- [ ] No new console errors on any new or modified screen, in either language.
- [ ] RLS still isolates shops. Account B sees zero of Account A's data via list, picker, recent, search, or any RPC.

---

*End of v1.4 enhancements spec.*
