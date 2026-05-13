# 2026-05-13 — Invitation permission snapshot is authoritative at accept time

## Context

When an owner creates an invitation via `create_invitation(p_email,
p_preset, p_permission_overrides, p_discount_limit_overrides)`, the
RPC must persist enough state that the invitee, upon `accept_invitation`,
receives exactly the permission set the owner intended — even if the
catalog or preset defaults change between create and accept.

Two options were available:
- (a) Re-resolve preset defaults at accept time. Drift between create
  and accept is visible.
- (b) Snapshot the resolved permission set at create time. Accept
  applies the snapshot verbatim.

## Decision

**Option (b) — snapshot.** `pending_invitations` has columns:
- `preset_applied text` (audit: which preset the owner chose).
- `permissions jsonb` (resolved set: `{key: bool}` for every catalog
  row at create time).
- `discount_limits jsonb` (resolved limits: preset defaults + owner
  overrides).

`accept_invitation` reads the JSONB and inserts one
`user_shop_permissions` row per key. No re-resolution against the
current catalog state.

Defense in depth: `accept_invitation` re-validates the snapshot's
dependency rules at accept time (against the CURRENT catalog
`requires`). If the catalog changed between create and accept and a
newly-required permission is missing from the snapshot, raise
`permission_dependency_missing`. The invitee retries after the owner
re-issues.

## Alternatives considered

1. **Re-resolve at accept time.** Rejected — drift between create and
   accept produces surprising "I checked X but Y appeared" cases. The
   owner reasonably expects "what I configured is what they get."
2. **Snapshot resolved permissions but NOT discount limits.** Rejected
   — same drift concern applies to caps.

## Consequences

- New permissions added in a v2.9.x migration between invitation create
  and accept don't show up in the snapshot; the invitee gets them OFF
  by default (per [[2026-05-13-rbac-presets-as-templates]] — staff
  default OFF on new permissions).
- The snapshot is captured at the moment the owner clicked "Send" —
  exactly what they saw in the UI.
- E9 edge case (Phase B §B.6.3) is the documented test for this
  behavior.

Related: [[2026-05-13-rbac-presets-as-templates]],
[[2026-05-13-rbac-permission-model-over-roles]].
