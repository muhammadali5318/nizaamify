# 2026-05-13 — Permission-based RBAC over role-based

## Context

The original Phase B Rev 1 design (`design/2026-05-13-rbac-model-design.md`
in git history before 2026-05-13b) used three fixed roles: owner /
manager / salesperson. Each role had a defined permission set encoded
in helper functions (`user_has_min_role`).

Mid-Phase-B, customer demand surfaced — 3 sports shops + 10 mobile
shops in the pipeline asked for granular permission control as a
competitive differentiator. Real shops want to grant `view_sale_cost`
to one manager but not another, or to enable `view_customer_outstanding`
for trusted salespeople in one shop while disabling it elsewhere.

## Decision

Pivot to permission-based RBAC. 50 boolean permissions across 8
categories. Per-user grants stored in `user_shop_permissions`. Three
system presets (Owner / Manager / Salesperson) become starting
templates at invitation time; per-user overrides are unlimited.

`user_has_permission(shop_id, permission_key)` is the single runtime
gate. Replaces `user_has_min_role`, `current_shop_has_min_role`, and
the other role-tier helpers.

## Alternatives considered

1. **Stay role-based + add overrides table.** Considered. Combines
   worst of both worlds: still needs role enum, plus override
   complexity. Rejected.
2. **Permission-based without presets.** Would force owners to grant
   30+ permissions manually for every invitation. Too much friction.
   Presets fix this without invalidating the granular model.
3. **Two-axis model: roles × shops.** Considered. The granular
   customer demand is per-permission, not per-shop; an additional
   axis adds complexity without addressing the ask.

## Consequences

- `user_shop_roles` table renamed to `user_shop_access` (one row
  per user × shop tracks ownership + preset + discount limits).
- New `user_shop_permissions` table (one row per user × shop ×
  permission, holds the `granted` boolean).
- New `permissions_catalog` table (50 rows, system-managed).
- Every RLS policy uses `user_has_permission(...)` instead of
  `user_has_min_role(...)`.
- Every DEFINER RPC's guard cites a specific permission key.
- The role-based Rev 1 design captured in git history at commit
  before 2026-05-13b. Future-Claude reading the doc sees both via
  the supersession cross-reference table in §B.1.4.
- Trade-off: surface area grew. 50 permission keys × per-user grants
  is more verbose than 3 role tags. Audit query suite extended with
  permission-integrity checks (AQ-18 through AQ-21).
- Customer benefit: per-user permission editing UI is the
  differentiator. Pakistani SMB shops with trust gradations among
  staff can encode them precisely.

Related: [[2026-05-13-rbac-50-permission-catalog]],
[[2026-05-13-rbac-presets-as-templates]],
[[2026-05-13-rbac-owner-implicit-shortcut]].
