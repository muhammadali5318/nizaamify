-- 0092_v292_definerize_financial_views_and_revoke_cost_at_sale.sql
--
-- v2.9.2 — Close the cost-column leak acknowledged in migration 0091.
--
-- NAMING NOTE: This work was authored under the label "v2.10a" during a
-- session where the security-hardening pass collided with the v2.10
-- feature ticket (returns/refunds/warranty). Renamed to v2.9.2 per
-- `decisions/2026-05-13-v292-naming-collision-with-returns-feature.md`.
-- The migration was APPLIED to production under the historical name
-- `0092_v210_definerize_financial_views_and_revoke_cost_at_sale` and
-- the supabase_migrations.schema_migrations table reflects that. The
-- local file rename is a forward fix; production history is intact.
--
-- CONTEXT
-- -------
-- Mig 0091 added permissive row-read policies on invoices + sale_items so
-- salespersons (who have view_all_sales but not view_sale_cost) can read
-- their own sales rows. The trade-off documented in 0091's header:
--
--   RLS only gates rows, not columns. A salesperson with row visibility
--   can read `sale_items.cost_at_sale` via raw Supabase JS even though the
--   React UI doesn't render it. Acceptable for the v2.9.1 pilot; v2.9.2
--   (originally drafted as v2.10) cleanup must refactor hooks to use
--   *_view + REVOKE SELECT cost columns at the grant layer.
--
-- This migration ships that cleanup. Two-front fix:
--
--   1. Convert the v2.6c `sale_item_financials` + `invoice_financials`
--      views from `security_invoker = true` to `security_invoker = false`
--      (DEFINER). Inside, add the same row-filter that v2.9's
--      `sale_items_view` + `invoices_view` apply (shop scope + cashier
--      check) and NULL-project cost/profit columns conditionally based
--      on `view_sale_cost` / `view_profit_margin`. This closes the
--      via-financials-view leak path: a salesperson direct-querying
--      `sale_item_financials` now sees their own rows with cost_at_sale
--      = NULL, line_cost = NULL, line_profit = NULL.
--
--   2. Column-level REVOKE on `public.sale_items.cost_at_sale` from
--      `authenticated` and `anon`. After REVOKE, raw direct reads of
--      `sale_items.cost_at_sale` fail with permission-denied for every
--      role except the postgres / supabase_admin / service_role roles
--      that own DEFINER views/functions. The DEFINER views still read
--      the column internally (their owner has the grant); they just
--      conditionally NULL-project it back to the caller.
--
-- IMPACT ON DOWNSTREAM CONSUMERS
-- ------------------------------
-- `monthly_summary`, `daily_sales_7`, `expenses_by_category_mtd`, and
-- `purchase_item_financials` are cascade-dropped when invoice_financials
-- and sale_item_financials are dropped (per Postgres view dependency
-- semantics). They are recreated with their original bodies unchanged.
-- They remain `security_invoker = true` because they aggregate from the
-- now-DEFINER financial views; the conditional projection propagates
-- naturally via the aggregate (NULL totals sum to 0 via coalesce).
--
-- HOOK IMPACT
-- -----------
-- `useSale` in src/features/sales/hooks.ts currently nests
-- `sale_items ( ..., cost_at_sale, ... )` in its invoices SELECT. After
-- REVOKE, that nested read fails for every caller. The companion hook
-- patch (separate commit) drops `cost_at_sale` from the nested select;
-- the cost value is read from `sale_item_financials.cost_at_sale`
-- instead, which is now permission-projected.
--
-- AQ IMPACT
-- ---------
-- - AQ-15 unchanged (no new DEFINER functions; views don't count)
-- - AQ-23 unchanged (only RPCs, not views)
-- - AQ-24 unchanged (legacy current_shop_id baseline)
-- - The two views switch from invoker to DEFINER, which would normally
--   be a Supabase advisor warning (security_definer_view); accepted
--   trade-off documented here. Add to the existing exempt list during
--   advisor review.
--
-- ROLLBACK
-- --------
-- A revert script would:
--   1. GRANT SELECT (cost_at_sale) ON public.sale_items TO authenticated;
--   2. Re-create sale_item_financials / invoice_financials as
--      `security_invoker = true` with their original bodies (mig 0052).
--   3. Cascade-restore monthly_summary / daily_sales_7 / etc.
-- The cost-leak returns; mig 0091's permissive policies remain the only
-- gate.

begin;

-- =====================================================================
-- §A. sale_item_financials — DEFINER + permission-aware
-- =====================================================================
-- Cascade drops invoice_financials, monthly_summary, daily_sales_7,
-- expenses_by_category_mtd, purchase_item_financials (verified via the
-- dependency graph in mig 0051 + 0052). All are recreated below.

drop view if exists public.sale_item_financials cascade;

create view public.sale_item_financials
with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select auth.uid()) as caller_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_all_sales')) as can_see_all,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_sale_cost')) as can_see_cost
),
per_line as (
  select
    si.id              as sale_item_id,
    si.invoice_id      as invoice_id,
    si.variant_id      as variant_id,
    si.product_id      as product_id,
    si.qty             as qty,
    si.price_at_sale   as price_at_sale,
    si.cost_at_sale    as cost_at_sale,
    coalesce(si.line_discount_amount, 0)::numeric(12,2) as line_discount_amount,
    ((si.price_at_sale * si.qty) - coalesce(si.line_discount_amount, 0))::numeric(12,2)
                                              as line_value,
    i.shop_id          as inv_shop_id,
    i.cashier_id       as inv_cashier_id
  from public.sale_items si
  join public.invoices i on i.id = si.invoice_id
  cross join caller_perms cp
  where i.shop_id = cp.active_shop_id
    and (cp.can_see_all or i.cashier_id = cp.caller_id)
),
invoice_totals as (
  select
    pl.invoice_id,
    coalesce(i.sale_discount_amount, 0)::numeric(12,2) as sale_discount_amount,
    coalesce(sum(pl.line_value), 0)::numeric(12,2)     as items_subtotal
  from per_line pl
  join public.invoices i on i.id = pl.invoice_id
  group by pl.invoice_id, i.sale_discount_amount
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
    case
      when it.sale_discount_amount > 0 and it.items_subtotal > 0 then
        round((it.sale_discount_amount * pl.line_value / it.items_subtotal)::numeric, 2)
      else 0::numeric(12,2)
    end as raw_share,
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
  -- cost_at_sale gated by view_sale_cost
  case when cp.can_see_cost then rs.cost_at_sale end as cost_at_sale,
  rs.line_discount_amount,
  rs.line_value,
  case
    when rs.rk = 1 then
      round((rs.raw_share + (d.sale_discount_amount - d.sum_raw_shares))::numeric, 2)
    else
      rs.raw_share
  end::numeric(12,2) as allocated_sale_discount,
  case
    when rs.rk = 1 then
      (rs.line_value - round((rs.raw_share + (d.sale_discount_amount - d.sum_raw_shares))::numeric, 2))::numeric(12,2)
    else
      (rs.line_value - rs.raw_share)::numeric(12,2)
  end as line_revenue,
  -- line_cost gated by view_sale_cost
  case when cp.can_see_cost
       then (rs.cost_at_sale * rs.qty)::numeric(12,2)
       end as line_cost,
  -- line_profit gated by view_sale_cost
  case when cp.can_see_cost then
    case
      when rs.rk = 1 then
        ((rs.line_value - round((rs.raw_share + (d.sale_discount_amount - d.sum_raw_shares))::numeric, 2))
          - (rs.cost_at_sale * rs.qty))::numeric(12,2)
      else
        ((rs.line_value - rs.raw_share) - (rs.cost_at_sale * rs.qty))::numeric(12,2)
    end
  end as line_profit
from raw_shares rs
join delta_per_invoice d on d.invoice_id = rs.invoice_id
cross join caller_perms cp;

grant select on public.sale_item_financials to authenticated;

-- =====================================================================
-- §B. invoice_financials — DEFINER + permission-aware (recreated)
-- =====================================================================

create view public.invoice_financials
with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select auth.uid()) as caller_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_all_sales')) as can_see_all,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_sale_cost')) as can_see_cost,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_profit_margin')) as can_see_margin
)
select
  i.id as invoice_id, i.shop_id, i.customer_id, i.created_at, i.payment_type,
  i.amount_paid, i.total as stored_total,
  coalesce(sum(sif.line_value), 0)::numeric(12,2) as items_subtotal,
  coalesce(i.sale_discount_amount, 0)::numeric(12,2) as sale_discount_amount,
  coalesce(sum(sif.line_revenue), 0)::numeric(12,2) as post_discount_items,
  coalesce(i.service_charge, 0)::numeric(12,2) as service_charge,
  (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0))::numeric(12,2) as revenue,
  -- total_cost gated by view_sale_cost
  case when cp.can_see_cost
       then coalesce(sum(sif.line_cost), 0)::numeric(12,2)
       end as total_cost,
  -- gross_profit gated by view_sale_cost
  case when cp.can_see_cost
       then (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)
             - coalesce(sum(sif.line_cost), 0))::numeric(12,2)
       end as gross_profit,
  -- gross_margin_percent gated by view_profit_margin
  case when cp.can_see_margin and
            (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)) > 0
       then round(((coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)
                    - coalesce(sum(sif.line_cost), 0))
                   / (coalesce(sum(sif.line_revenue), 0) + coalesce(i.service_charge, 0)) * 100)::numeric, 2)
       end as gross_margin_percent,
  greatest(0, i.total - coalesce(i.amount_paid, 0))::numeric(12,2) as outstanding
from public.invoices i
left join public.sale_item_financials sif on sif.invoice_id = i.id
cross join caller_perms cp
where i.shop_id = cp.active_shop_id
  and (cp.can_see_all or i.cashier_id = cp.caller_id)
group by i.id, i.shop_id, i.customer_id, i.created_at, i.payment_type,
         i.amount_paid, i.total, i.sale_discount_amount, i.service_charge,
         cp.can_see_cost, cp.can_see_margin;

grant select on public.invoice_financials to authenticated;

-- =====================================================================
-- §C. monthly_summary — recreated unchanged (security_invoker = true)
-- =====================================================================
-- Aggregates from invoice_financials.revenue + .gross_profit. Inherits
-- conditional projection: non-cost-viewers see gross_profit = 0 because
-- the underlying view NULL-projects line_cost (sum of NULLs + coalesce
-- = 0). total_sales remains real (revenue is never gated).

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

grant select on public.monthly_summary to authenticated;

-- =====================================================================
-- §D. daily_sales_7 — recreated unchanged
-- =====================================================================

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

grant select on public.daily_sales_7 to authenticated;

-- Note: expenses_by_category_mtd and purchase_item_financials do not
-- depend on invoice_financials / sale_item_financials in their bodies,
-- so they are NOT cascade-dropped above. They remain in place
-- unmodified.

-- =====================================================================
-- §E. Column-level REVOKE — close the raw-table leak
-- =====================================================================
-- After this REVOKE, direct .from('sale_items').select('cost_at_sale')
-- fails for `authenticated` and `anon`. The DEFINER views above remain
-- the only access path; both NULL-project the column based on
-- view_sale_cost.
--
-- Note: postgres / supabase_admin / service_role retain SELECT
-- privilege; service_role is the role Supabase uses internally for
-- admin scripts. Application code paths run as `authenticated`.

revoke select (cost_at_sale) on public.sale_items from authenticated;
revoke select (cost_at_sale) on public.sale_items from anon;

commit;
