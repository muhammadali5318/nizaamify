# Phase A.4 — Owner Regression Test Plan (v2.9.1 pre-flight)

**Goal:** click through every owner workflow in the live app against the
v2.9 backend (post migration `0086_ledger_audit_at_insert`). Any
broken behavior is a **v2.9 residual defect** that must be fixed before
v2.9.1 implementation starts — it is NOT a v2.9.1 task.

**Setup:**

1. `npm run dev` → http://localhost:5173
2. Sign in as your existing owner account
3. Open browser devtools (Network + Console tabs) to catch silent 4xx/5xx
4. Toggle to your usual language (EN or UR — exercise the one you'll
   pilot in first)

**How to use this checklist:** mark `[x]` next to each step that passes,
`[FAIL: <one-line description>]` next to anything that breaks, and add
notes inline. Defects are summarized at the bottom.

**What "fail" looks like:**
- Action button doesn't do anything
- Form submit throws a Postgres error in Network tab (look for `42501`
  RLS violation, `P0001` raise, anything red)
- Page renders blank / spinner forever
- Numbers don't match the prior view (especially money / stock)
- Console shows red errors (uncaught exceptions)

---

## A. Sales — cash + credit + ledger paths

### A.1 — Cash sale, no discount, single product

- [ ] `/pos` loads; product list renders with prices
- [ ] Search for a product, click `+` → adds to cart
- [ ] Cart shows correct subtotal
- [ ] Click "Complete sale" → cash → confirm
- [ ] Receipt page renders; print button works
- [ ] Navigate to `/sales`, the new invoice appears at top
- [ ] Open it from `/sales`; line items, qty, totals match
- [ ] Stock decremented (check on `/products/:id`)

**Watch for:** Network tab — should hit `record_sale` (or `record_sale_v28` is fine if it's a wrapper that delegates). No 42501.

### A.2 — Cash sale with sale-level discount

- [ ] Add 2+ items
- [ ] Apply 10% sale-level discount in cart
- [ ] Complete
- [ ] Sale detail: per-line profit reflects the largest-remainder allocation of the discount (v2.6c invariant)
- [ ] Dashboard MTD gross profit reflects the discounted amount (invoice_financials.gross_profit)

### A.3 — Credit sale (the ledger-fix path)

- [ ] Create/pick a customer at POS
- [ ] Complete sale on credit
- [ ] Receipt renders
- [ ] `/customers/:id` shows new outstanding balance
- [ ] `/khata` shows customer in the outstanding list

**Critical:** Migration 0086 was the fix here. If you see `P0001 ledger_entries are append-only` in Network/Console, it means 0086 didn't actually fix it under real client traffic → HALT.

### A.4 — Receive payment (full settle)

- [ ] On `/customers/:id` or `/khata`, click "Receive payment"
- [ ] Enter full outstanding amount → submit
- [ ] Outstanding drops to 0
- [ ] Ledger entry appears in customer history with type=credit
- [ ] `created_by_user_id` is populated (verify via Supabase Studio if you have access, otherwise trust the migration)

### A.5 — Receive payment (partial)

- [ ] Open another customer with outstanding > 0 (or recreate via A.3)
- [ ] Enter half the outstanding → submit
- [ ] Outstanding drops to the remainder

### A.6 — Reverse a ledger entry

- [ ] Pick a non-sale-tied ledger entry (e.g. a payment from A.4 or A.5)
- [ ] Reverse it
- [ ] Customer outstanding goes back up
- [ ] Reversal row visible in customer history

**Watch for:** ledger immutability triggers. Reversal must be done via `reverse_ledger_entry` RPC, NOT a direct UPDATE.

### A.7 — Sale detail page deep-dive

- [ ] Open any past sale
- [ ] Cost / profit columns visible (you're owner — `view_sale_cost` is implicit)
- [ ] Per-line profit + total profit reconcile
- [ ] If the line is a batched product, batch_no shows under the product name

---

## B. Products / variants / categories

### B.1 — Create product (simple, no variants, no batches)

- [ ] `/products` → "Add product"
- [ ] Fill name, category, price (optional)
- [ ] Submit
- [ ] Redirects to detail or returns to list with new row

### B.2 — Create product with batches enabled

- [ ] Same as B.1 but check "has_batches"
- [ ] Try to set opening stock → should be blocked (`cannot_seed_opening_stock_for_batched_product`)
- [ ] Save without opening stock → succeeds

### B.3 — Edit product

- [ ] `/products/:id` → "Edit"
- [ ] Change name, price, save
- [ ] List reflects new values

**Watch for:** as owner, the product UPDATE goes through direct-write (group C from v2.9.0.1 sweep). It should work via the v2.9 RLS policy that admits the owner via `is_owner=true`. If 42501, that's a regression.

### B.4 — Archive product

- [ ] Toggle `is_active = false` from edit dialog
- [ ] Product disappears from default list filter

**Watch for:** `archive_product_trigger_gate` (per ADR #16). This is enforced server-side via trigger when `archive_product` permission is missing. Owner bypasses via implicit shortcut.

### B.5 — Variant management

- [ ] Pick a product with `has_variants` (or convert one)
- [ ] Add a new variant via product detail page
- [ ] Update its stock by recording a stock-in

### B.6 — Categories CRUD

- [ ] `/products` → category filter dropdown
- [ ] "+ Create new category" inline → creates
- [ ] Settings page (or wherever — check if there's a categories management surface) → edit/deactivate

### B.7 — Variant attributes (settings → variant attributes)

- [ ] Open settings page section for variant attributes
- [ ] Add a new attribute (e.g. "Material")
- [ ] Add values
- [ ] Use it when adding a variant via B.5

### B.8 — Product packs

- [ ] On a non-batched product, define a pack (e.g. "box of 12")
- [ ] Verify it appears in POS as a quick-add chip

---

## C. Customers + Khata

### C.1 — Create customer (full)

- [ ] `/customers` → "Add customer"
- [ ] Name + phone + address + tier → save
- [ ] Appears in list

**Watch for:** v2.9.0.1 migrated `useCreateCustomer` to `create_customer_full` RPC. Should hit that.

### C.2 — Edit customer

- [ ] Open customer detail → edit
- [ ] Change name / phone / address → save

### C.3 — Delete customer

- [ ] Verify the delete button is **NOT present** on `/customers`
  (per v2.9.0.1 the UI was removed; v2.10 will add deactivate)

### C.4 — Customer tier assignment

- [ ] Open customer detail → assign or change tier
- [ ] Verify tier badge updates on list

### C.5 — Customer outstanding visible

- [ ] Customer detail shows outstanding balance numeric value
  (you're owner — `view_customer_outstanding` is implicit)

### C.6 — Khata page

- [ ] `/khata` lists customers with outstanding > 0
- [ ] Total outstanding matches sum of rows

---

## D. Purchases / stock-in / batches

### D.1 — Simple stock-in (non-batched product)

- [ ] `/purchases/new`
- [ ] Add a line with a non-batched product, qty, cost
- [ ] Optional service charges (overhead)
- [ ] Submit
- [ ] Product stock incremented
- [ ] `avg_cost` updated on the variant

### D.2 — Stock-in with batched product

- [ ] Add a line with a `has_batches = true` product
- [ ] Batch fields appear (batch_no auto-prefilled, expiry, warranty)
- [ ] Submit
- [ ] `inventory_batches` row created (verify on product detail page)
- [ ] Stock incremented

### D.3 — Opening stock checkbox

- [ ] In `/purchases/new`, tick "This is opening stock"
- [ ] Submit a purchase
- [ ] Verify the invoice/purchase marked accordingly

### D.4 — Partial write-off

- [ ] Pick a batch with `qty_remaining > 0`
- [ ] On product detail's batches section, click "Write off"
- [ ] Enter partial qty + reason → submit
- [ ] `qty_remaining` decreases by exactly the partial qty

### D.5 — Full write-off → auto-deactivate

- [ ] Pick a batch, write off the full remaining qty
- [ ] Verify the batch flips `is_active=false` automatically (per v2.8.2 trigger)
- [ ] It disappears from active list (unless "show inactive" is toggled)

### D.6 — Suppliers

- [ ] Settings or wherever suppliers are managed → create new supplier
- [ ] Use that supplier in a stock-in
- [ ] Verify supplier list updates

---

## E. Expenses

### E.1 — Create expense

- [ ] `/expenses` → add new
- [ ] Category, amount, date → save

### E.2 — Edit expense (within 24h)

- [ ] Edit the one you just created → save

### E.3 — Edit expense (older than 24h)

- [ ] Pick an old expense → try to edit
- [ ] Either prevented client-side OR server raises an error
- [ ] As owner: should you be allowed? Check the design doc — `edit_expense`
  permission alone doesn't override the 24h window. The owner shortcut
  may or may not override it. Note the actual behavior.

---

## F. Targets

### F.1 — Set monthly target

- [ ] `/targets` → enter sales target / profit targets for current month
- [ ] Save
- [ ] Dashboard MTD progress widget shows progress vs target

---

## G. Dashboard / Reports

### G.1 — Dashboard widgets

- [ ] Today's sales count + total
- [ ] MTD sales / gross profit / net profit (all reading from `invoice_financials` per v2.6c)
- [ ] Outstanding balance widget
- [ ] Target progress widget
- [ ] Inventory alerts widget (expiring soon / warranty)
- [ ] Expired stock widget
- [ ] Expired sales widget (if any sold-expired in window)
- [ ] Quick actions buttons work

### G.2 — Reports page

- [ ] `/reports` loads
- [ ] Last 7 days sales chart
- [ ] Last 6 months summary
- [ ] MTD expenses by category
- [ ] Outstanding balances table
- [ ] All widgets render under 3 seconds

---

## H. Settings

### H.1 — Shop settings (alert defaults)

- [ ] Settings page → "Default alert days" or similar section
- [ ] Edit `default_expiry_alert_days` + `default_warranty_alert_days`
- [ ] Save

**Watch for:** v2.9.0.1 migrated `useUpdateShopAlertDefaults` → `update_shop_settings` RPC. Should hit it.

### H.2 — Expired-sale policy

- [ ] Settings page → "Expired stock sales" section
- [ ] Change radio (Block / Warn / Allow)
- [ ] Save

**Watch for:** v2.9.0.1 migrated `useUpdateShopExpiredSaleSettings` → `update_shop_settings` RPC.

### H.3 — Owner details

- [ ] Settings page → owner details / CNIC etc.
- [ ] Edit a field, save

### H.4 — Subscription state

- [ ] Navigate to `/settings/support` or wherever shows subscription
- [ ] Confirms active / shows correct expiry

### H.5 — Language toggle

- [ ] Switch EN ↔ UR
- [ ] App re-renders with the other language; RTL switches correctly

---

## I. Cross-cutting

### I.1 — Window-focus cache refresh

- [ ] Open dashboard, look at outstanding total
- [ ] Record a payment from `/khata`
- [ ] Switch back to dashboard tab
- [ ] Outstanding total refetches within ~1s (5min staleness + focus refetch)

### I.2 — Refresh page (no client cache)

- [ ] Hard-reload (Ctrl+Shift+R) the dashboard
- [ ] All widgets repopulate without errors

### I.3 — Logout / login round-trip

- [ ] Sign out → back to /login
- [ ] Sign in again → dashboard shows current data

---

## Defect log

Record any FAIL items here with: file path or page name, what happened, browser console / network errors, expected behavior.

| # | Workflow | Symptom | Expected | Priority |
|---|----------|---------|----------|----------|
| | | | | |

If the defect log is empty → Phase A.4 PASS. Proceed to Phase A.5 stop check.

If defects exist → halt the v2.9.1 roadmap. Fix the residuals first. Each defect should produce either: (a) a fix migration + frontend patch, or (b) an ADR documenting accepted behavior.
