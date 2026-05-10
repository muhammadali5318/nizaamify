-- 0033_v23a_tier_rpcs.sql
-- v2.3 follow-up — define_tier and update_tier referenced the dropped
-- customer_tiers.discount_percent column. Drop the discount param entirely;
-- tiers are pure categories now.

drop function if exists public.define_tier(text, numeric, boolean, text);
drop function if exists public.update_tier(uuid, text, numeric, boolean, text);

create or replace function public.define_tier(
  p_name text,
  p_is_default boolean default false,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_tier_id uuid;
  v_normalized_name text := lower(trim(p_name));
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if v_normalized_name = '' then raise exception 'tier_name_required'; end if;

  if exists (
    select 1 from public.customer_tiers
     where shop_id = v_shop_id
       and is_active
       and lower(trim(name)) = v_normalized_name
  ) then
    raise exception 'tier_name_duplicate';
  end if;

  if coalesce(p_is_default, false) then
    update public.customer_tiers
       set is_default = false, updated_at = now()
     where shop_id = v_shop_id and is_default and is_active;
  end if;

  insert into public.customer_tiers (shop_id, name, is_default, notes)
  values (
    v_shop_id, trim(p_name),
    coalesce(p_is_default, false),
    nullif(trim(coalesce(p_notes, '')), '')
  ) returning id into v_tier_id;

  return v_tier_id;
end;
$function$;

create or replace function public.update_tier(
  p_tier_id uuid,
  p_name text,
  p_is_default boolean,
  p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_tier record;
  v_normalized_name text := lower(trim(p_name));
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if v_normalized_name = '' then raise exception 'tier_name_required'; end if;

  select id, shop_id, is_default, is_active into v_tier
    from public.customer_tiers
   where id = p_tier_id and shop_id = v_shop_id;
  if not found then raise exception 'tier_not_in_shop'; end if;
  if not v_tier.is_active then raise exception 'tier_archived'; end if;

  if exists (
    select 1 from public.customer_tiers
     where shop_id = v_shop_id
       and is_active
       and id <> p_tier_id
       and lower(trim(name)) = v_normalized_name
  ) then
    raise exception 'tier_name_duplicate';
  end if;

  if coalesce(p_is_default, false) and not v_tier.is_default then
    update public.customer_tiers
       set is_default = false, updated_at = now()
     where shop_id = v_shop_id and is_default and is_active and id <> p_tier_id;
  end if;

  if v_tier.is_default and not coalesce(p_is_default, false) then
    raise exception 'cannot_unset_default_tier'
      using hint = 'Set another tier as default first.';
  end if;

  update public.customer_tiers
     set name = trim(p_name),
         is_default = coalesce(p_is_default, is_default),
         notes = nullif(trim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_tier_id;
end;
$function$;

revoke execute on function public.define_tier(text, boolean, text) from public, anon;
grant  execute on function public.define_tier(text, boolean, text) to authenticated;

revoke execute on function public.update_tier(uuid, text, boolean, text) from public, anon;
grant  execute on function public.update_tier(uuid, text, boolean, text) to authenticated;
