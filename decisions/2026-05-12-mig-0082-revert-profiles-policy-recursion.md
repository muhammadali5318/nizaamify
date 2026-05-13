# 2026-05-12 — Migration 0082: revert profiles half of 0081 (RLS recursion)

**Status:** Filed. Hot-patch landed under live authenticated traffic.
**Date:** 2026-05-12

## Context

Migration 0081 (`2026-05-13-v29-cleanup-permissive-policies`) consolidated the two permissive SELECT policies on `public.profiles` — `profiles_self_read` and `v29_profiles_team_read` — into a single OR'd policy, `profiles_self_or_owner_team_read`. The goal was to clear five `multiple_permissive_policies` advisor lints (see [[2026-05-13-v29-cleanup-permissive-policies]]). The migration also consolidated `units_of_measure`'s permissive policies in the same pattern.

The consolidation was QA'd via the audit-query suite and synthetic tests that ran inside `BEGIN ... ROLLBACK` with a JWT-claim simulation. All 23 audit queries returned green. The migration was applied to the live project.

The first real authenticated session after the cutover crashed `useProfile()` with:

```
ERROR: 42P17: infinite recursion detected in policy for relation "user_shop_access"
```

Root cause: the consolidated policy inlined both branches into a single USING predicate. The planner chose to evaluate the team-read `EXISTS (... user_shop_access ...)` branch even on pure self-read profile queries (`WHERE id = auth.uid()`). That EXISTS walked into `user_shop_access`'s own self-recursive policy `usa_self_or_owner_read` (which contains an inline `EXISTS` against `user_shop_access` itself). The recursion fired.

The pre-0081 two-policy form did not surface this because Postgres evaluates each permissive policy independently. For a self-read row, the cheap `profiles_self_read` admits the row before the EXISTS branch in `v29_profiles_team_read` is reached. A single OR'd predicate removes that short-circuit.

The downstream effect was severe — `useProfile()` threw on every authenticated mount, the guards saw `undefined.onboarding_completed`, and users were caught in an endless redirect to `/onboarding`.

## Decision

Emergency revert of the **profiles half** of migration 0081. Migration 0082 drops `profiles_self_or_owner_team_read` and restores the two-policy form verbatim from pre-0081 `pg_policies` state: `profiles_self_read` (self-only USING `id = auth.uid()`) and `v29_profiles_team_read` (owner-team-read via the inline EXISTS against `user_shop_access`).

The `units_of_measure` half of 0081 is left intact — its consolidated policy does not reference `user_shop_access` in its predicate, so it does not trigger the recursion. Reverting both halves would re-introduce two `multiple_permissive_policies` lints needlessly.

See `supabase/migrations/0082_revert_0081_profiles_policy_recursion.sql` for the verbatim DDL.

## Alternatives considered

1. **Full revert of migration 0081.** Rejected. The `units_of_measure` consolidation is genuinely safe — its predicate does not touch `user_shop_access`. Reverting both halves would re-introduce two avoidable advisor lints and obscure which consolidation was actually unsafe.
2. **Inline DEFINER helper for `usa_self_or_owner_read`.** Considered. This is the *correct* long-term fix — replace `user_shop_access`'s inline-EXISTS with a SECURITY DEFINER helper that bypasses RLS. Deferred because (a) it requires careful audit-query suite re-validation against a broader surface, and (b) the emergency was profile reads breaking under live traffic. Filed as v2.9.1 follow-up work and ultimately fulfilled by migration 0087's `get_team_member_profiles` DEFINER helper.
3. **Keep the consolidated policy and add a planner hint / re-order the predicate.** Rejected. Postgres planner behavior under permissive RLS with multiple OR'd branches is not stable enough to bet uptime on a hint. The two-policy form has a well-understood short-circuit.

## Consequences

**Positive:**
- Live authenticated traffic unblocked within the same session. `useProfile()` resolves; the dashboard mounts.
- The two-policy form is verbatim from pre-0081 — no novel surface area introduced under pressure.

**Negative / accepted:**
- The five `multiple_permissive_policies` advisor lints on `profiles` return. Accepted cost until the DEFINER helper fix lands.
- Migration 0082 is the first in a three-migration hot-patch chain (0082 → 0083 → 0086) that closed during the same session. See [[2026-05-12-mig-0083-drop-profiles-team-read]] for the next step.

## Discipline lesson

The synthetic test in 0076b used `set_config('request.jwt.claims', ...)` inside a `BEGIN ... ROLLBACK` block. That simulates the JWT but does NOT switch role. Real authenticated clients connect as the `authenticated` role with the planner choosing paths under that role's permissions; the synthetic test's planner path is different. This is the same lesson recorded in `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Discipline lesson: synthetic SQL tests do not substitute for real-role traffic. Memorialized as the [[feedback-synthetic-tests-real-role]] discipline rule.

## Bookkeeping

- `supabase/migrations/0082_revert_0081_profiles_policy_recursion.sql` — the DDL.
- Bundle context: [[2026-05-12-v2-9-0-1-frontend-sweep]] §Bookkeeping lines ~140 lists 0082 as one of four backend hot-patches.
- Next in chain: [[2026-05-12-mig-0083-drop-profiles-team-read]].
- Underlying recursion fix queued and ultimately delivered via migration 0087's `get_team_member_profiles` DEFINER helper (Phase C v2.9.1 work).
