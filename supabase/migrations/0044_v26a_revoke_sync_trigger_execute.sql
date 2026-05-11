-- v2.6a — revoke EXECUTE on sync_product_id_from_variant() from authenticated.
--
-- This function is a BEFORE INSERT/UPDATE trigger helper installed in 0040,
-- not an RPC. Supabase auto-grants EXECUTE to authenticated on every newly
-- created function (CLAUDE.md v1.8a/v1.9a gotcha); 0040 revoked it from
-- public + anon but missed authenticated, which the advisor caught. Pattern
-- matches v1.8's touch_updated_at and financial_records_immutable revokes.

revoke execute on function public.sync_product_id_from_variant() from authenticated;
