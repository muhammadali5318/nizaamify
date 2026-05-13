# 2026-05-13 — Permission dependency rules enforced at grant/revoke time

## Context

Some permissions need others to be coherent. Granting `record_purchase`
without `view_suppliers` leaves the user unable to pick a supplier
during stock-in; the action is technically permitted but the UX is
broken. The question was where to enforce the dependency: at grant
time (catalog row declares `requires text[]`), at runtime (user_has_permission
traverses the graph), or in the UI only.

## Decision

**Approach (a) from Phase B B.1.2 — catalog-declared dependencies,
enforced symmetrically at grant time and revoke time. Runtime check
is single-permission, no traversal.**

29 dependency declarations (38 individual pairs after array expansion)
live in `permissions_catalog.requires text[]`. The two helper
functions enforce:

- `validate_permission_grant(p_access_id, p_permission_key)` — raises
  `permission_dependency_missing` if any required permission is not
  granted.
- `validate_permission_revoke(p_access_id, p_permission_key)` — raises
  `cannot_revoke_required_permission` if any permission that requires
  this one is currently granted.

Called from:
- `modify_user_permission` (grant path → validate_grant; revoke path →
  validate_revoke).
- `apply_preset_to_user` (no validation needed — presets are
  consistency-checked at catalog seed time).
- `create_invitation` (validates the resolved permission set + override
  delta).
- `accept_invitation` (defense in depth: re-validates the snapshot).

`user_has_permission(shop_id, key)` is single-key. Does NOT traverse
`requires`. The dependency system is a state-coherence guarantee, not
a runtime resolution.

## Alternatives considered

1. **Runtime traversal.** `user_has_permission` returns TRUE only if
   the key is granted AND every key in `requires` is granted (recursively).
   Rejected: every RPC call would walk the dep graph; expensive at
   ~50-permission scale; the "owner shortcut" would need its own
   traversal logic.
2. **No catalog dep field; enforce in RPC bodies.** Each RPC checks
   its own dependencies inline. Rejected: dependency rule lives in
   N places instead of one; future-Claude maintaining the RPCs has
   to know all the rules.
3. **UI-only enforcement.** Grey out dependent permissions until
   parent is granted. Rejected: client-side enforcement is bypassable
   via direct PostgREST. Server-side is the gate.

Notable specific dependency added 2026-05-13 post-Phase-C review:
`writeoff_batch` requires `view_inventory_batches` AND `view_batch_cost`.
The cost-visibility requirement forces "ability to make informed
write-off decisions" — a manager who can write off but can't see
cost can't self-regulate at the boundary where escalation to owner
would be appropriate.

## Consequences

- Catalog `requires` is the single source of truth. 29 declarations
  in §B.1.2 of the design doc.
- Grant operations may fail with `permission_dependency_missing`.
  Team UI displays the failure with the specific missing dep so the
  owner can grant it first.
- Revoke operations may fail with `cannot_revoke_required_permission`.
  Same UI treatment.
- Cascade is NOT automatic. Granting `record_purchase` does not
  auto-grant its 5 deps; the owner must grant them first. Mirrors
  enterprise IAM tools (AWS IAM, Okta) — explicit-action principle.
- Preset defaults are pre-validated at catalog seed time. Phase D's
  migration 0068 ensures each preset's TRUE-marked permissions have
  all their deps also TRUE-marked in the same preset; AQ-21
  verifies post-deploy.
- AQ-20 audits dependency consistency across `user_shop_permissions`:
  every granted permission must have its dependencies also granted.
  Should always return 0 rows.

Related: [[2026-05-13-rbac-50-permission-catalog]],
[[2026-05-13-rbac-presets-as-templates]].
