-- Per-customer outstanding (debit - credit). Negative would mean overpaid.
create or replace view public.customer_outstanding
with (security_invoker = true)
as
select
  c.shop_id,
  c.id as customer_id,
  c.name,
  c.phone,
  coalesce(sum(case when le.type = 'debit' then le.amount else 0 end), 0)
    - coalesce(sum(case when le.type = 'credit' then le.amount else 0 end), 0)
    as outstanding,
  max(le.created_at) as last_activity_at
from public.customers c
left join public.ledger_entries le
  on le.customer_id = c.id
group by c.shop_id, c.id, c.name, c.phone;
