# MVP Fixes & Enhancements — v1.3

**Audience:** Claude Code
**Companion to:** `PRD.md` (v1.2 baseline) — read it first if you haven't.
**Stack:** unchanged — React + Supabase (connected via Supabase MCP) + react-i18next.

> This is a **patch-on-top** spec. The MVP is already built and running. Do **not** rewrite features that work. Investigate, then make the smallest correct change for each item below.

---

## 0. How to work this ticket

Follow these phases in order. Do not skip the discovery phase.

### Phase A — Discovery (read before writing any code)

1. **Read `PRD.md`** end-to-end so the v1.2 contract is fresh.
2. **Inspect the live Supabase schema via MCP**, not the migration files. The DB is the source of truth — files may be out of sync.
   - List all tables under `public`, their columns, types, defaults, and constraints.
   - List all RLS policies per table.
   - List all functions, triggers, and views (especially `handle_new_user`, `complete_onboarding`, `expire_subscriptions`, `subscription_effective`, and any sale/purchase function).
   - List all indexes on the domain tables.
3. **Map the frontend** before changing it:
   - Find every React Query mutation (`useMutation`) and note its `mutationFn`, `onSuccess`, `onError`, and any toast/banner calls.
   - Find every Supabase call that uses `.insert(...).select().single()` — this is the most common source of the "record saved but error shown" bug (see §1.1).
   - Find the central toast component / hook so you understand how success vs error is signaled.
   - Find the i18n namespace files so new strings are added in both `en` and `ur`.
4. **Write a short discovery report** (in chat, not as a file) before touching code: "Here's the current schema, here's what I found in the mutation layer, here's my plan." Then proceed.

### Phase B — Schema migration first

All schema changes in §3 are applied **before** any frontend work, as a single migration `00XX_v13_avg_cost_and_links.sql` (next number after the latest existing migration). Apply via Supabase MCP, then regenerate `src/types/database.ts`.

### Phase C — Backend functions

Update Postgres functions (§3.3) so the stock-in flow correctly recomputes weighted average cost atomically. The frontend never computes this — it reads `products.avg_cost`.

### Phase D — Frontend fixes & features

In the order listed in §6 (Implementation order). Each section below tells you what to change and why.

### Phase E — Verification

For each issue, manually verify with two test users (cross-shop isolation must still hold). **Do not write Playwright or unit tests for this round** — the user explicitly said skip tests. Just verify by hand and report back.

---

## 1. Bug fixes

### 1.1 "Record was created but an error toast appears"

**Symptom:** Creating a customer, stock-in entry, expense, etc. — the row appears in the DB and in the list after refresh, but an error toast fires on submit.

**Most likely root causes (audit each):**

1. **`.insert(...).select().single()` blocked by RLS on the implicit SELECT after insert.** Supabase runs an internal SELECT to return the inserted row. If the table has an `INSERT` policy that passes but no `SELECT` policy that matches the just-inserted row (e.g., the RLS uses `current_shop_id()` and the row's `shop_id` is correct, but the policy is misconfigured), the SELECT fails with `PGRST116` while the insert already committed.
   - **Fix:** Verify each table has a `SELECT` policy whose `USING` clause matches what the `INSERT` policy's `WITH CHECK` allows. The patterns in PRD §11 use `for all using (...) with check (...)`, which is correct — but confirm none of them were narrowed during build.
   - Also check: any table missing a `SELECT` policy entirely? That would block `.select()` after insert even though insert returns success.

2. **Mutation re-throwing after success.** Pattern to look for:
   ```ts
   mutationFn: async (input) => {
     const { data, error } = await supabase.from('x').insert(input).select().single();
     if (error) throw error;
     return data;
   }
   ```
   If `data` is `null` because of (1) above, downstream code that does `data.id` throws and lands in `onError`. Fix the root cause in (1), not by swallowing the error.

3. **Toast fired in `onSettled` without checking status.** If `onSettled` shows an error toast unconditionally, both success and error paths show it. Use `onSuccess`/`onError` instead.

4. **Form `onSubmit` swallowing `mutate.mutateAsync` errors with a generic catch.** Look for `try { await mutateAsync(...) } catch { toast.error(...) }` where the mutation already shows its own toast — leading to a double-toast or a misleading toast.

5. **Optimistic update mismatch.** If `onMutate` adds a temp row and `onError` rolls it back, but the mutation actually succeeded, you'll see the row both add (real) and the rollback flicker. Check the React Query devtools for any optimistic patterns and verify they handle the success path.

**What to deliver:**
- A short note in chat naming which of (1)–(5) was the actual cause for each affected mutation (customers, stock-in, expenses, products, sales).
- The minimal fix applied.

### 1.2 General nitty-gritty audit

While you're in the mutation layer, also check and fix any of the following you find:

- Mutations that don't `invalidateQueries` after success → stale list views.
- List views that don't show a loading state (just a blank screen) or empty state.
- Form submit buttons that aren't disabled while the mutation is pending → users double-submit and create dupes (especially relevant for sales!).
- Number inputs that accept non-numeric values, or that don't enforce ≥ 0.
- Phone validation that's too strict (PRD allows `+92` and `0` prefix, 10 digits after).
- Date filters that use the user's local timezone for one bound and UTC for the other → records on the boundary day go missing. Pick one (UTC) and stick with it for `created_at` queries; for `expense_date`/`purchase_date` (which are `date` not `timestamptz`) use plain date comparison.
- Currency rendering that breaks in Urdu (`Intl.NumberFormat('ur-PK', { style: 'currency', currency: 'PKR' })` should be used; verify it renders Urdu numerals when the locale is `ur-PK`).
- RTL bugs: any screen using `ml-*` / `mr-*` / `pl-*` / `pr-*` instead of `ms-*` / `me-*` / `ps-*` / `pe-*`. Fix at least the screens you touch in this round.

Don't go on a 5-day refactor. Fix what's clearly broken on screens you visit; log the rest as known-issue notes.

---

## 2. Feature additions

### 2.1 Weighted-average cost on products

The current `products.cost` field is misleading because cost changes between purchases. Replace its meaning.

**Concept:**
- `products.avg_cost` = moving weighted average cost per unit, recomputed on every stock-in.
- `products.last_purchase_cost` = the cost from the most recent stock-in (informational only).
- The existing `products.cost` column is **kept** but its role changes; see migration plan in §3.1.

**Formula** (applied inside the stock-in DB function — never on the client):
```
avg_cost_new = (stock_old * avg_cost_old + qty_in * cost_in) / (stock_old + qty_in)
```
- If `stock_old = 0` (first stock-in, or stock fully depleted), `avg_cost_new = cost_in`.
- Round to 2 decimals at write time.
- `qty_in > 0` is guaranteed by the existing check constraint.

**Worked example (from the user's brief):**
- Existing: 5 units in stock at avg_cost 50 PKR.
- Stock-in: 10 units at 40 PKR.
- New stock = 15. New avg_cost = (5×50 + 10×40) / 15 = (250 + 400) / 15 = **43.33 PKR**.
- `last_purchase_cost = 40`.

**UI:**
- Product list shows: name, stock, **avg cost**, selling price, last purchase cost (smaller / muted text under avg cost).
- Product detail shows the same plus a small "How is avg cost calculated?" tooltip with the formula.
- Locale-formatted currency in both EN and UR.

### 2.2 Editable price at the time of sale

Selling price is negotiated. The cart line should let the cashier override `price_at_sale` per item before completing the sale.

**Behavior:**
- Each cart row shows: product name, qty (editable), unit price (editable, defaults to `products.price`), line total (computed).
- If the cashier changes the unit price, mark the line visually (e.g., a small "modified" badge or muted text "was 500"). No DB flag needed for MVP — the diff between `sale_items.price_at_sale` and the product's current price is enough.
- Validation: unit price must be ≥ 0. **Do not** block selling below `avg_cost` — show a soft warning toast/inline note ("Below average cost — selling at a loss") but allow it. Owner judgement wins.
- The `record_sale` Postgres function (§3.3) accepts `price_at_sale` per line from the client and snapshots it as-is, alongside the current `avg_cost` as `cost_at_sale`. (Today, if the function reads `products.cost` for the snapshot, that's wrong — it must read `avg_cost`.)

### 2.3 Credit sale → khata (ledger) linking + Sales module

The schema already has `ledger_entries.invoice_id`, but the UI doesn't surface it. Two changes:

**(a) Sales module (new route `/sales`)**

A list of every invoice for the shop. This was implicit in PRD §12 but not actually built — build it now.

- **List view (`/sales`)**:
  - Columns: date+time, customer name (or "Walk-in" if `customer_id` is null), payment type (cash/credit), total, service charge, line-item count.
  - Filters at top: date range (default: last 7 days), payment type (all / cash / credit), customer (autocomplete).
  - Default sort: `created_at desc`.
  - Pagination: 25 per page.
  - Click a row → `/sales/:id`.
- **Detail view (`/sales/:id`)**:
  - Header: invoice id (short), date+time, payment type badge, customer (link to `/customers/:id` if applicable), cashier email.
  - Items table: product name, qty, unit price (`price_at_sale`), unit cost (`cost_at_sale`), line total, line gross profit (`(price - cost) × qty`).
  - Totals: subtotal, service charge, grand total.
  - **If credit sale**: a "Khata" panel showing the linked `ledger_entries` rows (debit when sale was made, any credits since). Link "View customer khata" → `/customers/:id`.
  - No "edit" or "delete" — sales are immutable in MVP. (If owner asks for void/refund, that's v2 returns.)

**(b) Khata view enhancement**

`/customers/:id` currently shows a basic ledger. Upgrade it:

- Header: customer name, phone, current outstanding balance (big number).
- "Receive payment" CTA stays.
- Transactions table — one row per ledger entry — with columns: date, type (debit/credit pill), amount, **linked invoice** (when present, link to `/sales/:id`), running balance after this entry, note.
- For debit rows linked to a sale, show a small subline with item count or first 1–2 product names so the owner can see at a glance what the credit was for.

The "running balance" is computed client-side from the entries (which are already returned in time order). Don't add a stored `balance_after` column — it'd just be one more thing to keep consistent.

### 2.4 Stock-in detail view

`/purchases` already lists stock-in rows. Add a detail view.

- Make each row in `/purchases` clickable → `/purchases/:id`.
- **Detail view (`/purchases/:id`)**:
  - Header: date, source, total cost, note, recorded-by (email).
  - Items table: product name, qty, **cost at purchase** (`purchase_items.cost_at_purchase`), line total. A summary footer row showing total qty and total cost (must equal `purchases.total_cost`; if it doesn't, show a small warning so we catch data drift).
  - Below the table, an "Effect on inventory" mini-section: for each item, show the avg_cost *before* and *after* this stock-in if you can compute it cheaply.
    - **Honest caveat:** computing historical avg_cost for past stock-ins is non-trivial (you'd need to replay all stock-ins/sales). For MVP, only show this for the **most recent** stock-in per product; older ones show "—". Don't fabricate values.
  - No edit/delete — also immutable in MVP.

---

## 3. Schema changes

Single migration: `00XX_v13_avg_cost_and_links.sql` (replace `XX` with the next number after the latest applied migration — confirm via MCP).

### 3.1 `products` table

```sql
alter table public.products
  add column if not exists avg_cost numeric(12,2) not null default 0 check (avg_cost >= 0),
  add column if not exists last_purchase_cost numeric(12,2) check (last_purchase_cost >= 0);

-- Backfill: for existing rows, seed avg_cost from the current cost field
update public.products
set avg_cost = cost,
    last_purchase_cost = cost
where avg_cost = 0;
```

**Decision: keep `cost` column for now**, even though it's redundant. Removing it requires touching every place in the frontend that reads it. After this round, sweep the frontend to read `avg_cost` everywhere, and drop `cost` in a follow-up migration when nothing references it. Note this as a known follow-up.

### 3.2 Indexes (only if missing)

```sql
create index if not exists idx_invoices_shop_created
  on public.invoices (shop_id, created_at desc);
create index if not exists idx_ledger_invoice
  on public.ledger_entries (invoice_id);
create index if not exists idx_purchase_items_purchase
  on public.purchase_items (purchase_id);
```

### 3.3 Postgres functions

**Drop and recreate** these so the avg_cost logic is centralized in the DB. All run as `security definer` and use `auth.uid()` to resolve the shop via `current_shop_id()`.

#### `record_purchase(...)` — atomic stock-in

Inputs: `p_source`, `p_note`, `p_purchase_date`, and an array of items `(product_id, qty, cost_at_purchase)`.

Behavior in a single transaction:
1. Resolve `v_shop_id := current_shop_id()`. Reject if null.
2. Insert into `purchases`, get `v_purchase_id`.
3. For each item:
   - Verify the product belongs to the same shop (defense in depth — RLS already enforces, but the function bypasses RLS via security definer).
   - Insert into `purchase_items`.
   - Recompute the product's `avg_cost`:
     ```sql
     update public.products p
     set
       avg_cost = case
         when p.stock + i.qty = 0 then p.avg_cost
         when p.stock <= 0 then i.cost_at_purchase
         else round((p.stock * p.avg_cost + i.qty * i.cost_at_purchase) / (p.stock + i.qty), 2)
       end,
       last_purchase_cost = i.cost_at_purchase,
       stock = p.stock + i.qty,
       cost = case when p.stock <= 0 then i.cost_at_purchase else p.cost end,  -- keep legacy `cost` roughly aligned
       updated_at = now()
     where p.id = i.product_id and p.shop_id = v_shop_id;
     ```
4. Update `purchases.total_cost` from the sum of items (or take it from input and assert equality — use the sum, it's authoritative).
5. Return `v_purchase_id`.

Frontend calls this via `supabase.rpc('record_purchase', { ... })` and never updates `products.stock` or `products.avg_cost` directly.

#### `record_sale(...)` — atomic sale

Inputs: `p_customer_id` (nullable), `p_payment_type` ('cash'|'credit'), `p_service_charge`, and an array of items `(product_id, qty, price_at_sale)`.

Behavior in a single transaction:
1. Resolve `v_shop_id`, `v_user_id`. Reject if null.
2. If `p_payment_type = 'credit'` and `p_customer_id is null` → raise.
3. Compute total = sum(qty × price_at_sale) + service_charge.
4. Insert into `invoices` with `cashier_id = v_user_id`, get `v_invoice_id`.
5. For each item:
   - Look up the product's current `avg_cost` (this becomes `cost_at_sale`).
   - Verify `stock >= qty`. If not, raise `insufficient_stock`.
   - Insert into `sale_items` with snapshotted `price_at_sale` and `cost_at_sale`.
   - Decrement `products.stock` by `qty`. **Do not** change `avg_cost` on a sale.
6. If credit: insert one `ledger_entries` row with `type='debit'`, `amount=total`, `invoice_id=v_invoice_id`, `customer_id=p_customer_id`.
7. Return `v_invoice_id`.

If a `record_sale` already exists, **read it via MCP first**, diff against this spec, and patch — don't blow away custom logic that works.

#### `receive_payment(...)` — khata payment

Inputs: `p_customer_id`, `p_amount`, `p_note` (optional).

Behavior:
1. Resolve `v_shop_id`. Reject if null.
2. Verify customer belongs to the shop.
3. Insert one `ledger_entries` row with `type='credit'`, `amount=p_amount`, `paid_at=now()`, `invoice_id=null`, `note=p_note`.
4. Return the new entry id.

Allow over-payment for now (creates a negative balance which means the shop owes the customer). Don't silently cap.

### 3.4 RLS sanity check

While in the schema, verify each domain table has a `for select` policy that resolves `current_shop_id()`. The "record saved but error shown" bug (§1.1) often points to a missing or wrong SELECT policy. Patch any gaps in this same migration.

---

## 4. Frontend impact summary

| Area | Change |
|---|---|
| `products` list/table | Add `avg_cost` column. Show `last_purchase_cost` as muted subline. |
| Product create/edit form | Remove "cost" from the form (or rename to "Initial cost — set only at create"). On edit, `cost`/`avg_cost` are read-only — they change via stock-in. |
| Stock-in form | No change to fields, but the submit calls `rpc('record_purchase', ...)` and the response is the new `purchase_id`. Navigate to `/purchases/:id` on success. |
| `/purchases` list | Make rows clickable → `/purchases/:id`. |
| `/purchases/:id` (new) | Detail view as in §2.4. |
| POS cart | Make unit price editable per row, defaulted from `products.price`. Show "below avg cost" soft warning if `price < avg_cost`. Submit calls `rpc('record_sale', ...)`. |
| `/sales` (new) | Sales list with filters (§2.3a). |
| `/sales/:id` (new) | Sale detail with optional khata panel (§2.3a). |
| `/customers/:id` | Upgraded transactions table with linked invoice column + running balance (§2.3b). |
| Mutation layer (global) | Audit per §1.1 and patch the root cause. |
| i18n | Add new keys for: sales module, purchase detail, avg cost label, "below avg cost" warning, "modified price" badge. Add EN and UR. |

### New i18n keys (starter — add the rest as you go)

```jsonc
// locales/en/products.json
{
  "fields": {
    "avg_cost": "Avg cost",
    "last_purchase_cost": "Last purchase",
    "selling_price": "Selling price",
    "stock": "Stock"
  },
  "tooltip": {
    "avg_cost_explainer": "Weighted average cost across all stock-ins. Updates automatically when you record a stock-in."
  }
}

// locales/en/sales.json
{
  "title": "Sales",
  "filters": {
    "date_range": "Date range",
    "payment_type": "Payment type",
    "all": "All",
    "cash": "Cash",
    "credit": "Credit",
    "customer": "Customer"
  },
  "columns": {
    "datetime": "Date & time",
    "customer": "Customer",
    "payment_type": "Payment",
    "items": "Items",
    "total": "Total"
  },
  "walk_in": "Walk-in",
  "detail": {
    "title": "Sale #{{shortId}}",
    "items": "Items",
    "totals": "Totals",
    "khata_panel_title": "Khata entries",
    "view_customer_khata": "View customer khata",
    "below_avg_cost_warning": "This price is below average cost. Selling at a loss."
  },
  "modified_price_badge": "Modified"
}

// locales/en/purchases.json (additions)
{
  "detail": {
    "title": "Stock-in #{{shortId}}",
    "effect_on_inventory": "Effect on inventory",
    "avg_before": "Avg before",
    "avg_after": "Avg after",
    "not_available": "—"
  }
}

// locales/en/khata.json (additions)
{
  "transactions": {
    "linked_invoice": "Linked sale",
    "running_balance": "Balance after",
    "no_link": "—"
  }
}
```

Mirror all of these in `locales/ur/*` with Urdu translations. Use existing terminology — کھاتہ, نقد, ادھار, اسٹاک — for consistency.

---

## 5. Out of scope for this round

Explicitly **not** doing now (write down as "v1.4 candidates" if you discover them):

- Returns / refunds (would need stock + ledger reversal).
- Editing or deleting a sale or stock-in after submission.
- Per-product profit reports (will fall out naturally from sale_items.cost_at_sale once it's correctly populated, but the reports view itself is a v2 item per PRD §18).
- Replaying historical avg_cost for old purchases.
- Dropping the legacy `products.cost` column.
- Any test infrastructure (Playwright, Vitest). The user explicitly said skip.
- Payment gateway. Still manual.

---

## 6. Implementation order

Do strictly in this sequence. Each step is independently verifiable.

1. **Discovery report** in chat (§Phase A).
2. **Migration `00XX_v13_avg_cost_and_links.sql`** applied via MCP (schema + functions + RLS patches). Regenerate `database.ts`.
3. **Backfill verification**: spot-check 3–5 products to confirm `avg_cost` ≈ old `cost`.
4. **Stock-in flow** (`record_purchase` RPC end-to-end + `/purchases/:id` detail view). Verify avg_cost updates correctly with the worked example from §2.1.
5. **Product list** displays `avg_cost` and `last_purchase_cost`.
6. **POS** — editable unit price + below-avg-cost warning + `record_sale` RPC.
7. **Sales module** — `/sales` list with filters and `/sales/:id` detail.
8. **Khata view upgrade** — linked invoice column + running balance.
9. **Mutation layer audit** for the false-error bug. Fix root cause(s). Spot-check customers, expenses, products, stock-in, sale, receive-payment.
10. **Nitty-gritty sweep** (§1.2) on the screens you've touched.
11. **i18n pass** — confirm no hard-coded strings on new screens. Add UR translations.
12. **Manual smoke test** with two accounts:
    - Account A: signup → onboard → add 2 products → stock-in twice with different costs → confirm avg_cost matches the formula → make a cash sale and a credit sale → receive partial payment → check sales list, sale detail, customer khata, stock-in detail.
    - Account B: confirm B never sees A's data anywhere.
13. **Report back** with: what changed, what you found in discovery, any unresolved bugs, any spec ambiguities you resolved (and how).

---

## 7. Acceptance criteria

The patch is done when **all** of the following hold:

- [ ] Creating a customer / stock-in / expense / product / sale shows a success toast and **never** an error toast when the row was actually created.
- [ ] Recording a stock-in updates `products.avg_cost` per the WAC formula. Verified with the 5@50 + 10@40 = 43.33 example.
- [ ] Product list shows avg cost and last purchase cost; both render correctly in EN and UR locale formats.
- [ ] POS allows editing unit price per cart line; the modified line shows a "Modified" badge; selling below avg cost shows a soft warning but is allowed.
- [ ] `sale_items.cost_at_sale` is populated from `products.avg_cost` at the moment of sale (not from the legacy `cost` column).
- [ ] A credit sale creates exactly one `ledger_entries` row with `invoice_id` set.
- [ ] `/sales` lists every invoice for the current shop with working date-range and payment-type filters. Default range = last 7 days.
- [ ] `/sales/:id` shows full sale detail; for credit sales, the khata panel lists the linked ledger entries and links to the customer.
- [ ] `/customers/:id` shows linked invoice per debit row and a correct running balance.
- [ ] `/purchases/:id` shows full stock-in detail with line items and costs.
- [ ] No hard-coded user-facing strings on any new screen — everything routed through i18n in EN and UR.
- [ ] RLS still isolates shops: account B cannot see any of account A's data via any list, detail, RPC, or REST query.
- [ ] No new console errors on any new screen in either language.

---

*End of v1.3 fixes spec.*
