# 2026-05-13 — Search/list RPCs use wrapper-level conditional projection

## Context

Phase B §B.5.1 (post-F-PD-04 resolution) locks: the existing search
and list RPCs (`search_products`, `recent_purchase_products`,
`list_customers`, `recent_customers`) keep their signatures + are
gated on a basic read permission at the wrapper; the body conditionally
NULLs cost-bearing / contact / outstanding columns based on caller's
specific permissions.

Migration 0076 (rename-and-wrap pattern) added permission checks but
did NOT yet apply conditional projection — the inner `_v28` bodies
returned all columns unconditionally. Checkpoint 2 flagged this as the
critical pre-cutover gap. 0076b closes it.

`recent_customers` was newly identified during Checkpoint 2 re-audit
as having the same shape gap and is included.

## Decision

The projection happens **at the wrapper level** (not the inner body).
The wrapper:
1. Performs the permission check (basic read: `view_products` /
   `view_customers`).
2. Evaluates the secondary permission flags (`view_product_cost`,
   `view_customer_contact`, `view_customer_outstanding`) once per call.
3. Calls the inner `_v28` function which returns all rows + columns.
4. `return query select ... case when can_see_X then col end ... from
   inner(args)` projects sensitive columns as NULL for callers
   without the permission.

This pattern was chosen over rewriting the inner v28 bodies because:
- The wrapper already has the permission context.
- The inner body's SQL stays unchanged (auditable as the v2.8.5 logic).
- Only one delegation call per RPC; the column shaping is O(1) per row.
- Postgres caches `STABLE` helper results within a query plan.

Applied to: `search_products` (NULLs `avg_cost`, `last_purchase_cost`,
`min_price`, `max_price` per `view_product_cost`),
`recent_purchase_products` (NULLs `avg_cost`), `list_customers` (NULLs
`phone` + `address` per `view_customer_contact`; NULLs `outstanding`
per `view_customer_outstanding`), `recent_customers` (NULLs `phone` +
`address`).

## Alternatives considered

1. **Rewrite inner v28 bodies with conditional projection.** Inner
   bodies for record_sale (15KB) and search_products (3KB) are big;
   touching them mixes "permission checks" with "v2.8.5 SQL logic"
   and increases blast radius. Rejected.
2. **Two RPC variants** (`search_products` for cost-readers,
   `search_products_safe` for everyone). Doubles the API surface;
   client must choose which to call based on permission. Rejected
   per F-PD-04 resolution.
3. **Column-level revoke** (`REVOKE SELECT (avg_cost) FROM authenticated`).
   The Phase B §B.4 design constraint prohibits this approach
   ("prefer separate views over column-level grants"). Rejected.

## Consequences

- The 4 RPCs (`search_products`, `recent_purchase_products`,
  `list_customers`, `recent_customers`) gate on the BASIC read
  permission (`view_products` / `view_customers`).
- Salesperson without `view_product_cost` calls `search_products` →
  receives rows with `avg_cost = NULL`, `last_purchase_cost = NULL`,
  etc.
- Owner (implicit shortcut) sees all columns populated.
- Manager (default preset has `view_product_cost = ✓`) sees cost
  columns. Manager without `view_customer_contact` would see NULL
  phone/address — but manager preset default has it ✓; this would
  only fire if the owner explicitly revoked.

Related: [[2026-05-13-rbac-permission-conditional-view-projection]],
[[2026-05-13-rbac-permission-model-over-roles]].
