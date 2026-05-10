-- 0035_v23c_recent_suppliers_most_used.sql
-- v2.3 follow-up — `recent_suppliers` previously ordered by last_used_at.
-- For the stock-in form's default 10-supplier dropdown the user wants
-- "most used", not "most recently used". A shopkeeper buys from the same 2-3
-- suppliers regularly; sorting by recency surfaces a one-off purchase from
-- last week above a weekly-regular supplier that was last used 8 days ago.
--
-- Rewrite the RPC to order by purchase count (desc), tiebreak by recency
-- then name. Keep the same signature and return shape so the frontend hook
-- doesn't need to change.

create or replace function public.recent_suppliers(p_limit integer default 10)
returns table(id uuid, name text, contact text, last_used_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with usage as (
    select supplier_id,
           count(*) as use_count,
           max(created_at) as last_used_at
      from public.purchases
     where shop_id = public.current_shop_id() and supplier_id is not null
     group by supplier_id
  )
  select s.id, s.name, s.contact, u.last_used_at
    from public.suppliers s
    left join usage u on u.supplier_id = s.id
   where s.shop_id = public.current_shop_id() and s.is_active = true
   order by coalesce(u.use_count, 0) desc,
            u.last_used_at desc nulls last,
            s.name asc
   limit greatest(p_limit, 1);
$$;

revoke execute on function public.recent_suppliers(integer) from public, anon;
grant  execute on function public.recent_suppliers(integer) to authenticated;
