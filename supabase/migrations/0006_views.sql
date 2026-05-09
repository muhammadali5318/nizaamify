-- subscription_effective: derived "effective" status without bypassing RLS on the underlying table.
-- security_invoker = true so the view runs under the calling user's RLS, not the view owner's.
create or replace view public.subscription_effective
with (security_invoker = true)
as
select
  s.user_id,
  case
    when s.status in ('expired','suspended') then s.status
    when s.status = 'trial' and now() > s.trial_ends_at then 'expired'::public.subscription_status
    when s.status = 'active' and now() > s.current_period_ends_at then 'expired'::public.subscription_status
    else s.status
  end as effective_status,
  s.status,
  s.trial_ends_at,
  s.current_period_ends_at,
  s.last_payment_date
from public.subscriptions s;
