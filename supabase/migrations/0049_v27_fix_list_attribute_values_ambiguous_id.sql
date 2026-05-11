-- v2.7 hotfix — list_attribute_values had an ambiguous column reference.
--
-- The function declares `returns table (id uuid, value text, display_order int)`.
-- Inside the body, the existence-check
--     perform 1 from public.variant_attributes where id = p_attribute_id ...
-- references `id` unqualified. Postgres can't tell whether `id` refers to the
-- function's output column or the table's column, raising
--   ERROR 42702: column reference "id" is ambiguous
-- on every call.
--
-- The error is swallowed by useQuery's queryFn → data defaults to [] → every
-- attribute card body and every matrix builder value picker shows
-- "no values yet" even when the values exist. Frontend has been broken since
-- migration 0046 shipped — the user's complaint surfaced it.
--
-- Fix: alias variant_attributes and qualify every column reference.

create or replace function public.list_attribute_values(p_attribute_id uuid)
returns table (id uuid, value text, display_order int)
language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v_shop_id uuid := public.current_shop_id();
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  perform 1
    from public.variant_attributes a
   where a.id = p_attribute_id
     and a.shop_id = v_shop_id
     and a.is_active;
  if not found then raise exception 'attribute_not_in_shop_or_inactive'; end if;

  return query
    select vv.id, vv.value, vv.display_order
      from public.variant_attribute_values vv
     where vv.attribute_id = p_attribute_id and vv.is_active
     order by vv.display_order asc, vv.value asc;
end;
$$;

revoke execute on function public.list_attribute_values(uuid) from public, anon;
grant  execute on function public.list_attribute_values(uuid) to authenticated;
