# 2026-05-13 — Permission-conditional view projection

## Context

The v2.9 cost-visibility model needs to expose different column sets
to different users at runtime:

- Owner reads all sensitive columns (cost, profit, margin, PII).
- Manager with `view_product_cost` reads product cost.
- Manager with `view_profit_margin` reads margin %.
- Salesperson reads no cost / no margin / no PII (and only own sales).

Phase B Rev 1 proposed three view variants per table (`_safe`, `_revenue`,
`_with_margin`). Rev 2 collapsed this to **one view per table with
conditional column projection**, gated by `user_has_permission(...)`
calls inside the view body.

## Decision

Each cost-bearing or sensitive-column table has exactly one `_view`
that projects:
- Non-sensitive columns unconditionally.
- Sensitive columns conditional on the relevant permission, via
  `case when (select user_has_permission(shop, key)) then col end`.

The conditional check is materialized in a CTE at the top of the view:

```sql
create view public.sale_items_view with (security_invoker = false) as
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select auth.uid()) as caller_id,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_all_sales')) as can_see_all,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_sale_cost')) as can_see_cost,
    (select public.user_has_permission((select public.current_active_shop_id()), 'view_profit_margin')) as can_see_margin
)
select
  si.id, si.invoice_id, si.qty, si.price_at_sale,  -- always visible
  case when cp.can_see_cost then si.cost_at_sale end as cost_at_sale,
  case when cp.can_see_cost then ((si.price_at_sale * si.qty - coalesce(si.line_discount_amount, 0))
                                  - si.cost_at_sale * si.qty)::numeric(12,2) end as line_profit,
  case when cp.can_see_margin and si.price_at_sale > 0
       then round(((si.price_at_sale - si.cost_at_sale) / si.price_at_sale * 100)::numeric, 2) end as margin_percent
  from public.sale_items si
  join public.invoices i on i.id = si.invoice_id
  cross join caller_perms cp
 where i.shop_id = cp.active_shop_id
   and (cp.can_see_all or i.cashier_id = cp.caller_id);
```

The `with caller_perms as materialized (...)` forces Postgres to
evaluate the permission checks once per query (not per row). The
`(select helper(...))` subqueries inside the CTE memoize each
helper-call result. Net: one `current_active_shop_id()` header parse
and one `user_has_permission()` lookup per permission per query.

Applied to 12 v2.9 views: `products_view`, `product_variants_view`,
`inventory_batches_view`, `sale_items_view`, `invoices_view`,
`purchases_view`, `purchase_items_view`, `purchase_overhead_items_view`,
`customers_view`, `monthly_summary_view`, `shop_owner_details_view`,
`shop_effective_subscription`.

Plus the v2.8.5 `customer_outstanding` and `total_outstanding` views
replaced with permission-conditional bodies.

## Alternatives considered

1. **Three views per table (`_safe`, `_revenue`, `_with_margin`).**
   Rev 1's design. Required client code to choose which view to query
   based on user's role. Verbose; permission grants don't map cleanly
   to "switch to a different view." Rejected.
2. **Per-row evaluation of `user_has_permission` without
   materialization.** Postgres would call the helper for every row
   the view returns. For a query returning 100 rows, that's 100×N
   helper invocations. Rejected for performance.
3. **`security_invoker = true` views.** Underlying raw-table RLS would
   gate the rows. Doesn't support per-column conditional projection
   based on permission (RLS gates rows, not columns). Rejected.

## Consequences

- 14 new DEFINER views fire `security_definer_view` advisor warnings.
  Accepted per [[2026-05-13-rbac-definer-safe-views]].
- Client code in Phase D switches from `from('products')` reads to
  `from('products_view')` reads. The view's column shape mirrors
  the table's, with NULL substitutions for permission-gated fields.
- The materialization pattern is the v2.9 standard. Future views
  added to the catalog should follow the same shape.
- Per-call header parse overhead inside `current_active_shop_id()` is
  bounded to one parse per query thanks to the materialized CTE.

Related: [[2026-05-13-rbac-definer-safe-views]],
[[2026-05-13-rbac-permission-model-over-roles]],
[[2026-05-13-rbac-set-active-shop-fallback-path]].
