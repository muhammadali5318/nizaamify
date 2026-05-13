# ADR — v2.9.2: DEFINER-ize the v2.6c financial views + column-level grant pattern for sale_items.cost_at_sale

**Date:** 2026-05-13
**Status:** Accepted
**Migration (in source):** `0092_v292_definerize_financial_views_and_revoke_cost_at_sale.sql` + `0093_v292_column_grant_pattern_for_sale_items.sql`
**Migration (production):** applied under historical name `0092_v210_*` + `0093_v210_*` (the supabase_migrations.schema_migrations table records the pre-rename names; the rename is a forward source fix)

> **NAMING NOTE.** This work was authored under the working label "v2.10a" during a session where the security-hardening pass collided with the v2.10 feature ticket (returns/refunds/warranty). Renamed to v2.9.2 to free the v2.10 namespace for the feature work. See `decisions/2026-05-13-v292-naming-collision-with-returns-feature.md` for the rename rationale and the discipline lesson.

## Context

Migration 0091 (v2.9.1 hot-patch) added permissive row-read policies on `invoices` and `sale_items` so salespersons (with `view_all_sales` but not `view_sale_cost`) could see their own sales rows. The trade-off accepted at the time, documented in the 0091 header:

> RLS only gates rows, not columns. A salesperson with row visibility can read `sale_items.cost_at_sale` via raw Supabase JS even though the React UI doesn't render it. Acceptable for the v2.9.1 pilot; v2.9.2 (drafted as v2.10) cleanup must refactor hooks to use `*_view` + REVOKE SELECT cost columns at the grant layer.

This ADR ships that cleanup.

Two leak paths existed for `cost_at_sale` post-0091:

1. **Raw-table leak** — `supabase.from('sale_items').select('cost_at_sale')` from `authenticated` returned real values for any row visible to the caller.
2. **Via-view leak** — the v2.6c `sale_item_financials` view (`security_invoker = true`) ran the cost-bearing CTE as the caller. If the caller had grant on `cost_at_sale`, `line_cost` and `line_profit` were returned in plain numerics.

## Decision

**Two-front fix:**

### Migration 0092 — DEFINER-ize the v2.6c financial views

- `sale_item_financials` and `invoice_financials` switched from `security_invoker = true` to `security_invoker = false` (DEFINER) — they now run as their owner (`postgres`) and bypass base-table RLS.
- Both views now embed the v2.9 row-filter pattern: `where i.shop_id = current_active_shop_id() and (user_has_permission(shop_id, 'view_all_sales') or i.cashier_id = auth.uid())`.
- Cost-bearing columns conditionally NULL-projected via materialized `caller_perms` CTE:
  - `sale_item_financials.cost_at_sale`, `.line_cost`, `.line_profit` ⟵ `view_sale_cost`
  - `invoice_financials.total_cost`, `.gross_profit` ⟵ `view_sale_cost`
  - `invoice_financials.gross_margin_percent` ⟵ `view_profit_margin`
- Cascade-recreated `monthly_summary` and `daily_sales_7` with unchanged bodies — they aggregate from `invoice_financials.revenue` (never gated) and `.gross_profit` (NULL'd via the DEFINER view; `sum(NULL) + coalesce 0 = 0` for non-cost-viewers, which is harmless because the UI is permission-gated).
- `expenses_by_category_mtd` and `purchase_item_financials` left in place — they don't depend on the cost-bearing views (verified via `pg_depend`).

### Migration 0093 — Column-grant pattern on `sale_items`

Migration 0092's `revoke select (cost_at_sale) on public.sale_items from authenticated` was a no-op — a verified PostgreSQL semantic: **when a table-level `GRANT SELECT` is in place, column-level `REVOKE` is silently ignored**.

Verification (after applying 0092):
```sql
set role authenticated;
select cost_at_sale from public.sale_items limit 1;
-- returned: cost_at_sale read succeeded (no permission error)
```

Migration 0093 applies the correct pattern:
```sql
revoke select on public.sale_items from authenticated;
revoke select on public.sale_items from anon;
grant select (id, invoice_id, product_id, qty, price_at_sale,
              line_discount_type, line_discount_value,
              line_discount_amount, variant_id, batch_id, sold_expired)
  on public.sale_items to authenticated;
```

After 0093:
```sql
set role authenticated;
select cost_at_sale from public.sale_items limit 1;
-- ERROR: permission denied for table sale_items
select id from public.sale_items limit 1;
-- (returns rows scoped by RLS)
```

`anon` loses SELECT entirely — it had no business reading `sale_items` and Supabase's default `grant to anon` was overbroad.

### Hook + component refactor

- `useSale` in `src/features/sales/hooks.ts` — `cost_at_sale` removed from the nested `sale_items` SELECT (would now error for every authenticated caller). Added to the `sale_item_financials` SELECT instead; the DEFINER view returns the value conditionally per `view_sale_cost`.
- `SaleDetailItem.{cost_at_sale, line_cost, line_profit}` widened to `number | null`. `SaleDetail.financials.{total_cost, gross_profit, gross_margin_percent}` widened to `number | null`.
- `SaleDetailPage` cells (`unit_cost`, `line_profit`) — type matches new nullable shape; null-coalesce inside the cell renderer is defensive (these cells render only when `canViewSaleCost === true`, so the runtime value is non-null when the column is shown).

## Alternatives considered

**A. Skip cost_at_sale; only close the customer.outstanding_balance leak.** Partial coverage, leaves the bigger leak open. Rejected — the v2.9.1 acknowledgment specifically targeted `cost_at_sale`.

**B. Refactor every hook to read from v2.9 `sale_items_view` / `invoices_view` (PostgREST nested joins).** PostgREST nested joins between views require explicit relationship metadata; building that out adds surface area without closing the v2.6c financial-view path. Rejected as too broad for v2.9.2's first slice.

**C. Stay with `security_invoker = true` financial views and add a permission-check WHERE clause that filters rows to zero for non-cost-viewers.** This would close the cost leak via the financial views but also zero out revenue rollups for salespersons on Dashboard and Reports — salespersons would see "Total sales: 0" which is wrong (they should see their cashier-scoped revenue). Rejected.

## Consequences

### Positive

- Cost leak closed at three layers: raw base-table grant, raw `sale_items_view` (existing), and via `sale_item_financials` / `invoice_financials` (new). A salesperson direct-querying any of those paths via Supabase JS gets `null` or a permission-denied error.
- The v2.6c "no JS Number arithmetic on money paths" discipline is preserved — `sale_item_financials` still computes the v2.3 largest-remainder allocation in SQL and emits `line_revenue`, `line_cost`, `line_profit`, `allocated_sale_discount`.
- Owner experience unchanged — the `owner_implicit` shortcut in `user_has_permission()` returns `true` for every permission, so DEFINER views return the real values for owners.
- Mig 0091's permissive row-read policies on `invoices` + `sale_items` remain in place but are now superseded by the DEFINER-view path. They can be dropped in a future cleanup migration after a stable observation period; leaving them in place is harmless.

### Negative / accepted trade-offs

- The Supabase security advisor will flag `sale_item_financials` and `invoice_financials` as `security_definer_view` warnings. Accepted, per ADR-0011 pattern — these warnings are baseline.
- Any future migration that adds a column to `public.sale_items` MUST also `grant select (<new_col>) on public.sale_items to authenticated;`. The mig 0093 header documents this contract; missing the grant makes the column invisible to the application.
- TypeScript shape change — `SaleDetailItem.{cost_at_sale, line_cost, line_profit}` are now nullable. Future readers must null-check before arithmetic. The component reads these only inside permission-gated cells, so the runtime path stays sound.
- v2.9.2 (this ADR + migs 0094 + 0095) does NOT close the analogous leaks on:
  - `customers.outstanding_balance` (raw-API readable)
  - `inventory_batches.cost_per_unit` (raw-API readable)
  - `products.{cost, avg_cost, last_purchase_cost}` and `product_variants.*` cost columns (raw-API readable)
  - `purchase_items.cost_at_purchase` and overhead columns (raw-API readable for users with `view_purchases`)

  v2.9.3 (post-pilot) will extend the column-grant pattern to those tables once v2.9.2 proves stable in pilot. Tracking in `docs/todos.md`.

### Rollback

A revert migration would:
1. `grant select on public.sale_items to authenticated;` (restore the table-level grant)
2. Drop + re-create `sale_item_financials` / `invoice_financials` as `security_invoker = true` with their v2.6c bodies (mig 0051 + 0052).
3. Cascade-restore `monthly_summary` / `daily_sales_7`.

The cost-leak returns; mig 0091's permissive policies remain the only gate.

### AQ baseline

- AQ-15 unchanged (no new DEFINER *functions*; views don't count toward function-level audit).
- AQ-23 unchanged (only RPCs).
- AQ-24 unchanged (legacy `current_shop_id()` baseline allowlist).
- Two new `security_definer_view` advisor entries expected. Add to the advisor exempt list during next audit.

## Related

- [[ADR-0011]] — DEFINER advisor warnings are accepted baseline.
- [[ADR-0015]] — v1.8 hardening: views should use `security_invoker = true` *by default*. This ADR partially reverses that for permission-conditional views; see also ADR for v2.9 mig 0074 conditional projection.
- [[v2.9.1 leaky-purchase-cost-acknowledgment]] — same pattern for purchase-side cost columns, deferred to v2.9.3 post-pilot.
- [[v2.9.1 ledger audit at insert]] (mig 0086) — analogous DEFINER pattern for append-only rows.
