# RBAC Implementation Plan — 2026-05-13 (Phase D)

**Status:** locked. Derived mechanically from Phase B Rev 2 (`design/
2026-05-13-rbac-model-design.md`) and Phase C Rev 2 (`design/
2026-05-13-rbac-attack-surface.md`).

**Audience:** the engineer implementing v2.9 (which may be future-
Claude). Read this document end-to-end before writing the first
migration.

**Discipline:** zero data loss during migration. Every irreversible
schema change has a rollback path documented. Every column drop is
deferred (deprecate-without-drop, ADR-0024 style).

---

## D.0 Scope and status

This document specifies **HOW** the locked design is deployed, not
what the design is. The design is locked elsewhere:

- §B (model design) — `design/2026-05-13-rbac-model-design.md` Rev 2
- §C (attack surface + test matrix) — `design/2026-05-13-rbac-attack-surface.md` Rev 2
- §A (audit baseline) — `audit/2026-05-13-rbac-pre-design-audit.md`

Phase D produces:
- §D.1 — Migration ordering (12 migrations: 0068 → 0079)
- §D.2 — Risk inventory + rollback strategy per migration
- §D.3 — Phasing decisions (incremental ship or big-bang)
- §D.4 — `tasks.md` additions (verbatim block)
- §D.5 — `decisions/` scaffolding (20 ADRs to file)
- §D.6 — The three pre-Phase-D resolutions (F-PD-04, F-PD-08, F-PD-09)
- §D.7 — Summary handoff to implementation

This is the last design document before code. No further locked-design
revisions; if a defect surfaces during implementation, it's a Phase D'
(prime) amendment to this document.

---

## D.1 Migration ordering

### D.1.1 The 12-migration sequence

Numbered 0068 through 0079, continuing from the v2.8.5 endpoint (0067).
Each migration is one `.sql` file applied atomically via
`mcp__supabase__apply_migration`. Dependencies between migrations are
strict — DDL in 00NN cannot reference objects created in 00NN+1.

| # | Filename (proposed) | What it does | Reversible? |
|---|---|---|---|
| 0068 | `0068_v29_foundation_enum_catalog.sql` | Create `invitation_status` enum + `permissions_catalog` table + seed 50 rows | Yes (drop) |
| 0069 | `0069_v29_identity_tables.sql` | Create `user_shop_access`, `user_shop_permissions`, `user_shop_permission_audit`, `pending_invitations` tables + RLS placeholders | Yes (drop) |
| 0070 | `0070_v29_helper_functions.sql` | `user_has_shop_access`, `current_active_shop_id`, `set_active_shop`, `user_has_permission`, `user_permissions_in_shop`, `validate_permission_grant`, `validate_permission_revoke`, `pre_request_set_active_shop`. **Does NOT modify `current_shop_id()` body** — preserved for old-policy "deny wins" safety during stabilization (see §D.2.5 below). | Yes (drop function) |
| 0071 | `0071_v29_backfill_owner_access.sql` | For every existing `shops` row, insert `user_shop_access (user_id=owner_user_id, shop_id, is_owner=true)`. Idempotent (`on conflict do nothing`). | Yes (delete the backfilled rows) |
| 0072 | `0072_v29_existing_table_columns.sql` | Add `_by_user_id` columns + `is_active` (customers) + `salesperson_payment_cap_pkr` (shops) + FK change `shops.owner_user_id` → ON DELETE RESTRICT | Mostly yes; columns droppable, FK rebuildable |
| 0073 | `0073_v29_new_rls_policies.sql` | Add new permission-based RLS policies **alongside** the existing shop-scope-only policies. Both sets coexist; RLS combines via OR. | Yes (drop new policies) |
| 0074 | `0074_v29_new_views.sql` | Create 11 `_view` views (`security_invoker = false`) per §B.3.5 + revised `customer_outstanding` body + `shop_effective_subscription` view | Yes (drop view) |
| 0075 | `0075_v29_new_rpcs.sql` | 24 new DEFINER RPCs per §B.5.4 | Yes (drop function) |
| 0076 | `0076_v29_modify_existing_rpcs.sql` | Rewrite each of the 45 existing RPCs to add permission checks + audit `_by_user_id` writes per §B.5.1 | Reversible by re-applying the v2.8.5 RPC bodies from git |
| 0077 | `0077_v29_drop_legacy_policies.sql` | (Run **after stabilization week** per §D.3.4.) Drop old shop-scope-only policies; drop `shops_owner_update` policy; `revoke update (owner_user_id) on shops from authenticated`; `revoke update (is_owner) on user_shop_access from authenticated` | Yes (re-create from prior migration source — but data is intact, only the gate widens if rolled back) |
| 0078 | `0078_v29_cron_jobs.sql` | `cleanup_invitations` cron at 00:30 UTC daily; new audit-suite cron at 04:00 UTC weekly (optional) | Yes (`cron.unschedule`) |
| 0079 | `0079_v29_hardening.sql` | F-M-25 tightening: `revoke execute on function batch_immutable_fields() / batch_auto_deactivate_when_empty() from authenticated`. Defensive hygiene. | Yes (re-grant) |

**Migration policy:** no `DROP COLUMN`, no `DROP TABLE`, no irreversible
ALTER. Deprecate-without-drop per ADR-0024 throughout. The only DROPs
are POLICY and FUNCTION drops, both of which restore from migration
source.

### D.1.2 Inter-migration dependency graph

```
0068 (enum + catalog)
 │
 ├──▶ 0069 (identity tables; FK to permissions_catalog)
 │     │
 │     ├──▶ 0070 (helpers reference user_shop_access)
 │     │     │
 │     │     ├──▶ 0071 (backfill; inserts into user_shop_access)
 │     │     │
 │     │     ├──▶ 0073 (new RLS; uses user_has_permission helper)
 │     │     │     │
 │     │     │     └──▶ 0074 (new views; use user_has_permission)
 │     │     │
 │     │     └──▶ 0075 (new RPCs; use helpers)
 │     │            │
 │     │            └──▶ 0076 (modified RPCs; use helpers)
 │     │                   │
 │     │                   └──▶ 0077 (drop legacy; requires 0073-0076 stable)
 │     │
 │     └──▶ 0072 (column additions; no helper dep)
 │
 └──▶ 0078 (cron jobs; independent of helpers)
 0079 (hardening; independent)
```

Critical-path order: 0068 → 0069 → 0070 → 0071 → 0072 → 0073 → 0074 →
0075 → 0076 → [stabilization week] → 0077 → 0078 → 0079.

Migrations 0072 and 0078 / 0079 can run in parallel with the critical
path (no cross-dependency). For simplicity, deploy sequentially.

### D.1.3 Backfill semantics (0071)

Existing production state (per audit §A.2.1):
- 2 shops
- 2 profiles (one per shop, each is the founding owner)
- 0 `user_shop_access` rows (table doesn't exist yet)

Backfill operation:
```sql
insert into public.user_shop_access (user_id, shop_id, is_owner)
select owner_user_id, id, true
  from public.shops
 on conflict (user_id, shop_id) do nothing;
```

Result: 2 user_shop_access rows. The partial unique index
`uq_user_shop_access_one_owner_per_shop` is satisfied (one owner per
shop).

No `user_shop_permissions` rows are inserted for owners — the implicit
shortcut handles them. Audit query AQ-19 verifies this invariant
(owners never have permission rows).

For sale_items / purchase_items audit columns: NULL post-backfill.
The UI displays "Recorded before audit-trail launch" for these rows
per Phase B §B.2.5.

**Pre-flight check before 0071:**
- Verify every shop has exactly one `owner_user_id` (audit AQ-07 from
  Phase C should already pass; if not, fix before 0071).
- Verify every `shops.owner_user_id` references an extant profile
  (FK guarantees this; check that no profile has been deleted with
  cascading shop removal).

**Post-flight check after 0071:**
- Verify `count(*)` of `user_shop_access` rows equals `count(*)` of
  `shops` rows.
- Verify `count(*) filter (where is_owner = true)` equals
  `count(*)` of shops.

---

## D.2 Risk inventory

### D.2.1 Pre-deployment risks

**R-PD-01 — `user_shop_access` backfill misses a shop with
mis-pointed `owner_user_id`.**
- Impact: a real shop ends up without an owner row in user_shop_access;
  the founder loses access on next sign-in (the implicit shortcut
  requires `is_owner = true`).
- Probability: low (audit AQ-07 verifies the invariant pre-deploy;
  current production has 2 shops, both clean).
- Mitigation: run AQ-07 before deploying 0071. Block deploy if any
  rows return.
- Severity: HIGH if it happens (locks out an owner).

**R-PD-02 — A pending invitation's email matches a registered user
with profile.email differing in case/whitespace from the invitation's
normalized form.**
- Impact: `accept_invitation` raises `invitation_email_mismatch` when
  the invitee tries to accept.
- Probability: low (profiles.email comes from Supabase auth.users,
  which Supabase normalizes; the invitation row stores `lower(trim(...))`
  per §B.3.1).
- Mitigation: in `accept_invitation`, compare `lower(trim(...))` on
  both sides.
- Severity: MEDIUM (invitee gets an error; owner re-sends).

**R-PD-03 — A migration script has a typo that the SQL editor accepts
but Supabase rejects.**
- Mitigation: every migration tested against the staging project first.
  Use `mcp__supabase__apply_migration` against a staging branch via
  `mcp__supabase__create_branch` → test → merge.
- Severity: LOW (caught in staging).

### D.2.2 In-flight risks (during multi-migration deploy)

**R-IF-01 — Mid-deploy: migration 0073 (new RLS) succeeds but 0076
(modified RPCs) fails. State: new RLS in place, but RPCs still use
the old helpers (`current_shop_id` without permission checks).**
- Impact: RPCs continue to work for the founding owner (implicit
  shortcut). Non-owners don't exist yet in production (no
  user_shop_access rows for them until invitations are sent). Net
  effect: no user-visible breakage.
- Mitigation: deploy 0076 immediately after 0073 (within the same
  hour). If 0076 fails, the RPCs still operate correctly for owners.
- Severity: LOW.

**R-IF-02 — Mid-deploy: 0074 (new views) succeeds but the client
hasn't been updated to query `_view` instead of raw tables.**
- Impact: old client code reading raw tables (`from('sale_items')`)
  is gated by new RLS in 0073. Owner passes via implicit shortcut.
  Non-owners (yet to be invited) would be denied. No user-visible
  breakage.
- Severity: LOW.

**R-IF-03 — Mid-deploy: 0076 modifies a critical RPC body, but a
parameter type or return type changes subtly, breaking the client.**
- Impact: existing client code calling the RPC sees a malformed
  response or an unrecognized error.
- Mitigation: every RPC body change preserves signature and return
  shape; new parameters are added with DEFAULTs (e.g., new
  `p_confirm_expired_sale_at_pos` not added — that's covered by
  existing permission flow). The 45 modifications are guard-add-only,
  not signature-changing.
- Verify: TypeScript regeneration (`mcp__supabase__generate_typescript_types`)
  shows no breaking type changes after 0076.
- Severity: MEDIUM (caught by type-check in CI).

**R-IF-04 — `pre_request_set_active_shop` configuration miss: the
function exists in 0070, but the Supabase project's pre-request hook
setting is not configured.**
- Impact: the header `app-shop-id` is ignored; multi-shop users fall
  back to single-shop or NULL → `no_shop_for_user`. Single-shop users
  (the production state today) are unaffected.
- Mitigation: Phase D operator manually configures the pre-request
  setting via the Supabase project dashboard after 0070 applies. This
  is the only out-of-migration step.
- Severity: HIGH for multi-shop users; LOW for current production
  (single-shop).
- **Action item:** the deploy checklist (§D.3.2) includes this step.

### D.2.3 Post-deployment risks

**R-PD-04 — Owner accidentally revokes their own access via
`revoke_user_access(self)`.**
- Mitigation: RPC body raises `cannot_revoke_own_access` (§B.3.4).
- Severity: closed by design.

**R-PD-05 — Owner grants a permission with a missing dependency,
leaving the target user in an inconsistent state.**
- Mitigation: `validate_permission_grant` (§B.3.3 helper 7) raises
  `permission_dependency_missing`.
- Severity: closed by design.

**R-PD-06 — An owner's profile is deleted while they still own a
shop.**
- Mitigation: `shops.owner_user_id` FK changed to `ON DELETE RESTRICT`
  in 0072. Profile deletion fails until ownership is transferred (a
  v2.10+ workflow).
- Severity: closed.

**R-PD-07 — A salesperson's JWT remains valid for up to 1h after
their access is revoked.**
- Impact: revoked salesperson retains shop access for the JWT TTL.
- Mitigation: documented limitation. Supabase Auth doesn't support
  remote session invalidation in v2.9. Phase E (post-v2.9) could
  add JWT shortening or a custom session-invalidation flow.
- Severity: ACCEPTED limitation per audit §C.1.4 XA-05.

**R-PD-08 — Pre-request function `pre_request_set_active_shop` raises
on every request because the header validation has a bug.**
- Impact: every PostgREST request returns the raise error. App is
  unreachable for non-anonymous users.
- Mitigation: pre-request function is dead simple (read header,
  validate, set config). Unit-test against staging branch before
  production deploy. If broken in production, hotfix migration:
  ```sql
  create or replace function public.pre_request_set_active_shop()
  returns void language sql as $$ select null::void $$;
  ```
  (no-op fallback to restore service while the bug is investigated).
- Severity: HIGH if it occurs; LOW probability.

**R-PD-09 — `view_purchases` permission preset default for manager is
`✓`, but cost-visibility leak via manager seeing purchases history.**
- Per Phase B §B.2.2 leaky-abstraction acknowledgment: a manager can
  read historical purchase costs (operational requirement for stock-
  in). Mitigation is documented limitation, not closed.
- Severity: ACCEPTED limitation (out of scope for v2.9).

### D.2.5 Dual-policy "deny wins" enforcement

PostgreSQL combines PERMISSIVE RLS policies via OR (allow wins by
default). During the 7-day stabilization week, both old policies (from
v2.8.5) and new policies (from 0073) coexist. **Without explicit care,
allow-wins could open a security gap** where an invited employee
benefits from the old policy's broad shop-scope.

**Enforcement mechanism:** the old policies reference
`current_shop_id()` whose v2.8.5 body is
`select id from public.shops where owner_user_id = auth.uid() limit 1`.
For invited employees, this returns NULL → the old policies evaluate
their USING clause to NULL → effectively FALSE → the policies are a
no-op for non-owner users.

**The new policies use `current_active_shop_id()` (different helper),
which returns the active shop via header / session variable / single-
shop fallback.** New policies fire for invited employees and gate
them per their permission rows.

**OR-combination during stabilization:**
- Owner: old permits (their shop) ∪ new permits (implicit shortcut) = permits. ✓
- Invited employee: old returns FALSE (current_shop_id NULL) ∪ new returns per-permission = whatever new says. ✓ No widening.

**Critical invariant: migration 0070 MUST NOT replace `current_shop_id()`
body with an alias to `current_active_shop_id()`.** Doing so would
make the old body resolve via the new helper (with header / fallback),
causing the old policies to permit invited employees → allow-wins gap.
Phase B §B.2.0a helper (4) amended 2026-05-13 to lock this rule.

**Two-layer defense:**
- **Technical:** the old policies are NULL-no-op for non-owners during
  stabilization (above).
- **Procedural:** `RBAC_TEAM_UI_ENABLED` feature flag remains OFF in
  production during stabilization, so no invitations can be issued.
  Non-owner testing happens only in staging.

After migration 0077 drops the old policies (Day 7), the OR-combine
question is moot — only new policies remain. `current_shop_id()` then
has zero callers and can be aliased or dropped in v2.10+.

**Verification during stabilization:** Phase C §C.3 audit query AQ-15
runs daily; it lists DEFINER functions callable by `authenticated`
whose bodies lack `auth.uid()` / `current_active_shop_id` /
`user_has_permission` / `user_has_shop_access`. Should return zero.

### D.2.4 Rollback strategy per migration

PostgreSQL DDL is transactional within a single migration file. If a
migration fails mid-execution, the entire transaction rolls back.
Cross-migration rollbacks require explicit "down" migrations.

**For each migration, the rollback approach:**

| Migration | Rollback | Notes |
|---|---|---|
| 0068 | `drop type invitation_status cascade; drop table permissions_catalog cascade;` | Cascades to user_shop_permissions if 0069 ran. |
| 0069 | `drop table pending_invitations, user_shop_permission_audit, user_shop_permissions, user_shop_access cascade;` | Order matters (FKs); cascade handles. |
| 0070 | `drop function pre_request_set_active_shop, validate_permission_revoke, ..., user_has_shop_access;` | All helpers droppable individually. |
| 0071 | `delete from user_shop_access where created_at > '<deploy timestamp>';` OR truncate if 0069 was rolled back. | Data-only; no schema. |
| 0072 | `alter table shops drop column salesperson_payment_cap_pkr; alter table customers drop column is_active, drop column created_by_user_id; ...` | All columns droppable; data loss in the `_by_user_id` columns is acceptable (no historical writes yet). |
| 0073 | `drop policy <new_policy_name> on <table>;` for every new policy. | Old policies still exist (0077 hasn't run yet). System reverts to pre-0073 RLS behavior. |
| 0074 | `drop view <name> cascade;` for each `_view`. | Client code reading from `_view` will break — but client code update is in Phase D′. |
| 0075 | `drop function <name>;` for each new RPC. | Client code calling these will break (only owner UI uses them; revert client too). |
| 0076 | `create or replace function <name>` with the v2.8.5 body, from git. | The 45 RPC bodies are in git history at commit `de6b6a8` (MVP 2.8.4) or `0067_v285_search_products_batch_fields.sql`. |
| 0077 | Re-create the old policies from migration source (the prior migration files in git). | The old policies remained in 0073 as a coexisting set; if 0077 has rolled back, both old and new exist. To "fully revert": drop the new policies (0073 rollback) + re-create old. |
| 0078 | `select cron.unschedule('cleanup_invitations');` | Trivial. |
| 0079 | `grant execute on function batch_immutable_fields() to authenticated; grant execute on function batch_auto_deactivate_when_empty() to authenticated;` | Returns to pre-0079 grant state. |

**Full-rollback scenario (catastrophic):** if every migration must
revert, the order is reverse-deploy: 0079 → 0078 → 0077 → 0076 →
0075 → 0074 → 0073 → 0072 → 0071 → 0070 → 0069 → 0068. Each step's
rollback is per the table above.

**Acceptable data loss in rollback:**
- `user_shop_permission_audit` rows are lost (audit history; if
  v2.9 rolled back, the audit history wasn't useful anyway).
- `pending_invitations` rows are lost (any pending invitations
  invalidate; owner re-creates).
- `user_shop_permissions` rows are lost (any non-owner access is
  revoked; only owner access via shops.owner_user_id remains).
- `user_shop_access` rows are lost (same).
- `_by_user_id` columns lose any data written between 0072 and
  rollback (cosmetic; the UI's "Recorded before audit-trail launch"
  fallback covers).

**Unacceptable data loss:** none. Every existing v2.8.5 row in
`shops`, `profiles`, `subscriptions`, `products`, `product_variants`,
`sale_items`, `invoices`, `purchases`, `purchase_items`, `customers`,
`ledger_entries`, `expenses`, `monthly_targets`, `inventory_batches`,
`suppliers`, `customer_tiers`, `variant_attributes`, etc. is intact
under rollback. v2.9 does not touch existing rows except to add new
NULL-able columns.

---

## D.3 Phasing

### D.3.1 Can v2.9 ship incrementally?

**No.** The dependencies are tight:
- The invitation flow requires `user_shop_access` + `user_shop_permissions`
  + `pending_invitations` tables AND the permission helpers AND the
  permission-gated RPCs to enforce.
- Shipping the invitation flow without the enforcement creates pending
  seats with no permission-gating — the invitee would land on the
  shop with shop-scoped RLS only (matching the owner's permissions),
  which is the worst possible state (every employee gets owner-grade
  access).
- Conversely, shipping the enforcement without the invitation flow
  leaves owners with no path to onboard staff (the only test is the
  owner themselves, which trivially passes via implicit shortcut).

**However, the deploy can be staged:**
- Migrations 0068–0076 deploy together on Deploy Day (Day 0).
- A "stabilization week" (Day 1–7) runs the system under dual-policy
  regime: new RLS policies coexist with old shop-scope-only policies.
  Both pass for the founding owner (implicit shortcut). Non-owner
  testing happens in staging during this week.
- Migration 0077 (drop legacy policies) deploys on Day 7 after AQ-01
  through AQ-22 all return clean.
- Migrations 0078, 0079 deploy alongside or after 0077.

### D.3.2 Pre-deployment checklist

Before applying 0068:

- [ ] Phase A, B, C documents reviewed and acknowledged by the owner.
- [ ] Staging Supabase branch created via `mcp__supabase__create_branch`.
- [ ] All 12 migrations dry-applied to the staging branch.
- [ ] All 322 Phase C tests executed against the staging branch with
  test users created per §C.2.0.
- [ ] All §C.3 audit queries (AQ-01 through AQ-22) run clean against
  staging.
- [ ] Pre-request function setting (the Supabase project's
  "Pre-request function" config) prepared with the value
  `pre_request_set_active_shop`. This setting cannot be migrated — it
  must be configured manually via the Supabase project dashboard
  after 0070 applies.
- [ ] **Tier verification:** confirm the Supabase project's plan
  supports the pre-request hook. PostgREST's `db-pre-request` setting
  is supported on all tiers including Free, but the dashboard UI
  affordance may be Pro-only. If UI is inaccessible, configure via
  the Supabase Management API or CLI. **If the capability is somehow
  unavailable**, fall back to the in-helper header-read pattern
  documented in F-PD-01 fallback / §D.2.5 — see "Pre-request hook
  fallback" below.

### D.3.2.1 Pre-request hook fallback (if unavailable on current tier)

If the Supabase project cannot configure a pre-request function (UI
absent + Management API rejection + CLI rejection — unlikely on any
tier), the locked design has a documented fallback that preserves all
locked semantics:

- **Drop the `pre_request_set_active_shop` configuration step** from
  migration 0070 (the function definition remains; just not wired
  as a hook).
- **Modify `current_active_shop_id()` body** to read the header
  per-call:

```sql
create or replace function public.current_active_shop_id()
returns uuid
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare
  v_shop_id_str text := current_setting('request.headers', true)::jsonb ->> 'app-shop-id';
  v_shop_id uuid;
begin
  if v_shop_id_str is not null and v_shop_id_str <> '' then
    begin
      v_shop_id := v_shop_id_str::uuid;
    exception when others then
      raise exception 'invalid_app_shop_id_header' using errcode = 'P0001';
    end;
    if not public.user_has_shop_access(v_shop_id) then
      raise exception 'no_access_to_shop' using errcode = 'P0001';
    end if;
    return v_shop_id;
  end if;
  -- Fallback: single-shop user
  return (select shop_id from public.user_shop_access
           where user_id = auth.uid()
           group by user_id having count(*) = 1
           limit 1);
end;
$$;
```

- **Trade-off:** ~1ms additional per call (JSONB parse + membership
  check). Postgres caches the JSONB parse within a query plan via the
  `STABLE` attribute, so the cost is amortized.
- **All other locked semantics preserved:** header injection
  client-side, validation server-side, failure modes identical.

The fallback is equivalent in security properties. Implementation is
~10 lines of SQL different from the hook-based version.
- [ ] Production audit query AQ-07 (current state, pre-0071) returns
  zero rows.
- [ ] Production audit query for `count(shops) = count(distinct
  owner_user_id) = 2` (sanity check).
- [ ] Production backup snapshot taken via Supabase point-in-time
  recovery (or `mcp__supabase__pause_project` → `restore_project`
  if a hard rollback is anticipated).
- [ ] CLAUDE.md updated with v2.9 build-trail entry.
- [ ] Client-side feature flag `RBAC_TEAM_UI_ENABLED` defaulted to
  `false` for production users (the team UI rolls out behind this
  flag).
- [ ] Owner-facing announcement: "v2.9 is rolling out today; existing
  access unchanged; new team management features available shortly."

### D.3.3 Deployment day timeline (Day 0)

| Time (UTC) | Action | Verification |
|---|---|---|
| 00:00 | `mcp__supabase__apply_migration(name="0068_v29_foundation_enum_catalog")` | Catalog has 50 rows. |
| 00:05 | `mcp__supabase__apply_migration(name="0069_v29_identity_tables")` | 4 new tables exist; RLS placeholders in place. |
| 00:10 | `mcp__supabase__apply_migration(name="0070_v29_helper_functions")` | All 8 helpers callable; advisor lint shows no new findings beyond ADR-0011 list. |
| 00:15 | **Manual:** configure Supabase project's pre-request setting to `pre_request_set_active_shop`. | Test with a sample request; verify `app.shop_id` is set when header present. |
| 00:20 | `mcp__supabase__apply_migration(name="0071_v29_backfill_owner_access")` | AQ-01 returns 0; AQ-07 returns 0; `user_shop_access` row count equals `shops` row count. |
| 00:25 | `mcp__supabase__apply_migration(name="0072_v29_existing_table_columns")` | All new columns present; FK changes confirmed via `pg_constraint`. |
| 00:30 | `mcp__supabase__apply_migration(name="0073_v29_new_rls_policies")` | New policies visible in `pg_policies`; both old and new sets exist. |
| 00:35 | `mcp__supabase__apply_migration(name="0074_v29_new_views")` | All 11 `_view`s exist; advisor lint shows expected `security_definer_view` warnings per ADR-2026-05-14-rbac-definer-safe-views (filed below). |
| 00:45 | `mcp__supabase__apply_migration(name="0075_v29_new_rpcs")` | All 24 new RPCs callable; their EXECUTE grants match the pattern `revoke from public, anon; grant to authenticated`. |
| 01:00 | `mcp__supabase__apply_migration(name="0076_v29_modify_existing_rpcs")` | All 45 modified RPCs preserve their signature; type-regen passes. |
| 01:15 | `mcp__supabase__generate_typescript_types` → write to `src/types/database.ts`. | TypeScript compilation passes. |
| 01:20 | Run smoke matrix from Phase C §C.2 against production with the founding owner's credentials. | All owner-tier tests pass. |
| 01:30 | **Stabilization week begins.** Production runs under dual-policy regime. Non-owner testing continues in staging. |  |

Migrations 0077, 0078, 0079 are NOT applied on Day 0. They wait for
the stabilization week.

### D.3.4 Stabilization week (Day 1–7)

**Activities during stabilization:**
- Daily run of Phase C §C.3 audit query suite (AQ-01 through AQ-22).
  Any non-zero result triggers investigation before proceeding to
  Day 7.
- Owner-tier smoke tests on production (positive controls).
- Non-owner testing in staging: create test invitations, accept, run
  every preset's smoke matrix, verify dependency-rule enforcement.
- Monitor PostgREST logs for unexpected `insufficient_permissions` or
  `no_shop_for_user` errors. These indicate either (a) client-side
  bug, (b) production owner accidentally triggering a non-owner path.
- The `RBAC_TEAM_UI_ENABLED` feature flag remains `false` for
  production owners; their UI is unchanged. The team-management UI
  is tested in staging.
- TanStack Query `staleTime: 60_000` for `['permissions', ...]` is
  active in client code (F-PD-08 resolution).

**Day 7 readiness gate:**
- AQ-01 through AQ-22 all return zero rows for 7 consecutive days.
- Staging non-owner tests pass at 100%.
- No production errors traceable to the v2.9 migration set.
- Owner approves the cutover.

### D.3.5 Post-stabilization cutover (Day 7+)

| Time | Action |
|---|---|
| Day 7, 00:00 | `mcp__supabase__apply_migration(name="0077_v29_drop_legacy_policies")` |
| Day 7, 00:05 | `mcp__supabase__apply_migration(name="0078_v29_cron_jobs")` |
| Day 7, 00:10 | `mcp__supabase__apply_migration(name="0079_v29_hardening")` |
| Day 7, 00:15 | Run AQ-01 through AQ-22 final pass. |
| Day 7, 00:30 | Flip `RBAC_TEAM_UI_ENABLED` to `true` for production owners. |
| Day 7, 01:00 | Owner announcement: "Team management is now live." Pilot owners can invite first employees. |

### D.3.6 Why not ship the migrations one-at-a-time across multiple
days?

Considered. Rejected because:

- Each migration sets up state the next one consumes. Day 1 deploys
  migration 0068; Day 2 deploys 0069. Between Day 1 and Day 2, the
  catalog exists but no tables reference it. State is harmless but
  awkward.
- The owner-tier smoke matrix needs all migrations in place to test
  end-to-end. Partial migration sets give partial test coverage.
- Production is currently 2 shops × 1 user each. Big-bang on a small
  base is low-risk. SMB context.

The big-bang-on-Day-0 + stabilization-week + cutover-on-Day-7 is the
chosen phasing. Documented as ADR-2026-05-14-rbac-deployment-phasing.

---

## D.4 tasks.md additions

Insert the following block into `tasks.md` after the v2.8.5 section
(currently the last section):

```markdown
---

## v2.9 — Permission-based RBAC (3 sports + 10 mobile shop pipeline)

Specs (locked 2026-05-13):
- Audit: `audit/2026-05-13-rbac-pre-design-audit.md`
- Design: `design/2026-05-13-rbac-model-design.md` (Rev 2 — permission-based)
- Attack surface: `design/2026-05-13-rbac-attack-surface.md` (Rev 2)
- Implementation plan: `design/2026-05-13-rbac-implementation-plan.md`

ADRs to file during implementation: `decisions/v29-rbac-INDEX.md`
(20 ADRs scaffolded; file in order as decisions land).

### Phase A — Foundation migrations

- [ ] 0068: permissions_catalog table + invitation_status enum + seed 50 catalog rows
- [ ] 0069: user_shop_access + user_shop_permissions + user_shop_permission_audit + pending_invitations tables (with RLS placeholders)
- [ ] 0070: helper functions (user_has_shop_access, current_active_shop_id, set_active_shop, current_shop_id alias, user_has_permission, user_permissions_in_shop, validate_permission_grant, validate_permission_revoke, pre_request_set_active_shop)
- [ ] **Manual:** configure Supabase project's pre-request hook setting → `pre_request_set_active_shop`
- [ ] 0071: backfill existing shops as owner rows in user_shop_access (idempotent)
- [ ] 0072: new columns on existing tables (audit `_by_user_id` columns + `customers.is_active` + `shops.salesperson_payment_cap_pkr` + FK change on `shops.owner_user_id` to RESTRICT)

### Phase B — RLS + Views (additive)

- [ ] 0073: new permission-based RLS policies on every shop-scoped table (additive — coexisting with old policies during stabilization week)
- [ ] 0074: 11 `_view` views per §B.3.5 with conditional column projection + revised `customer_outstanding` body + new `shop_effective_subscription` view
- [ ] AQ-01 through AQ-22 audit queries run clean

### Phase C — RPC layer

- [ ] 0075: 24 new DEFINER RPCs (apply_preset_to_user, modify_user_permission, create_invitation, accept_invitation, cancel_invitation, update_user_discount_limits, revoke_user_access, create_customer_basic, create_customer_full, create_expense, update_expense, update_shop_settings, update_owner_details, upsert_monthly_target, get_user_shop_list, get_team_for_active_shop, get_user_permissions, plus helpers)
- [ ] 0076: rewrite 45 existing RPCs with permission checks + `_by_user_id` writes (see Phase B §B.5.1 mapping; conditional-projection logic for search_products / recent_purchase_products / list_customers per F-PD-04 resolution)
- [ ] `mcp__supabase__generate_typescript_types` → `src/types/database.ts`

### Phase D — Client integration

- [ ] Supabase client `customFetch` wrapper for `app-shop-id` header (F-PD-09)
- [ ] `localStorage.nizaamify.active_shop_id` keyed storage + TopBar shop switcher component
- [ ] TanStack Query `['permissions', shop_id, user_id]` with `staleTime: 60_000` + `refetchOnWindowFocus: true` (F-PD-08)
- [ ] Permission-aware UI: `usePermission(key)` hook reads `get_user_permissions` and gates buttons / routes
- [ ] All client-side reads of cost-bearing tables switched to `_view` query path (e.g., `from('products')` → `from('products_view')` where applicable)
- [ ] All client-side writes that were direct DML on `customers`, `expenses`, `monthly_targets`, `products`, `product_variants`, `suppliers` switched to the new RPC paths
- [ ] `<RequireActiveSubscription>` guard rewired to query `shop_effective_subscription` view (closes audit F-H-17)
- [ ] Feature flag `RBAC_TEAM_UI_ENABLED` defaulted off

### Phase E — Team management UI

- [ ] `/settings/team` page (gated by `view_team` permission; only visible to owner by default)
- [ ] Invite-modal component (preset radio + permission override toggles + discount-limit override numeric fields; calls `create_invitation`)
- [ ] Pending-invitations list + cancel action
- [ ] `/invite/accept` route (reads invitation_id from URL, prompts password set, prompts 4-digit code, calls `accept_invitation`)
- [ ] Per-user permission editor (reads `get_user_permissions`, calls `modify_user_permission` per toggle, surfaces dependency errors)
- [ ] Discount-limits editor (calls `update_user_discount_limits`)
- [ ] Revoke-access button (calls `revoke_user_access`)
- [ ] Audit log viewer at `/settings/team/audit` (gated by `view_user_audit_log`)
- [ ] i18n: new namespace `team` with EN + UR translations

### Phase F — Stabilization week (Day 1–7)

- [ ] Daily run of AQ-01 through AQ-22 — all return clean
- [ ] Staging non-owner test matrix per Phase C §C.2 (322 tests)
- [ ] PostgREST log review for unexpected `insufficient_permissions` / `no_shop_for_user` errors
- [ ] No production user-visible breakage (owner workflows continue normally)

### Phase G — Cutover (Day 7)

- [ ] 0077: drop legacy shop-scope-only RLS policies + `shops_owner_update` + column-level revokes on `shops.owner_user_id` and `user_shop_access.is_owner`
- [ ] 0078: cron jobs (cleanup_invitations daily 00:30 UTC)
- [ ] 0079: hardening — revoke EXECUTE on batch trigger functions from authenticated (per F-M-25)
- [ ] Flip `RBAC_TEAM_UI_ENABLED` to true for production owners
- [ ] AQ-01 through AQ-22 final pass after cutover

### Phase H — Documentation

- [ ] CLAUDE.md updated with v2.9 build-trail entry + 4-6 new gotchas
- [ ] `docs/build-trail.md` v2.9 entry
- [ ] `docs/gotchas.md` additions:
  - "User access is gated by permissions, not roles — read user_has_permission helper"
  - "Owner has every permission via implicit shortcut; user_shop_permissions has no rows for owners"
  - "Cost columns are conditionally NULL in views via user_has_permission; client must handle NULL"
  - "Set_active_shop validates membership; localStorage drives the shop switcher; pre-request hook bridges to DB"
- [ ] `docs/todos.md` updated:
  - Move "Role-based access (v2)" from "Phase 2+" to "Shipped in v2.9"
  - Add new deferred items: void_sale (v2.10+), edit_sale_notes (v2.10+), apply_discount_above_limit / manager-override-at-POS (v2.10+), real-time permission updates via Supabase Realtime (v2.10+ option a)
- [ ] 20 ADRs filed per `decisions/v29-rbac-INDEX.md`

### Phase I — Pilot rollout

- [ ] Pilot shop owner invited to test the team UI in production
- [ ] First real invitation sent to a staff member
- [ ] 2-week pilot observation: monitor audit log activity, PostgREST errors, owner feedback
- [ ] Roll out to remaining shops in the 3 sports + 10 mobile pipeline

---
```

That block totals roughly 100 lines and slots into `tasks.md` at the
end of the existing post-MVP section.

---

## D.5 decisions/ scaffolding

20 ADRs to file during implementation, named per the existing
`decisions/` convention (date-prefixed, kebab-case). Each ADR follows
the four-section template from ADR-0009 (Context / Decision /
Alternatives / Consequences).

Create an index file `decisions/v29-rbac-INDEX.md` with the following
content as a Phase D pre-implementation artifact:

```markdown
# v2.9 RBAC — ADR index

20 ADRs to file as decisions land during v2.9 implementation. Filing
order follows the deploy phases; each ADR is one decision; cross-link
liberally with [[other-adr-name]].

## Foundational decisions (file during Phase A)

1. `2026-05-14-rbac-permission-model-over-roles.md`
   - Why permission-based, not role-based. References the customer
     demand (3 sports + 10 mobile shops asked for granular control).
     The pivot mid-Phase-B; Rev 1 captured in git.

2. `2026-05-14-rbac-50-permission-catalog.md`
   - The 50-permission count, granularity rationale (medium per the
     user's preference; 40-60 was the target range). 8 categories
     matching UI grouping.

3. `2026-05-14-rbac-owner-implicit-shortcut.md`
   - Owner has every permission via `user_has_permission` shortcut
     (no user_shop_permissions rows needed). Cannot be revoked.
     Cannot have permissions modified individually. Founding-owner
     concept retained via `shops.owner_user_id` denormalization +
     `user_shop_access.is_owner` flag.

4. `2026-05-14-rbac-presets-as-templates.md`
   - Presets are starting templates at invitation time, not enforced
     after. Once applied, per-user overrides are unlimited. Re-applying
     a preset re-seeds the user's permission rows.

5. `2026-05-14-rbac-dependency-rules-grant-time.md`
   - Catalog declares `requires text[]`. Enforcement at grant time
     (cannot grant X without prerequisites) and revoke time (cannot
     revoke Y while a dependent of Y is granted). Runtime check is
     single-permission (no traversal). Approach (a) from Phase B B.1.2.

## Mechanism decisions (file during Phase B/C)

6. `2026-05-14-rbac-set-active-shop-header-pattern.md`
   - Per-request `app-shop-id` HTTP header set by client `customFetch`
     wrapper from `localStorage.nizaamify.active_shop_id`.
   - `pre_request_set_active_shop()` SQL function configured as
     Supabase's pre-request hook validates membership and sets
     `app.shop_id` session variable.
   - Failure modes: missing → fallback to single-shop or NULL;
     invalid → raise; no access → raise.
   - F-PD-09 resolution captured here.

7. `2026-05-14-rbac-permission-conditional-view-projection.md`
   - Per-table `_view` views are `security_invoker = false` (DEFINER)
     and project sensitive columns as NULL conditional on
     `user_has_permission`. Single view per table; the locked-back-door
     promise: raw table has stricter RLS, view is the open door.
   - 11 views per §B.3.5.

8. `2026-05-14-rbac-search-rpcs-conditional-projection.md`
   - `search_products`, `recent_purchase_products`, `list_customers`
     gates change from cost-permission to read-permission; body
     conditionally NULLs cost columns. No `_safe` variant RPCs.
   - F-PD-04 resolution captured here.

9. `2026-05-14-rbac-discount-limits-on-user-shop-access.md`
   - Discount limits stored as JSONB on `user_shop_access.discount_limits`,
     seeded by preset at invitation, modifiable per-user via
     `update_user_discount_limits` RPC.
   - Cap shape locked: `{per_line_max_pct, per_invoice_max_pct,
     per_line_max_pkr, per_invoice_max_pkr}`; missing = no limit on
     that axis.

10. `2026-05-14-rbac-receive-payment-cap-applies-to-all-non-owners.md`
    - `shops.salesperson_payment_cap_pkr` (default 10,000 PKR) caps
      every non-owner caller, not just salesperson-preset.
    - The column name is retained for backward compat; F-PD-05 carries
      forward a rename suggestion.

11. `2026-05-14-rbac-cashier-role-snapshot-dropped.md`
    - Why we don't snapshot `cashier_role` on `invoices` / `purchases`
      under the permission model. Audit reconstruction via
      `user_shop_permission_audit` timestamps.

## Invitation-flow decisions (file during Phase D RPC layer)

12. `2026-05-14-rbac-invitation-snapshot-not-resolved-at-accept.md`
    - Invitation row stores `permissions jsonb` snapshot at create
      time. Accept-time applies the snapshot, not re-resolved catalog
      defaults. Closes drift between create and accept (Phase B §B.6
      E9).

13. `2026-05-14-rbac-4-digit-code-mistyped-email-mitigation.md`
    - 4-digit verbal confirmation code delivered out-of-band (phone,
      WhatsApp, in-person). Stored on `pending_invitations` but not
      in the email. Combined with 24h expiration and 5-strike
      auto-cancel.

14. `2026-05-14-rbac-failed-attempts-counter-five-strike.md`
    - `pending_invitations.failed_attempts` increments on wrong
      confirmation code. After 5, status flips to `'cancelled'` and
      future accept attempts raise `invitation_not_pending`.

## Operational decisions

15. `2026-05-14-rbac-client-cache-staleness-bounded.md`
    - TanStack Query `staleTime: 60_000` for permission queries +
      `refetchOnWindowFocus: true` + explicit invalidation on owner
      mutations. Option (b) from F-PD-08.
    - Real-time via Supabase Realtime (option a) is the upgrade path
      if SMB feedback demands stronger posture.

16. `2026-05-14-rbac-archive-product-trigger-gate.md`
    - `archive_product` permission gates `is_active = false` toggle
      on products via BEFORE UPDATE trigger that checks
      `user_has_permission(shop_id, 'archive_product')` when `OLD.is_active`
      differs from `NEW.is_active`. Plus `edit_product` for everything
      else.

17. `2026-05-14-rbac-update-shop-via-rpc-only.md`
    - `shops` UPDATE policy dropped. All shop-settings edits via
      `update_shop_settings` RPC.
    - `revoke update (owner_user_id) on public.shops from authenticated`
      as defense in depth.
    - Closes Rev 1 / Phase C F-NEW-02.

18. `2026-05-14-rbac-definer-safe-views.md`
    - The 11 `_view` views are `security_invoker = false` (DEFINER).
    - Triggers `security_definer_view` advisor warnings. Intentional;
      this ADR explains.

## Stabilization & deferred items

19. `2026-05-14-rbac-deployment-phasing.md`
    - Big-bang Day-0 deploy (migrations 0068-0076) + stabilization
      week + Day-7 cutover (0077-0079). Why not incremental.

20. `2026-05-14-rbac-leaky-purchase-cost-acknowledgment.md`
    - Manager has `view_purchases` + `view_product_cost` + `view_batch_cost`
      by default (operational for stock-in). Can reconstruct profit
      on adjacent sales by joining purchase_items to sale_items.
      ACCEPTED limitation. Out-of-scope mitigation: separate "purchase
      reviewer" role from "purchase recorder" — defer to v2.10+.

## Deferred to v2.10+

The following items are explicitly deferred via Phase D §D.2 and
should NOT be filed as v2.9 ADRs:
- `void_sale` RPC + permission (deferred per Phase B D1)
- `edit_sale_notes` RPC + permission (`financial_records_immutable`
  blocks; needs allowlist trigger)
- `apply_discount_above_limit` / manager-override-at-POS (deferred
  per Phase B B.2.4)
- Real-time permission updates via Supabase Realtime
- Remote JWT invalidation for revoked users
- Ownership transfer (`transfer_ownership` RPC)
```

---

## D.6 Pre-Phase-D resolutions

### D.6.1 F-PD-04 resolution — search RPCs use permission-conditional projection

**Decision:** option (b) from Phase C §C.4 question — keep the
existing search/list RPCs (`search_products`, `recent_purchase_products`,
`list_customers`), drop the cost-permission as the gate, gate on the
basic read permission (`view_products` / `view_customers`), and have
the RPC body conditionally NULL the cost-bearing return columns based
on the caller's specific cost permission.

**Reasoning:**
- PostgREST + view query alone is insufficient for the salesperson POS
  search UX. The existing `search_products` uses `pg_trgm` similarity
  scoring for fuzzy / typo-tolerant matching. PostgREST's `ilike` /
  `phraseto_tsquery` is clunky and slower.
- Re-adding `_safe` RPC variants doubles the RPC surface for the same
  functionality. Avoidable.
- The conditional-projection pattern is already in use at the view
  level (§B.2.0b). Mirroring it at the RPC level is consistent.

**Impact on Phase B:**
- §B.5.1 entries for `search_products`, `recent_purchase_products`,
  `list_customers` updated (gate changes from cost-permission to read-
  permission; body conditionally NULLs cost columns). **Patched in
  this turn.**

**Impact on Phase C:**
- §C.4 F-PD-04 marked RESOLVED with the conditional-projection
  rationale. **Patched in this turn.**
- §C.2.1 boundary tests for these RPCs are unchanged in shape: the
  salesperson can call the RPC (succeeds), but cost columns return
  NULL when called.

**ADR to file:** `2026-05-14-rbac-search-rpcs-conditional-projection.md`
(#8 in §D.5).

### D.6.2 F-PD-09 resolution — `set_active_shop` via per-request header

**Decision:** the locked mechanism per the user's instruction:

- **Header name:** `app-shop-id` (lowercase). Value: UUID string.
- **Client-side:**
  - Storage: `localStorage.getItem('nizaamify.active_shop_id')`.
  - Injection: custom `fetch` wrapper passed to `createClient` via
    `global.fetch` config. The wrapper reads the storage key and sets
    the header on every PostgREST request.
  - Switching: TopBar shop switcher writes to `localStorage`, then
    invalidates TanStack Query keys for the new shop's data.
- **Server-side:** `public.pre_request_set_active_shop()` SQL function,
  configured as the Supabase project's "Pre-request function" setting.
  Runs after JWT verification, before RLS. Reads the header, validates
  membership via `user_has_shop_access`, sets `app.shop_id`. Always
  resets at function entry to clear connection-pool state.
- **Failure modes:**
  - Missing header → fallback to single-shop or NULL.
  - Invalid UUID format → raise `invalid_app_shop_id_header`.
  - No access to the specified shop → raise `no_access_to_shop`.
  - Connection-pool reuse → cleared by explicit reset at function entry.

**Implementation note:** the Supabase pre-request setting must be
configured **manually** via the Supabase project dashboard after
migration 0070 applies. This is the only out-of-migration step in
v2.9. See §D.3.2 pre-deployment checklist.

**ADR to file:** `2026-05-14-rbac-set-active-shop-header-pattern.md`
(#6 in §D.5).

### D.6.3 F-PD-08 resolution — TanStack Query staleness contract

**Decision:** option (b) from the user's three offered shapes —
bounded staleness, 60-second TTL + revalidate-on-focus.

**Specific contract:**
- Query key: `['permissions', shop_id, target_user_id]`.
- `staleTime: 60_000` (60 seconds).
- `refetchOnWindowFocus: true`.
- `refetchInterval: false`.
- Explicit invalidation on owner mutations: after a successful
  `modify_user_permission` / `apply_preset_to_user` /
  `update_user_discount_limits` / `revoke_user_access` /
  `accept_invitation` / `cancel_invitation` call, invalidate
  `['permissions', shop_id, target_user_id]` AND `['team', shop_id]`.

**Security posture:**
- DB layer enforces immediately (every RPC re-queries
  `user_has_permission`).
- Worst case: 60-second window where UI shows an enabled button but
  click returns `insufficient_permissions`. UX glitch, not a
  privilege escalation.
- For the SMB threat model (fired salesperson, not APT), 60-second
  permission lag is negligible vs. the dominant Supabase JWT lifetime
  (1 hour default; longer for active users).
- Option (a) — real-time via Supabase Realtime subscription — is
  documented as the upgrade path if the user later demands stronger
  posture. Per-shop user count (1–10) makes Realtime affordable but
  unnecessary today.
- Option (c) — invalidate-on-mutation broadcast — was rejected
  because the modifying session and the affected user's session are
  typically different. Same effective behavior as bounded staleness
  with extra complexity.

**ADR to file:** `2026-05-14-rbac-client-cache-staleness-bounded.md`
(#15 in §D.5).

### D.6.4 Phase B patches applied in this turn

| Change | Location | Description |
|---|---|---|
| Gate change | §B.5.1 row `search_products` | `view_product_cost` → `view_products` + conditional projection |
| Gate change | §B.5.1 row `recent_purchase_products` | `view_product_cost` → `view_products` + conditional projection |
| Gate change | §B.5.1 row `list_customers` | `view_customer_contact` → `view_customers` + conditional projection (NULLs phone/address per view_customer_contact, NULLs outstanding per view_customer_outstanding) |

The dependency table (§B.1.2 row 8) was already patched earlier
(2026-05-13) to `writeoff_batch | view_inventory_batches,
view_batch_cost`. No further B.1 changes in this turn.

### D.6.5 Phase C §C.4 patches applied in this turn

| Change | Location | Description |
|---|---|---|
| RESOLVED | §C.4 F-NEW-04 cross-reference | Path locked: permission-conditional projection. |
| RESOLVED | §C.4 F-PD-04 | Pointer to the cross-reference. |
| RESOLVED | §C.4 F-PD-08 | Full TanStack Query contract documented. |
| RESOLVED | §C.4 F-PD-09 | Full header-based mechanism + pre-request hook function body documented. |

---

## D.7 Summary

Phase D is the implementation handoff. The locked design is in §B
and §C; this document specifies the order of operations.

**12-migration sequence:**
- 0068 enum + catalog
- 0069 identity tables
- 0070 helper functions + pre-request hook function
- 0071 backfill owner access
- 0072 audit columns + FK changes
- 0073 new RLS (additive)
- 0074 new views
- 0075 new RPCs
- 0076 modify existing RPCs
- 0077 drop legacy RLS (Day 7)
- 0078 cron jobs
- 0079 hardening

**Phasing:** big-bang Day-0 (0068–0076) + stabilization week + Day-7
cutover (0077–0079). No incremental ship for v2.9; the dependencies
are too tight.

**Rollback:** every irreversible change has a documented rollback
path. No `DROP COLUMN`, no `DROP TABLE` of v1 entities. Acceptable
data loss in rollback is limited to v2.9 audit history and pending
invitations.

**Risks:**
- R-PD-01 owner access lockout from misaligned backfill — mitigated
  by pre-flight AQ-07.
- R-IF-04 pre-request hook misconfiguration — mitigated by manual
  step in the deploy checklist.
- R-PD-07 revoked salesperson retains JWT for 1h — accepted
  limitation.
- R-PD-09 manager can reconstruct profit via purchase cost — accepted
  limitation (out-of-scope mitigation deferred to v2.10).

**Three pre-Phase-D items resolved:**
- F-PD-04: conditional-projection RPCs, no _safe variants.
- F-PD-08: bounded 60s staleness + refetch-on-focus + explicit
  invalidation.
- F-PD-09: per-request `app-shop-id` header + pre-request hook
  function.

**Open Phase D items (carry into implementation):**
- F-PD-01, F-PD-02, F-PD-03, F-PD-05, F-PD-06, F-PD-07, F-PD-10,
  F-PD-11, F-PD-12. Each is a specific migration-time concern
  documented in Phase C §C.4.

**ADRs to file: 20** per §D.5 index. The implementation engineer
files them as decisions land.

**tasks.md addition: ~100 lines** per §D.4, with checkboxes spanning
Phase A through Phase I.

**This is the last design document before code.** Phase D′ (prime)
amendments are filed if defects surface during implementation, but
none are anticipated.

---

*End of Phase D. Document locked 2026-05-13.*
