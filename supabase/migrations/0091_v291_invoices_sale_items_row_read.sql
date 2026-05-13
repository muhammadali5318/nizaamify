-- 0091_v291_invoices_sale_items_row_read.sql
--
-- v2.9.1 hot-patch — invoices/sale_items row visibility for salespersons.
--
-- BUG: catalog says view_all_sales = "See sales recorded by other staff.
-- Without this permission, user sees only sales they personally recorded
-- (filtered by cashier_id = auth.uid())." But the only v2.9 SELECT policy
-- on `invoices` is `v29_invoices_cost_read` gated on view_sale_cost. A
-- salesperson with view_all_sales but no view_sale_cost still sees zero
-- rows because no policy admits the row. Same break on `sale_items`.
--
-- Design intent of v2.9: frontend reads cost-sensitive surfaces through
-- `invoices_view` / `sale_items_view` (mig 0074), which have row-admit
-- semantics matching the catalog promise AND NULL-project cost columns
-- conditionally. But `useSales` / `useSale` hooks call `.from('invoices')`
-- directly — they were never migrated to the views.
--
-- This migration ships the smaller of two possible fixes:
--   (a) Add permissive row-read policies admitting rows by view_all_sales
--       OR cashier_id = auth.uid(). [shipping this]
--   (b) Refactor hooks to use views + column-revoke cost columns at the
--       grant layer. [deferred to v2.10 cleanup]
--
-- TRADE-OFF accepted for v2.9.1 pilot: option (a) creates a temporary
-- column-leak. RLS only gates rows, not columns; a salesperson with row
-- visibility can read `sale_items.cost_at_sale` via raw Supabase JS even
-- though the React UI doesn't render it. For the pilot (single owner +
-- 1-2 test staff) this is acceptable. v2.10 cleanup must:
--   1. Refactor useSales / useSale / useSaleItems-equivalent to read via
--      `invoices_view` + `sale_items_view`
--   2. `REVOKE SELECT (cost_at_sale) ON public.sale_items FROM authenticated`
--   3. Drop this migration's permissive policies OR keep them; either way
--      cost reads route through the view's conditional projection.
-- The same `v29_*_cost_read` policies remain — they still admit cost-
-- aware reads for users with view_sale_cost. Policies OR-combine.
--
-- AQ impact: AQ-15 (DEFINER functions with auth gates) unchanged. AQ-23
-- unchanged (no new functions). Existing AQ-01..AQ-24 stay zero.

begin;

create policy v29_invoices_row_read on public.invoices
  for select to authenticated
  using (
    shop_id = (select public.current_active_shop_id())
    and (
      (select public.user_has_permission(invoices.shop_id, 'view_all_sales'))
      or cashier_id = (select auth.uid())
    )
  );

create policy v29_sale_items_row_read on public.sale_items
  for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
       where i.id = sale_items.invoice_id
         and i.shop_id = (select public.current_active_shop_id())
         and (
           (select public.user_has_permission(i.shop_id, 'view_all_sales'))
           or i.cashier_id = (select auth.uid())
         )
    )
  );

commit;
