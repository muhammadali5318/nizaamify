# `invoice_financials` is the single source of truth for profit

**Date:** 2026-05-12
**Ticket:** v2.6 hardening (Stage 2 folded-in scope from the Stage 1
  profit-calculation P0)
**Status:** Accepted

## Context

The Stage 1 forensic discovery found two independent profit code paths in
the codebase, both wrong, that disagreed with each other:

- `SaleDetailPage.tsx` (per-line cell) — subtracted line discount, ignored
  invoice-level sale-discount.
- `monthly_summary.gross_profit` view (read by Dashboard + Reports) —
  ignored BOTH line discount AND sale-level discount.

Stage 1 patched only the first site with a JS allocation; the
monthly_summary view stayed wrong. Beyond fixing the math, the broader
risk was that any future surface (sales list, reports, COGS dashboard,
P&L) would either reach for the buggy view or invent a third disagreeing
formula.

The hardening directive layered into Stage 2 is to establish exactly one
source of truth for invoice / per-line financial math and make every
surface read from it.

## Decision

Two new SQL views (migration `0051_v26b_invoice_financials_view.sql`),
both `security_invoker = true`:

### `public.sale_item_financials` (one row per sale_items row)

Per-line allocation of `invoice.sale_discount_amount` done in pure SQL via
the v2.3 largest-remainder method: raw shares rounded to 2dp, correction
delta added to the highest-`line_value` line of the invoice (ties broken
by `sale_item_id`), so per-line shares sum to `sale_discount_amount`
exactly.

Columns: `sale_item_id, invoice_id, variant_id, product_id, qty,
price_at_sale, cost_at_sale, line_discount_amount, line_value,
allocated_sale_discount, line_revenue, line_cost, line_profit`. All
money columns `numeric(12,2)`.

### `public.invoice_financials` (one row per invoice)

Aggregates from `sale_item_financials` and layers in
`invoices.service_charge`:

```
items_subtotal       = Σ line_value                    (= Σ (price*qty − line_disc))
sale_discount_amount = invoices.sale_discount_amount   (snapshot)
post_discount_items  = Σ line_revenue                  (= items_subtotal − sale_discount)
service_charge       = invoices.service_charge
revenue              = post_discount_items + service_charge   (= invoices.total)
total_cost           = Σ line_cost                     (= Σ (cost_at_sale × qty))
gross_profit         = revenue − total_cost
gross_margin_percent = round(gross_profit / revenue × 100, 2)  NULL when revenue = 0
```

Service is "pure revenue" — no cost-of-goods, flows through to
`gross_profit` 1:1. The v2.3 stacking discipline (negotiated → line disc
→ sale disc → + service) is honoured exactly.

### Consumers rewritten to read from these views

- `SaleDetailPage.tsx` — per-line profit cell + line-total cell read
  `sale_item_financials.{line_profit, line_revenue,
  allocated_sale_discount}` directly. The Stage-1 JS allocation block is
  deleted.
- `monthly_summary` view — body rewritten to `SUM(invoice_financials.{revenue, gross_profit})`.
  Column shape (`shop_id, month, total_sales, gross_profit,
  total_expenses`) unchanged, so the existing Dashboard + Reports
  consumers continue to work — they just see correct numbers now.

`useSale` hook (`features/sales/hooks.ts`) loads the per-line financials
in a second `from('sale_item_financials')` query and merges by
`sale_item_id`. One extra round trip in exchange for moving every money
calculation server-side.

## Alternatives considered

1. **Per-call recompute in each consumer.** Rejected — Stage 1 showed
   that two independent recompute sites had already drifted into two
   different bugs. The whole point of the hardening is to not have N
   recompute sites.
2. **Materialized view, refreshed on `record_sale`.** Considered for
   perf. Rejected for v2.6b — current volumes (≤ 100k invoices/shop)
   render the views in milliseconds; the `sale_items.invoice_id` btree
   index makes the allocation CTE fast. Revisit if the audit query
   suite or dashboard MTD rollup start to lag.
3. **Compute profit in `record_sale` at write time and snapshot to a new
   column.** Considered. Rejected because the math depends on
   `invoice.sale_discount_amount` AND every line's `cost_at_sale` AND
   every line's `line_discount_amount` — that's already all snapshotted
   on the rows, so a view computes the same thing without a write-time
   join + a writable mirror that could drift.
4. **JS recompute (cleaner version of Stage 1).** Rejected — violates the
   no-JS-Number-on-money discipline being formalized in this same stage.
5. **Replace `cost_at_sale` semantics so it includes discount allocation
   pre-snapshot.** Rejected — `cost_at_sale` is COGS, not net-of-discount
   revenue cost. Don't conflate.

## Consequences

- The two reported sales now display correct profit on `/sales/:id`
  AND contribute correctly to `monthly_summary.gross_profit` (Dashboard
  MTD figure is no longer over-stated).
- New `audit_7` query (added in `decisions/2026-05-12-stage2-audit-extensions.md`)
  cross-checks `invoice_financials.stored_total` against the computed
  revenue formula; this catches any future divergence between
  `invoices.total` (written by `record_sale`) and the view-side
  recomputation.
- `useSale` now fires two queries (invoice + financials). Negligible —
  both hit the same row set via the same indexes; the financials view
  evaluation is trivially short.
- Any new profit / margin surface (P&L, COGS report, per-product
  profitability) reads from these views or extends them. No JS or one-off
  SQL profit formulas are permitted; the CLAUDE.md gotcha documents
  this rule.

## References

- ADR-0017 (v2.3 discount stacking: negotiated → line → sale → +service)
- `decisions/2026-05-12-profit-calculation-bug-root-cause.md` (Stage 1)
- Migrations: `0051_v26b_invoice_financials_view.sql`
- Frontend: `src/features/sales/hooks.ts`, `src/features/sales/SaleDetailPage.tsx`
