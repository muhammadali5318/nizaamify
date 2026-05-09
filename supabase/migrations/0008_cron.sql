-- Schedule expire_subscriptions daily at 00:05 UTC. Idempotent (unschedule first).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire-subscriptions') then
    perform cron.unschedule('expire-subscriptions');
  end if;
end $$;

select cron.schedule(
  'expire-subscriptions',
  '5 0 * * *',
  $cmd$ select public.expire_subscriptions(); $cmd$
);
