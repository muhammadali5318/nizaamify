# 2026-05-13 — Presets are starting templates, not enforced

## Context

After locking the permission-based model and the 50-permission
catalog, the question was whether presets (Owner / Manager /
Salesperson) should be enforced after invitation acceptance, or
treated as one-time starting templates.

"Enforced presets" would mean: invitee starts as Manager → their
permissions track the Manager preset forever; if the catalog default
changes, their grants update.

"Template presets" would mean: invitee starts with Manager defaults
applied to their `user_shop_permissions` rows → after that, the rows
are independent of the catalog default; owner can flip individual
permissions per-user.

## Decision

**Template presets.** Catalog defaults apply once at invitation
acceptance time (or at explicit `apply_preset_to_user` call); after
that, the user's permission rows are independent.

Per-user overrides are unlimited. Owner can flip any individual
permission via `modify_user_permission` RPC. Re-applying a preset
re-seeds all 50 rows back to defaults; `user_shop_access.preset_applied`
records which preset was last applied (or NULL if custom-after-preset
modifications happened — set by `modify_user_permission` to indicate
divergence from preset).

## Alternatives considered

1. **Enforced presets.** Tracks the catalog over time. Rejected
   because real shops want stable per-user permission sets; surprising
   if a catalog migration silently changes what a manager can do.
2. **No presets at all.** Owner toggles each of 50 permissions per
   invitation. Rejected for UX; the customer demand was for granular
   control with a sensible starting point.
3. **Multiple custom presets.** Owner defines their own "head cashier"
   preset, etc. Rejected for v2.9 scope — the three system presets
   cover the common cases; user-defined presets can ship in v2.10+
   if demand surfaces.

## Consequences

- `apply_preset_to_user` RPC inserts/upserts 50 rows in
  `user_shop_permissions` per the catalog's `preset_<role>_default`
  columns. Each row's `source = 'preset'`.
- `modify_user_permission` for individual changes sets `source =
  'manual'`. The team UI can show "this permission deviated from the
  Manager preset" by checking `source`.
- New permissions added in future migrations DO NOT auto-apply to
  existing users. The migration adds the catalog row; existing
  `user_shop_permissions` tables have no row for the new key;
  `user_has_permission` defaults to FALSE for non-owners. Owners
  get the new permission via implicit shortcut.
- Invitation snapshot includes the resolved permission set at create
  time. Accepts at any time yield the snapshot — preset changes in
  the catalog between invite-create and invite-accept don't drift
  (see [[2026-05-14-rbac-invitation-snapshot-not-resolved-at-accept]]).
- Catalog `preset_<role>_default` columns are authoritative for new
  preset applications, not for existing users.

Related: [[2026-05-13-rbac-permission-model-over-roles]],
[[2026-05-13-rbac-50-permission-catalog]],
[[2026-05-13-rbac-dependency-rules-grant-time]].
