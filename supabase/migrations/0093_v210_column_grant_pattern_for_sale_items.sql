-- 0093_v210_column_grant_pattern_for_sale_items.sql
--
-- v2.10a follow-up — migration 0092's `revoke select (cost_at_sale)` was a
-- no-op because PostgreSQL's table-level SELECT grant supersedes the
-- column-level REVOKE. Verified by SET ROLE authenticated + SELECT
-- cost_at_sale FROM sale_items returning rows (no permission error).
--
-- The correct pattern (PostgreSQL semantics): revoke the table-level
-- SELECT, then GRANT SELECT (col1, col2, ...) on the per-column basis
-- for everything that SHOULD be readable. Columns omitted from the
-- explicit grant are blocked.
--
-- COVERAGE
-- --------
-- After this migration:
--   - authenticated can SELECT every sale_items column EXCEPT cost_at_sale
--   - anon loses SELECT entirely (it had no business reading sale_items
--     anyway; Supabase grants it by default)
--   - DEFINER views (sale_item_financials, sale_items_view) continue to
--     read cost_at_sale internally as postgres and project it back
--     conditionally based on view_sale_cost
--
-- MAINTENANCE CONTRACT
-- --------------------
-- Any future migration that ADDs a column to public.sale_items MUST also
-- `grant select (<new_col>) on public.sale_items to authenticated;` or
-- the column will be invisible to the application. The current column
-- inventory below is the baseline as of v2.10a:
--
--   id, invoice_id, product_id, qty, price_at_sale, [cost_at_sale],
--   line_discount_type, line_discount_value, line_discount_amount,
--   variant_id, batch_id, sold_expired
--
-- Bracketed column (cost_at_sale) is intentionally excluded.
--
-- INSERT / UPDATE / DELETE grants are untouched. Application code does
-- not write sale_items directly — all writes flow through the
-- record_sale DEFINER RPC which runs as postgres.

begin;

revoke select on public.sale_items from authenticated;
revoke select on public.sale_items from anon;

grant select (
  id,
  invoice_id,
  product_id,
  qty,
  price_at_sale,
  line_discount_type,
  line_discount_value,
  line_discount_amount,
  variant_id,
  batch_id,
  sold_expired
) on public.sale_items to authenticated;

commit;
