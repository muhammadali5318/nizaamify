# Profit calculation bug — root cause

**Date:** 2026-05-12
**Severity:** P0 (financial correctness)
**Status:** Identified, minimal-fix applied in Stage 1; structural hardening folded into Stage 2 (v2.6)

## Context

User reported two test sales of the same product, both showing displayed
profit = 1,000:

| Invoice | sale-level discount | total | cost@sale × qty | shown profit | correct profit |
|---|---|---|---|---|---|
| `62c622cd` | none | 10,000 | 9,000 | 1,000 | 1,000 ✓ |
| `f9f13521` | 5% (= 500 stored) | 9,500 | 9,000 | 1,000 | **500** ✗ |

Per the CLAUDE.md discount-stacking discipline (v2.2 §1 / v2.3 ADR-0017),
the order is: negotiated price → per-line discount → sale-level discount →
service charge added last. Discounts touch items only, never service. The
correct per-line profit therefore allocates the sale-level discount across
lines and subtracts each line's share from its revenue before subtracting
cost.

## Forensic findings (Phase 1A)

Two distinct profit code paths exist in the repo. They disagree with each
other AND both deviate from the documented stacking order:

1. **Site 1 — `SaleDetailPage.tsx:173-194` (per-line profit on /sales/:id):**
   ```js
   const revenue = price_at_sale * qty - line_discount_amount
   const cost    = cost_at_sale * qty
   const profit  = revenue - cost
   ```
   Subtracts line discount ✓. Ignores sale-level discount ✗.

2. **Site 2 — `monthly_summary.gross_profit` (read by Dashboard + Reports):**
   ```sql
   sum((price_at_sale - cost_at_sale) * qty)
   ```
   Ignores line discount ✗. Ignores sale-level discount ✗.

The user's report is the symptom on Site 1. Site 2 is independently buggier
and over-states MTD gross_profit by the full sum of every discount in the
period.

Both paths predate the discount columns: `monthly_summary` is from v1.7
era (0011); the per-line cell was added in a later sale-detail commit but
copy-pasted the same formula and only added a line-discount subtraction.
Neither was updated when v2.2 introduced line discounts or v2.3 introduced
sale-level discounts.

## Decision

**Bug class: 1 (profit ignores sale-level discount entirely) — manifesting
at TWO independent sites, byproduct of class 5 (paths disagree).**

**Stage 1 minimal fix** (this stage):

- Site 1 (`SaleDetailPage.tsx`): allocate sale-level discount pro-rata by
  line value, subtract each line's share from its revenue before computing
  per-line profit. Largest-remainder allocation so per-line shares sum
  exactly to `invoice.sale_discount_amount` (same pattern as v2.3's
  overhead allocation).

That is the smallest change that makes the reported sales display correctly.

**Stage 2 hardening** (v2.6 — folded-in scope; NOT this stage):

- Replace both Site 1 and Site 2 with a single `invoice_financials` SQL
  view as the single source of truth. SaleDetailPage and monthly_summary
  both read from it. No competing JS / SQL math.
- Add audit queries (zero rows): `stored_total = items_subtotal −
  sale_discount + service`; `revenue ≥ 0, total_cost ≥ 0, gross_profit ≤
  revenue`; `ledger_debit = invoice − amount_paid`.
- Document `record_sale` transaction integrity and `cost_at_sale` snapshot
  timing in dedicated ADRs.
- Decimal precision + no-JS-Number-on-money audits.

The Stage 2 work intentionally REWRITES Site 2 (monthly_summary in 0011 +
0020) — Stage 1's minimal fix to Site 1 stays correct because the v2.6
view returns the same math.

## Alternatives considered

1. **Fix both sites in Stage 1.** Rejected — Stage 1 is forensic + minimal.
   Site 2 lives in a DB view used by two consumers; rewriting it correctly
   means adding aggregate sale_discount accounting to the view, which is
   close to Stage 2's invoice_financials work. Doing both at once collapses
   the staged structure.
2. **Disable the line-profit column entirely until v2.6.** Rejected —
   removing a user-visible column is itself a regression, and Stage 1's
   allocation fix is small.
3. **Show invoice-level gross_profit on the sale detail page instead of
   per-line.** Rejected — per-line profit is informative for the cashier
   when checking that margins held on a discounted multi-line sale. The
   fix makes per-line profit honest, which is more useful than collapsing
   it to one number.

## Consequences

- After Stage 1's fix, the two reported sales display correctly: 1,000 and
  500.
- The dashboard / reports `gross_profit` continues to be over-stated until
  Stage 2 replaces `monthly_summary` with reads from `invoice_financials`.
  Documented in tasks.md / CLAUDE.md.
- For multi-line invoices, Site 1's allocation uses largest-remainder so
  the sum of per-line profits = `total_revenue − total_cost`. No floating
  rounding drift.
- Records (sale_items rows) are unchanged. The fix is purely on the read
  side. No migration needed for Stage 1.

## References

- CLAUDE.md "Discount stacking order is fixed" (v2.2 §1)
- ADR-0017 (v2.3 partial reversion of v2.2)
- `SaleDetailPage.tsx:173-194`
- `monthly_summary` view in `supabase/migrations/0011_dashboard_views.sql`
  (later re-applied in `0020_v18_db_hardening.sql`)
- Stage 2 forthcoming: `2026-05-12-invoice-financials-single-source-of-truth.md`
