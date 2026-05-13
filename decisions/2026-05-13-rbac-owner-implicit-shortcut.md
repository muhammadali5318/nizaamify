# 2026-05-13 — Owner has every permission via implicit shortcut

## Context

Under the permission-based model ([[2026-05-13-rbac-permission-model-over-roles]])
the natural question is how the shop owner gets access. Two options:
populate `user_shop_permissions` with 50 rows (all `granted = true`)
on shop creation, or short-circuit the owner via a special check.

## Decision

The shop owner is special. `user_shop_access.is_owner = true` triggers
a short-circuit in `user_has_permission(p_shop_id, p_permission_key)`:
if the caller is owner of the shop, return TRUE for every permission
without consulting `user_shop_permissions`. The owner has NO rows in
`user_shop_permissions`.

The owner is established at shop creation by `complete_onboarding`,
which inserts `user_shop_access` with `is_owner = true`. There can be
exactly one such row per shop (enforced by partial unique index
`uq_user_shop_access_one_owner_per_shop`).

Ownership is NOT editable in the permission UI. The owner cannot be
revoked via `revoke_user_access` (raises `cannot_revoke_owner_access`).
The owner cannot have individual permissions modified via
`modify_user_permission` (raises `cannot_modify_owner`).

Ownership transfer is a v2.10+ workflow (`transfer_ownership` RPC).

## Alternatives considered

1. **Populate 50 permission rows for the owner.** Considered. Adds
   bulk to `user_shop_permissions`. Confuses the audit log (every
   shop creation logs 50 grant events instead of one ownership
   event). Rejected.
2. **Owner is "just a user with all permissions granted."** A
   variation of (1) without the shortcut. Means new permissions added
   in future migrations would NOT auto-apply to the owner (the owner
   would lack the new rows until backfilled). Rejected — the
   shortcut keeps owners forward-compatible.
3. **No is_owner column; owner = shops.owner_user_id pointer only.**
   The `shops.owner_user_id` denormalization stays, but it's a
   "founding owner" snapshot, not a "current owner" gate. Confusing
   if they diverge. Rejected; the `is_owner` flag on `user_shop_access`
   is the authoritative source.

## Consequences

- `user_has_permission` body short-circuits via EXISTS on
  `user_shop_access WHERE is_owner = true`. One extra table read per
  call, cached as STABLE.
- Audit AQ-19 verifies the invariant: owners must NEVER have rows in
  `user_shop_permissions`. If they do, it's a bug.
- New permissions added in future migrations are immediately TRUE for
  every existing owner — no backfill needed.
- The `shops.owner_user_id` column stays for back-compat but is no
  longer the authoritative ownership gate. AQ-07 ensures it matches
  the `user_shop_access` row.
- Cannot remove owner via UI. Owner deletion requires v2.10+ ownership
  transfer.
- The owner preset's `preset_owner_default = true` for every catalog
  row is informational — used by the team UI to display "Owner has all
  permissions implicitly."

Related: [[2026-05-13-rbac-permission-model-over-roles]],
[[2026-05-13-rbac-presets-as-templates]].
