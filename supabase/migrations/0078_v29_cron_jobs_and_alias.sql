
-- v2.9 Day-7 cutover migration 0078: cron job for invitation cleanup
-- + permanent current_shop_id() alias (safe now that 0077 dropped policies that depended on the v2.8.5 body)

-- (1) cleanup_invitations function: mark expired pending invitations + hard-delete terminal-state old rows
create or replace function public.cleanup_invitations()
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
begin
  -- Mark expired pending invitations
  update public.pending_invitations
     set status = 'expired'
   where status = 'pending'
     and expires_at < now();
  -- Hard-delete terminal-state rows older than 30 days
  delete from public.pending_invitations
   where status in ('accepted', 'cancelled', 'expired')
     and created_at < now() - interval '30 days';
end;
$fn$;

revoke execute on function public.cleanup_invitations() from public, anon, authenticated;
-- Implicitly granted to postgres + service_role (cron user is postgres)

-- (2) Schedule daily cleanup at 00:30 UTC
select cron.schedule(
  'cleanup-invitations',
  '30 0 * * *',
  $cron$ select public.cleanup_invitations(); $cron$
);

-- (3) Permanent alias of current_shop_id() to current_active_shop_id().
-- Old policies have been dropped in 0077; the deny-wins concern is resolved.
-- This makes the back-compat helper consistent with the v2.9 mechanism.
create or replace function public.current_shop_id() returns uuid
language sql stable security definer set search_path to public, pg_catalog
as $alias$ select public.current_active_shop_id(); $alias$;
