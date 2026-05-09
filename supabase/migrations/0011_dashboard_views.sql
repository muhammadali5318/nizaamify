-- monthly_summary: per-(shop, month) totals and gross profit. Net profit derived in the client.
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
    (select sum(i.total)
       from public.invoices i
      where i.shop_id = m.shop_id
        and date_trunc('month', i.created_at at time zone 'utc')::date = m.month), 0
  ) as total_sales,
  coalesce(
    (select sum((si.price_at_sale - si.cost_at_sale) * si.qty)
       from public.sale_items si
       join public.invoices i on i.id = si.invoice_id
      where i.shop_id = m.shop_id
        and date_trunc('month', i.created_at at time zone 'utc')::date = m.month), 0
  ) as gross_profit,
  coalesce(
    (select sum(e.amount)
       from public.expenses e
      where e.shop_id = m.shop_id
        and date_trunc('month', e.expense_date)::date = m.month), 0
  ) as total_expenses
from months m;

-- daily_sales_today: for the dashboard "today" widget.
create or replace view public.daily_sales_today
with (security_invoker = true)
as
select
  i.shop_id,
  count(*) as sales_count,
  coalesce(sum(i.total), 0) as total_sales,
  coalesce(sum(case when i.payment_type = 'cash' then i.total else 0 end), 0) as cash_sales,
  coalesce(sum(case when i.payment_type = 'credit' then i.total else 0 end), 0) as credit_sales
from public.invoices i
where date_trunc('day', i.created_at at time zone 'utc')::date = current_date
group by i.shop_id;
