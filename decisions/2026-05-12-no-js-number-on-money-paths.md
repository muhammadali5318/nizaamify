# No JS Number arithmetic on money paths

## Context

Stage 1 forensics traced the P0 profit calculation bug to TWO independent
sites that each computed money totals in JS (TypeScript `Number()`). The
two paths drifted from each other: SaleDetailPage's JS sum ignored the
invoice's `sale_discount_amount`, while `monthly_summary` (a server view)
did account for it — so the displayed profit on a sale page disagreed
with the dashboard total for the same sale.

Beyond the specific bug, every JS-side money computation creates three
risks:

1. **Drift between display sites** — two callers compute the same value
   independently and quietly diverge as the model evolves (which is
   exactly what happened to profit).
2. **Floating-point imprecision** — JS `Number` is IEEE-754 binary
   float. `0.1 + 0.2 = 0.30000000000000004`. Postgres `numeric(12,2)`
   has no such drift; canonical answers must come from there.
3. **Coupling to client knowledge of the model** — if the discount
   stacking order changes (v2.2 → v2.3 demonstrated this), every JS
   site needs to be updated. A SQL view changes once.

## Decision

**Authoritative money totals are always computed in Postgres and read by
the frontend. JS may only cast `Number(...)` at the display boundary
(into `formatPKR()`), never to participate in arithmetic.**

Concretely:

- **Display paths (post-write)** — any page rendering data that exists
  in the DB MUST read totals from a SQL view. The frontend pulls the
  precomputed `numeric(12,2)` and casts to `Number` only for
  `Intl.NumberFormat`. No `+ - * /` between Number values that
  represent money.
- **Composition paths (pre-write)** — POS cart and NewPurchase form
  necessarily compute previews in JS because no DB row exists yet.
  These are explicitly **cosmetic**; the authoritative number arrives
  back from `record_sale` / `record_purchase` and downstream display
  paths read from views. Composition previews are not a violation of
  the discipline because the JS value never leaves the screen.

### Server-side views established (v2.6c)

| View | Purpose | Replaces JS site |
|------|---------|------------------|
| `sale_item_financials` | Per-line: `line_value`, `line_revenue`, `line_cost`, `line_profit`, `allocated_sale_discount` (largest-remainder allocation of `invoices.sale_discount_amount`). | SaleDetailPage qty×price reductions and `line_profit` ad-hoc math. |
| `invoice_financials` | Per-invoice aggregate: `items_subtotal`, `post_discount_items`, `revenue`, `total_cost`, `gross_profit`, `gross_margin_percent`, `outstanding`. | SaleDetailPage `itemsSubtotal` reduce + `total − amount_paid`. |
| `invoices.outstanding` (GENERATED column) | `greatest(0, total − amount_paid)::numeric(12,2)`. Sealed by append-only after insert. | SalesListPage `Math.max(0, Number(r.total) − Number(r.amount_paid))`. |
| `purchase_item_financials` | Per-line: `line_subtotal`, `line_overhead` (effective: `line_overhead_amount` falling back to legacy `overhead_per_unit × qty_in_base`), `line_total`, `cost_delta`. | PurchaseDetailPage `lineSubtotal(...) + lineOverhead(...)` and `avg_after − avg_before` JS subtraction. |
| `daily_sales_7` | Last 7 days of bucketed daily sales for the reports chart. | Reports `useDailySalesLast7` client-side `reduce`. |
| `expenses_by_category_mtd` | Month-to-date expense aggregate per category. | Reports `useExpenseBreakdownThisMonth` client-side `reduce`. |
| `total_outstanding` | Sum of `customer_outstanding.outstanding` for current shop. | Dashboard `useTotalOutstanding` client-side `reduce`. |

All listed views are `security_invoker = true` so RLS applies (per ADR-0015).

## Alternatives considered

1. **Wrap money in a `Decimal` class on the JS side** (e.g. `decimal.js`).
   Eliminates float drift but doesn't address the drift-between-sites
   problem — two pages independently using `Decimal` can still disagree
   if their formulas drift. SQL views give us one formula full stop.
2. **Compute on the client, validate against server.** Adds round-trip,
   adds a "displayed value vs. authoritative value" reconciliation
   problem, and doesn't actually eliminate JS arithmetic — it just adds
   a second layer.
3. **Materialize totals into invoice columns.** `invoices.total` already
   is materialized at insert time. The problem isn't `total` — it's
   the per-line breakdowns (revenue, cost, profit, allocated discount)
   which need allocation across rows. A view computes them on read and
   stays consistent through future formula changes.

## Consequences

- **Frontend hooks always pull from the appropriate `_financials` view
  in parallel with the base entity.** Pattern: `Promise.all([base, financials])`.
- **Pages render the field directly via `formatPKR(Number(field), locale)`.**
  Number cast is allowed at the formatter boundary because the value
  is already authoritative — the cast is purely to feed Intl.
- **POS cart and NewPurchase form preview math is explicitly out of
  scope.** The discipline applies to data-display paths, not composition.
- **Adding a new field to a money-display page requires extending the
  view, not adding a JS computation.** This is enforced socially today;
  if it slips, the audit query suite (Stage 2 audits 1–9) will flag the
  drift between view-computed and stored values.

### Composition-side gap (known, accepted)

`Receipt.tsx` line 65 computes a `subtotal` from `qty × price` lines
passed in by POSPage at submit time. The `total` shown on the receipt
arrives as a prop from the server-recorded invoice, but the per-line
subtotal block is still a JS reduce. The bug-impact is bounded: the
displayed sale-final `total` is server-truth; the subtotal/service-charge
breakdown on a receipt is cosmetic context. Promoting Receipt to refetch
`invoice_financials` by `invoice_id` post-sale is a future improvement
flagged in CLAUDE.md.
