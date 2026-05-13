# 2026-05-13 v2.9 cleanup — consolidate permissive policies (ADR #23)

## Context

The Supabase performance advisor emitted 10
`multiple_permissive_policies` lints after the v2.9 RBAC migrations
(0068–0080) landed:

- **`profiles` (5 lints, one per role):** two permissive SELECT
  policies coexisted — `profiles_self_read` (pre-v2.9: `id =
  auth.uid()`) and `v29_profiles_team_read` (introduced in
  migration 0075: owner of a shop can read profiles of users who
  share that shop). Postgres evaluates permissive policies via OR,
  so both predicates were evaluated on every `profiles` SELECT;
  the advisor flags this as a planner-cost regression.
- **`units_of_measure` (5 lints, one per role):** the legacy
  `v29_uom_manage_write` policy was declared `FOR ALL`
  (SELECT+INSERT+UPDATE+DELETE), and a separate `v29_uom_members_read`
  policy provided SELECT to all shop members. The two policies
  overlapped on SELECT.

Both tables are on the **v2.9.1 frontend hot path** —
`profiles` is read by the TopBar shop switcher and `/settings/team`;
`units_of_measure` is read by the POS UoM dropdown. The
`audit/2026-05-13-pre-frontend-advisor-review.md` Rev 2 classified
these 10 lints as `FIX_AT_START_OF_V291` — to land as the first
migration of v2.9.1 before any TypeScript shipped.

The user (2026-05-13, this session) reclassified the work to
**v2.9 cleanup**: land the migration immediately while the backend
is in a known-good state (22 AQs green + 16/65 spot-check clean)
rather than carrying it into v2.9.1 where it would compete for
attention with frontend regressions. This keeps the v2.9.1 spec
focused on `customFetch`, shop switcher, `usePermission`, team
page, and invitation acceptance — pure frontend work.

## Decision

**Land `0081_v29_cleanup_permissive_policies.sql` in the v2.9
backend.** Migration consolidates:

1. `profiles_self_read` + `v29_profiles_team_read` → one SELECT
   policy `profiles_self_or_owner_team_read` with OR'd USING
   predicates. The owner-only team-read branch (`usa_caller.is_owner =
   true`) is preserved verbatim — managers and salespeople still
   only see their own profile row. (The live policy was tighter
   than my reconstruction-from-memory; verbatim copy from
   `pg_policies` was used.)
2. `v29_uom_members_read` + the SELECT branch of
   `v29_uom_manage_write` → one SELECT policy
   `v29_uom_members_or_managers_select`. The legacy `FOR ALL` policy
   is split into per-verb policies (`v29_uom_manage_insert`,
   `v29_uom_manage_update`, `v29_uom_manage_delete`) so writes stay
   gated by the manage permission, but the SELECT-branch overlap is
   eliminated.

Each consolidated policy carries a `COMMENT ON POLICY ... IS '...'`
spelling out the OR'd-predicate identity and the rollback path.

### OR'd-predicate identity proof

Postgres docs (CREATE POLICY § "permissive policies"):

> When multiple permissive policies apply to a query, they are
> combined using `OR`. A row is visible if at least one applicable
> permissive policy's `USING` clause returns true.

Equivalent algebra: given two permissive SELECT policies p1 with
`USING (A)` and p2 with `USING (B)`, the set of rows visible is
`{r : A(r)} ∪ {r : B(r)}`. A single permissive policy p with
`USING (A OR B)` admits exactly the rows `{r : A(r) OR B(r)} = {r :
A(r)} ∪ {r : B(r)}`. The two formulations are extensionally
identical; only the planner cost changes (one predicate
evaluation per row instead of two).

This identity holds regardless of `A` and `B` because permissive
policies do not "see" each other's predicates at evaluation time —
they're independently evaluated and OR'd. Restrictive policies
would change the calculus, but no restrictive policies are
involved here.

## Alternatives considered

1. **Leave it for v2.9.1 (original plan).** Rejected: would pile
   policy debugging into the same window as new frontend code; the
   backend is currently in known-good state and the cleanup is
   trivially scoped.
2. **Fold into per-feature PRs (one row per consuming page).**
   Rejected: the consolidation is mechanical and tablewide; piecing
   it across feature PRs spreads risk for no gain.
3. **Use restrictive policies instead of permissive.** Rejected:
   restrictive policies AND with permissive — they'd narrow the
   row set rather than widen it, changing semantics. We need
   union-of-conditions, not intersection.
4. **Drop one of the overlapping policies entirely.** Rejected for
   `profiles`: both `self` and `owner-team-read` cases are needed
   (a non-owner user needs `self`, an owner needs `team-read`).
   Rejected for `units_of_measure`: the legacy `FOR ALL` policy
   could in principle be dropped (managers also have membership,
   so they'd get SELECT via `v29_uom_members_read`), but its WRITE
   branch is needed and disambiguating into per-verb policies is
   cleaner.

## Consequences

**Lint deltas (verified post-migration via `get_advisors`):**

- 10 `multiple_permissive_policies` lints → 0
- Total performance advisor surface: 63 → 53 (5 perf lints
  vanish per table × 2 tables)
- Security advisor unchanged (still 14 ERROR + 65 WARN DEFINER +
  1 WARN HIBP)

**Audit suite verification (post-migration):**

All 23 audit queries (AQ-01..22 with AQ-14a/14b split + AQ-23
proposed in this session) return 0 rows. No drift.

**AQ-23 baseline (full 65-wrapper scan, not just sample):**

- Total functions in scope: 65 (matches advisor lint count
  exactly: DEFINER + granted to `authenticated` + non-trigger +
  non-`_v28`)
- Exempt: 11 (`accept_invitation`, `cancel_invitation`,
  `complete_onboarding`, `current_active_shop_id`, `current_shop_id`,
  `get_user_permissions`, `get_user_shop_list`, `set_active_shop`,
  `user_has_permission`, `user_has_shop_access`,
  `user_permissions_in_shop`)
- Conforming: 54 (all four standard properties present —
  `not_authenticated` precondition, `no_shop_for_user` precondition,
  `user_has_permission(...)` gate, `<name>_v28` delegation or
  net-new v2.9 body)
- Deviations: **0**

The original "53 deviations" reported by the first AQ-23 dry-run was
a query-scope bug: the scan swept in 41 `_v28` inner bodies (which
are correctly DEFINER but NOT granted to `authenticated` — they are
reachable only via their wrapper) and 9 trigger functions (which
don't receive caller authentication). The corrected AQ-23 scope
filters on `has_function_privilege('authenticated', oid, 'execute')`
+ `pg_get_function_result(oid) <> 'trigger'` + `proname not like
'%\_v28' escape '\'` — yielding exactly the 65 functions flagged by
`authenticated_security_definer_function_executable`.

**`complete_onboarding` added to the exempt list.** It is granted to
`authenticated` but legitimately has no `no_shop_for_user` precondition
because **it creates the first shop** — no shop_id exists pre-call.
This was missed in the original Phase D enumeration; surfacing here
and documenting as part of AQ-23's exempt set.

**No wrapper deviations to fix.** Halt criterion not triggered.

## Rollback

If 0081 needs to be reverted:

```sql
begin;

-- profiles: split back into self + owner-team-read
drop policy if exists profiles_self_or_owner_team_read on public.profiles;

create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy v29_profiles_team_read on public.profiles
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

-- units_of_measure: rebuild the FOR ALL + members-read pair
drop policy if exists v29_uom_members_or_managers_select on public.units_of_measure;
drop policy if exists v29_uom_manage_insert on public.units_of_measure;
drop policy if exists v29_uom_manage_update on public.units_of_measure;
drop policy if exists v29_uom_manage_delete on public.units_of_measure;

create policy v29_uom_manage_write on public.units_of_measure
  for all to authenticated
  using       (shop_id = (select public.current_active_shop_id())
               and (select public.user_has_permission(shop_id, 'manage_units_of_measure')))
  with check  (shop_id = (select public.current_active_shop_id())
               and (select public.user_has_permission(shop_id, 'manage_units_of_measure')));

create policy v29_uom_members_read on public.units_of_measure
  for select to authenticated
  using (shop_id = (select public.current_active_shop_id())
         and (select public.user_has_shop_access(shop_id)));

commit;
```

Rollback is non-destructive — no data is touched, only policy
definitions are swapped.

## Bookkeeping

- Migration: `0081_v29_cleanup_permissive_policies` (applied
  2026-05-13).
- Logged in: `tasks.md`, `docs/todos.md`, `CLAUDE.md` v2.9
  build-trail entry, `audit/2026-05-13-pre-frontend-advisor-review.md`
  Rev 3.
- AQ-23 appended to `design/2026-05-13-rbac-attack-surface.md` §C.3
  alongside AQ-01..22; the audit suite is now 23 queries.
- Index updated: `decisions/v29-rbac-INDEX.md` adds ADR #23 to the
  "bonus" set (third bonus ADR alongside `audit-query-refinements`
  and `record-sale-permission-enhancements`).
