-- v1.9a — fix-up for v1.9 RPC grants.
--
-- Caught in re-audit: Supabase auto-grants EXECUTE on every public function
-- to `anon`, `authenticated`, and `service_role` explicitly (not via PUBLIC),
-- so `REVOKE … FROM PUBLIC` doesn't bite. Need to revoke from anon explicitly.
-- (Different gotcha than v1.8a, where PUBLIC held the grant.)

revoke execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) from anon;
revoke execute on function public.search_suppliers(text, integer, integer)                 from anon;
revoke execute on function public.recent_suppliers(integer)                                from anon;
revoke execute on function public.create_supplier_inline(text, text, text, text)           from anon;
revoke execute on function public.search_purchases(date, date, uuid, boolean, integer, integer) from anon;
revoke execute on function public.search_purchases_count(date, date, uuid, boolean)        from anon;
revoke execute on function public.recent_purchase_products(integer)                        from anon;
