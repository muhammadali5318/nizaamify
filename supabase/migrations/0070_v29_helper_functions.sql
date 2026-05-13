
-- v2.9 Phase A migration 0070: helper functions (fallback path; no pre-request hook)
-- Locked design: design/2026-05-13-rbac-model-design.md §B.2.0a + §B.3.3
-- IMPORTANT: current_shop_id() v2.8.5 body is INTENTIONALLY PRESERVED for
-- "deny wins" safety during stabilization week. Do NOT modify it here.

-- (1) Pure set-membership
create or replace function public.user_has_shop_access(p_shop_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_shop_access
    where user_id = auth.uid() and shop_id = p_shop_id
  );
$$;

-- (2) Active shop — FALLBACK PATH: reads `app-shop-id` header per call
-- No pre-request hook. Validates membership inline. Falls back to single-shop.
-- Per ADR 2026-05-13-rbac-set-active-shop-fallback-path.
create or replace function public.current_active_shop_id()
returns uuid
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare
  v_headers_text text;
  v_shop_id_str text;
  v_shop_id uuid;
begin
  -- Read the request.headers GUC (may be null outside a PostgREST request)
  v_headers_text := current_setting('request.headers', true);
  if v_headers_text is not null and v_headers_text <> '' then
    -- Try parsing as JSONB and extracting the header
    begin
      v_shop_id_str := v_headers_text::jsonb ->> 'app-shop-id';
    exception when others then
      v_shop_id_str := null;
    end;
    if v_shop_id_str is not null and v_shop_id_str <> '' then
      begin
        v_shop_id := v_shop_id_str::uuid;
      exception when others then
        raise exception 'invalid_app_shop_id_header' using errcode = 'P0001';
      end;
      if not public.user_has_shop_access(v_shop_id) then
        raise exception 'no_access_to_shop' using errcode = 'P0001',
          detail = format('header app-shop-id=%s; caller has no access', v_shop_id_str);
      end if;
      return v_shop_id;
    end if;
  end if;
  -- Fallback: single-shop user
  return (select shop_id from public.user_shop_access
           where user_id = auth.uid()
           group by user_id having count(*) = 1
           limit 1);
end;
$$;

-- (3) Validate-and-confirm RPC for the client's explicit shop switch
-- The actual per-request transport is the header (see current_active_shop_id).
-- This RPC exists so the client can validate membership before writing to localStorage.
create or replace function public.set_active_shop(p_shop_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not public.user_has_shop_access(p_shop_id) then
    raise exception 'no_access_to_shop' using errcode = 'P0001';
  end if;
  -- No-op beyond validation in the fallback path.
end;
$$;

-- (4) current_shop_id() v2.8.5 body NOT MODIFIED.
-- Per ADR 2026-05-13-rbac-set-active-shop-fallback-path + §B.2.0a helper (4):
-- the existing body
--   select id from public.shops where owner_user_id = auth.uid() limit 1;
-- is preserved so that old PERMISSIVE RLS policies referencing
-- current_shop_id() return NULL for non-owner users during stabilization,
-- making old policies a no-op and preventing "allow-wins" widening.
-- This is intentional. Migration 0070 leaves current_shop_id() alone.

-- (5) Permission check (owner shortcut + lookup)
create or replace function public.user_has_permission(
  p_shop_id uuid, p_permission_key text
) returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select case
    when exists (
      select 1 from public.user_shop_access
      where user_id = auth.uid() and shop_id = p_shop_id and is_owner = true
    ) then true
    else coalesce(
      (select usp.granted
         from public.user_shop_access usa
         join public.user_shop_permissions usp on usp.user_shop_access_id = usa.id
        where usa.user_id = auth.uid()
          and usa.shop_id = p_shop_id
          and usp.permission_key = p_permission_key),
      false
    )
  end;
$$;

-- (6) List effective permissions for the calling user at a shop
create or replace function public.user_permissions_in_shop(p_shop_id uuid)
returns table(permission_key text, granted boolean, source text)
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare v_is_owner boolean;
begin
  select is_owner into v_is_owner
    from public.user_shop_access
   where user_id = auth.uid() and shop_id = p_shop_id;
  if v_is_owner is null then return; end if;
  if v_is_owner then
    return query
      select pc.key, true, 'owner_implicit'::text
        from public.permissions_catalog pc where pc.is_active;
    return;
  end if;
  return query
    select pc.key, coalesce(usp.granted, false),
           coalesce(usp.source, 'default')::text
      from public.permissions_catalog pc
      left join public.user_shop_access usa
        on usa.user_id = auth.uid() and usa.shop_id = p_shop_id
      left join public.user_shop_permissions usp
        on usp.user_shop_access_id = usa.id
       and usp.permission_key = pc.key
     where pc.is_active;
end;
$$;

-- (7) Validate grant-time dependencies (internal helper)
create or replace function public.validate_permission_grant(
  p_access_id uuid, p_permission_key text
) returns void
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare v_requires text[]; v_req text; v_req_granted boolean;
begin
  select requires into v_requires
    from public.permissions_catalog where key = p_permission_key;
  if v_requires is null or cardinality(v_requires) = 0 then return; end if;

  foreach v_req in array v_requires loop
    select coalesce(usp.granted, false) into v_req_granted
      from public.user_shop_permissions usp
     where usp.user_shop_access_id = p_access_id
       and usp.permission_key = v_req;
    if not coalesce(v_req_granted, false) then
      raise exception 'permission_dependency_missing'
        using errcode = 'P0001',
              detail = format('Granting %s requires %s to also be granted', p_permission_key, v_req);
    end if;
  end loop;
end;
$$;

-- (8) Validate revoke-time dependencies (internal helper)
create or replace function public.validate_permission_revoke(
  p_access_id uuid, p_permission_key text
) returns void
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare v_dep record;
begin
  for v_dep in
    select pc.key
      from public.permissions_catalog pc
     where p_permission_key = any(pc.requires)
       and exists (
         select 1 from public.user_shop_permissions usp
         where usp.user_shop_access_id = p_access_id
           and usp.permission_key = pc.key and usp.granted)
  loop
    raise exception 'cannot_revoke_required_permission'
      using errcode = 'P0001',
            detail = format('Cannot revoke %s: %s depends on it and is granted',
                            p_permission_key, v_dep.key);
  end loop;
end;
$$;

-- Grants: caller-facing helpers go to authenticated; internal validators stay restricted
revoke execute on function public.user_has_shop_access(uuid) from public, anon;
grant execute on function public.user_has_shop_access(uuid) to authenticated;

revoke execute on function public.current_active_shop_id() from public, anon;
grant execute on function public.current_active_shop_id() to authenticated;

revoke execute on function public.set_active_shop(uuid) from public, anon;
grant execute on function public.set_active_shop(uuid) to authenticated;

revoke execute on function public.user_has_permission(uuid, text) from public, anon;
grant execute on function public.user_has_permission(uuid, text) to authenticated;

revoke execute on function public.user_permissions_in_shop(uuid) from public, anon;
grant execute on function public.user_permissions_in_shop(uuid) to authenticated;

-- Internal: revoke from authenticated; DEFINER bodies that call them run as postgres
revoke execute on function public.validate_permission_grant(uuid, text) from public, anon, authenticated;
revoke execute on function public.validate_permission_revoke(uuid, text) from public, anon, authenticated;
