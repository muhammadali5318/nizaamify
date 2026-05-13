# v2.9.1 — List-RPCs to bridge the catalog-vs-RLS gap on team tables

**Status:** Draft (Phase C). Promoted to filed after C → D gate verification.
**Date:** 2026-05-13
**Related:** Phase A.2 §8.1, migration 0087

## Context

The v2.9 permissions catalog (migration 0068) advertises `view_team` and `view_user_audit_log` as the gates for the team-management page. But the actual RLS on `pending_invitations` and `user_shop_permission_audit` is **owner-only** (no policy admits managers with `view_team`). Managers with the cataloged permissions cannot read those tables directly — the Phase A.2 RPC inventory flagged this as discrepancy §8.1.

Two routes to close the gap:

1. **Loosen the table policies.** Add `using ( ... or user_has_permission('view_team') )` to the `SELECT` policy on `pending_invitations`; add the equivalent for `user_shop_permission_audit` gated on `view_user_audit_log`.
2. **Mint DEFINER list-RPCs gated by the catalog permission.** Keep RLS owner-only as defense in depth; frontend reads only via the RPCs.

## Decision

**Option 2.** Two new DEFINER RPCs in migration 0087:

- `list_pending_invitations_for_shop()` — gated on `view_team`. Projects identifier columns + `invited_by_email` (joined via `profiles`); does NOT project `confirmation_code` (sensitive — only the invitee's accept flow uses it) or `permissions` JSONB (resolved at accept time).
- `list_permission_audit_for_shop(p_limit, p_offset)` — gated on `view_user_audit_log`. Projects the full audit row including `old_value` / `new_value` JSONB per Phase B / D.4 (audit users need the diff). Paginated; default 100/page, cap 500.

RLS on both tables stays owner-only. Frontend `usePendingInvitations` + `usePermissionAuditLog` hooks call only the RPCs.

## Alternatives considered

1. **Loosen table RLS** — works, but each loosened policy is a new attack surface line. For `user_shop_permission_audit` specifically, the `old_value` / `new_value` JSONB may carry permission keys + discount limits + invitation snapshots; raw-row access without projection control bypasses the explicit "what should managers see" question.
2. **Manager-readable view layer instead of RPCs** — would work, but views can't enforce limits / offsets / projection rules as readably. RPCs are the existing v2.9 pattern (14 conditional-projection DEFINER views are already in use); list-RPCs follow the same shape.
3. **Use Supabase realtime subscriptions** — same problem as RLS for managers; bypasses RPC gates.

## Consequences

**Positive:**
- Defense in depth: even if a future migration accidentally drops the RPC permission check, raw table RLS is still owner-only.
- Explicit projection control: `confirmation_code` cannot leak to the team page even via row-level access patterns.
- Consistent with v2.9's 14 conditional-projection views — same mental model, same audit reach.

**Negative / accepted:**
- Two extra functions to maintain. Both shape-conformant to AQ-23 (P1/P2/P3 gates present).
- Direct RLS reads on these tables remain inert for managers. Any future hook that needs broader team data must go through an RPC or extend the loosen-RLS path (with an ADR).

## Revisability

If a future use case needs broader team-table reads (e.g., a Supabase realtime subscription on invitation status changes), loosening RLS becomes an option — but only with a follow-up ADR documenting the projection rules and an explicit threat-model review. The current scope (read-only list pages) is well-served by RPCs.
