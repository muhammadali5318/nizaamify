# 2026-05-12 — Migration 0083: drop `v29_profiles_team_read` pending DEFINER helper

**Status:** Filed. Hot-patch follow-on to 0082.
**Date:** 2026-05-12

## Context

Migration 0082 restored the two-policy form on `public.profiles` (see [[2026-05-12-mig-0082-revert-profiles-policy-recursion]]). The expectation was that splitting the predicate back into two permissive policies would let Postgres short-circuit on self-read rows via the cheap `profiles_self_read` policy, avoiding the team-read EXISTS branch entirely.

The expectation did not hold under live traffic. Even with the two-policy form restored, `useProfile()` continued to raise `42P17: infinite recursion detected in policy for relation "user_shop_access"`. Re-reading the Postgres RLS evaluator confirmed the actual behavior: **for a candidate row, Postgres evaluates the USING predicate of every permissive policy** until one admits the row. There is no row-level short-circuit across policies — the planner runs each predicate to determine its OR contribution.

That means even on a pure `select * from profiles where id = auth.uid()` query, both `profiles_self_read` (which trivially admits the row) AND `v29_profiles_team_read` (which contains the recursive EXISTS) get evaluated. The recursion fires on the second policy regardless of whether the first already admitted the row.

The lesson: the 0082 revert was necessary but not sufficient. The recursion source is `v29_profiles_team_read`'s inline `EXISTS` against `user_shop_access` joined to itself.

## Decision

Drop `v29_profiles_team_read` entirely. `profiles` SELECT becomes self-only, matching v2.8.5 behavior. The team-read affordance — needed for the v2.9.1 team page — is deferred to a later migration that replaces the inline EXISTS with a SECURITY DEFINER helper function.

See `supabase/migrations/0083_drop_profiles_team_read_pending_helper_fix.sql` for the verbatim DDL (single `drop policy if exists`).

## Alternatives considered

1. **Inline a DEFINER helper now, in 0083, instead of dropping.** Considered and rejected for the same reason as in [[2026-05-12-mig-0082-revert-profiles-policy-recursion]]: the helper requires careful audit-query suite re-validation, and the emergency was that authenticated users could not load their own profile. Drop-and-defer was the faster recovery. The DEFINER helper landed in migration 0087's `get_team_member_profiles` (Phase C v2.9.1 work).
2. **Re-write the EXISTS to avoid the self-join on `user_shop_access`.** Investigated. The EXISTS needs to know whether the caller is an owner of any shop the target user belongs to — that inherently joins `user_shop_access` to itself. Re-shaping the predicate would have meant moving the join under a DEFINER helper anyway, i.e. landing the v2.10 work under fire.
3. **Accept the recursion and route team reads through a different table.** Rejected. The team page legitimately needs to read `profiles.full_name` and `profiles.email` for users on the same shop. No alternative table holds that data.

## Consequences

**Positive:**
- Live authenticated traffic unblocked. `useProfile()` resolves. Dashboard mounts.
- The drop is conservative: the policy disappears, no new surface area appears.

**Negative / accepted:**
- The v2.9.1 team page cannot rely on direct `SELECT FROM profiles` for non-self rows. Workaround: the team page reads via a list RPC that returns team-member profile data with a DEFINER projection. See [[2026-05-13-v291-list-rpcs-vs-rls-loosening]] for the broader pattern and migration 0087's `get_team_member_profiles` for the closed fix.
- v2.8.5 behavior (self-only profile reads) is restored as the interim state for v2.9.0.x.

## Discipline lesson

When restoring "the form that used to work," verify the form's actual behavior matches the mental model. The two-policy form in 2026-05-12-mig-0082 was the right shape to clear the *naming* of the policies but did not address the underlying recursion source. The team-read predicate is the source — not the consolidation. Removing the source closes the loop.

This reinforces the [[feedback-synthetic-tests-real-role]] rule (recorded in `docs/gotchas.md`): synthetic SQL tests with `set_config('request.jwt.claims', ...)` do not exercise the planner's per-policy USING evaluation the way real `authenticated`-role traffic does. The recursion was latent in `v29_profiles_team_read` from migration 0075's installation; it survived QA but failed under live traffic.

## Bookkeeping

- `supabase/migrations/0083_drop_profiles_team_read_pending_helper_fix.sql` — the DDL.
- Predecessor: [[2026-05-12-mig-0082-revert-profiles-policy-recursion]].
- Successor in chain: [[2026-05-12-mig-0084-current-active-shop-id-grouping-fix]].
- Long-term fix delivered: migration 0087's `get_team_member_profiles` DEFINER helper (Phase C v2.9.1).
- Cross-ref: [[2026-05-13-v291-list-rpcs-vs-rls-loosening]] for the "list RPCs instead of RLS-broadening" pattern v2.9.1 adopts more broadly.
