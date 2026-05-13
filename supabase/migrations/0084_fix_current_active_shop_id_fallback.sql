
-- 0084_fix_current_active_shop_id_fallback.sql
--
-- Fixes a SQL grouping bug in `current_active_shop_id()`'s
-- single-shop fallback (introduced in 0070):
--
--   return (select shop_id from public.user_shop_access
--            where user_id = auth.uid()
--            group by user_id having count(*) = 1
--            limit 1);
--
-- Postgres rejects this with 42803 ("column user_shop_access.shop_id
-- must appear in the GROUP BY clause or be used in an aggregate
-- function") because shop_id is selected but only user_id is grouped.
--
-- The fallback fires whenever no `app-shop-id` HTTP header is sent
-- (e.g. v2.8.5 client code, or v2.9.1 frontend before the
-- customFetch wrapper lands). Result: every RPC that calls
-- current_active_shop_id() crashes for new owners.
--
-- Fix: aggregate shop_id with min() under the same HAVING guard.
-- min() returns the (sole) shop_id when count = 1, NULL otherwise.

create or replace function public.current_active_shop_id()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_headers_text text;
  v_shop_id_str text;
  v_shop_id uuid;
begin
  -- Header path (v2.9.1 frontend with customFetch)
  v_headers_text := current_setting('request.headers', true);
  if v_headers_text is not null and v_headers_text <> '' then
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

  -- Fallback: user has exactly one shop. min() satisfies the
  -- grouping rule; HAVING ensures we only return when count = 1.
  return (
    select min(shop_id)
      from public.user_shop_access
     where user_id = auth.uid()
     group by user_id
    having count(*) = 1
  );
end;
$function$;
