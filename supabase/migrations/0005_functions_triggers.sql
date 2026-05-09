-- current_shop_id: helper used by RLS policies and the client.
create or replace function public.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.shops where owner_user_id = auth.uid() limit 1;
$$;

revoke execute on function public.current_shop_id() from public, anon;
grant execute on function public.current_shop_id() to authenticated;

-- complete_onboarding: writes shops + shop_owner_details + flips profile flag, atomically.
create or replace function public.complete_onboarding(
  p_shop_name text,
  p_shop_address text,
  p_shop_phone text,
  p_shop_type text,
  p_owner_name text,
  p_owner_phone text,
  p_owner_cnic text,
  p_owner_address text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.shops (owner_user_id, shop_name, shop_address, shop_phone, shop_type)
  values (v_user_id, p_shop_name, p_shop_address, p_shop_phone, p_shop_type)
  returning id into v_shop_id;

  insert into public.shop_owner_details (shop_id, owner_name, owner_phone, owner_cnic, owner_address)
  values (v_shop_id, p_owner_name, p_owner_phone, p_owner_cnic, p_owner_address);

  update public.profiles set onboarding_completed = true, updated_at = now() where id = v_user_id;

  return v_shop_id;
end;
$$;

revoke execute on function public.complete_onboarding(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text, text, text, text, text) to authenticated;

-- expire_subscriptions: scheduled daily by pg_cron in 0008.
create or replace function public.expire_subscriptions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set status = 'expired', updated_at = now()
  where (status = 'trial' and trial_ends_at < now())
     or (status = 'active' and current_period_ends_at < now());
end;
$$;

revoke execute on function public.expire_subscriptions() from public, anon, authenticated;
