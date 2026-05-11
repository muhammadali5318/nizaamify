-- v2.7 §4.1 — Attribute and value management RPCs.
--   create_variant_attribute / update_variant_attribute / deactivate_variant_attribute
--   add_variant_value / update_variant_value / deactivate_variant_value
--   search_variant_attributes / list_attribute_values
--
-- All SECURITY DEFINER, search_path = public, pg_catalog. Each function
-- enforces shop ownership via current_shop_id() and rejects archive ops when
-- there's still an active variant referencing the attribute/value.

-- ===========================================================================
-- create_variant_attribute(p_name, p_display_order) → uuid
-- ===========================================================================

create or replace function public.create_variant_attribute(
  p_name text,
  p_display_order int default 0
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_id uuid;
  v_trimmed text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if length(v_trimmed) = 0 then raise exception 'attribute_name_blank'; end if;

  -- Revive an archived match before inserting a duplicate (same pattern as
  -- create_category_inline from v2.5).
  update public.variant_attributes
     set is_active = true,
         display_order = coalesce(p_display_order, display_order),
         updated_at = now()
   where shop_id = v_shop_id
     and is_active = false
     and lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(v_trimmed)
   returning id into v_id;
  if v_id is not null then return v_id; end if;

  insert into public.variant_attributes (shop_id, name, display_order)
  values (v_shop_id, v_trimmed, coalesce(p_display_order, 0))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'attribute_already_exists';
end;
$$;

-- ===========================================================================
-- update_variant_attribute(p_id, p_name, p_display_order, p_is_active)
-- ===========================================================================

create or replace function public.update_variant_attribute(
  p_id uuid,
  p_name text default null,
  p_display_order int default null,
  p_is_active boolean default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_trimmed text;
  v_in_use bool;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  if p_name is not null then
    v_trimmed := regexp_replace(trim(p_name), '\s+', ' ', 'g');
    if length(v_trimmed) = 0 then raise exception 'attribute_name_blank'; end if;
  end if;

  -- If deactivating, reject when any active variant still references one of
  -- this attribute's values.
  if p_is_active = false then
    select exists (
      select 1
        from public.product_variant_attribute_values pvav
        join public.variant_attribute_values vv on vv.id = pvav.attribute_value_id
        join public.product_variants v on v.id = pvav.variant_id
       where vv.attribute_id = p_id and v.is_active
    ) into v_in_use;
    if v_in_use then raise exception 'attribute_in_use_cannot_archive'; end if;
  end if;

  update public.variant_attributes
     set name = coalesce(v_trimmed, name),
         display_order = coalesce(p_display_order, display_order),
         is_active = coalesce(p_is_active, is_active)
   where id = p_id and shop_id = v_shop_id;

  if not found then raise exception 'attribute_not_found'; end if;
exception
  when unique_violation then
    raise exception 'attribute_already_exists';
end;
$$;

-- ===========================================================================
-- deactivate_variant_attribute(p_id)  — convenience wrapper
-- ===========================================================================

create or replace function public.deactivate_variant_attribute(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  perform public.update_variant_attribute(p_id, null, null, false);
end;
$$;

-- ===========================================================================
-- add_variant_value(p_attribute_id, p_value, p_display_order) → uuid
-- ===========================================================================

create or replace function public.add_variant_value(
  p_attribute_id uuid,
  p_value text,
  p_display_order int default 0
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_id uuid;
  v_trimmed text := regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g');
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if length(v_trimmed) = 0 then raise exception 'value_blank'; end if;

  -- Verify attribute belongs to the caller's shop and is active
  perform 1 from public.variant_attributes
    where id = p_attribute_id and shop_id = v_shop_id and is_active;
  if not found then raise exception 'attribute_not_in_shop_or_inactive'; end if;

  -- Revive archived match first
  update public.variant_attribute_values
     set is_active = true,
         display_order = coalesce(p_display_order, display_order),
         updated_at = now()
   where attribute_id = p_attribute_id
     and is_active = false
     and lower(regexp_replace(trim(value), '\s+', ' ', 'g')) = lower(v_trimmed)
   returning id into v_id;
  if v_id is not null then return v_id; end if;

  insert into public.variant_attribute_values (attribute_id, value, display_order)
  values (p_attribute_id, v_trimmed, coalesce(p_display_order, 0))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'value_already_exists';
end;
$$;

-- ===========================================================================
-- update_variant_value(p_id, p_value, p_display_order, p_is_active)
-- ===========================================================================

create or replace function public.update_variant_value(
  p_id uuid,
  p_value text default null,
  p_display_order int default null,
  p_is_active boolean default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_trimmed text;
  v_in_use bool;
  v_attr_shop_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  if p_value is not null then
    v_trimmed := regexp_replace(trim(p_value), '\s+', ' ', 'g');
    if length(v_trimmed) = 0 then raise exception 'value_blank'; end if;
  end if;

  -- Shop guard via attribute
  select a.shop_id into v_attr_shop_id
    from public.variant_attribute_values vv
    join public.variant_attributes a on a.id = vv.attribute_id
   where vv.id = p_id;
  if v_attr_shop_id is null then raise exception 'value_not_found'; end if;
  if v_attr_shop_id <> v_shop_id then raise exception 'value_not_in_shop'; end if;

  if p_is_active = false then
    select exists (
      select 1
        from public.product_variant_attribute_values pvav
        join public.product_variants v on v.id = pvav.variant_id
       where pvav.attribute_value_id = p_id and v.is_active
    ) into v_in_use;
    if v_in_use then raise exception 'value_in_use_cannot_archive'; end if;
  end if;

  update public.variant_attribute_values
     set value = coalesce(v_trimmed, value),
         display_order = coalesce(p_display_order, display_order),
         is_active = coalesce(p_is_active, is_active)
   where id = p_id;
exception
  when unique_violation then
    raise exception 'value_already_exists';
end;
$$;

-- ===========================================================================
-- deactivate_variant_value(p_id)
-- ===========================================================================

create or replace function public.deactivate_variant_value(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  perform public.update_variant_value(p_id, null, null, false);
end;
$$;

-- ===========================================================================
-- search_variant_attributes(p_query) — for shop-wide pickers
--   Returns id, name, display_order, value_count
-- ===========================================================================

create or replace function public.search_variant_attributes(
  p_query text default null
) returns table (
  id uuid,
  name text,
  display_order int,
  value_count bigint
)
language plpgsql stable security definer
set search_path = public, extensions, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  perform set_limit(0.2);

  return query
    select a.id, a.name, a.display_order,
           count(vv.id) filter (where vv.is_active) as value_count
      from public.variant_attributes a
      left join public.variant_attribute_values vv on vv.attribute_id = a.id
     where a.shop_id = v_shop_id
       and a.is_active
       and (v_q is null or a.name % v_q or a.name ilike '%' || v_q || '%')
     group by a.id, a.name, a.display_order
     order by a.display_order asc, a.name asc;
end;
$$;

-- ===========================================================================
-- list_attribute_values(p_attribute_id) — ordered by display_order
-- ===========================================================================

create or replace function public.list_attribute_values(
  p_attribute_id uuid
) returns table (
  id uuid,
  value text,
  display_order int
)
language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v_shop_id uuid := public.current_shop_id();
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  perform 1 from public.variant_attributes
    where id = p_attribute_id and shop_id = v_shop_id and is_active;
  if not found then raise exception 'attribute_not_in_shop_or_inactive'; end if;

  return query
    select vv.id, vv.value, vv.display_order
      from public.variant_attribute_values vv
     where vv.attribute_id = p_attribute_id and vv.is_active
     order by vv.display_order asc, vv.value asc;
end;
$$;

-- ===========================================================================
-- Grants — revoke from public/anon, grant to authenticated
-- ===========================================================================

revoke execute on function public.create_variant_attribute(text, int)                              from public, anon;
revoke execute on function public.update_variant_attribute(uuid, text, int, boolean)               from public, anon;
revoke execute on function public.deactivate_variant_attribute(uuid)                               from public, anon;
revoke execute on function public.add_variant_value(uuid, text, int)                               from public, anon;
revoke execute on function public.update_variant_value(uuid, text, int, boolean)                   from public, anon;
revoke execute on function public.deactivate_variant_value(uuid)                                   from public, anon;
revoke execute on function public.search_variant_attributes(text)                                  from public, anon;
revoke execute on function public.list_attribute_values(uuid)                                      from public, anon;

grant  execute on function public.create_variant_attribute(text, int)                              to authenticated;
grant  execute on function public.update_variant_attribute(uuid, text, int, boolean)               to authenticated;
grant  execute on function public.deactivate_variant_attribute(uuid)                               to authenticated;
grant  execute on function public.add_variant_value(uuid, text, int)                               to authenticated;
grant  execute on function public.update_variant_value(uuid, text, int, boolean)                   to authenticated;
grant  execute on function public.deactivate_variant_value(uuid)                                   to authenticated;
grant  execute on function public.search_variant_attributes(text)                                  to authenticated;
grant  execute on function public.list_attribute_values(uuid)                                      to authenticated;
