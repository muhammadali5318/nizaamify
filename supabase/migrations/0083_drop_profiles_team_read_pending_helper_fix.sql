
-- 0083_drop_profiles_team_read_pending_helper_fix.sql
--
-- Drops `v29_profiles_team_read` (profiles SELECT policy from 0075)
-- which contains a `JOIN user_shop_access` that triggers infinite
-- recursion via `user_shop_access`'s own self-recursive
-- `usa_self_or_owner_read` policy.
--
-- The recursion fires even on a pure self-read profile query
-- (`WHERE id = auth.uid()`) because Postgres evaluates BOTH
-- permissive policies' USING predicates for any candidate row.
-- Self-read predicate succeeds, but EXISTS-branch keeps walking
-- into user_shop_access → recursion error → useProfile() throws
-- → guards see undefined.onboarding_completed → endless redirect
-- to /onboarding.
--
-- Why this only surfaces now:
--   - 0075 deployed without real authenticated traffic afterward
--   - The synthetic test in 0076b ran inside BEGIN..ROLLBACK with
--     a JWT-claim simulation that didn't reproduce the planner
--     path used by the real client
--   - Pre-wipe, no profile read ever fired with a populated
--     user_shop_access table from an authenticated session
--
-- Owner-team-read is needed for the v2.9.1 team page; we'll add it
-- back as a DEFINER helper (not an inline EXISTS) when the team
-- page ships. For now: profiles SELECT is self-only, which matches
-- v2.8.5 behavior and unblocks the dashboard.

begin;

drop policy if exists v29_profiles_team_read on public.profiles;

commit;
