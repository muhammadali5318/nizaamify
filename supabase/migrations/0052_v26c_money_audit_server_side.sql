-- v2.6c hardening — eliminate JS Number arithmetic on money paths.
--
-- Stage 1 forensics + the broader no-JS-Number-on-money discipline (from the
-- mission directive §2.X.6) requires every money computation to happen in
-- Postgres with numeric type, never in JS. Five frontend sites were
-- computing money values via Number() arithmetic:
--
--   1. SaleDetailPage.tsx:81  — itemsSubtotal sum (display)
--   2. SaleDetailPage.tsx:173 — line_total cell  (display)
--   3. reports/hooks.ts:24,72 — daily sales bucket + expenses-by-category bucket
--   4. PurchaseDetailPage.tsx:63,170 — line subtotal + cost delta (display)
--   5. SalesListPage.tsx:99 — outstanding-credit per row (display)
--
-- (1) and (2) already resolve via the v2.6b sale_item_financials /
-- invoice_financials views from migration 0051. The remaining three sites
-- need server-side surfaces:
--
--   • invoice_financials gains an `outstanding` column (= stored_total
--     − amount_paid, floor 0). Sales list reads from here.
--   • New purchase_item_financials view exposes per-line subtotal +
--     cost_delta. Purchase detail reads from here.
--   • New daily_sales_7 view returns the last-7-days sales bucket. Reports
--     reads from here, replacing its client-side reduce.
--   • New monthly_expenses_by_category view groups expenses by category for
--     a (shop_id, month). Reports MTD chart reads from here.
--
-- All money columns numeric(12,2). All sums + arithmetic happen in SQL.

-- ============================================================================
-- §A. invoice_financials gets an `outstanding` column.
--      DROP + CREATE to change the return shape (column added at end).
-- ============================================================================

drop view if exists public.invoice_financials cascade;
create view public.invoice_financials
with (security_invoker = true) as
select
  i.id as invoice_id, i.shop_id, i.customer_id, i.created_at, i.payment_type,
  i.amount_paid, i.total as stored_total,
  coalesce(sum(sif.line_value), 0)::numeric(12,2) as items_subtotal,
  coalesce(i.sale_discount_amount, 0)::numeric(12,2) as sale_discount_amount,
  coalesce(sum(sif.line_revenue), 0)::numeric(12,2) as post_discount_items,
  coalesce(i.service_charge, 0)::numeric(12,2) as service_charge,
  (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0))::numeric(12,2) as revenue,
  coalesce(sum(sif.line_cost), 0)::numeric(12,2) as total_cost,
  (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)
   - coalesce(sum(sif.line_cost), 0))::numeric(12,2) as gross_profit,
  case
    when (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)) > 0 then
      round(((coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)
              - coalesce(sum(sif.line_cost), 0))
             / (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)) * 100)::numeric, 2)
    else null
  end as gross_margin_percent,
  -- v2.6c: outstanding credit for sales list display.
  greatest(0, i.total - coalesce(i.amount_paid, 0))::numeric(12,2) as outstanding
from public.invoices i
left join public.sale_item_financials sif on sif.invoice_id = i.id
group by i.id, i.shop_id, i.customer_id, i.created_at, i.payment_type,
         i.amount_paid, i.total, i.sale_discount_amount, i.service_charge;

-- Recreate monthly_summary that read from invoice_financials.
create or replace view public.monthly_summary
with (security_invoker = true)
as
with months as (
  select distinct shop_id, date_trunc('month', created_at at time zone 'utc')::date as month
    from public.invoices
  union
  select distinct shop_id, date_trunc('month', expense_date)::date
    from public.expenses
)
select
  m.shop_id, m.month,
  coalesce(
    (select sum(if2.revenue) from public.invoice_financials if2
      where if2.shop_id = m.shop_id
        and date_trunc('month', if2.created_at at time zone 'utc')::date = m.month), 0
  )::numeric(12,2) as total_sales,
  coalesce(
    (select sum(if2.gross_profit) from public.invoice_financials if2
      where if2.shop_id = m.shop_id
        and date_trunc('month', if2.created_at at time zone 'utc')::date = m.month), 0
  )::numeric(12,2) as gross_profit,
  coalesce(
    (select sum(e.amount) from public.expenses e
      where e.shop_id = m.shop_id
        and date_trunc('month', e.expense_date)::date = m.month), 0
  )::numeric(12,2) as total_expenses
from months m;

-- ============================================================================
-- §B. purchase_item_financials — per-line subtotal + cost delta.
-- ============================================================================

drop view if exists public.purchase_item_financials cascade;
create view public.purchase_item_financials
with (security_invoker = true) as
select
  pi.id as purchase_item_id,
  pi.purchase_id,
  pi.variant_id,
  pi.product_id,
  pi.qty,
  pi.qty_in_base,
  pi.cost_at_purchase,
  pi.pack_id,
  pi.pack_qty,
  pi.pack_base_qty_snapshot,
  pi.line_overhead_amount,
  pi.overhead_per_unit,
  pi.avg_cost_before,
  pi.avg_cost_after,
  -- Subtotal: invoiced units × cost. For pack lines, the pack_qty is the
  -- invoiced unit-count; for base-unit lines, qty IS the invoiced count.
  (coalesce(pi.pack_qty, pi.qty) * pi.cost_at_purchase)::numeric(12,2)
                                                   as line_subtotal,
  -- Cost delta (avg_cost_after − avg_cost_before). NULL on legacy rows
  -- where either side wasn't snapshotted.
  case
    when pi.avg_cost_before is null or pi.avg_cost_after is null then null
    else (pi.avg_cost_after - pi.avg_cost_before)::numeric(12,2)
  end                                              as cost_delta
from public.purchase_items pi;

-- ============================================================================
-- §C. daily_sales_7 — last 7 days bucketed daily totals for the reports chart.
--      Used by ReportsPage's "last 7 days" line chart.
-- ============================================================================

drop view if exists public.daily_sales_7 cascade;
create view public.daily_sales_7
with (security_invoker = true) as
with days as (
  select generate_series(current_date - interval '6 days', current_date, '1 day')::date as day
)
select
  d.day,
  coalesce(
    (select sum(if2.revenue) from public.invoice_financials if2
      where if2.shop_id = public.current_shop_id()
        and (if2.created_at at time zone 'utc')::date = d.day), 0
  )::numeric(12,2) as total_sales
from days d;

-- ============================================================================
-- §D. expenses_by_category_mtd — month-to-date expense aggregation per category.
-- ============================================================================

drop view if exists public.expenses_by_category_mtd cascade;
create view public.expenses_by_category_mtd
with (security_invoker = true) as
select
  e.category,
  sum(e.amount)::numeric(12,2) as total_amount,
  count(*)::int as expense_count
from public.expenses e
where e.shop_id = public.current_shop_id()
  and date_trunc('month', e.expense_date)::date = date_trunc('month', current_date)::date
group by e.category;
