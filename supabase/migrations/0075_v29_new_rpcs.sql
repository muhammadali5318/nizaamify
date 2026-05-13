
-- v2.9 Phase C migration 0075: 17 new DEFINER RPCs
-- Each RPC: SHOP guard pattern (declare v_shop_id once), permission check,
-- audit-row writes where applicable.

-- =====================================================================
-- 1. modify_user_permission
-- =====================================================================
create or replace function public.modify_user_permission(
  p_target_user_id uuid,
  p_permission_key text,
  p_granted boolean,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_access_id uuid;
  v_old_granted boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'modify_user_permissions') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: modify_user_permissions';
  end if;
  -- Reject self-modification (owner shortcut handles owner-target case via the is_owner check below)
  if p_target_user_id = auth.uid() then
    raise exception 'cannot_modify_own_permissions' using errcode = 'P0001';
  end if;
  -- Locate the target's user_shop_access row at this shop; reject if target is owner
  select usa.id into v_access_id
    from public.user_shop_access usa
   where usa.user_id = p_target_user_id and usa.shop_id = v_shop_id and usa.is_owner = false
   for update;
  if not found then
    raise exception 'cannot_modify_owner_or_unknown_user' using errcode = 'P0001';
  end if;
  -- Verify the permission key exists
  if not exists (select 1 from public.permissions_catalog where key = p_permission_key and is_active) then
    raise exception 'unknown_permission_key' using errcode = 'P0001', detail = p_permission_key;
  end if;
  -- Dependency check
  if p_granted then
    perform public.validate_permission_grant(v_access_id, p_permission_key);
  else
    perform public.validate_permission_revoke(v_access_id, p_permission_key);
  end if;
  -- Read old value
  select granted into v_old_granted from public.user_shop_permissions
   where user_shop_access_id = v_access_id and permission_key = p_permission_key;
  -- Upsert
  insert into public.user_shop_permissions (user_shop_access_id, permission_key, granted, granted_by_user_id, source)
  values (v_access_id, p_permission_key, p_granted, auth.uid(), 'manual')
  on conflict (user_shop_access_id, permission_key)
  do update set granted = excluded.granted,
                granted_by_user_id = excluded.granted_by_user_id,
                granted_at = now(),
                source = 'manual';
  -- Audit
  insert into public.user_shop_permission_audit (
    shop_id, target_user_id, actor_user_id, permission_key,
    old_granted, new_granted, action, reason
  ) values (
    v_shop_id, p_target_user_id, auth.uid(), p_permission_key,
    coalesce(v_old_granted, false), p_granted,
    case when p_granted then 'permission_granted' else 'permission_revoked' end,
    p_reason
  );
end;
$fn$;

revoke execute on function public.modify_user_permission(uuid, text, boolean, text) from public, anon;
grant execute on function public.modify_user_permission(uuid, text, boolean, text) to authenticated;

-- =====================================================================
-- 2. apply_preset_to_user
-- =====================================================================
create or replace function public.apply_preset_to_user(
  p_target_user_id uuid,
  p_preset text
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_access_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'modify_user_permissions') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: modify_user_permissions';
  end if;
  if p_preset not in ('manager', 'salesperson') then
    raise exception 'invalid_preset' using errcode = 'P0001', detail = p_preset;
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot_modify_own_permissions' using errcode = 'P0001';
  end if;
  select usa.id into v_access_id
    from public.user_shop_access usa
   where usa.user_id = p_target_user_id and usa.shop_id = v_shop_id and usa.is_owner = false
   for update;
  if not found then
    raise exception 'cannot_modify_owner_or_unknown_user' using errcode = 'P0001';
  end if;
  -- Upsert per-permission rows from catalog defaults
  if p_preset = 'manager' then
    insert into public.user_shop_permissions (user_shop_access_id, permission_key, granted, granted_by_user_id, source)
    select v_access_id, pc.key, pc.preset_manager_default, auth.uid(), 'preset'
      from public.permissions_catalog pc where pc.is_active
    on conflict (user_shop_access_id, permission_key)
    do update set granted = excluded.granted, granted_by_user_id = excluded.granted_by_user_id, granted_at = now(), source = 'preset';
  else  -- salesperson
    insert into public.user_shop_permissions (user_shop_access_id, permission_key, granted, granted_by_user_id, source)
    select v_access_id, pc.key, pc.preset_salesperson_default, auth.uid(), 'preset'
      from public.permissions_catalog pc where pc.is_active
    on conflict (user_shop_access_id, permission_key)
    do update set granted = excluded.granted, granted_by_user_id = excluded.granted_by_user_id, granted_at = now(), source = 'preset';
  end if;
  update public.user_shop_access set preset_applied = p_preset, updated_at = now() where id = v_access_id;
  insert into public.user_shop_permission_audit (shop_id, target_user_id, actor_user_id, action, reason, new_value)
  values (v_shop_id, p_target_user_id, auth.uid(), 'preset_applied', 'Applied ' || p_preset || ' preset', jsonb_build_object('preset', p_preset));
end;
$fn$;

revoke execute on function public.apply_preset_to_user(uuid, text) from public, anon;
grant execute on function public.apply_preset_to_user(uuid, text) to authenticated;

-- =====================================================================
-- 3. update_user_discount_limits
-- =====================================================================
create or replace function public.update_user_discount_limits(
  p_target_user_id uuid,
  p_discount_limits jsonb,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_old jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'modify_user_discount_limits') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: modify_user_discount_limits';
  end if;
  select discount_limits into v_old from public.user_shop_access
   where user_id = p_target_user_id and shop_id = v_shop_id and is_owner = false
   for update;
  if not found then
    raise exception 'cannot_modify_owner_or_unknown_user' using errcode = 'P0001';
  end if;
  update public.user_shop_access
     set discount_limits = coalesce(p_discount_limits, '{}'::jsonb), updated_at = now()
   where user_id = p_target_user_id and shop_id = v_shop_id;
  insert into public.user_shop_permission_audit (shop_id, target_user_id, actor_user_id, action, reason, old_value, new_value)
  values (v_shop_id, p_target_user_id, auth.uid(), 'discount_limits_changed', p_reason, v_old, p_discount_limits);
end;
$fn$;

revoke execute on function public.update_user_discount_limits(uuid, jsonb, text) from public, anon;
grant execute on function public.update_user_discount_limits(uuid, jsonb, text) to authenticated;

-- =====================================================================
-- 4. revoke_user_access
-- =====================================================================
create or replace function public.revoke_user_access(
  p_target_user_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_access_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'revoke_user_access') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: revoke_user_access';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot_revoke_own_access' using errcode = 'P0001';
  end if;
  select id into v_access_id from public.user_shop_access
   where user_id = p_target_user_id and shop_id = v_shop_id and is_owner = false
   for update;
  if not found then
    raise exception 'cannot_revoke_owner_or_unknown_user' using errcode = 'P0001';
  end if;
  delete from public.user_shop_access where id = v_access_id;
  insert into public.user_shop_permission_audit (shop_id, target_user_id, actor_user_id, action, reason)
  values (v_shop_id, p_target_user_id, auth.uid(), 'access_revoked', p_reason);
end;
$fn$;

revoke execute on function public.revoke_user_access(uuid, text) from public, anon;
grant execute on function public.revoke_user_access(uuid, text) to authenticated;

-- =====================================================================
-- 5. create_invitation
-- =====================================================================
create or replace function public.create_invitation(
  p_email text,
  p_preset text,
  p_permission_overrides jsonb default '{}'::jsonb,
  p_discount_limit_overrides jsonb default '{}'::jsonb
) returns table (invitation_id uuid, confirmation_code text)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_email text;
  v_code text;
  v_permissions jsonb := '{}'::jsonb;
  v_discount_limits jsonb;
  v_preset_defaults jsonb;
  v_invitation_id uuid;
  v_default_limits jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'invite_users') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: invite_users';
  end if;
  if p_preset not in ('manager', 'salesperson') then
    raise exception 'cannot_invite_owner' using errcode = 'P0001';
  end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then raise exception 'invalid_email' using errcode = 'P0001'; end if;

  -- Resolve baseline permissions from catalog
  if p_preset = 'manager' then
    select jsonb_object_agg(pc.key, pc.preset_manager_default) into v_permissions
      from public.permissions_catalog pc where pc.is_active;
  else
    select jsonb_object_agg(pc.key, pc.preset_salesperson_default) into v_permissions
      from public.permissions_catalog pc where pc.is_active;
  end if;
  -- Apply overrides (key→bool delta)
  if jsonb_typeof(p_permission_overrides) = 'object' then
    v_permissions := v_permissions || p_permission_overrides;
  end if;

  -- Dependency check across the final resolved set
  declare
    v_key text; v_granted boolean; v_required text; v_req_granted boolean;
  begin
    for v_key in select jsonb_object_keys(v_permissions) loop
      v_granted := (v_permissions ->> v_key)::boolean;
      if v_granted then
        for v_required in select unnest(requires) from public.permissions_catalog where key = v_key loop
          v_req_granted := (v_permissions ->> v_required)::boolean;
          if not coalesce(v_req_granted, false) then
            raise exception 'permission_dependency_missing'
              using errcode = 'P0001',
                    detail = format('Granting %s requires %s to also be granted', v_key, v_required);
          end if;
        end loop;
      end if;
    end loop;
  end;

  -- Default discount limits per preset
  v_default_limits := case p_preset
    when 'manager' then '{"per_line_max_pct":25,"per_invoice_max_pct":15}'::jsonb
    when 'salesperson' then '{"per_line_max_pct":5,"per_invoice_max_pct":3,"per_line_max_pkr":100,"per_invoice_max_pkr":300}'::jsonb
  end;
  v_discount_limits := v_default_limits || coalesce(p_discount_limit_overrides, '{}'::jsonb);

  -- Generate 4-digit confirmation code
  v_code := lpad((floor(random() * 10000)::int)::text, 4, '0');

  insert into public.pending_invitations (
    shop_id, email, preset_applied, permissions, discount_limits,
    invited_by_user_id, confirmation_code, expires_at, status
  ) values (
    v_shop_id, v_email, p_preset, v_permissions, v_discount_limits,
    auth.uid(), v_code, now() + interval '24 hours', 'pending'
  ) returning id into v_invitation_id;

  return query select v_invitation_id, v_code;
end;
$fn$;

revoke execute on function public.create_invitation(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_invitation(text, text, jsonb, jsonb) to authenticated;

-- =====================================================================
-- 6. cancel_invitation
-- =====================================================================
create or replace function public.cancel_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_inv_shop uuid;
  v_status public.invitation_status;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'cancel_invitations') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: cancel_invitations';
  end if;
  select shop_id, status into v_inv_shop, v_status
    from public.pending_invitations where id = p_invitation_id for update;
  if not found or v_inv_shop <> v_shop_id then
    raise exception 'invitation_not_in_shop' using errcode = 'P0001';
  end if;
  if v_status <> 'pending' then
    raise exception 'invitation_not_pending' using errcode = 'P0001', detail = v_status::text;
  end if;
  update public.pending_invitations
     set status = 'cancelled', cancelled_at = now()
   where id = p_invitation_id;
end;
$fn$;

revoke execute on function public.cancel_invitation(uuid) from public, anon;
grant execute on function public.cancel_invitation(uuid) to authenticated;

-- =====================================================================
-- 7. accept_invitation
-- =====================================================================
create or replace function public.accept_invitation(
  p_invitation_id uuid,
  p_confirmation_code text
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_inv record;
  v_caller_email text;
  v_access_id uuid;
  v_key text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  select * into v_inv from public.pending_invitations
   where id = p_invitation_id for update;
  if not found then raise exception 'invitation_not_found' using errcode = 'P0001'; end if;
  if v_inv.status <> 'pending' then
    raise exception 'invitation_not_pending' using errcode = 'P0001', detail = v_inv.status::text;
  end if;
  if now() > v_inv.expires_at then
    update public.pending_invitations set status = 'expired' where id = p_invitation_id;
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  if v_inv.confirmation_code <> p_confirmation_code then
    update public.pending_invitations
       set failed_attempts = failed_attempts + 1,
           status = case when failed_attempts + 1 >= 5 then 'cancelled' else 'pending' end,
           cancelled_at = case when failed_attempts + 1 >= 5 then now() else cancelled_at end
     where id = p_invitation_id;
    if v_inv.failed_attempts + 1 >= 5 then
      raise exception 'invitation_not_pending' using errcode = 'P0001', detail = 'auto_cancelled_5_strike';
    end if;
    raise exception 'invalid_confirmation_code' using errcode = 'P0001';
  end if;

  select lower(email) into v_caller_email from public.profiles where id = auth.uid();
  if v_caller_email is null or v_caller_email <> lower(v_inv.email) then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.user_shop_access where user_id = auth.uid() and shop_id = v_inv.shop_id) then
    raise exception 'already_a_member_at_this_shop' using errcode = 'P0001';
  end if;

  insert into public.user_shop_access (user_id, shop_id, is_owner, preset_applied, discount_limits)
  values (auth.uid(), v_inv.shop_id, false, v_inv.preset_applied, v_inv.discount_limits)
  returning id into v_access_id;

  for v_key in select jsonb_object_keys(v_inv.permissions) loop
    insert into public.user_shop_permissions (user_shop_access_id, permission_key, granted, granted_by_user_id, source)
    values (v_access_id, v_key, (v_inv.permissions ->> v_key)::boolean, v_inv.invited_by_user_id, 'preset')
    on conflict (user_shop_access_id, permission_key) do nothing;
  end loop;

  update public.pending_invitations
     set status = 'accepted', accepted_at = now(), accepted_by_user_id = auth.uid()
   where id = p_invitation_id;

  insert into public.user_shop_permission_audit (
    shop_id, target_user_id, actor_user_id, action, reason, new_value
  ) values (
    v_inv.shop_id, auth.uid(), v_inv.invited_by_user_id, 'access_granted',
    'Invitation accepted',
    jsonb_build_object('preset', v_inv.preset_applied, 'permissions', v_inv.permissions)
  );

  return v_access_id;
end;
$fn$;

revoke execute on function public.accept_invitation(uuid, text) from public, anon;
grant execute on function public.accept_invitation(uuid, text) to authenticated;

-- =====================================================================
-- 8. create_customer_basic
-- =====================================================================
create or replace function public.create_customer_basic(p_name text, p_phone text)
returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_tier_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_customer_basic') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_customer_basic';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required' using errcode = 'P0001'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone_required' using errcode = 'P0001'; end if;
  select id into v_tier_id from public.customer_tiers
   where shop_id = v_shop_id and is_default and is_active limit 1;
  begin
    insert into public.customers (shop_id, name, phone, tier_id, created_by_user_id)
    values (v_shop_id, trim(p_name), trim(p_phone), v_tier_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'duplicate_phone_in_shop' using errcode = 'P0001';
  end;
  return v_id;
end;
$fn$;

revoke execute on function public.create_customer_basic(text, text) from public, anon;
grant execute on function public.create_customer_basic(text, text) to authenticated;

-- =====================================================================
-- 9. create_customer_full
-- =====================================================================
create or replace function public.create_customer_full(
  p_name text, p_phone text, p_address text default null,
  p_notes text default null, p_tier_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_customer_full') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_customer_full';
  end if;
  if p_tier_id is not null and not public.user_has_permission(v_shop_id, 'assign_customer_tier') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: assign_customer_tier (to set tier_id)';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required' using errcode = 'P0001'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone_required' using errcode = 'P0001'; end if;
  -- Verify tier (if provided) belongs to this shop
  if p_tier_id is not null and not exists (
    select 1 from public.customer_tiers where id = p_tier_id and shop_id = v_shop_id and is_active
  ) then raise exception 'tier_not_in_shop' using errcode = 'P0001'; end if;
  begin
    insert into public.customers (shop_id, name, phone, address, notes, tier_id, created_by_user_id)
    values (v_shop_id, trim(p_name), trim(p_phone), nullif(trim(coalesce(p_address,'')),''), nullif(trim(coalesce(p_notes,'')),''), p_tier_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'duplicate_phone_in_shop' using errcode = 'P0001';
  end;
  return v_id;
end;
$fn$;

revoke execute on function public.create_customer_full(text, text, text, text, uuid) from public, anon;
grant execute on function public.create_customer_full(text, text, text, text, uuid) to authenticated;

-- =====================================================================
-- 10. create_expense
-- =====================================================================
create or replace function public.create_expense(
  p_category text, p_amount numeric(12,2),
  p_expense_date date default current_date, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_expense') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_expense';
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'amount_invalid' using errcode = 'P0001'; end if;
  insert into public.expenses (shop_id, category, amount, expense_date, note, created_by)
  values (v_shop_id, p_category, p_amount, coalesce(p_expense_date, current_date), nullif(trim(coalesce(p_note,'')),''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$fn$;

revoke execute on function public.create_expense(text, numeric, date, text) from public, anon;
grant execute on function public.create_expense(text, numeric, date, text) to authenticated;

-- =====================================================================
-- 11. update_expense
-- =====================================================================
create or replace function public.update_expense(
  p_expense_id uuid, p_category text, p_amount numeric(12,2), p_note text default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_creator uuid;
  v_created_at timestamptz;
  v_exp_shop_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'edit_expense') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: edit_expense';
  end if;
  select shop_id, created_by, created_at into v_exp_shop_id, v_creator, v_created_at
    from public.expenses where id = p_expense_id for update;
  if not found or v_exp_shop_id <> v_shop_id then raise exception 'expense_not_in_shop' using errcode = 'P0001'; end if;
  if v_creator <> auth.uid() then raise exception 'not_expense_creator' using errcode = 'P0001'; end if;
  if v_created_at < now() - interval '24 hours' then raise exception 'expense_edit_window_expired' using errcode = 'P0001'; end if;
  update public.expenses
     set category = p_category, amount = p_amount, note = nullif(trim(coalesce(p_note,'')),'')
   where id = p_expense_id;
end;
$fn$;

revoke execute on function public.update_expense(uuid, text, numeric, text) from public, anon;
grant execute on function public.update_expense(uuid, text, numeric, text) to authenticated;

-- =====================================================================
-- 12. update_shop_settings
-- =====================================================================
create or replace function public.update_shop_settings(
  p_shop_name text default null, p_shop_address text default null,
  p_shop_phone text default null, p_shop_type text default null,
  p_default_expiry_alert_days int default null,
  p_default_warranty_alert_days int default null,
  p_default_expired_sale_policy public.expired_sale_policy default null,
  p_expired_sale_receipt_disclaimer boolean default null,
  p_salesperson_payment_cap_pkr numeric(12,2) default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'edit_shop_settings') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: edit_shop_settings';
  end if;
  update public.shops set
    shop_name = coalesce(p_shop_name, shop_name),
    shop_address = coalesce(p_shop_address, shop_address),
    shop_phone = coalesce(p_shop_phone, shop_phone),
    shop_type = coalesce(p_shop_type, shop_type),
    default_expiry_alert_days = coalesce(p_default_expiry_alert_days, default_expiry_alert_days),
    default_warranty_alert_days = coalesce(p_default_warranty_alert_days, default_warranty_alert_days),
    default_expired_sale_policy = coalesce(p_default_expired_sale_policy, default_expired_sale_policy),
    expired_sale_receipt_disclaimer = coalesce(p_expired_sale_receipt_disclaimer, expired_sale_receipt_disclaimer),
    salesperson_payment_cap_pkr = coalesce(p_salesperson_payment_cap_pkr, salesperson_payment_cap_pkr),
    updated_at = now()
   where id = v_shop_id;
end;
$fn$;

revoke execute on function public.update_shop_settings(text, text, text, text, int, int, public.expired_sale_policy, boolean, numeric) from public, anon;
grant execute on function public.update_shop_settings(text, text, text, text, int, int, public.expired_sale_policy, boolean, numeric) to authenticated;

-- =====================================================================
-- 13. update_owner_details
-- =====================================================================
create or replace function public.update_owner_details(
  p_owner_name text default null, p_owner_phone text default null,
  p_owner_cnic text default null, p_owner_address text default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'edit_owner_details') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: edit_owner_details';
  end if;
  update public.shop_owner_details set
    owner_name = coalesce(p_owner_name, owner_name),
    owner_phone = coalesce(p_owner_phone, owner_phone),
    owner_cnic = coalesce(p_owner_cnic, owner_cnic),
    owner_address = coalesce(p_owner_address, owner_address),
    updated_at = now()
   where shop_id = v_shop_id;
end;
$fn$;

revoke execute on function public.update_owner_details(text, text, text, text) from public, anon;
grant execute on function public.update_owner_details(text, text, text, text) to authenticated;

-- =====================================================================
-- 14. upsert_monthly_target
-- =====================================================================
create or replace function public.upsert_monthly_target(
  p_month date, p_target_sale numeric(12,2),
  p_target_gross_profit numeric(12,2), p_target_net_profit numeric(12,2)
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_monthly_targets') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_monthly_targets';
  end if;
  insert into public.monthly_targets (shop_id, month, target_sale, target_gross_profit, target_net_profit, updated_by_user_id)
  values (v_shop_id, date_trunc('month', p_month)::date, p_target_sale, p_target_gross_profit, p_target_net_profit, auth.uid())
  on conflict (shop_id, month) do update set
    target_sale = excluded.target_sale,
    target_gross_profit = excluded.target_gross_profit,
    target_net_profit = excluded.target_net_profit,
    updated_by_user_id = excluded.updated_by_user_id,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$fn$;

revoke execute on function public.upsert_monthly_target(date, numeric, numeric, numeric) from public, anon;
grant execute on function public.upsert_monthly_target(date, numeric, numeric, numeric) to authenticated;

-- =====================================================================
-- 15. get_user_shop_list
-- =====================================================================
create or replace function public.get_user_shop_list()
returns table(shop_id uuid, shop_name text, is_owner boolean, preset_applied text)
language sql security definer set search_path = public, pg_catalog
as $fn$
  select usa.shop_id, s.shop_name, usa.is_owner, usa.preset_applied
    from public.user_shop_access usa
    join public.shops s on s.id = usa.shop_id
   where usa.user_id = auth.uid()
   order by s.shop_name;
$fn$;

revoke execute on function public.get_user_shop_list() from public, anon;
grant execute on function public.get_user_shop_list() to authenticated;

-- =====================================================================
-- 16. get_team_for_active_shop
-- =====================================================================
create or replace function public.get_team_for_active_shop()
returns table(user_id uuid, email text, is_owner boolean, preset_applied text,
              joined_at timestamptz, granted_permission_count int)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_team') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_team';
  end if;
  return query
    select usa.user_id, p.email, usa.is_owner, usa.preset_applied, usa.joined_at,
           coalesce((select count(*)::int from public.user_shop_permissions usp
                      where usp.user_shop_access_id = usa.id and usp.granted), 0) as granted_permission_count
      from public.user_shop_access usa
      join public.profiles p on p.id = usa.user_id
     where usa.shop_id = v_shop_id
     order by usa.is_owner desc, usa.joined_at asc;
end;
$fn$;

revoke execute on function public.get_team_for_active_shop() from public, anon;
grant execute on function public.get_team_for_active_shop() to authenticated;

-- =====================================================================
-- 17. get_user_permissions
-- =====================================================================
create or replace function public.get_user_permissions(p_target_user_id uuid)
returns table(permission_key text, granted boolean, source text)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_is_owner boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  -- Caller must be self OR have view_team
  if p_target_user_id <> auth.uid()
     and not public.user_has_permission(v_shop_id, 'view_team') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_team';
  end if;
  select is_owner into v_is_owner
    from public.user_shop_access where user_id = p_target_user_id and shop_id = v_shop_id;
  if v_is_owner is null then return; end if;
  if v_is_owner then
    return query
      select pc.key, true, 'owner_implicit'::text
        from public.permissions_catalog pc where pc.is_active
       order by pc.display_order;
    return;
  end if;
  return query
    select pc.key, coalesce(usp.granted, false), coalesce(usp.source, 'default')::text
      from public.permissions_catalog pc
      left join public.user_shop_access usa
        on usa.user_id = p_target_user_id and usa.shop_id = v_shop_id
      left join public.user_shop_permissions usp
        on usp.user_shop_access_id = usa.id and usp.permission_key = pc.key
     where pc.is_active
     order by pc.display_order;
end;
$fn$;

revoke execute on function public.get_user_permissions(uuid) from public, anon;
grant execute on function public.get_user_permissions(uuid) to authenticated;
