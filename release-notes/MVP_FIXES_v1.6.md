# MVP Enhancements — v1.6 (Ledger Hardening)

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline), `MVP_FIXES_v1.3.md`, `v1.4.md`, `v1.5.md`.
**Stack:** unchanged — React + Supabase (via Supabase MCP) + react-i18next.

> Patch-on-top spec focused entirely on the Khata (ledger) subsystem. Investigate first, then make the smallest correct change for each item. **The ledger holds real money. No margin for sloppy migrations or off-by-one balance bugs.**

---

## 0. How to work this ticket

### Phase A — Discovery (read before writing code)

1. **Re-read** previous fix docs if not already loaded this session.
2. **Inspect the live `ledger_entries` table via MCP — this is the most important discovery step.** Run via MCP and report findings before doing anything else:
   ```sql
   -- Exact column list
   select column_name, data_type, is_nullable, column_default
   from information_schema.columns
   where table_schema = 'public' and table_name = 'ledger_entries'
   order by ordinal_position;

   -- Existing constraints
   select conname, pg_get_constraintdef(oid)
   from pg_constraint
   where conrelid = 'public.ledger_entries'::regclass;

   -- Existing triggers
   select tgname, pg_get_triggerdef(oid) from pg_trigger
   where tgrelid = 'public.ledger_entries'::regclass and not tgisinternal;
   ```
   **Specifically report:** does `ledger_entries` have a `notes` column? A `check (amount > 0)` constraint? Any update/delete triggers? The user suspects v1.4's `notes` field landed only on `invoices`, not on `ledger_entries`. Confirm one way or the other.

3. **Read the current `receive_payment` and `record_sale` function bodies** via MCP. We need to know exactly how each writes to `ledger_entries` today.

4. **Map the khata UI:**
   - `/customers` list — how is "outstanding balance" computed today (client-side replay or a computed column)?
   - `/customers/:id` — the entries table layout, what columns exist now.
   - The "Receive payment" form — does it have a notes field, an amount validation, an invoice link?
   - `/sales/:id` — does it show any payment-history section? (v1.3 added a khata panel for credit sales; this is similar but inverted.)

5. **Discovery report in chat** before any code: schema state, the answer to "did `notes` land in `ledger_entries`", current function bodies, current UI structure, plan. Then proceed.

### Phase B — Schema migration first

Single migration: `00XX_v16_ledger_hardening.sql`. Apply via MCP, regenerate `src/types/database.ts`.

### Phase C — Backend functions

Update `receive_payment` (or add it if missing). Add `reverse_ledger_entry`. Add `search_khata_customers`. Add a `ledger_entries_view` view that joins product summaries.

### Phase D — Frontend changes

In the order in §11.

### Phase E — Verification

Manual smoke test with two accounts, including the specific scenarios in §11.13 — overpayment rejection, reversal, invoice linking, balance correctness after each.

---

## 1. Feature scope

### 1.1 Stored running balance on `customers`

Today, every render of `/customers` and `/customers/:id` replays the customer's full ledger history to compute outstanding balance. At ~3 years of activity for an active khata customer (500+ entries), this is wasteful — and the new "Open / Closed" filter in §1.5 needs an indexable balance value to filter on, which a client-side computation can't provide.

Add `customers.outstanding_balance numeric(12,2) not null default 0`, maintained by a trigger on `ledger_entries` insert. The replay logic stays as the audit source of truth — the stored value is for display and filtering. They must always agree; we'll write a periodic reconciliation check (§7).

### 1.2 Notes on ledger entries

Whatever Phase A discovers, the goal is the same: every ledger entry can carry a free-text note. Examples:
- "Paid via bank transfer, ref #1234"
- "Customer disputes — waiting for confirmation"
- "Cash received at shop, no slip"
- For debits: auto-filled from invoice context if useful (e.g., `"Sale #abc123"`), but editable.

If `ledger_entries.notes` already exists, verify `receive_payment` actually writes to it. If it doesn't exist, add it.

### 1.3 Reversal mechanism

Replace any "delete ledger entry" affordance with a **reversal**. In accounting, you never destroy an entry — you record an equal-and-opposite entry that nets to zero, with a pointer to what's being reversed.

Add `ledger_entries.reverses_entry_id uuid null references ledger_entries(id)`. When the cashier reverses an entry:
- A new entry is inserted with the **opposite** type, **same** amount, **same** customer, `reverses_entry_id = original.id`, and an auto-prefilled note like `"Reversal of #shortId"` (editable).
- The original entry stays untouched.
- The balance trigger handles both inserts naturally — net effect on balance is zero.

UI behavior:
- The reversed-original entry shows with a "Reversed" badge and a link to the reversal entry.
- The reversal entry shows with a "Reversal" badge and a link to the original.
- Once reversed, an entry cannot be reversed again — the "Reverse" button is hidden on already-reversed entries.

### 1.4 `occurred_at` for ledger entries

Today, debit entries' "when did this happen" is implicit (the linked invoice's `created_at`); only credit entries have an explicit `paid_at`. Asking "what did the customer owe at 3pm on March 15?" requires correlating two tables.

Add `ledger_entries.occurred_at timestamptz not null default now()`, populated for both debits and credits. Backfill from `created_at` for existing rows. `paid_at` stays for back-compat but is now redundant; deprecate in code (don't write to it from new flows). Drop in a future migration after audit.

This is the field used for ledger ordering, ageing reports, and the (eventual) "balance as of date X" query.

### 1.5 Khata filters and fuzzy search

The khata list (`/customers` or wherever the khata view lives) currently disappears closed accounts because zero-balance customers aren't filterable. Add a filter dropdown plus a search.

**Filter dropdown** — three options:
- **Open** (default) — `outstanding_balance > 0`
- **Closed** — `outstanding_balance = 0` AND has at least one ledger entry historically
- **All** — has at least one ledger entry historically (open ∪ closed)

The "has ledger history" check matters because we don't want to show every customer ever created — the khata view is for customers with credit history. Walk-in cash-only customers (from v1.4) shouldn't appear here unless they've had a credit transaction at some point.

**Fuzzy search** — same engine as v1.4's customer picker (`pg_trgm` already installed). Searches name and phone, trigram-indexed.

These combine: filter first, then search within the filtered set.

### 1.6 Overpayment validation

Today, the receive-payment form accepts any amount. Customer owes 100 PKR; cashier types 5,000; balance goes to −4,900; the customer disappears from the open-khata view because their balance is no longer positive. The shop has effectively lost track of money it might owe back.

Two-layer fix:
- **Database-level reject:** `receive_payment` raises an exception if `p_amount > customer.outstanding_balance` (or, when linking to an invoice, if `p_amount > invoice.remaining_outstanding`).
- **UI-level prevention:** the amount input is capped at the customer's outstanding (or invoice's remaining outstanding when linked); the form shows the cap as a hint ("Max: 100"); submit is disabled if the value exceeds the cap.

> **Honest caveat — advance payments are out of scope.** A real shop sometimes wants to take an advance ("here's 500 toward whatever I buy next month"). That's a separate flow with its own UX (a credit-balance state on the customer, redeemable at next sale). Not in v1.6. The strict overpayment rejection is the right MVP behavior; if the shop owner asks for advances, we design that properly in a future round rather than rationalizing negative balances.

### 1.7 Optional payment-to-invoice linking

When receiving a payment, the cashier can optionally pick a specific sale to apply it to. This is genuinely useful for accounting clarity — "this 500 closes invoice #47" — and for invoice-level history.

**Behavior:**
- Receive-payment form has an optional **"Apply to specific sale"** dropdown. Empty by default ("General payment — applies to overall balance").
- The dropdown lists the customer's invoices that still have an outstanding balance, ordered by date (oldest first), each row showing: short id, date, total, remaining outstanding.
- When an invoice is picked, the amount input auto-fills with that invoice's remaining outstanding (still editable, still capped).
- The resulting credit `ledger_entries` row has `invoice_id` set to the picked invoice. Otherwise `invoice_id` is null on the credit (general payment).

**Where this shows up:**
- `/sales/:id` gets a new "Payment history" section listing credits applied to this invoice with date, amount, and notes.
- `/customers/:id` (the khata view) shows the linked invoice short id on each credit entry where it's set.

**The schema change is zero** — `ledger_entries.invoice_id` already exists from v1.2. Today it's only populated for debits (the original sale that created the debt). We'll start populating it on credits too, with the new semantic: "this payment is applied to this sale."

> **Why this is safe even though the column is shared:** for **debit** rows, `invoice_id` means "the sale that created this debt." For **credit** rows, `invoice_id` means "the sale this payment was applied against." Same column, parallel semantics — no conflict because debit and credit are different rows. Encode this clearly in the view (§3.4) and in the code comments.

### 1.8 Product / service names in khata table

Each debit entry (and each linked credit entry) should show **what** the credit was for, not just an amount. For a sale with products: list the first 2 product names with "+ N more" if there are more. For a service-only sale (no items, just service charge): show the invoice notes (truncated) prefixed with "Service:".

This requires joining `ledger_entries` → `invoices` → `sale_items` → `products`. We'll do it via a view (§3.4) so the frontend just queries a single shape.

### 1.9 Append-only enforcement

Defense in depth: block `UPDATE` and `DELETE` on `ledger_entries` at the database level, except where explicitly needed. Today there's no enforcement — a buggy mutation or a future feature could silently rewrite history.

- `UPDATE` is blocked entirely. If the cashier needs to "fix" an entry, they reverse it and create a new one.
- `DELETE` is blocked entirely. Same reasoning.

Implemented as a trigger that raises on UPDATE/DELETE, plus narrowed RLS policies that don't permit those operations for end users.

---

## 2. Schema changes

Single migration: `00XX_v16_ledger_hardening.sql`.

### 2.1 Pre-flight (informational only)

Discovery in Phase A determines whether `notes` already exists on `ledger_entries`. The migration should be **idempotent** (`add column if not exists`) so it's safe regardless.

### 2.2 New columns on `ledger_entries`

```sql
alter table public.ledger_entries
  add column if not exists notes text,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists reverses_entry_id uuid null references public.ledger_entries(id);

-- Backfill occurred_at from created_at for existing rows
update public.ledger_entries
set occurred_at = created_at
where occurred_at = created_at;  -- idempotent guard, defaults can collide

-- Amount must be positive (we encode direction in `type`, not in sign)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ledger_entries'::regclass
      and conname = 'ledger_entries_amount_positive'
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_amount_positive check (amount > 0);
  end if;
end$$;

-- A reversal must point to an existing, non-reversal entry. Self-reversal is invalid.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ledger_entries'::regclass
      and conname = 'ledger_entries_no_self_reversal'
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_no_self_reversal check (reverses_entry_id is null or reverses_entry_id <> id);
  end if;
end$$;

-- Each entry can only be reversed once (the reversal pointer is unique among non-null values)
create unique index if not exists uq_ledger_entries_reverses
  on public.ledger_entries (reverses_entry_id)
  where reverses_entry_id is not null;
```

### 2.3 Stored balance on `customers`

```sql
alter table public.customers
  add column if not exists outstanding_balance numeric(12,2) not null default 0;

-- Backfill from existing entries
update public.customers c
set outstanding_balance = coalesce(
  (select sum(case when type = 'debit' then amount else -amount end)
     from public.ledger_entries le
     where le.customer_id = c.id),
  0
);

-- Index for the Open/Closed filter and fast scanning
create index if not exists idx_customers_shop_outstanding
  on public.customers (shop_id, outstanding_balance);
```

### 2.4 Balance-update trigger

```sql
create or replace function public.ledger_entries_update_balance()
returns trigger
language plpgsql
as $$
declare
  v_delta numeric(12,2);
begin
  if TG_OP = 'INSERT' then
    v_delta := case when new.type = 'debit' then new.amount else -new.amount end;
    update public.customers
      set outstanding_balance = outstanding_balance + v_delta,
          updated_at = now()
      where id = new.customer_id;
    return new;
  end if;
  -- UPDATE / DELETE are blocked by ledger_entries_immutable below; we never reach here
  return null;
end;
$$;

drop trigger if exists ledger_entries_balance on public.ledger_entries;
create trigger ledger_entries_balance
  after insert on public.ledger_entries
  for each row execute function public.ledger_entries_update_balance();
```

### 2.5 Append-only enforcement

```sql
create or replace function public.ledger_entries_immutable()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception 'ledger_entries are append-only — reverse the entry instead of updating it'
      using errcode = 'P0001';
  elsif TG_OP = 'DELETE' then
    raise exception 'ledger_entries are append-only — reverse the entry instead of deleting it'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

drop trigger if exists ledger_entries_no_modify on public.ledger_entries;
create trigger ledger_entries_no_modify
  before update or delete on public.ledger_entries
  for each row execute function public.ledger_entries_immutable();
```

> **RLS policies should also be narrowed.** Verify in Phase A whether the existing policies grant UPDATE/DELETE to end users. If they do, remove those grants in this migration — defense in depth means the trigger is the last safety net, not the only one.

### 2.6 Indexes for the new query patterns

```sql
-- For "list a customer's entries in chronological order"
create index if not exists idx_ledger_entries_customer_occurred
  on public.ledger_entries (customer_id, occurred_at desc);

-- For "find credits applied to this invoice"
create index if not exists idx_ledger_entries_invoice_type
  on public.ledger_entries (invoice_id, type) where invoice_id is not null;
```

### 2.7 Reconciliation view (audit safety net)

A view to compare the trigger-maintained balance against the replay calculation. If they ever disagree, something has gone wrong and we'd want to know.

```sql
create or replace view public.customer_balance_reconciliation as
select
  c.id as customer_id,
  c.shop_id,
  c.outstanding_balance as stored_balance,
  coalesce(
    (select sum(case when type = 'debit' then amount else -amount end)
     from public.ledger_entries le where le.customer_id = c.id),
    0
  ) as computed_balance,
  c.outstanding_balance - coalesce(
    (select sum(case when type = 'debit' then amount else -amount end)
     from public.ledger_entries le where le.customer_id = c.id),
    0
  ) as drift
from public.customers c;
```

A row with `drift <> 0` is a bug. The frontend doesn't read this; it's for ops/audits. Document the SQL the user can run periodically:
```sql
select * from public.customer_balance_reconciliation where drift <> 0;
```

---

## 3. Backend functions

### 3.1 `receive_payment` rewrite

Read the current version via MCP first. Then drop and recreate.

```sql
create or replace function public.receive_payment(
  p_customer_id uuid,
  p_amount numeric(12,2),
  p_invoice_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_outstanding numeric(12,2);
  v_invoice_remaining numeric(12,2);
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive'; end if;

  -- Customer must exist and belong to this shop
  select outstanding_balance into v_outstanding
  from public.customers
  where id = p_customer_id and shop_id = v_shop_id
  for update;
  if not found then raise exception 'customer_not_in_shop'; end if;

  -- Customer-level overpayment guard
  if p_amount > v_outstanding then
    raise exception 'overpayment: amount % exceeds customer outstanding %', p_amount, v_outstanding
      using errcode = 'P0001';
  end if;

  -- Optional invoice link → invoice-level overpayment guard
  if p_invoice_id is not null then
    -- Invoice must belong to this customer in this shop
    perform 1 from public.invoices i
      where i.id = p_invoice_id
        and i.shop_id = v_shop_id
        and i.customer_id = p_customer_id;
    if not found then raise exception 'invoice_not_for_customer'; end if;

    -- Compute remaining = total - amount_paid - sum(credits already applied)
    select i.total - i.amount_paid - coalesce(
      (select sum(le.amount) from public.ledger_entries le
        where le.invoice_id = i.id and le.type = 'credit'),
      0
    )
    into v_invoice_remaining
    from public.invoices i
    where i.id = p_invoice_id;

    if v_invoice_remaining <= 0 then
      raise exception 'invoice_already_settled' using errcode = 'P0001';
    end if;

    if p_amount > v_invoice_remaining then
      raise exception 'overpayment: amount % exceeds invoice remaining %', p_amount, v_invoice_remaining
        using errcode = 'P0001';
    end if;
  end if;

  -- Insert the credit entry. The trigger updates customer.outstanding_balance.
  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type, occurred_at, paid_at, notes
  ) values (
    v_shop_id, p_customer_id, p_invoice_id, p_amount, 'credit', now(), now(), p_notes
  ) returning id into v_entry_id;

  return v_entry_id;
end;
$$;
```

Frontend:
```ts
const { data, error } = await supabase.rpc('receive_payment', {
  p_customer_id: customerId,
  p_amount: amount,
  p_invoice_id: invoiceId ?? null,
  p_notes: notes ?? null,
});
```

Recognize and translate the friendly errors: `overpayment`, `invoice_already_settled`, `invoice_not_for_customer`, `customer_not_in_shop`.

### 3.2 `reverse_ledger_entry` RPC

```sql
create or replace function public.reverse_ledger_entry(
  p_entry_id uuid,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_orig record;
  v_new_id uuid;
  v_new_type text;
  v_already_reversed uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  -- Fetch original; must belong to this shop
  select * into v_orig
  from public.ledger_entries
  where id = p_entry_id and shop_id = v_shop_id;
  if not found then raise exception 'entry_not_in_shop'; end if;

  -- Cannot reverse a reversal entry
  if v_orig.reverses_entry_id is not null then
    raise exception 'cannot_reverse_a_reversal' using errcode = 'P0001';
  end if;

  -- Cannot reverse twice (the unique index would catch it, but raise a friendly error here)
  select id into v_already_reversed
  from public.ledger_entries
  where reverses_entry_id = p_entry_id;
  if v_already_reversed is not null then
    raise exception 'entry_already_reversed' using errcode = 'P0001';
  end if;

  v_new_type := case when v_orig.type = 'debit' then 'credit' else 'debit' end;

  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type,
    occurred_at, paid_at, notes, reverses_entry_id
  ) values (
    v_orig.shop_id,
    v_orig.customer_id,
    v_orig.invoice_id,    -- preserve invoice link
    v_orig.amount,
    v_new_type,
    now(),
    case when v_new_type = 'credit' then now() else null end,
    coalesce(p_notes, 'Reversal of entry ' || substr(p_entry_id::text, 1, 8)),
    p_entry_id
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;
```

### 3.3 `search_khata_customers` RPC

```sql
create or replace function public.search_khata_customers(
  p_query text default null,
  p_status text default 'open',     -- 'open' | 'closed' | 'all'
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id uuid,
  name text,
  phone text,
  address text,
  outstanding_balance numeric(12,2),
  last_activity_at timestamptz,
  entry_count bigint
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
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_status not in ('open', 'closed', 'all') then
    raise exception 'invalid_status' using hint = 'Use open, closed, or all';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  return query
  with shop_customers as (
    select c.*,
           (select max(le.occurred_at) from public.ledger_entries le where le.customer_id = c.id) as last_activity_at,
           (select count(*) from public.ledger_entries le where le.customer_id = c.id) as entry_count
    from public.customers c
    where c.shop_id = v_shop_id
  ),
  filtered as (
    select * from shop_customers c
    where
      -- status filter
      case
        when p_status = 'open'   then c.outstanding_balance > 0
        when p_status = 'closed' then c.outstanding_balance = 0 and c.entry_count > 0
        when p_status = 'all'    then c.entry_count > 0
      end
      -- search filter
      and (
        v_query is null
        or c.name  ilike '%' || v_query || '%'
        or c.phone ilike '%' || v_query || '%'
        or c.name  % v_query
        or c.phone % v_query
      )
  )
  select
    f.id, f.name, f.phone, f.address,
    f.outstanding_balance, f.last_activity_at, f.entry_count
  from filtered f
  order by
    case when v_query is null then 0 else 1 end,
    case when v_query is not null then greatest(similarity(f.name, v_query), similarity(f.phone, v_query)) else 0 end desc,
    f.outstanding_balance desc,
    f.last_activity_at desc nulls last
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;
```

A matching `search_khata_customers_count` follows the same pattern as v1.5's product count function. Keep them parallel.

### 3.4 `ledger_entries_view` (display projection)

A view used by the khata UI so the frontend doesn't have to join four tables.

```sql
create or replace view public.ledger_entries_view as
select
  le.id,
  le.shop_id,
  le.customer_id,
  le.invoice_id,
  le.amount,
  le.type,
  le.occurred_at,
  le.created_at,
  le.notes,
  le.reverses_entry_id,
  -- "Has this entry been reversed by another?" — null if not.
  (select r.id from public.ledger_entries r where r.reverses_entry_id = le.id) as reversed_by_entry_id,
  (select r.occurred_at from public.ledger_entries r where r.reverses_entry_id = le.id) as reversed_at,
  -- Invoice context
  i.notes as invoice_notes,
  i.total as invoice_total,
  i.amount_paid as invoice_amount_paid,
  i.payment_type as invoice_payment_type,
  -- Product summary: first 2 product names + "+ N more" if applicable
  (
    select case
      when count(*) = 0 then null
      when count(*) <= 2 then string_agg(p.name, ', ' order by si.id)
      else (
        select string_agg(p2.name, ', ' order by p2.name)
        from (
          select p3.name from public.sale_items si3
          join public.products p3 on p3.id = si3.product_id
          where si3.invoice_id = le.invoice_id
          order by si3.id
          limit 2
        ) p2
      ) || ' + ' || (count(*) - 2)::text || ' more'
    end
    from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.invoice_id = le.invoice_id
  ) as products_summary,
  (
    select count(*) from public.sale_items si where si.invoice_id = le.invoice_id
  ) as items_count
from public.ledger_entries le
left join public.invoices i on i.id = le.invoice_id;
```

Frontend reads from this view via `supabase.from('ledger_entries_view').select(...)` — RLS is inherited from `ledger_entries` and `invoices` (shop-scoped), so no additional policies needed. Verify this in Phase E with Account B.

> **One caveat:** views inherit RLS only when the underlying tables enforce it. Confirm RLS is enabled on `ledger_entries`, `invoices`, `sale_items`, and `products` — it should be, but verify.

### 3.5 `customer_open_invoices` RPC (for the "Apply to invoice" dropdown)

```sql
create or replace function public.customer_open_invoices(p_customer_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  total numeric(12,2),
  amount_paid numeric(12,2),
  credits_applied numeric(12,2),
  remaining numeric(12,2),
  payment_type text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.created_at, i.total, i.amount_paid,
    coalesce(
      (select sum(amount) from public.ledger_entries le
       where le.invoice_id = i.id and le.type = 'credit'),
      0
    ) as credits_applied,
    i.total - i.amount_paid - coalesce(
      (select sum(amount) from public.ledger_entries le
       where le.invoice_id = i.id and le.type = 'credit'),
      0
    ) as remaining,
    i.payment_type, i.notes
  from public.invoices i
  where i.shop_id = public.current_shop_id()
    and i.customer_id = p_customer_id
    and i.payment_type in ('credit', 'partial')
    and i.total - i.amount_paid - coalesce(
      (select sum(amount) from public.ledger_entries le
       where le.invoice_id = i.id and le.type = 'credit'),
      0
    ) > 0
  order by i.created_at asc;
$$;
```

This returns only invoices that still have something owed.

---

## 4. RLS sanity check

- All new functions are `security definer` and resolve `current_shop_id()`. None accept a shop id from the caller.
- Confirm `ledger_entries` policies do **not** grant UPDATE or DELETE to end users. SELECT and INSERT only. The triggers in §2.5 are defense in depth, not a substitute for proper RLS.
- Confirm `customers` UPDATE policy still allows the trigger-driven balance update. The trigger runs as `security definer`-context — it shouldn't be blocked by RLS, but verify.
- After applying the migration, verify with two accounts that `search_khata_customers`, `customer_open_invoices`, `receive_payment`, `reverse_ledger_entry`, and direct `ledger_entries_view` reads all enforce shop scoping.

---

## 5. Frontend changes

### 5.1 `/customers` (khata list)

- Header: "Khata" with two controls — filter dropdown (Open / Closed / All, default Open) and search input.
- Search is debounced 250ms; combined with filter through the `search_khata_customers` RPC.
- Pagination at 50/page using `search_khata_customers_count`.
- Row columns: name (bold) + phone (muted), last activity date, entry count, **outstanding balance** (right-aligned, color-coded — red if > 0, gray if 0). The balance now reads from the stored `outstanding_balance`, not a client-side sum.
- Empty states: "No open khata" / "No closed khata" / "No khata customers yet" depending on filter.

### 5.2 `/customers/:id` (khata detail) upgrade

Header (unchanged from v1.4): name, phone, current outstanding (large, color-coded).

Action area: **Receive payment** CTA (existing) and **Edit customer** (existing).

**Transactions table** uses `ledger_entries_view`:

| Date | Type | Amount | For | Notes | Balance after | Actions |
|---|---|---|---|---|---|---|

- **Date:** `occurred_at` formatted in user's locale.
- **Type:** Debit / Credit pill. If `reverses_entry_id is not null`, add a "Reversal" badge. If `reversed_by_entry_id is not null`, add a "Reversed" badge with strikethrough on the row.
- **Amount:** signed display — debit shown as `+X` (customer owes more), credit as `-X`.
- **For:** the new richness:
  - Debit row linked to a sale with items: `products_summary` (e.g., "Battery, Charging Cable + 2 more") with the linked sale's short id below as a small link to `/sales/:id`.
  - Debit row linked to a sale that's service-only (`items_count = 0`): "Service" badge plus truncated `invoice_notes` (full on hover or click). Sale link below.
  - Credit row with `invoice_id` set: "Payment for sale #abc123" with link.
  - Credit row without `invoice_id`: "General payment".
- **Notes:** the entry's own `notes` field, truncated.
- **Balance after:** computed client-side from the entries in chronological order (cheap because we already have all the rows).
- **Actions:** "Reverse" button — visible only if the entry hasn't been reversed yet AND isn't itself a reversal. Confirmation modal: "Reverse this entry? A new entry of the opposite type will be added. The original entry will remain visible for audit." Submit calls `reverse_ledger_entry`.

### 5.3 Receive Payment form

Fields, in order:
1. **Apply to specific sale** (optional dropdown) — sourced from `customer_open_invoices`. Default: empty ("General payment").
   - Each option shows: short id · date · "Remaining: 500 of 1,200".
2. **Amount** — numeric input.
   - If invoice picked: cap = invoice's `remaining`, hint shows "Max: X (invoice remaining)".
   - If no invoice picked: cap = customer's `outstanding_balance`, hint shows "Max: X (customer total outstanding)".
   - Submit disabled when `amount > cap` with inline error.
3. **Notes** (optional, multiline, max 1000).

Submit calls `receive_payment` with `p_invoice_id`. On the friendly errors (`overpayment`, `invoice_already_settled`), show inline error mapped to i18n strings.

### 5.4 `/sales/:id` Payment History section

Below the totals block, add a "Payment history" section. Empty state when no credits exist for this invoice. Otherwise a table:

| Date | Amount | Notes | Reversal? |
|---|---|---|---|

Reads from `ledger_entries_view` filtered by `invoice_id = this.id and type = 'credit'`. Plus a small summary row at the bottom: "Paid X of Y · Remaining Z". A reversed credit shows with strikethrough; the row beneath it (the reversal) shows with a "Reversal" badge.

This complements v1.3's khata panel — that one shows ledger entries for the linked customer; this one is invoice-centric.

### 5.5 i18n keys (additions)

```jsonc
// locales/en/khata.json (additions)
{
  "list": {
    "filter_label": "Show",
    "filter_open": "Open khata",
    "filter_closed": "Closed khata",
    "filter_all": "All",
    "search_placeholder": "Search by name or phone",
    "empty_open": "No open khata",
    "empty_closed": "No closed khata yet",
    "empty_all": "No khata customers yet"
  },
  "entry": {
    "for_label": "For",
    "products_summary_more": "{{first}} + {{count}} more",
    "service": "Service",
    "general_payment": "General payment",
    "payment_for_sale": "Payment for sale #{{shortId}}",
    "balance_after": "Balance after",
    "reversal_badge": "Reversal",
    "reversed_badge": "Reversed",
    "reverse_action": "Reverse",
    "reverse_confirm_title": "Reverse this entry?",
    "reverse_confirm_body": "A new entry of the opposite type will be added. The original entry will remain visible for audit.",
    "reverse_confirm_cta": "Reverse entry"
  },
  "receive_payment": {
    "apply_to_sale": "Apply to specific sale (optional)",
    "general_payment_option": "General payment — applies to overall balance",
    "open_invoice_row": "#{{shortId}} · {{date}} · Remaining: {{remaining}}",
    "amount_max_invoice": "Max: {{max}} (invoice remaining)",
    "amount_max_customer": "Max: {{max}} (customer total outstanding)",
    "notes_placeholder": "Optional — e.g., 'Bank transfer ref #1234'"
  },
  "errors": {
    "overpayment_customer": "Amount cannot exceed the customer's outstanding balance ({{max}}).",
    "overpayment_invoice": "Amount cannot exceed the invoice's remaining balance ({{max}}).",
    "invoice_already_settled": "This invoice is already fully paid.",
    "amount_must_be_positive": "Amount must be greater than zero.",
    "cannot_reverse_a_reversal": "Reversal entries cannot themselves be reversed.",
    "entry_already_reversed": "This entry has already been reversed."
  }
}

// locales/en/sales.json (additions)
{
  "payment_history": {
    "title": "Payment history",
    "empty": "No payments received against this sale yet.",
    "summary": "Paid {{paid}} of {{total}} · Remaining {{remaining}}"
  }
}
```

Mirror in `locales/ur/*` consistent with prior translations (کھاتہ, ادائیگی, الٹ — for "reversal").

---

## 6. Edge cases & defensive notes

- **Concurrent receive_payment racing customer outstanding.** Two cashiers click "Receive 100" while customer owes 100. The `for update` lock on the customer row in §3.1 serializes them — the second call sees outstanding = 0 and raises `overpayment`. Surface as a friendly inline error.
- **Reversal of a debit that was created by `record_sale`.** The reversal cancels the debt at the ledger level but the original `invoice` row stays as-is. That's correct — the sale happened; reversing the ledger entry just means "we forgave the debt" or "we recorded it wrong." If the underlying intent is "the sale itself was wrong," that's a returns/voids flow (still out of scope).
- **Reversal of a credit that was applied to a specific invoice.** The reversal preserves `invoice_id` (per §3.2), so the invoice's "Payment history" view shows both the credit and its reversal, netting to zero. Verify visually.
- **Customer with `outstanding_balance < 0` after backfill.** Shouldn't happen if all prior credits passed through `receive_payment`. If it does, that's pre-existing data damage; report it during Phase A and let the user decide whether to write it off (insert a debit to bring to zero) or investigate.
- **The view's `products_summary` correlated subquery.** At MVP scale, fine. At ten million ledger entries it'd hurt; if the khata detail starts feeling slow, materialize the summary into a column on `ledger_entries` populated at insert time (denormalize when scale demands).
- **`set_limit(0.2)` is per-session.** Calling it inside the function sets it for the duration of that statement. Consistent with v1.5's `search_products`. Don't worry about restoring.
- **Empty `notes` stored as `''` vs `null`.** Server-side, normalize empty-string to null in the function (or just don't send empty strings from the frontend). Be consistent with v1.5's product description handling.

---

## 7. Reconciliation runbook (for the user)

After this lands, the user has one new SQL snippet worth keeping handy:

```sql
-- Find customers whose stored balance disagrees with their replay-computed balance.
-- Should always return zero rows.
select * from public.customer_balance_reconciliation where drift <> 0;
```

If this ever returns rows, the trigger in §2.4 missed an event or someone bypassed it. Fix the underlying issue, then resync stored balances:

```sql
update public.customers c
set outstanding_balance = coalesce(
  (select sum(case when type = 'debit' then amount else -amount end)
     from public.ledger_entries le
     where le.customer_id = c.id),
  0
);
```

Run the reconciliation once a week as ops hygiene; it costs nothing.

---

## 8. Out of scope for this round

- **Advance payments / customer credit balances** — taking 500 today against future purchases. Real flow with its own UX. Note as v1.7 candidate.
- **Splitting one payment across multiple invoices** — UI would let cashier allocate "300 to invoice A, 200 to invoice B" in one form. v1.6 keeps it 1:1. If the cashier needs split, they record two separate payments.
- **Returns / refunds** with stock reversal. Different design problem (touches inventory + invoice + ledger).
- **Per-customer ageing report** (30/60/90 days). The data is now there with `occurred_at`; the UI is a future ticket.
- **SMS / WhatsApp reminders for overdue khata.** Future.
- **Supplier ledger** (the shop owing suppliers). Mirror structure of customer khata; out of scope here.
- **Dropping `paid_at` column.** Deprecated in v1.6, drop in a follow-up after audit.
- **Test infrastructure.** Still skipped per user instruction.

---

## 9. Implementation order

1. **Discovery report** in chat (§Phase A) — must include the answer to the `notes` question, current `receive_payment` body, current `record_sale` body, current RLS policies on `ledger_entries`.
2. **Migration `00XX_v16_*.sql`** in this exact order, applied via MCP:
   - Add columns on `ledger_entries` (`notes` if missing, `occurred_at`, `reverses_entry_id`).
   - Add `amount > 0` and `no_self_reversal` constraints.
   - Add unique index on `reverses_entry_id`.
   - Add `customers.outstanding_balance` and backfill.
   - Create balance-update trigger.
   - Create append-only enforcement trigger.
   - Narrow RLS policies on `ledger_entries` (drop UPDATE/DELETE if granted).
   - Add new indexes.
   - Create reconciliation view.
3. **Backfill verification**: run `select count(*) from customer_balance_reconciliation where drift <> 0;`. Must be zero.
4. **Backend functions**: rewrite `receive_payment`, add `reverse_ledger_entry`, `search_khata_customers`, `search_khata_customers_count`, `customer_open_invoices`, `ledger_entries_view`. Regenerate `database.ts`.
5. **Sanity in SQL**: call each new function with valid and invalid inputs (overpayment, invalid customer, double reversal). Confirm friendly errors fire.
6. **`/customers` (khata list)** — filter, search, pagination, balance column from stored value.
7. **`/customers/:id` (khata detail)** — entries table from the view, with product/service display, reversal action.
8. **Receive payment form** — invoice dropdown, capped amount, notes.
9. **`/sales/:id` Payment history section.**
10. **i18n pass** — all new strings in EN + UR.
11. **Manual smoke test** with two accounts (matrix in §11).
12. **Report back** with: schema diff, the answer to "did v1.4's notes land in `ledger_entries`", any spec ambiguities resolved.

### 9.1 Manual test matrix

**Account A — happy paths:**
- Create customer Ahmed with full details.
- Make a credit sale to Ahmed for 1,000 (3 products). Verify khata shows debit with the 3 product names; balance = 1,000.
- Make a partial sale to Ahmed: 500 paid of 800. Verify ledger debit = 300; balance = 1,300.
- Make a service-only sale to Ahmed for 200 with notes "Replaced charging port". Credit. Verify khata shows "Service" badge with the note; balance = 1,500.
- Receive a general payment of 500. Verify balance = 1,000; entry shows "General payment".
- Receive a payment of 300 applied to the first sale's invoice. Verify the credit entry shows "Payment for sale #..."; the sale's payment-history section lists it; balance = 700.

**Account A — overpayment & reversal:**
- Try to receive 5,000 — friendly error, no entry created, balance unchanged.
- Try to apply 1,500 to the first sale (which has < 1,500 remaining) — friendly invoice-overpayment error.
- Reverse the 300 invoice-linked payment. Verify the original shows strikethrough + "Reversed"; a new "Reversal" entry appears; balance back to 1,000; the sale's payment-history shows both rows.
- Try to reverse the same entry again — blocked.
- Try to reverse the reversal — blocked.

**Account A — filters & search:**
- Pay off Ahmed's full 1,000. Verify khata closes; he disappears from "Open" filter; appears under "Closed" and "All".
- Search "ahm" with fuzzy → finds Ahmed.
- Search "Ahmd" (typo) → still finds Ahmed.

**Account A — append-only:**
- Try via SQL editor to `delete from ledger_entries where id = ...` — blocked by trigger.
- Try `update ledger_entries set amount = 999 where id = ...` — blocked.

**Account B (cross-shop):**
- Confirm B's khata list, search results, RPC calls, and direct view reads return zero rows from A's data.

**Reconciliation:**
- Run `select * from customer_balance_reconciliation where drift <> 0` — empty.

---

## 10. Acceptance criteria

The patch is done when **all** of the following hold:

- [ ] Phase A reported whether `ledger_entries.notes` already existed; the migration handled both cases idempotently.
- [ ] `customers.outstanding_balance` is maintained by trigger and stays consistent with the replay-computed value (`customer_balance_reconciliation` returns no rows with `drift <> 0`).
- [ ] Every `ledger_entries` row has `occurred_at` populated; backfill set it to `created_at` for old rows.
- [ ] `ledger_entries` cannot be updated or deleted from the application — confirmed by an explicit attempted UPDATE failing.
- [ ] Receiving a payment > customer's outstanding balance is rejected with a friendly error, no entry created, balance unchanged.
- [ ] Receiving a payment > linked invoice's remaining balance is rejected with a friendly error.
- [ ] An entry can be reversed; the original stays visible with "Reversed" indication; the reversal entry shows "Reversal" indication; balance correctly nets to zero contribution from the reversed pair.
- [ ] An already-reversed entry cannot be reversed again. A reversal entry cannot itself be reversed.
- [ ] Khata list filters by Open / Closed / All with correct semantics — closed customers reappear under Closed and All.
- [ ] Khata search is fuzzy on name and phone; typos like "Ahmd" find "Ahmed".
- [ ] Each ledger entry in the detail view shows what it was for: product names for product sales, service badge + truncated notes for service-only sales, "General payment" or "Payment for sale #..." for credits.
- [ ] `/sales/:id` shows a Payment history section listing credits applied to that invoice with dates, amounts, notes; reversed credits net out visually.
- [ ] No new console errors on any new or modified screen, in either language.
- [ ] RLS still isolates shops. Account B sees zero of Account A's khata data via list, search, view, or RPC.

---

*End of v1.6 ledger hardening spec.*
