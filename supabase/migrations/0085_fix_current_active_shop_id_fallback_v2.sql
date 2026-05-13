
-- 0085: 0084 attempted min(shop_id) but min(uuid) is not a built-in
-- aggregate. Switch to array_agg + count check, which works for any
-- type and only needs implicit single-group aggregation.

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

  -- Fallback: user has exactly one shop. array_agg works for uuid;
  -- count() in the same select acts as the "exactly one" guard.
  return (
    select case when count(*) = 1 then (array_agg(shop_id))[1] end
      from public.user_shop_access
     where user_id = auth.uid()
  );
end;
$function$;
