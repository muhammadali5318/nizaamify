
-- 0081_v29_cleanup_permissive_policies.sql
--
-- v2.9 cleanup. Consolidates the two overlapping permissive SELECT
-- policies on `profiles` and splits the legacy FOR ALL policy on
-- `units_of_measure` (which overlapped on SELECT with the members-read
-- policy) into per-verb policies. Eliminates 10 advisor lints of type
-- `multiple_permissive_policies` (5 roles × 2 tables × SELECT action).
--
-- OR'd-predicate identity:
--   Postgres evaluates permissive policies via OR — a row is visible if
--   ANY permissive policy's USING clause returns true. So two policies
--   p1: USING (A) and p2: USING (B) admit the same rows as one policy
--   p: USING (A OR B). No semantic change; the planner evaluates one
--   predicate instead of two.
--
-- Rollback (if needed):
--   drop the consolidated policies and recreate the originals from this
--   file's history (predicates copied verbatim from pg_policies before
--   migration; see the inline comments below).

begin;

-- ─────────────────────────────────────────────────────────────────────
-- profiles: consolidate profiles_self_read + v29_profiles_team_read
--
-- Live predicates copied verbatim from pg_policies pre-migration:
--   profiles_self_read       USING (id = (SELECT auth.uid()))
--   v29_profiles_team_read   USING (EXISTS (SELECT 1
--     FROM user_shop_access usa_target
--     JOIN user_shop_access usa_caller ON usa_caller.shop_id = usa_target.shop_id
--     WHERE usa_target.user_id = profiles.id
--       AND usa_caller.user_id = (SELECT auth.uid())
--       AND usa_caller.is_owner = true))
--
-- The team-read predicate is OWNER-only — managers/salespeople do NOT
-- see team profiles. This is the live behaviour and is preserved in the
-- OR'd predicate.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists profiles_self_read     on public.profiles;
drop policy if exists v29_profiles_team_read on public.profiles;

create policy profiles_self_or_owner_team_read
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.user_shop_access usa_target
      join public.user_shop_access usa_caller
        on usa_caller.shop_id = usa_target.shop_id
      where usa_target.user_id = profiles.id
        and usa_caller.user_id = (select auth.uid())
        and usa_caller.is_owner = true
    )
  );

comment on policy profiles_self_or_owner_team_read on public.profiles is
  'v2.9 cleanup (0081): consolidated profiles_self_read + v29_profiles_team_read. '
  'OR''d-predicate identity: two permissive SELECT policies with USING(A) and USING(B) '
  'admit the same rows as one policy with USING(A OR B). '
  'Self-read = auth.uid()=id. Team-read = caller is OWNER of a shop where target is a member. '
  'Note: only owners see team profiles; non-owner team members still only see their own row. '
  'Rollback: drop this policy and recreate the originals from 0070/0075.';

-- ─────────────────────────────────────────────────────────────────────
-- units_of_measure: split v29_uom_manage_write (FOR ALL) and merge its
-- SELECT branch with v29_uom_members_read into a single SELECT policy.
--
-- Live predicates copied verbatim from pg_policies pre-migration:
--   v29_uom_manage_write (ALL)   USING/WITH CHECK (shop_id = current_active_shop_id()
--                                AND user_has_permission(shop_id, 'manage_units_of_measure'))
--   v29_uom_members_read (SELECT) USING (shop_id = current_active_shop_id()
--                                AND user_has_shop_access(shop_id))
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists v29_uom_manage_write on public.units_of_measure;
drop policy if exists v29_uom_members_read on public.units_of_measure;

create policy v29_uom_members_or_managers_select
  on public.units_of_measure
  for select
  to authenticated
  using (
    shop_id = (select public.current_active_shop_id())
    and (
      (select public.user_has_shop_access(shop_id))
      or (select public.user_has_permission(shop_id, 'manage_units_of_measure'))
    )
  );

comment on policy v29_uom_members_or_managers_select on public.units_of_measure is
  'v2.9 cleanup (0081): consolidated v29_uom_members_read with the SELECT branch of '
  'v29_uom_manage_write. OR''d-predicate identity preserved. Shop-membership grants SELECT; '
  'manage permission also grants SELECT (redundant but cheap). Writes are gated by the '
  'per-verb manage policies below. Rollback: drop and recreate originals from 0075.';

create policy v29_uom_manage_insert
  on public.units_of_measure
  for insert
  to authenticated
  with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_units_of_measure'))
  );

create policy v29_uom_manage_update
  on public.units_of_measure
  for update
  to authenticated
  using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_units_of_measure'))
  )
  with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_units_of_measure'))
  );

create policy v29_uom_manage_delete
  on public.units_of_measure
  for delete
  to authenticated
  using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_units_of_measure'))
  );

comment on policy v29_uom_manage_insert on public.units_of_measure is
  'v2.9 cleanup (0081): split from v29_uom_manage_write (FOR ALL) into per-verb. '
  'Eliminates SELECT-branch overlap with v29_uom_members_or_managers_select.';

commit;
