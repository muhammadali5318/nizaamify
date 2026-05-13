-- 0088_v291_get_invitation_for_acceptance.sql
--
-- v2.9.1 Phase D.4 — read-only DEFINER RPC for the /invite/accept page.
--
-- pending_invitations RLS is owner-only (per [[2026-05-13-rbac-deployment-phasing]]),
-- so the invitee can't read the invitation row directly to see what shop
-- they're being invited to. Without this RPC the accept page would have
-- to ask for the code blind — bad UX, and gives the invitee no chance to
-- confirm they're joining the right shop.
--
-- This RPC bridges the gap defensively: it returns the invitation
-- metadata + shop branding ONLY when the caller's auth email matches
-- the invitation's email. Wrong-email callers get
-- `invitation_email_mismatch` without any data leak.
--
-- Note: returns metadata regardless of invitation `status` (pending /
-- accepted / cancelled / expired). The page renders an appropriate
-- final-state UX for non-pending statuses. AQ-23 exempt: this is a
-- shop-membership-NEUTRAL helper called BEFORE the user has any
-- access — there's no shop to gate on yet.

create or replace function public.get_invitation_for_acceptance(
  p_invitation_id uuid
) returns table(
  shop_name text,
  invited_by_email text,
  preset_applied text,
  invited_email text,
  expires_at timestamptz,
  failed_attempts int,
  status public.invitation_status
)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_inv record;
  v_caller_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_inv from public.pending_invitations where id = p_invitation_id;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  -- Defense in depth: don't leak shop name to a different email's user
  select lower(p.email) into v_caller_email
    from public.profiles p where p.id = auth.uid();
  if v_caller_email is null or v_caller_email <> lower(v_inv.email) then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  return query
    select
      s.shop_name,
      coalesce(ib.email, '') as invited_by_email,
      v_inv.preset_applied,
      v_inv.email,
      v_inv.expires_at,
      v_inv.failed_attempts,
      v_inv.status
    from public.shops s
    left join public.profiles ib on ib.id = v_inv.invited_by_user_id
    where s.id = v_inv.shop_id;
end;
$fn$;

revoke execute on function public.get_invitation_for_acceptance(uuid) from public, anon;
grant execute on function public.get_invitation_for_acceptance(uuid) to authenticated;
