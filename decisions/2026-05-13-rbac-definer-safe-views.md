# 2026-05-13 — DEFINER views with conditional projection (security_definer_view advisor warnings accepted)

## Context

Phase B §B.2.0b locks "one `_view` per cost-bearing table, with
per-column conditional projection based on caller permissions" as the
mechanism for the cost-visibility three-tier policy
([[2026-05-13-rbac-permission-model-over-roles]]).

The view bodies must run with elevated privileges to bypass the raw
table's RLS gate — otherwise a salesperson reading
`products_view` would inherit the salesperson's RLS-denied SELECT on
the raw `products` table and see zero rows.

PostgreSQL views default to `security_invoker = false` historically but
Supabase advisors flag explicit `security_definer` (also called
`security_invoker = false`) views as ERROR-level lints because
DEFINER-mode views can leak privileged data if mis-written.

## Decision

The 14 v2.9 views — `products_view`, `product_variants_view`,
`inventory_batches_view`, `sale_items_view`, `invoices_view`,
`purchases_view`, `purchase_items_view`, `purchase_overhead_items_view`,
`customers_view`, `monthly_summary_view`, `shop_owner_details_view`,
`shop_effective_subscription`, `customer_outstanding` (replaced),
`total_outstanding` (replaced) — are intentionally DEFINER
(`security_invoker = false`).

Each view body:
1. Establishes a materialized `caller_perms` CTE that captures the
   active shop and per-permission booleans from
   `user_has_permission(...)`.
2. Cross-joins the row source.
3. Projects sensitive columns conditional on the corresponding
   permission flag via `case when cp.can_see_X then col end`.

The mechanism is documented in Phase B §B.2.0b and §B.3.5.

The Supabase advisor `security_definer_view` lint fires 14 times after
migration 0074. **This is intentional and accepted.** No remediation
action; the views are auditable from the design doc and the catalog of
permission keys.

## Alternatives considered

1. **`security_invoker = true` views.** Inherit caller's RLS. Would
   force the raw table's RLS to permit all the row-access patterns we
   want, breaking the cost-visibility gate. Rejected.
2. **Column-level grants on the raw tables.** REVOKE SELECT
   (cost_columns) FROM authenticated. Verbose, fragile (re-grants
   needed after every ALTER TABLE), breaks the Supabase TypeScript
   type generator (NULL columns are still typed as non-NULL). Rejected
   per the Phase B §B.4 design constraint.
3. **Function-returning-table RPCs instead of views.** Verbose at the
   client (every list query routed through an RPC); loses PostgREST
   query DSL features (ilike, range, embed). Rejected.

## Consequences

- Supabase security advisor reports 14 ERROR-level
  `security_definer_view` lints. These are accepted documented
  warnings analogous to ADR-0011's `authenticated_security_definer_function_executable`
  lints for the SECURITY DEFINER RPCs.
- AQ-15 ongoing-regression query (Phase C §C.3) verifies that every
  DEFINER function callable by authenticated has a permission check
  in its body. The view bodies are similarly auditable: every
  cost-bearing column reference must be wrapped in `case when
  cp.can_see_X then ... end`.
- Phase D §C.4 F-PD-04 resolved: existing search/list RPCs
  (`search_products`, `recent_purchase_products`, `list_customers`)
  will be updated in a follow-up migration (0076b) to apply the same
  conditional-projection pattern in their RETURN-shaped bodies — see
  the deferred-enhancements list in Checkpoint 2.

Related: [[2026-05-13-rbac-permission-model-over-roles]],
[[2026-05-13-rbac-50-permission-catalog]],
ADR-0011 (`decisions/0011-intentional-security-definer-rpcs.md`).
