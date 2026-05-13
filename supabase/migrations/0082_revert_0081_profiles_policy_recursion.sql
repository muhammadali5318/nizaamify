
-- 0082_revert_0081_profiles_policy_recursion.sql
--
-- EMERGENCY REVERT of the profiles half of migration 0081.
--
-- Symptom: 0081's consolidated `profiles_self_or_owner_team_read` policy
-- triggers infinite recursion in `user_shop_access`'s own RLS policy
-- (`usa_self_or_owner_read`, which contains a self-querying EXISTS).
-- Reproduced verbatim under `set role authenticated`:
--
--   ERROR:  42P17: infinite recursion detected in policy
--           for relation "user_shop_access"
--
-- The original two-policy form did not surface this because Postgres
-- evaluates each permissive policy independently — for self-read rows
-- the cheap `profiles_self_read` admits the row before the EXISTS
-- branch in `v29_profiles_team_read` ever fires. A single OR'd policy
-- inlines both branches into one predicate; the planner chose to
-- evaluate the EXISTS for our self-read query, walking into the
-- recursive `user_shop_access` policy.
--
-- This revert restores the two-policy form verbatim from pre-0081
-- pg_policies state. The 5 `multiple_permissive_policies` advisor
-- lints on profiles return; that is the accepted cost.
--
-- The units_of_measure half of 0081 is left intact — it does not
-- query user_shop_access in its predicate and the consolidation is
-- safe.
--
-- Follow-up (NOT in this migration): fix the underlying recursion
-- in `usa_self_or_owner_read` by replacing the inline EXISTS with
-- a SECURITY DEFINER helper. Once that's done, 0081's profiles
-- consolidation can be re-applied safely.

begin;

drop policy if exists profiles_self_or_owner_team_read on public.profiles;

create policy profiles_self_read
  on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy v29_profiles_team_read
  on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.user_shop_access usa_target
      join public.user_shop_access usa_caller
        on usa_caller.shop_id = usa_target.shop_id
      where usa_target.user_id = profiles.id
        and usa_caller.user_id = (select auth.uid())
        and usa_caller.is_owner = true
    )
  );

commit;
