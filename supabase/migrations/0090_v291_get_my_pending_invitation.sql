-- 0090_v291_get_my_pending_invitation.sql
--
-- v2.9.1 hot-patch — invitee routing fix.
--
-- Bug discovered under real flag-flip traffic: a brand-new invitee signs up
-- at /signup, clicks the verify-email link, and lands at `/`. The route tree
-- resolves AppShell → RequireAuth ✓ → RequireOnboarded, which sees
-- `profiles.onboarding_completed = false` and redirects to /onboarding —
-- the OWNER onboarding wizard. The invitee runs it, `complete_onboarding`
-- fires, a NEW shop is created with the invitee as owner. The pending
-- invitation row sits untouched; the invitee is now permanently the wrong
-- thing (owner of a new shop instead of staff at the inviter's shop).
--
-- This migration mints the server-side primitive needed for the fix:
-- a pre-shop helper that returns the caller's latest pending invitation
-- (if any) so the frontend RequireOnboarded guard can detect this state
-- and redirect to /invite/accept/<id> BEFORE the wrong-onboarding loop.
--
-- AQ-23 exempt: pre-shop helper, same category as
-- get_invitation_for_acceptance (mig 0088), accept_invitation, and
-- cancel_invitation. The invitee has no shop access at call time —
-- the no_shop_for_user / user_has_permission gates would be incorrect.
-- P1 (not_authenticated) is present.

create or replace function public.get_my_pending_invitation()
returns table (
  id uuid,
  shop_id uuid,
  shop_name text,
  preset_applied text,
  invited_by_email text,
  expires_at timestamptz
)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Caller's auth email — read from profiles (RLS-admitted via
  -- profiles_self_read since profile.id = auth.uid()).
  select lower(p.email) into v_email
    from public.profiles p where p.id = auth.uid();
  if v_email is null then return; end if;

  -- Most-recent non-expired pending invitation for the caller's email.
  -- If multiple shops have invited the same email, we surface the
  -- newest. The invitee can accept others later via direct URL.
  return query
    select pi.id, pi.shop_id, s.shop_name, pi.preset_applied,
           coalesce(ib.email, '') as invited_by_email, pi.expires_at
      from public.pending_invitations pi
      join public.shops s on s.id = pi.shop_id
      left join public.profiles ib on ib.id = pi.invited_by_user_id
     where lower(pi.email) = v_email
       and pi.status = 'pending'
       and pi.expires_at > now()
     order by pi.created_at desc
     limit 1;
end;
$fn$;

revoke execute on function public.get_my_pending_invitation() from public, anon;
grant execute on function public.get_my_pending_invitation() to authenticated;
