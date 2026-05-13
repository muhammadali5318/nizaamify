
-- v2.9 Phase B migration 0074: permission-aware views with conditional projection
-- Pattern: WITH caller_perms AS MATERIALIZED (one row of permission flags + active shop)
-- CROSS JOIN with the row source → one helper call per query, not per row.

-- =====================================================================
-- products_view
-- =====================================================================
create or replace view public.products_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_products')) as can_view,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_product_cost')) as can_see_cost
)
select
  p.id, p.shop_id, p.name, p.category_id, p.description, p.type,
  p.base_unit_id, p.is_scan_only, p.is_active,
  p.has_variants, p.has_batches, p.expired_sale_policy,
  p.expiry_alert_days, p.warranty_alert_days,
  p.price, p.stock,
  case when cp.can_see_cost then p.cost end as cost,
  case when cp.can_see_cost then p.avg_cost end as avg_cost,
  case when cp.can_see_cost then p.last_purchase_cost end as last_purchase_cost,
  p.created_at, p.updated_at
  from public.products p
  cross join caller_perms cp
 where p.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.products_view to authenticated;

-- =====================================================================
-- product_variants_view
-- =====================================================================
create or replace view public.product_variants_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_products')) as can_view,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_product_cost')) as can_see_cost
)
select
  v.id, v.product_id, v.sku, v.stock, v.price,
  case when cp.can_see_cost then v.cost end as cost,
  case when cp.can_see_cost then v.avg_cost end as avg_cost,
  case when cp.can_see_cost then v.last_purchase_cost end as last_purchase_cost,
  v.is_default, v.is_active,
  v.created_at, v.updated_at
  from public.product_variants v
  join public.products p on p.id = v.product_id
  cross join caller_perms cp
 where p.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.product_variants_view to authenticated;

-- =====================================================================
-- inventory_batches_view
-- =====================================================================
create or replace view public.inventory_batches_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_inventory_batches')) as can_view,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_batch_cost')) as can_see_cost
)
select
  b.id, b.variant_id, b.batch_no, b.purchase_item_id, b.supplier_id,
  b.qty_received, b.qty_remaining,
  case when cp.can_see_cost then b.cost_per_unit end as cost_per_unit,
  b.manufactured_date, b.expiry_date,
  b.supplier_warranty_days, b.warranty_expires_at,
  b.received_at, b.is_active, b.notes,
  b.created_at, b.updated_at
  from public.inventory_batches b
  join public.product_variants v on v.id = b.variant_id
  join public.products p on p.id = v.product_id
  cross join caller_perms cp
 where p.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.inventory_batches_view to authenticated;

-- =====================================================================
-- invoices_view (revenue + conditional profit/margin; row-filter by view_all_sales)
-- =====================================================================
create or replace view public.invoices_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select auth.uid()) as caller_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_all_sales')) as can_see_all,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_sale_cost')) as can_see_cost,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_profit_margin')) as can_see_margin
),
sale_rollup as (
  select
    si.invoice_id,
    sum(si.price_at_sale * si.qty - coalesce(si.line_discount_amount, 0))::numeric(12,2) as items_post_line,
    sum(si.cost_at_sale * si.qty)::numeric(12,2) as total_cost
    from public.sale_items si
   group by si.invoice_id
)
select
  i.id, i.shop_id, i.customer_id,
  i.total, i.service_charge, i.payment_type, i.cashier_id,
  i.amount_paid, i.notes, i.tier_id,
  i.sale_discount_type, i.sale_discount_value,
  i.sale_discount_percent_snapshot, i.sale_discount_amount,
  i.outstanding,
  i.created_at,
  -- gross_profit gated by view_sale_cost
  case when cp.can_see_cost
       then ((i.total - coalesce(sr.total_cost, 0)))::numeric(12,2)
       end as gross_profit,
  -- gross_margin_percent gated by view_profit_margin (separate gate)
  case when cp.can_see_margin and i.total > 0
       then round(((i.total - coalesce(sr.total_cost, 0)) / i.total * 100)::numeric, 2)
       end as gross_margin_percent
  from public.invoices i
  left join sale_rollup sr on sr.invoice_id = i.id
  cross join caller_perms cp
 where i.shop_id = cp.active_shop_id
   and (cp.can_see_all or i.cashier_id = cp.caller_id);

grant select on public.invoices_view to authenticated;

-- =====================================================================
-- sale_items_view (joined to invoices for shop scope; row-filter)
-- =====================================================================
create or replace view public.sale_items_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select auth.uid()) as caller_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_all_sales')) as can_see_all,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_sale_cost')) as can_see_cost,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_profit_margin')) as can_see_margin
)
select
  si.id, si.invoice_id, si.variant_id, si.product_id,
  si.qty, si.price_at_sale,
  si.line_discount_type, si.line_discount_value, si.line_discount_amount,
  si.batch_id, si.sold_expired,
  case when cp.can_see_cost then si.cost_at_sale end as cost_at_sale,
  case when cp.can_see_cost
       then ((si.price_at_sale * si.qty - coalesce(si.line_discount_amount, 0))
             - si.cost_at_sale * si.qty)::numeric(12,2)
       end as line_profit,
  case when cp.can_see_margin and si.price_at_sale > 0
       then round(((si.price_at_sale - si.cost_at_sale) / si.price_at_sale * 100)::numeric, 2)
       end as margin_percent
  from public.sale_items si
  join public.invoices i on i.id = si.invoice_id
  cross join caller_perms cp
 where i.shop_id = cp.active_shop_id
   and (cp.can_see_all or i.cashier_id = cp.caller_id);

grant select on public.sale_items_view to authenticated;

-- =====================================================================
-- purchases_view, purchase_items_view, purchase_overhead_items_view
-- =====================================================================
create or replace view public.purchases_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_purchases')) as can_view
)
select
  p.id, p.shop_id, p.total_cost, p.source, p.note, p.purchase_date,
  p.cashier_id, p.is_opening, p.supplier_id,
  p.items_subtotal, p.overhead_subtotal,
  p.created_at
  from public.purchases p
  cross join caller_perms cp
 where p.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.purchases_view to authenticated;

create or replace view public.purchase_items_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_purchases')) as can_view
)
select
  pi.id, pi.purchase_id, pi.product_id, pi.variant_id, pi.batch_id,
  pi.qty, pi.qty_in_base, pi.cost_at_purchase,
  pi.line_overhead_amount, pi.overhead_per_unit,
  pi.avg_cost_before, pi.avg_cost_after,
  pi.pack_id, pi.pack_qty, pi.pack_base_qty_snapshot
  from public.purchase_items pi
  join public.purchases p on p.id = pi.purchase_id
  cross join caller_perms cp
 where p.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.purchase_items_view to authenticated;

create or replace view public.purchase_overhead_items_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_purchases')) as can_view
)
select
  poi.id, poi.purchase_id, poi.category, poi.amount, poi.description, poi.created_at
  from public.purchase_overhead_items poi
  join public.purchases p on p.id = poi.purchase_id
  cross join caller_perms cp
 where p.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.purchase_overhead_items_view to authenticated;

-- =====================================================================
-- customers_view (conditional phone/address + outstanding/has_khata)
-- =====================================================================
create or replace view public.customers_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_customers')) as can_view,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_customer_contact')) as can_see_contact,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_customer_outstanding')) as can_see_outstanding
)
select
  c.id, c.shop_id, c.name,
  case when cp.can_see_contact then c.phone end as phone,
  case when cp.can_see_contact then c.address end as address,
  c.tier_id,
  case when cp.can_see_outstanding then c.outstanding_balance end as outstanding_balance,
  (c.outstanding_balance > 0) as has_khata,
  c.is_active, c.notes, c.created_at, c.updated_at, c.created_by_user_id
  from public.customers c
  cross join caller_perms cp
 where c.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.customers_view to authenticated;

-- =====================================================================
-- shop_owner_details_view (owner-only via view_owner_details)
-- =====================================================================
create or replace view public.shop_owner_details_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_owner_details')) as can_view
)
select
  sod.id, sod.shop_id, sod.owner_name, sod.owner_phone, sod.owner_cnic, sod.owner_address,
  sod.created_at, sod.updated_at
  from public.shop_owner_details sod
  cross join caller_perms cp
 where sod.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.shop_owner_details_view to authenticated;

-- =====================================================================
-- monthly_summary_view (revised — gated by view_reports + view_monthly_targets;
-- gross_profit by view_sale_cost; margin by view_profit_margin)
-- =====================================================================
create or replace view public.monthly_summary_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_reports')) as can_view,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_sale_cost')) as can_see_cost
)
select
  m.shop_id, m.month, m.total_sales,
  case when cp.can_see_cost then m.gross_profit end as gross_profit,
  m.total_expenses
  from public.monthly_summary m
  cross join caller_perms cp
 where m.shop_id = cp.active_shop_id
   and cp.can_view;

grant select on public.monthly_summary_view to authenticated;

-- =====================================================================
-- shop_effective_subscription (Phase B F-H-17 closure)
-- Resolves through shops.owner_user_id → subscriptions for the owner.
-- Members of the shop (any role) can read.
-- =====================================================================
create or replace view public.shop_effective_subscription with (security_invoker = false) as
select
  s.id as shop_id,
  case
    when sub.status in ('expired', 'suspended') then sub.status
    when sub.status = 'trial' and now() > sub.trial_ends_at then 'expired'::public.subscription_status
    when sub.status = 'active' and now() > sub.current_period_ends_at then 'expired'::public.subscription_status
    else sub.status
  end as effective_status,
  sub.status,
  sub.trial_ends_at,
  sub.current_period_ends_at,
  sub.last_payment_date
  from public.shops s
  join public.subscriptions sub on sub.user_id = s.owner_user_id
 where (select public.user_has_shop_access(s.id));

grant select on public.shop_effective_subscription to authenticated;

-- =====================================================================
-- customer_outstanding REPLACEMENT
-- Existing v2.8.5 view (security_invoker=true) replaced with DEFINER
-- conditional-projection version. Salesperson without view_customer_outstanding
-- sees NULL for the outstanding amount but still gets has_khata-equivalent
-- information via downstream queries.
--
-- total_outstanding depends on customer_outstanding; drop+recreate both.
-- =====================================================================
drop view if exists public.total_outstanding;
drop view if exists public.customer_outstanding;

create view public.customer_outstanding with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_customer_outstanding')) as can_see_outstanding
)
select
  c.shop_id,
  c.id as customer_id,
  c.name,
  c.phone,
  case when cp.can_see_outstanding
       then (coalesce(sum(case when le.type='debit' then le.amount else 0 end), 0)
            - coalesce(sum(case when le.type='credit' then le.amount else 0 end), 0))::numeric(12,2)
       end as outstanding,
  max(le.created_at) as last_activity_at
  from public.customers c
  left join public.ledger_entries le on le.customer_id = c.id
  cross join caller_perms cp
 where c.shop_id = cp.active_shop_id
 group by c.shop_id, c.id, c.name, c.phone, cp.can_see_outstanding;

grant select on public.customer_outstanding to authenticated;

create view public.total_outstanding with (security_invoker = false) as
select coalesce(sum(outstanding), 0::numeric)::numeric(12,2) as total,
       count(*) filter (where outstanding > 0::numeric)::integer as customer_count
  from public.customer_outstanding
 where shop_id = (select public.current_active_shop_id());

grant select on public.total_outstanding to authenticated;

-- Revoke from anon explicitly (defense in depth)
revoke select on public.products_view from anon, public;
revoke select on public.product_variants_view from anon, public;
revoke select on public.inventory_batches_view from anon, public;
revoke select on public.invoices_view from anon, public;
revoke select on public.sale_items_view from anon, public;
revoke select on public.purchases_view from anon, public;
revoke select on public.purchase_items_view from anon, public;
revoke select on public.purchase_overhead_items_view from anon, public;
revoke select on public.customers_view from anon, public;
revoke select on public.shop_owner_details_view from anon, public;
revoke select on public.monthly_summary_view from anon, public;
revoke select on public.shop_effective_subscription from anon, public;
revoke select on public.customer_outstanding from anon, public;
revoke select on public.total_outstanding from anon, public;
