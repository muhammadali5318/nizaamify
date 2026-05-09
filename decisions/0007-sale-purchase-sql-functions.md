# 0007 — `record_sale` and `record_purchase` as SQL functions

## Context

PRD §16 (Week 3–4) mentions atomic stock-deduction inside a Postgres function (`record_sale`), but PRD §15's migration list omits it. A POS sale touches `invoices` + `sale_items` + `products.stock` (decrement) + optionally `ledger_entries` (credit sale) — must succeed or fail as one. Same atomicity concern for stock-in, which writes `purchases` + `purchase_items` + `products.stock` (increment).

## Decision

Add a new migration `0009_sale_purchase_functions.sql` containing:

- `record_sale(p_shop_id uuid, p_customer_id uuid, p_payment_type text, p_service_charge numeric, p_items jsonb)` — returns the new invoice id. Inside one transaction:
  1. Insert into `invoices` (snapshot total, payment_type, cashier_id = `auth.uid()`).
  2. For each item in `p_items`: insert into `sale_items` (qty, snapshot price + cost), update `products` set `stock = stock - qty`. Reject if stock would go negative.
  3. If `payment_type = 'credit'`: insert a `ledger_entries` debit row tied to this invoice + customer.
- `record_purchase(p_shop_id uuid, p_source text, p_note text, p_purchase_date date, p_items jsonb)` — symmetric: insert into `purchases` + `purchase_items`, update `products.stock = stock + qty`, snapshot `cost_at_purchase`.

Both `security definer`, with `set search_path = public`, and validated against `current_shop_id() = p_shop_id` to prevent cross-shop writes.

## Alternatives considered

- **Multiple round-trips from the client** — race conditions on stock; partial-write risk if the network drops mid-flow. Rejected.
- **Edge Function in TypeScript** — adds deployment surface; cold starts; less efficient than in-DB transaction. Rejected for MVP.

## Consequences

- Frontend calls one RPC per sale — simple and atomic.
- Stock cannot go negative (DB-enforced).
- `cashier_id` always equals the authenticated user; no cross-shop spoofing.
- Schema constraint on `sale_items.qty > 0` and `products.stock >= 0` (already in PRD §10) gives a backstop.
