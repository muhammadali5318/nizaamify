# v2.9.1 — AQ-22 action widening + AQ-23 exempt list extension

**Status:** Filed (post-pilot)
**Date:** 2026-05-13
**Related:** `audit/2026-05-13-v291-phase-e-owner-synthetic-test.sql`, `notes/2026-05-13-v291-pilot-aq-findings.md`, migration `0075_v29_new_rpcs.sql` (accept_invitation), migration `0090_v291_get_my_pending_invitation.sql`, [[2026-05-13-v291-aq24-baseline-allowlist]]

## Context

The v2.9.1 self-pilot ran the full AQ-01..AQ-24 suite post-pilot. Two soft-asserts returned 1 each:

- **AQ-22 = 1**: every `user_shop_access` row with `preset_applied` set should have a matching audit row with `action='preset_applied'`. The new `+salesperson@` row failed the check.
- **AQ-23 = 1**: every DEFINER wrapper granted to `authenticated` should carry the three guards (`not_authenticated`, `no_shop_for_user`, `user_has_permission`) unless exempt. `get_my_pending_invitation` was flagged for missing `no_shop_for_user`.

Both findings are pre-existing — they predate the pilot and are not caused by either today's cascade-fix (`c860ffd`) or the `no_access_to_shop` handler (`3195984`).

## Decision (AQ-22)

`accept_invitation` emits its audit row with `action='access_granted'` (carrying `new_value.preset`), not `action='preset_applied'`. Both AUDIT row variants record the same fact — that a preset was applied to this user at this shop — but AQ-22 only recognized one. Every successfully accepted invitation since v2.9 has produced a stale AQ-22 row.

Widen AQ-22 to accept either action:

```sql
and uspa.action in ('preset_applied', 'access_granted')
and uspa.new_value->>'preset' = usa.preset_applied
```

The `new_value.preset` cross-check is preserved verbatim. A user who somehow gets `preset_applied` set on their membership row but has *neither* audit variant present (i.e. someone bypassed both `apply_preset_to_user` and `accept_invitation`) is still flagged — that's the failure mode AQ-22 exists for.

## Alternatives considered (AQ-22)

1. **Modify `accept_invitation` to emit a second `action='preset_applied'` audit row.** Tighter symmetry, but adds a migration and doubles the audit volume on every accept. Rejected — the existing audit row already records the fact; the audit query was the thing out of alignment.
2. **Leave AQ-22 as a soft-assert and document every accept as a known false-positive.** Rejected — operator fatigue. The audit suite's value depends on `n=0` being achievable; a hard-coded `n=1` per non-owner user makes AQ-22 unread.

## Decision (AQ-23)

`get_my_pending_invitation` (mig 0090) is a v2.9.1 hot-patch added so `RequireOnboarded` can detect a caller's pending invitation *before* they have any shop access and redirect them to `/invite/accept` instead of `/onboarding`. The function intentionally runs without an `app-shop-id` header — the invitee has no shop yet. It mirrors `get_invitation_for_acceptance` (mig 0088) exactly in this respect, and `get_invitation_for_acceptance` is already in the AQ-23 exempt list.

`get_my_pending_invitation` was simply omitted from the exempt list when it was added — the AQ-23 exempt list lives in the audit SQL file, not in mig 0090, so the audit baseline wasn't synchronized at the time.

Add it:

```sql
case when name in (
  'accept_invitation','cancel_invitation','complete_onboarding',
  'current_active_shop_id','current_shop_id',
  'get_user_permissions','get_user_shop_list',
  'set_active_shop','user_has_permission','user_has_shop_access',
  'user_permissions_in_shop',
  'get_active_shop','get_shop_settings',
  'get_invitation_for_acceptance',
  'get_my_pending_invitation'  -- v2.9.1 mig 0090, same pre-shop rationale
) then true else false end as is_exempt
```

## Alternatives considered (AQ-23)

1. **Add a `no_shop_for_user` raise inside `get_my_pending_invitation`.** Rejected — the function exists *because* the caller has no shop. Adding the raise would make it useless for its single purpose.
2. **Drop AQ-23 entirely.** Rejected — it's the only line of defense against new DEFINER wrappers shipping without the three guards.

## Consequences

- AQ-22 and AQ-23 both return 0 against current production state.
- The exempt list in AQ-23 now has 15 entries (was 14). Parallel discipline to [[2026-05-13-v291-aq24-baseline-allowlist]]: additions to the list are ADR-tracked so the surface stays auditable.
- Future invitations will pass AQ-22 without any application change. No migration needed.
- If `accept_invitation` is ever rewritten to emit `preset_applied` (e.g. to reduce branching in downstream dashboards), AQ-22's widened predicate still passes — the `in ('preset_applied', 'access_granted')` clause is forward-compatible.
- Any new DEFINER wrapper added to the codebase must either implement the three guards or be added to the AQ-23 exempt list with a documented rationale — same rule as before, just with the list synchronized.
