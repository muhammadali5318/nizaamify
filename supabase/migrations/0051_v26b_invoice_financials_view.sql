-- v2.6 hardening (Stage 2 folded-in scope from Stage 1) — single source of
-- truth for invoice / per-line profit math.
--
-- Two views land in this migration:
--
--   public.sale_item_financials
--       One row per sale_items row. Computes per-line revenue & profit with
--       the invoice's sale_discount_amount allocated pro-rata by line value
--       via the v2.3 largest-remainder method (correction goes to the line
--       with the highest line_value; ties broken by sale_item.id). Per-line
--       shares sum to sale_discount_amount exactly.
--
--   public.invoice_financials
--       One row per invoice. Aggregates from sale_item_financials and
--       layers in the invoice-level service_charge. The view is the single
--       source of truth that frontend display and report-aggregation views
--       both consume.
--
-- After this lands, the v2.6 stack-discipline becomes:
--   items_subtotal   = Σ (price_at_sale × qty − line_discount_amount)
--   post_discount    = items_subtotal − sale_discount_amount
--   revenue          = post_discount + service_charge        (= invoices.total)
--   total_cost       = Σ (cost_at_sale × qty)                  (items only)
--   gross_profit     = revenue − total_cost
--                    = post_discount + service_charge − total_cost
--
-- The v2.3 stacking discipline (negotiated → line disc → sale disc →
-- + service) is honoured exactly. Service is pure revenue (no associated
-- cost-of-goods); it flows into both `revenue` and `gross_profit`.
--
-- This migration also rewrites the v1.7-era monthly_summary view body so
-- the dashboard / reports gross_profit aggregates from invoice_financials
-- instead of the buggy (price_at_sale − cost_at_sale) × qty formula that
-- predates v2.2 line discounts and v2.3 sale-level discounts.
--
-- Decision: 2026-05-12-invoice-financials-single-source-of-truth.md

-- ============================================================================
-- §A. sale_item_financials — per-line allocation in pure SQL
-- ============================================================================

drop view if exists public.sale_item_financials cascade;
create view public.sale_item_financials
with (security_invoker = true) as
with per_line as (
  select
    si.id              as sale_item_id,
    si.invoice_id      as invoice_id,
    si.variant_id      as variant_id,
    si.product_id      as product_id,
    si.qty             as qty,
    si.price_at_sale   as price_at_sale,
    si.cost_at_sale    as cost_at_sale,
    coalesce(si.line_discount_amount, 0)::numeric(12,2) as line_discount_amount,
    -- line_value = price*qty − line_discount, the v2.2 line-after-discount value
    ((si.price_at_sale * si.qty) - coalesce(si.line_discount_amount, 0))::numeric(12,2)
                                              as line_value
  from public.sale_items si
),
invoice_totals as (
  select
    i.id                              as invoice_id,
    coalesce(i.sale_discount_amount, 0)::numeric(12,2) as sale_discount_amount,
    coalesce(sum(p.line_value), 0)::numeric(12,2)       as items_subtotal
  from public.invoices i
  left join per_line p on p.invoice_id = i.id
  group by i.id, i.sale_discount_amount
),
raw_shares as (
  select
    pl.sale_item_id,
    pl.invoice_id,
    pl.variant_id,
    pl.product_id,
    pl.qty,
    pl.price_at_sale,
    pl.cost_at_sale,
    pl.line_discount_amount,
    pl.line_value,
    it.sale_discount_amount,
    it.items_subtotal,
    -- Pro-rata raw share, 2dp; 0 when the invoice has no sale-level discount
    -- or no items (zero-divide guard).
    case
      when it.sale_discount_amount > 0 and it.items_subtotal > 0 then
        round((it.sale_discount_amount * pl.line_value / it.items_subtotal)::numeric, 2)
      else 0::numeric(12,2)
    end as raw_share,
    -- Rank for the largest-remainder correction. Highest line_value wins; ties
    -- broken by sale_item_id for determinism.
    row_number() over (
      partition by pl.invoice_id
      order by pl.line_value desc, pl.sale_item_id
    ) as rk
  from per_line pl
  join invoice_totals it on it.invoice_id = pl.invoice_id
),
delta_per_invoice as (
  select
    invoice_id,
    sale_discount_amount,
    coalesce(sum(raw_share), 0)::numeric(12,2) as sum_raw_shares
  from raw_shares
  group by invoice_id, sale_discount_amount
)
select
  rs.sale_item_id,
  rs.invoice_id,
  rs.variant_id,
  rs.product_id,
  rs.qty,
  rs.price_at_sale,
  rs.cost_at_sale,
  rs.line_discount_amount,
  rs.line_value,
  -- Allocated sale-discount share: raw + (sale_discount − Σraw) on the rk=1
  -- line (the highest-value line), raw otherwise. Sum-across-invoice =
  -- sale_discount_amount exactly.
  case
    when rs.rk = 1 then
      round((rs.raw_share + (d.sale_discount_amount - d.sum_raw_shares))::numeric, 2)
    else
      rs.raw_share
  end::numeric(12,2) as allocated_sale_discount,
  -- line_revenue = price*qty − line_disc − allocated sale-disc share
  case
    when rs.rk = 1 then
      (rs.line_value - round((rs.raw_share + (d.sale_discount_amount - d.sum_raw_shares))::numeric, 2))::numeric(12,2)
    else
      (rs.line_value - rs.raw_share)::numeric(12,2)
  end as line_revenue,
  (rs.cost_at_sale * rs.qty)::numeric(12,2) as line_cost,
  -- line_profit = line_revenue − line_cost
  case
    when rs.rk = 1 then
      ((rs.line_value - round((rs.raw_share + (d.sale_discount_amount - d.sum_raw_shares))::numeric, 2))
        - (rs.cost_at_sale * rs.qty))::numeric(12,2)
    else
      ((rs.line_value - rs.raw_share) - (rs.cost_at_sale * rs.qty))::numeric(12,2)
  end as line_profit
from raw_shares rs
join delta_per_invoice d on d.invoice_id = rs.invoice_id;

-- ============================================================================
-- §B. invoice_financials — aggregate per invoice
-- ============================================================================

drop view if exists public.invoice_financials cascade;
create view public.invoice_financials
with (security_invoker = true) as
select
  i.id            as invoice_id,
  i.shop_id       as shop_id,
  i.customer_id   as customer_id,
  i.created_at    as created_at,
  i.payment_type  as payment_type,
  i.amount_paid   as amount_paid,
  i.total         as stored_total,
  -- Pre-discount item revenue (post line discounts)
  coalesce(sum(sif.line_value), 0)::numeric(12,2) as items_subtotal,
  coalesce(i.sale_discount_amount, 0)::numeric(12,2) as sale_discount_amount,
  -- Post-sale-discount items (= items_subtotal − sale_discount_amount)
  coalesce(sum(sif.line_revenue), 0)::numeric(12,2) as post_discount_items,
  coalesce(i.service_charge, 0)::numeric(12,2) as service_charge,
  -- Top-line revenue: post-discount items + service. Equals invoices.total.
  (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0))::numeric(12,2) as revenue,
  -- Items-only cost. Service has no cost-of-goods component.
  coalesce(sum(sif.line_cost), 0)::numeric(12,2) as total_cost,
  -- Gross profit = revenue − total_cost. Service flows through as pure profit.
  (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)
   - coalesce(sum(sif.line_cost), 0))::numeric(12,2) as gross_profit,
  -- Gross margin %, 2dp. NULL when revenue is 0.
  case
    when (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)) > 0 then
      round(
        ((coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)
          - coalesce(sum(sif.line_cost), 0))
         / (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)) * 100)::numeric,
        2
      )
    else null
  end as gross_margin_percent
from public.invoices i
left join public.sale_item_financials sif on sif.invoice_id = i.id
group by i.id, i.shop_id, i.customer_id, i.created_at, i.payment_type,
         i.amount_paid, i.total, i.sale_discount_amount, i.service_charge;

-- ============================================================================
-- §C. monthly_summary.gross_profit — aggregate from invoice_financials.
--      Column shape unchanged so CREATE OR REPLACE keeps existing readers
--      (Dashboard, Reports) working.
-- ============================================================================

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
  m.shop_id,
  m.month,
  coalesce(
    (select sum(if2.revenue)
       from public.invoice_financials if2
      where if2.shop_id = m.shop_id
        and date_trunc('month', if2.created_at at time zone 'utc')::date = m.month), 0
  )::numeric(12,2) as total_sales,
  coalesce(
    (select sum(if2.gross_profit)
       from public.invoice_financials if2
      where if2.shop_id = m.shop_id
        and date_trunc('month', if2.created_at at time zone 'utc')::date = m.month), 0
  )::numeric(12,2) as gross_profit,
  coalesce(
    (select sum(e.amount)
       from public.expenses e
      where e.shop_id = m.shop_id
        and date_trunc('month', e.expense_date)::date = m.month), 0
  )::numeric(12,2) as total_expenses
from months m;
