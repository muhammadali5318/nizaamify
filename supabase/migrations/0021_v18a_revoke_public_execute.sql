-- v1.8a — fix-up for v1.8 hardening
-- Bug found in re-audit: REVOKE EXECUTE FROM anon was a no-op because PUBLIC
-- still held EXECUTE. anon inherits via membership in PUBLIC, so the advisor
-- still flagged every SECURITY DEFINER function as anon-callable.
--
-- Pattern fix: revoke from PUBLIC (which strips the wildcard), then grant
-- back to the roles that should be able to call it. SECURITY DEFINER stays.

-- Write RPCs — authenticated-only (per ADR-0011)
revoke execute on function public.record_sale(uuid, numeric, numeric, text, jsonb)         from public;
grant  execute on function public.record_sale(uuid, numeric, numeric, text, jsonb)         to authenticated;

revoke execute on function public.record_purchase(text, text, date, jsonb, boolean)        from public;
grant  execute on function public.record_purchase(text, text, date, jsonb, boolean)        to authenticated;

revoke execute on function public.receive_payment(uuid, numeric, text)                     from public;
grant  execute on function public.receive_payment(uuid, numeric, text)                     to authenticated;

revoke execute on function public.reverse_ledger_entry(uuid, text)                         from public;
grant  execute on function public.reverse_ledger_entry(uuid, text)                         to authenticated;

revoke execute on function public.create_product_with_opening_stock(text, text, text, numeric, integer, numeric) from public;
grant  execute on function public.create_product_with_opening_stock(text, text, text, numeric, integer, numeric) to authenticated;

revoke execute on function public.complete_onboarding(text, text, text, text, text, text, text, text) from public;
grant  execute on function public.complete_onboarding(text, text, text, text, text, text, text, text) to authenticated;

-- Read RPCs — authenticated-only
revoke execute on function public.list_customers(text, integer, integer)                   from public;
grant  execute on function public.list_customers(text, integer, integer)                   to authenticated;

revoke execute on function public.recent_customers(integer)                                from public;
grant  execute on function public.recent_customers(integer)                                to authenticated;

revoke execute on function public.search_khata_customers(text, text, integer, integer)     from public;
grant  execute on function public.search_khata_customers(text, text, integer, integer)     to authenticated;

revoke execute on function public.search_khata_customers_count(text, text)                 from public;
grant  execute on function public.search_khata_customers_count(text, text)                 to authenticated;

revoke execute on function public.search_products(text, integer, integer, boolean)         from public;
grant  execute on function public.search_products(text, integer, integer, boolean)         to authenticated;

revoke execute on function public.search_products_count(text, boolean)                     from public;
grant  execute on function public.search_products_count(text, boolean)                     to authenticated;

revoke execute on function public.current_shop_id()                                        from public;
grant  execute on function public.current_shop_id()                                        to authenticated;

-- Trigger / internal functions — fully internal. Strip from PUBLIC; do not grant back.
revoke execute on function public.ledger_entries_update_balance() from public;
revoke execute on function public.ledger_entries_immutable()      from public;
revoke execute on function public.financial_records_immutable()   from public;
revoke execute on function public.touch_updated_at()              from public;
revoke execute on function public.products_normalize_trigger()    from public;
revoke execute on function public.normalize_product_text(text)    from public;
revoke execute on function public.expire_subscriptions()          from public;
