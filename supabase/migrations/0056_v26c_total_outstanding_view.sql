-- v2.6c — server-side aggregate for total customer outstanding.
--
-- useTotalOutstanding was summing per-customer outstanding in JS:
--   data.reduce((s, r) => s + Number(r.outstanding ?? 0), 0)
-- violating no-JS-Number-on-money. Push the SUM into Postgres.

drop view if exists public.total_outstanding cascade;
create view public.total_outstanding
with (security_invoker = true) as
select
  coalesce(sum(co.outstanding), 0)::numeric(12,2) as total,
  count(*) filter (where co.outstanding > 0)::int as customer_count
from public.customer_outstanding co
where co.shop_id = public.current_shop_id();
