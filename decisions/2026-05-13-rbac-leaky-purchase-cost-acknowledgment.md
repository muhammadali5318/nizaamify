# 2026-05-13 — Manager can derive sale profit from purchase data (accepted limitation)

## Context

Phase B §B.2.2 locks: manager preset has `view_purchases = ✓`,
`view_product_cost = ✓`, `view_batch_cost = ✓` (operational data
needed for stock-in), but `view_sale_cost = ·` and `view_profit_margin
= ·` by default. The intent: manager cannot see absolute profit on
sales.

But a manager with `view_purchases` knows historical `purchase_items.cost_at_purchase`.
A manager can JOIN `sale_items` (visible via `sale_items_view` with
cost columns NULLed) to historical purchase data to APPROXIMATE the
cost per unit at sale time. For products with stable cost, this
approximation is exact.

## Decision

**Accepted limitation.** Phase B §B.2.2 acknowledges this explicitly:

> A manager who recorded a recent purchase can mentally remember the
> cost and compute profit on adjacent sales. This is unavoidable
> absent a separation-of-duties that splits "purchase entry" from
> "purchase review" into two roles — out of scope for v2.9.

The v2.9 design does NOT close this loophole. The permission model
provides the granularity to do so (an owner could revoke `view_purchases`
from a manager and route purchases through a separate "purchaser"
account), but the catalog's default presets assume the manager does
both stock-in and sales-floor work.

## Alternatives considered

1. **Strip cost from `view_purchases` too.** Would force stock-in
   workflows to be blind to cost — operationally untenable.
2. **Add a separate `purchase_recorder` role / permission set.**
   Doubles the operational model. Rejected for v2.9; revisit in v2.10
   if customer demand surfaces.
3. **Anonymize cost at purchase time** (e.g., display the cost in
   the form but don't persist it). Rejected — defeats the audit trail
   and the avg_cost computation.

## Consequences

- A determined manager can compute profit via SQL joins between
  visible purchase data and salt-stripped sale data. The threat model
  (per Phase C §C.0.1) is "fired manager with valid credentials, not
  APT" — a fired manager exfiltrating cost data via this path is
  bounded by their JWT TTL (1h Supabase default).
- For shops that explicitly distrust their managers with cost data,
  the owner can manually revoke `view_purchases` from that manager.
  That manager loses stock-in capability — explicit operational
  trade-off.
- Documented in `docs/gotchas.md` as a v2.9 limitation. v2.10+
  candidate for separation-of-duties refinement.

Related: [[2026-05-13-rbac-permission-conditional-view-projection]],
[[2026-05-13-rbac-permission-model-over-roles]].
