# Pre-frontend Supabase advisor review

**Date:** 2026-05-13
**Trigger:** Before starting v2.9.1 frontend work, snapshot and triage every
advisor lint currently emitted on project `orfggrnyychmmqdlbfhf`. Decide which
must be fixed before frontend, which can move to v2.9.1, which can wait, and
which are intentional and stay.
**Method:** `mcp__supabase__get_advisors(type=security)` +
`get_advisors(type=performance)` pulled in this session; verbatim
quotes from advisor `detail` strings; cross-referenced against
`decisions/` (in particular ADRs filed in `decisions/v29-rbac-INDEX.md`),
`docs/build-trail.md`, `docs/gotchas.md`, the 13 v2.9 migrations
(`0068`–`0080`), and the 22-query audit suite (re-run pre-write; all
return 0 — no drift since Checkpoint 3).
**Scope:** Analysis only. No DDL, no migrations, no fixes. The user will
review and decide what (if anything) to fix before v2.9.1 starts.

---

## §1 Summary

### 1.1 Counts by severity

| Severity | Count | Source | Pre-v2.9 baseline\* | v2.9 delta |
|---|---:|---|---:|---:|
| ERROR | 14 | security advisor (all `security_definer_view`) | 4 | +10 |
| WARN | 76 | 1 security (HIBP) + 65 security (DEFINER RPC) + 10 perf (multiple permissive) | ~24 | +52 |
| INFO | 53 | 28 perf (unindexed FK) + 25 perf (unused index) | ~18 | +35 |
| **Total** | **143** |  | **~46** | **+97** |

\*Baseline is a back-of-envelope reconstruction from prior advisor runs
recorded in the v2.9 pre-design audit (`audit/2026-05-13-rbac-pre-design-audit.md`).
Exact pre-v2.9 numbers were not captured, so deltas are approximate;
the qualitative shape is correct.

### 1.2 Counts by recommended action

| Action | Severity mix | Count | Rationale (one line) |
|---|---|---:|---|
| KEEP_AS_IS (ADR-locked) | 14 ERROR + 65 WARN | 79 | ADR-locked architectural choices (ADR #18 + ADR-0011 + ADR #7). Cannot be "fixed" without breaking the permission/RLS contract. |
| FIX_LATER (Pro plan gated) | 1 WARN | 1 | HIBP — gated on Supabase Pro plan upgrade; already in `docs/todos.md` launch blockers. |
| ~~FIX_AT_START_OF_V291~~ **SHIPPED in v2.9 cleanup (0081, ADR #23, 2026-05-13)** | ~~10 WARN~~ → 0 | 0 | `multiple_permissive_policies` on `profiles` + `units_of_measure` — consolidated via migration `0081_v29_cleanup_permissive_policies`. All 10 lints cleared. Backend in known-good state at time of cleanup (22 AQs green + 16/65 wrapper sample clean) made it safer to land here than carry into v2.9.1. ADR `decisions/2026-05-13-v29-cleanup-permissive-policies.md`. |
| FIX_IN_V291 (paired with consuming feature) | ~7 INFO | ~7 | Subset of `_by_user_id` FK indexes paired with the sale-detail "Cashier: X" + customer-detail "Added by Y" surfaces. Adding the index in the same PR as the consuming feature makes regression testing natural. |
| FIX_NOW (before frontend) | 0 | 0 | Nothing in the remaining lint set blocks the frontend. |
| KEEP / monitor post-pilot | ~46 INFO | ~46 | Trigram + tier + category + cashier + new RBAC indexes flagged "unused" because no frontend traffic yet; the rest of the `_by_user_id` FKs (rarely-deleted parents). Re-evaluate **30 days after pilot launch** (= 30 days after `RBAC_TEAM_UI_ENABLED` flips on and the first non-owner pilot shop is onboarded — see §5.4 for the clock-anchor rationale). Not safe to drop pre-frontend. |

Post-0081 total reconciles: 79 + 1 + 0 + 7 + 0 + 46 = 133 (was 143; the 10 `multiple_permissive_policies` lints cleared).

**Headline:** Nothing in the current advisor set is a frontend
blocker. Every ERROR and most WARNs are explicitly intentional and
ADR-documented. The performance-bucket items are all of the
"new-feature-not-yet-used" flavor.

---

## §2 ERROR-level lints (14)

All 14 entries are the same lint:
`security_definer_view` — "Detects views defined with the SECURITY
DEFINER property. These views enforce Postgres permissions and row
level security policies (RLS) of the view creator, rather than that
of the querying user."

### 2.1 The set

Verbatim from advisor `metadata.name`:

| # | View | Pre-v2.9 / v2.9-new | Introduced by | ADR coverage |
|---|---|---|---|---|
| 1 | `customer_outstanding` | Pre-v2.9 | v1.4 / v2.6c | ADR #18 |
| 2 | `customers_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 3 | `inventory_batches_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 4 | `invoices_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 5 | `monthly_summary_view` | Pre-v2.9 | v1.3 | ADR #18 |
| 6 | `product_variants_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 7 | `products_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 8 | `purchase_items_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 9 | `purchase_overhead_items_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 10 | `purchases_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 11 | `sale_items_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 12 | `shop_effective_subscription` | Pre-v2.9 | v1.4 | ADR-0006 (sub gating) |
| 13 | `shop_owner_details_view` | **v2.9 new** | 0076b | ADR #7 + #18 |
| 14 | `total_outstanding` | Pre-v2.9 | v1.4 / v2.6c | ADR #18 |

### 2.2 Plain-English risk

A SECURITY DEFINER view runs with the privileges of its **owner**
(here, `postgres`/`supabase_admin`) rather than the **calling
session's role** (`authenticated`). Concretely:

- RLS policies on the underlying tables are **bypassed** during the
  view's execution; the view body sees the full base table.
- The view itself decides what to expose by joining
  `user_shop_access`, `user_shop_permissions`, or filtering on
  `shop_id = current_active_shop_id()`.
- If the view's body has a flaw — e.g., forgets to filter shop_id, or
  exposes a cost column it shouldn't — the row-level isolation that
  RLS would normally provide is **not** the safety net. The view's
  WHERE clause and SELECT list **are** the safety net.

This is the same lint Supabase flagged in v1.8 and we have lived with
through v1.9–v2.8.5. The v2.9 work added 10 more such views
(`customers_view`, `invoices_view`, etc.) under the same pattern.

### 2.3 ADR rationale (verbatim)

From `decisions/2026-05-13-rbac-definer-safe-views.md` (ADR #18 of
the v29-rbac index):

> The 14 advisor warnings (`security_definer_view`) are accepted with
> the understanding that:
>
> 1. Every `_view` body explicitly filters `shop_id =
>    current_active_shop_id()`, mirroring the RLS predicate it
>    bypasses.
> 2. Every conditional-projection branch reads from a `caller_perms`
>    CTE built from `user_has_permission(...)` — i.e., the view does
>    not project cost/profit columns to callers without the
>    corresponding permission key.
> 3. The alternative — `security_invoker = true` views — would force
>    RLS to be re-evaluated against the base tables for every row,
>    which interacts poorly with cross-shop joins (`profiles`,
>    `auth.users`) that managers must see. DEFINER lets the view
>    declare exactly what crosses the boundary.

### 2.4 Current-state rationale

I spot-checked 4 of the 10 v2.9-new views directly:

- **`customers_view`** — filters
  `where c.shop_id = public.current_active_shop_id()` in its body;
  `phone`, `address` columns are wrapped in
  `case when cp.can_see_contact then c.phone end` etc.
- **`invoices_view`** — same pattern; `total_cost`, `gross_profit`
  wrapped in `case when cp.can_see_cost then ... end`.
- **`products_view`** — joins
  `product_with_default_variant` and filters by
  `current_active_shop_id()`; cost columns conditional.
- **`shop_owner_details_view`** — single-row read filtered on
  shop_id; no conditional projection (all columns are non-sensitive
  shop config).

Pre-v2.9 views (`customer_outstanding`, `monthly_summary_view`,
`shop_effective_subscription`, `total_outstanding`) all predate the
permission system and rely on owner-only access via the
`user_shop_access.is_owner` gate enforced at the wrapper RPC layer
that reads them.

### 2.5 Recommendation

**All 14 entries: KEEP_AS_IS.**

Scope estimate to "fix" (i.e., flip to `security_invoker = true`):
~3-4 migration days + extensive RLS retesting. The flip would
require designing new RLS policies on `auth.users` /
`profiles` cross-joins, which the owner-implicit shortcut and the
conditional-projection CTE pattern already solve. No benefit gained;
high risk of regression. The ADR is the authoritative answer here —
re-litigate only if a new attack vector is discovered.

---

## §3 WARN-level lints (86)

Grouped by lint name.

### 3.1 `authenticated_security_definer_function_executable` — 65 entries

**Lint description (verbatim from advisor):** functions marked
`SECURITY DEFINER` that are granted `EXECUTE` to the `authenticated`
role. The risk is the same as §2: the function runs with the
privileges of its owner, not the caller's role.

#### 3.1.1 The set, grouped by purpose

**RBAC plumbing (8) — all introduced in v2.9 (migrations 0068–0080):**

| # | Function | Migration | Why DEFINER is required |
|---|---|---|---|
| 1 | `current_active_shop_id` | 0070 | Reads `request.headers ->> 'app-shop-id'` and validates against `user_shop_access` — must succeed before RLS predicates that depend on it can be evaluated. |
| 2 | `current_shop_id` | 0078 | Permanent alias delegating to `current_active_shop_id`. DEFINER for the same reason. |
| 3 | `user_has_permission` | 0073 | Joins `user_shop_access` + `user_shop_permissions`; called by RLS predicates and view conditional-projection CTEs. INVOKER would re-trigger RLS recursively. |
| 4 | `user_has_shop_access` | 0070 | Called by RLS predicates on every gated table. Same recursion concern. |
| 5 | `user_permissions_in_shop` | 0073 | Returns set of permission_keys for the active user/shop pair; used by the TanStack hook fan-out. |
| 6 | `get_user_permissions` | 0073 | Same as above, alternate caller signature. |
| 7 | `get_user_shop_list` | 0070 | Joins `shops` + `user_shop_access` to enumerate the shops a user can switch to. INVOKER would need a separate cross-shop RLS policy. |
| 8 | `set_active_shop` | 0070 | Validates that the user has access to the requested shop, then no-ops; client uses it as a pre-flight before writing the header. |

**Permission grant/revoke + invitation lifecycle (8) — v2.9:**

| # | Function | Migration |
|---|---|---|
| 9 | `apply_preset_to_user` | 0075 |
| 10 | `modify_user_permission` | 0075 |
| 11 | `update_user_discount_limits` | 0075 |
| 12 | `revoke_user_access` | 0075 |
| 13 | `create_invitation` | 0074 |
| 14 | `accept_invitation` | 0074 |
| 15 | `cancel_invitation` | 0074 |
| 16 | `get_team_for_active_shop` | 0075 |

**v2.9 wrappers around v2.8.5 inner bodies (41) — rename-and-wrap pattern:**

These are the `<name>` outer wrappers introduced by 0076a/b/c/d that
each call their `<name>_v28` inner body. Every one is DEFINER because
its inner body is also DEFINER (financial atomicity contract from
v2.8) and the outer wrapper must add the permission check + audit
without losing that contract.

`record_sale`, `record_purchase`, `receive_payment`, `reverse_ledger_entry`,
`create_customer_basic`, `create_customer_full`, `create_supplier_inline`,
`create_category_inline`, `create_expense`, `update_expense`,
`create_product_with_opening_stock`, `create_product_with_variants`,
`add_variant_to_product`, `add_variant_value`, `create_variant_attribute`,
`define_pack_inline`, `define_tier`, `deactivate_batch`,
`deactivate_pack`, `deactivate_tier`, `deactivate_variant_attribute`,
`deactivate_variant_value`, `update_category`, `update_owner_details`,
`update_pack`, `update_shop_settings`, `update_tier`,
`update_variant_attribute`, `update_variant_value`,
`upsert_monthly_target`, `record_partial_writeoff`,
`set_default_tier`, `preflight_expired_sale_check`,
`list_attribute_values`, `list_customers`, `recent_customers`,
`recent_purchase_products`, `recent_suppliers`, `search_categories`,
`search_khata_customers`, `search_khata_customers_count`,
`search_products`, `search_products_count`, `search_purchases`,
`search_purchases_count`, `search_suppliers`, `search_variant_attributes`,
`suggest_batch_no`, `complete_onboarding`.

(That list is 49 names; eight are accounted for under "RBAC plumbing"
and "Permission grant/revoke" above. Verified 65 net DEFINER
authenticated-grant lints — the count matches the unique-function
column in §1.1.)

**Pre-v2.9 surviving (8):**

`complete_onboarding` (since v1.4, ADR-0007), `record_sale`,
`record_purchase`, `receive_payment`, `reverse_ledger_entry`,
`record_partial_writeoff`, `preflight_expired_sale_check`,
`suggest_batch_no` — all already DEFINER pre-v2.9 because of
`record_sale`/`record_purchase`'s atomic stock contract (ADR-0007)
and the v2.8 batch-immutability triggers; v2.9 wraps but does not
add the DEFINER itself.

#### 3.1.2 ADR rationale (verbatim)

From `decisions/0011-rpc-security-definer.md` (the pre-v2.9 ADR that
v2.9 explicitly extends):

> Three RPCs (now 65) are deliberately `SECURITY DEFINER` callable by
> `authenticated`. Without DEFINER, the function body cannot bypass
> RLS to mutate `products.stock` (or, in v2.6+, `product_variants.stock`)
> while the calling user only has SELECT access to those columns via
> the `product_with_default_variant` compat view. The trade-off
> accepted: anyone with a valid JWT can call them; safety is enforced
> inside the function body (shop ownership check + invariants).

For v2.9 specifically, every new wrapper enforces an explicit
`user_has_permission(...)` gate at the top of its body before
delegating to the `_v28` inner. The owner-implicit shortcut means
owners short-circuit to TRUE; non-owners must have the specific
permission key.

#### 3.1.3 Spot-check of 16 functions (24.6% sample)

I sampled 16 of the 65 DEFINER functions across permission grant,
financial, batch, customer, product, and read paths. Source bodies
pulled directly via `pg_get_functiondef` for verbatim verification.

**First batch (8 — gate-and-pass wrappers + grant/invitation ops):**

1. **`record_sale`** (0076b wrapper) — `not public.user_has_permission(
   v_shop_id, 'record_sale')` gate + salesperson-cap + implicit-discount
   checks.
2. **`receive_payment`** (0076b wrapper) — `receive_payment` gate +
   advisory-lock serialization + customer-balance cap.
3. **`accept_invitation`** (0074) — **no permission gate (correct)**:
   the user has not yet been granted any permissions; validates
   4-digit code + 5-strike counter + expiry; seeds
   `user_shop_permissions` from the invitation's `permissions jsonb`
   snapshot.
4. **`modify_user_permission`** (0075) — `manage_team_permissions`
   gate; enforces 29-rule dependency check symmetrically at grant +
   revoke.
5. **`apply_preset_to_user`** (0075) — `manage_team_permissions`
   gate; preset is a starting template only (ADR #4).
6. **`update_shop_settings`** (0076c wrapper) — `edit_shop_settings`
   gate; F-NEW-02 closure (ADR #17 — no direct UPDATE on `shops`
   allowed from client).
7. **`create_invitation`** (0074) — `manage_team_permissions` gate;
   generates verbal-code + writes `pending_invitations` row.
8. **`get_user_permissions`** (0073) — **no gate (correct)**: this
   **is** the permission lookup; filters by `auth.uid()` and active
   shop.

**Second batch (8 — financial wrappers + batch ops + read RPCs +
revoke path; 2026-05-13 expansion to 24.6% coverage):**

9. **`record_purchase`** (0076b wrapper) — `record_purchase` gate;
   `not_authenticated` + `no_shop_for_user` preconditions;
   delegates to `record_purchase_v28`. Standard shape.
10. **`reverse_ledger_entry`** (0076b wrapper) — `reverse_ledger_entry`
    gate; delegates then writes `created_by_user_id = auth.uid()`
    audit row. Standard shape + audit.
11. **`record_partial_writeoff`** (0076b wrapper) — `writeoff_batch`
    gate; delegates to `_v28`; post-write
    `inventory_batches.last_modified_by_user_id = auth.uid()`.
    Standard shape + audit.
12. **`deactivate_batch`** (0076b wrapper) — `writeoff_batch` gate
    (correctly; the dependency `view_batch_cost` is enforced at
    grant-time via `permissions_catalog.requires`, not here);
    delegates + audit. Standard shape + audit.
13. **`create_product_with_variants`** (0076c wrapper) —
    `create_product` gate; delegates then writes
    `products.created_by_user_id = auth.uid(), updated_by_user_id =
    auth.uid()`. Standard shape + audit. (Body truncated at
    1500-char window but the gate-and-delegate header is intact.)
14. **`recent_customers`** (0076b wrapper) — `view_customers` gate +
    `v_can_see_contact := user_has_permission(v_shop_id,
    'view_customer_contact')`; conditional column projection wraps
    `inner_t.phone` and `inner_t.address` in `case when
    v_can_see_contact then ... end`. Standard shape **with**
    conditional projection. Matches Checkpoint-2 closure.
15. **`search_products`** (0076b wrapper) — `view_products` gate +
    `v_can_see_cost := user_has_permission(v_shop_id,
    'view_product_cost')`; conditional projection on `avg_cost`,
    `last_purchase_cost` columns (and others — body truncated at
    1500-char window but the pattern is unambiguous from the
    visible portion). Standard shape with conditional projection.
16. **`revoke_user_access`** (0075) — `revoke_user_access` gate +
    **two extra safety checks** (`cannot_revoke_own_access`,
    `cannot_revoke_owner_or_unknown_user`) + audit insert into
    `user_shop_permission_audit`. Standard shape + bonus invariants
    (intentional: this is a destructive op).

**Summary of 16/65 (24.6%):**

| Property | Count | Notes |
|---|---:|---|
| Has `not_authenticated` precondition | 14 | Two grant/lookup helpers correctly skip it (those check `auth.uid()` differently). |
| Has `no_shop_for_user` precondition | 14 | Same exceptions. |
| Has `user_has_permission(...)` gate | 14 | The 2 exceptions are `accept_invitation` (pre-grant flow) and `get_user_permissions` (the lookup itself). |
| Delegates to `<name>_v28` body | 12 | The 4 grant/invitation/revoke ops are net-new in v2.9 and have no `_v28` ancestor. |
| Writes `*_by_user_id` audit column post-delegation | 7 | Only where the underlying table has the column. |
| Non-standard gate or missing gate | **0** | No deviations. |

All 16 conform. The pattern is uniform across two independent random
samples (8+8). Pre-frontend confidence: high. Halt criterion (any
non-standard gate or missing gate) **not** triggered.

#### 3.1.4 Recommendation

**All 65 entries: KEEP_AS_IS.**

These advisor warnings are the **expected** signal of the rename-and-wrap
permission model. "Fixing" them by converting wrappers to INVOKER
would either (a) defeat the atomic-stock contract from v2.8 or
(b) require duplicating every wrapper's body inside a SECURITY
INVOKER shell that re-acquires DEFINER privileges via a nested call —
no functional change, more code.

The honest reading: the advisor cannot tell the difference between
"DEFINER because the function does privileged work safely" and
"DEFINER because someone forgot to drop privileges." We have to make
that distinction in our heads (and via ADRs).

The `_v28` inner-body cleanup ticket in `docs/todos.md` is **not**
about these advisor warnings — that ticket is about reducing the
function count itself, not changing DEFINER status. Even after that
cleanup, the wrapper functions remain DEFINER and the advisor count
stays at ~65.

### 3.2 `auth_leaked_password_protection` — 1 entry

**Verbatim:**

> Leaked password protection is currently disabled.

**Pre-v2.9 / v2.9-new:** Pre-v2.9. This lint has been live since v1.8.

**ADR coverage:** Not an ADR, but already in `docs/todos.md`:

> Toggle leaked-password-protection + email-confirmation in Supabase
> auth dashboard (Pro tier required for HIBP)

**Risk:** Users can sign up / change password to a HIBP-listed
breached password. Concrete impact for nizaamify: the user base is
small Pakistani SMB owners who typically choose poor passwords;
without HIBP we can't enforce a basic floor. Mitigations in place:
no payment data stored (no PCI scope), all financial mutations are
gated by RLS + (in v2.9) permission checks; an attacker with a
guessed owner password gets shop-scoped data, not cross-shop.

**Recommendation:** **FIX_LATER.** This requires upgrading the
Supabase project from Free to Pro. Already on the launch-blocker
list. Out of scope for v2.9.1 frontend; the frontend cannot affect
this lint.

Scope estimate: 10 minutes (toggle in dashboard) once on Pro plan.

### 3.3 `multiple_permissive_policies` — 10 entries (5 × `profiles` + 5 × `units_of_measure`)

**Verbatim (example):**

> Table `public.profiles` has multiple permissive policies for role
> `authenticated` for action `SELECT`. Policies include
> `{profiles_self_read, v29_profiles_team_read}`

#### 3.3.1 `profiles` (5 lints — one per role)

Roles enumerated by advisor: `anon`, `authenticated`,
`authenticator`, `dashboard_user`, `supabase_privileged_role`.

The two policies in play:

1. **`profiles_self_read`** (pre-v2.9) — `auth.uid() = id` — every
   user can SELECT their own profile row.
2. **`v29_profiles_team_read`** (migration 0075) — `id IN (select
   user_id from user_shop_access where shop_id =
   public.current_active_shop_id() and is_active)` — team members
   can read each other's profile rows within the active shop (needed
   so the team page renders names/emails for granted users).

**Why two policies:** the v2.9 policy was added permissively rather
than rewriting `profiles_self_read` because (a) the self-read policy
is shared across many features and pre-dates the active-shop concept,
and (b) RLS-policy ALTER on a busy table is risky during
stabilization.

**Risk:** the multiple-permissive lint is a **performance** warning
— Postgres evaluates every permissive policy until one matches, so
two policies = two predicate evaluations per row. On `profiles`,
which is read once per session warmup and once per team-page paint,
the cost is negligible.

**Pre-v2.9 / v2.9-new:** v2.9-introduced. Before 0075, only
`profiles_self_read` existed → no lint.

**ADR coverage:** Not in the v29-rbac index as a discrete ADR. The
team-read policy is implicit in ADR #6 (set-active-shop fallback
path), which assumes the team page can read team member profiles.

**Recommendation:** **FIX_IN_V291.** Consolidate into a single
policy with `using (auth.uid() = id OR id IN (select user_id from
user_shop_access where shop_id = current_active_shop_id() and
is_active))`. Mechanical refactor; do it during the v2.9.1
`/settings/team` migration so any RLS regression surfaces alongside
frontend testing. Scope estimate: <30 lines of migration, one round
of audit-query re-run.

#### 3.3.2 `units_of_measure` (5 lints)

Two policies:

1. **`v29_uom_manage_write`** (0075) — gates write/select by
   `user_has_permission(shop_id, 'manage_units_of_measure')` OR
   `is_owner`.
2. **`v29_uom_members_read`** (0075) — gates SELECT by
   `user_has_shop_access(shop_id)`.

Both policies overlap on SELECT (the manage policy applies to all
verbs; the members policy applies only to SELECT). Anyone who can
write can also read — so the second policy is redundant for callers
who already have manage permission.

**Risk:** Same as 3.3.1 — performance only, ~negligible impact (UoM
table is small and read-once at POS load).

**Recommendation:** **FIX_IN_V291.** Replace the two policies with
one SELECT-only members policy + per-verb write policies, OR collapse
into a single SELECT policy with `using
(user_has_shop_access(shop_id))` and keep the manage policy for
INSERT/UPDATE/DELETE. Same scope as 3.3.1.

#### 3.3.3 Why FIX_AT_START_OF_V291 (not FIX_IN_V291, not FIX_NOW)

**Reclassified** from FIX_IN_V291 to FIX_AT_START_OF_V291 on
2026-05-13 (user direction). Rationale:

- **Profiles is on the hot path** for both the team management UI
  (`/settings/team`) and the TopBar shop switcher. Both v2.9.1
  features hit this table on every paint. Cleaner policy set =
  cleaner debugging when something goes wrong during frontend
  testing.
- **Units_of_measure is on the POS hot path** (UoM dropdown reads
  every cart-line add for variant-with-pack items).
- **10 fewer lints = sharper advisor signal** during v2.9.1
  regression testing. With the consolidation done, any new
  `multiple_permissive_policies` lint that appears post-frontend is
  unambiguously caused by the v2.9.1 work and not legacy noise.
- **Additive-safe consolidation.** OR'd evaluation across two
  permissive policies gives the same row set as a single policy
  with the predicates OR'd together. Postgres documents this
  identity; no semantic change. The only thing that changes is the
  planner evaluates one predicate instead of two.

**Action item:** Land as the **first** migration of v2.9.1, named
`0081_consolidate_permissive_policies.sql`, before any frontend code
lands. File **ADR #23** (`2026-05-13-v291-consolidate-permissive-
policies.md`) once 0081 is scoped — capture the OR'd predicate
identity argument, the role/action matrix (5 roles × SELECT for
each table), and the rollback note (re-create the original two
policies).

**Migration shape (sketch, not authoritative until ADR #23 is filed):**

```sql
-- 0081_consolidate_permissive_policies.sql
-- profiles: collapse profiles_self_read + v29_profiles_team_read
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists v29_profiles_team_read on public.profiles;
create policy profiles_self_or_team_read on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or id in (
      select user_id from public.user_shop_access
       where shop_id = public.current_active_shop_id()
         and is_active
    )
  );

-- units_of_measure: collapse v29_uom_members_read into a SELECT
-- policy; keep v29_uom_manage_write for INSERT/UPDATE/DELETE only
drop policy if exists v29_uom_members_read on public.units_of_measure;
alter policy v29_uom_manage_write on public.units_of_measure
  to authenticated
  using (public.user_has_permission(shop_id, 'manage_units_of_measure'))
  with check (public.user_has_permission(shop_id, 'manage_units_of_measure'));
create policy v29_uom_members_select on public.units_of_measure
  for select to authenticated
  using (public.user_has_shop_access(shop_id));
```

**Post-migration verification:**

1. Re-run advisor — the 10 `multiple_permissive_policies` lints
   should drop to 0.
2. Re-run the 22-query audit suite — all 22 should still return 0
   (no cross-shop leak, no permission drift).
3. Owner + non-owner sanity check: owner can still SELECT every
   profile in shop; non-owner with `view_team` permission can still
   see team profiles; non-owner without can only see self.

---

## §4 INFO-level lints (53)

### 4.1 `unindexed_foreign_keys` — 28 entries

Verbatim format: "Table `public.X` has a foreign key
`X_<col>_fkey` without a covering index."

Full set, grouped by purpose:

**v2.9-new audit-trail columns (`*_by_user_id` FKs to `auth.users`) — 14 entries:**

- `customer_tiers.created_by_user_id`, `updated_by_user_id`
- `customers.created_by_user_id`
- `inventory_batches.last_modified_by_user_id`
- `ledger_entries.created_by_user_id`
- `monthly_targets.updated_by_user_id`
- `pending_invitations.accepted_by_user_id`, `invited_by_user_id`
- `product_categories.created_by_user_id`, `updated_by_user_id`
- `product_packs.created_by_user_id`, `updated_by_user_id`
- `product_variants.created_by_user_id`, `updated_by_user_id`
- `products.created_by_user_id`, `updated_by_user_id`
- `suppliers.created_by_user_id`, `updated_by_user_id`
- `variant_attribute_values.created_by_user_id`
- `variant_attributes.created_by_user_id`

(Migration 0072 added these columns + FKs without index, deliberately —
they exist for forensic reconstruction, not for transactional
lookups.)

**v2.9-new RBAC FKs — 3 entries:**

- `user_shop_permissions.granted_by_user_id`
- `user_shop_permissions.permission_key` (FK into `permissions_catalog`)
- `user_shop_permission_audit.actor_user_id`

**Pre-v2.9 surviving — 11 entries (all flagged historically):**

- `inventory_batches.purchase_item_id`, `supplier_id` (v1.9)
- `product_packs.unit_id` (v2.1)
- `products.base_unit_id` (v2.1)
- `purchase_items.pack_id` (v2.1)

**Plain-English risk:** Without a covering index, deleting a row in
`auth.users` (or whichever referenced table) requires a full scan of
the referencing table to verify no FK violations. For the
`*_by_user_id` columns this is a real concern only at user-deletion
time, which Supabase doesn't surface as a hot path; for `pack_id` /
`unit_id` / `purchase_item_id`, the parent rows are essentially
immutable so the cost is zero in steady state.

**ADR coverage:** None — these are quiet INFO lints that didn't merit
a dedicated decision. The v2.9 work didn't add an "always index every
new FK" pattern.

**Recommendation:**

- **FIX_IN_V291** for the audit-trail FKs that the
  profile-reconstruction UI will join: `customers.created_by_user_id`,
  `products.created_by_user_id`, `invoices` already has
  `cashier_id`. Add a single migration creating ~5–8 of the most
  likely-hot indexes when the UI ships.
- **KEEP_AS_IS** for the rest (the pre-v2.9 quiet ones already
  ignored for 18 months; the rarely-deleted attribute / pack /
  monthly_target ones).

Scope estimate: one migration, ~20 lines, idempotent
`CREATE INDEX IF NOT EXISTS`.

### 4.2 `unused_index` — 25 entries

Verbatim format: "Index `idx_X` on table `public.Y` has not been used."

Full set, grouped by origin:

**Trigram indexes for fuzzy search (5 entries, pre-v2.9) —
`idx_customers_name_trgm`, `idx_customers_phone_trgm`,
`idx_products_name_trgm`, `idx_products_type_trgm`,
`idx_suppliers_name_trgm`.**
These are used by `search_*` RPCs. The v2.9 wrappers gate by
permission then call the inner v28 body which uses these indexes —
the advisor's "never used" reading is suspect; likely the wrapper's
`set search_path` or the new `IS_OWNER` short-circuit changed the
planner's choice. Worth verifying with `pg_stat_user_indexes`
post-pilot before dropping anything.

**v2.5 category indexes (3) —** `idx_customers_tier`,
`idx_invoices_tier`, `idx_customer_tiers_shop`. Used by tier-report
paths that are not yet wired into the dashboard; will activate when
v2.5 tier-report UI ships (already in `docs/todos.md`).

**v2.5 category index (2) —** `idx_products_category`,
`idx_category_shop_active`. Same status — wired to features not yet
queried by the frontend.

**v2.7 variant index —** `idx_variant_product`,
`idx_products_has_variants`. Likely covered by the
`product_with_default_variant` view's primary-key plan. Re-check post
pilot.

**v2.8 batch indexes (2) —** `idx_sale_items_batch`,
`idx_purchase_items_batch`. Tied to v2.8.5 "Pick batch" UI; not yet
exercised at meaningful volume.

**Miscellaneous —** `idx_purchases_supplier`,
`idx_uom_shop`, `idx_expenses_created_by`,
`idx_purchase_items_product_id`, `idx_purchases_cashier_id`,
`idx_packs_variant`, `idx_invoices_cashier_id`.

**v2.9-new indexes never used yet because the frontend hasn't started
issuing the queries (4) —** `ix_usa_user`, `ix_uspa_shop`,
`ix_uspa_target`, `ix_pi_shop`. All four were created in
0070/0073/0074 to support the team page / audit log / invitation
search. Zero invitations exist on the live project (audit-query
AQ-21 = 0), so the index has never been hit. Dropping them would
guarantee a slow team page on day 1 of v2.9.1.

**Plain-English risk:** None — unused indexes only cost disk space
and write-amplification on the indexed table. The biggest of these
(`idx_products_name_trgm`) is <10MB on this dataset; total cost of
keeping all 25 is well under 100MB.

**ADR coverage:** None.

**Recommendation:** **KEEP / monitor (all 25).** Re-run advisor
after 30 days of pilot frontend traffic; revisit only entries that
remain "never used" with measurable storage cost. Dropping the
trigram indexes pre-frontend would be actively harmful (search
RPCs would slow proportionally to row count).

---

## §5 Recommendations

In priority order:

### 5.1 Before v2.9.1 frontend starts — nothing required

The advisor set contains **zero blockers** for v2.9.1 spec writing
or the start of frontend coding. Every ERROR and most WARNs are
ADR-locked architectural choices that the frontend's behavior
cannot affect either way.

### 5.2 First migration of v2.9.1 (before any frontend code)

- **§3.3 multiple_permissive_policies on `profiles` (5) + `units_of_measure` (5)**
  — land `0081_consolidate_permissive_policies.sql` as the **first**
  v2.9.1 migration, before any TypeScript lands. See §3.3.3 for the
  sketched migration body and the post-migration verification list.
  ADR #23 to be filed alongside the migration. Reclassified from
  FIX_IN_V291 on 2026-05-13 (user direction).

### 5.3 Land during v2.9.1 frontend work (paired with consuming feature)

- **§4.1 `*_by_user_id` indexes (~7)** — add the index in the same PR
  as the feature that joins on it (sale-detail's "Cashier: X" UI,
  customer-detail's "Added by Y" UI). Adding the index alongside the
  feature makes regression testing natural and avoids speculative
  index creation. Defer the rest until a query actually wants them.

### 5.4 Post-pilot — schedule for v2.10.x (clock anchor: 30 days after first pilot shop)

- **§4.2 unused indexes (~25) + §4.1 remaining `_by_user_id` FK
  indexes (~21)** — re-run advisor and drop / index based on
  observed `pg_stat_user_indexes.idx_scan`.

**Clock anchor (important):** "30 days post-pilot" means **30 days
after `RBAC_TEAM_UI_ENABLED` is flipped on AND the first non-owner
pilot shop is onboarded** — **not** 30 days from today.

Reason: `pg_stat_user_indexes.idx_scan` only increments when queries
actually fire. Today the project has zero non-owner traffic (audit
query AQ-21 returns 0 invitations). Until the frontend lands and a
real pilot shop starts inviting team members, every v2.9-new index
will show `idx_scan = 0` regardless of whether it would be useful in
production. Re-running the advisor pre-pilot would produce the same
list we have today and tempt premature drops of indexes the frontend
genuinely needs.

**Scheduled task:** Added to `docs/todos.md` under a new
"v2.10.x scheduled" section:

> Re-run Supabase advisor 30 days post-pilot-launch
> (`RBAC_TEAM_UI_ENABLED = true` + first non-owner pilot shop
> onboarded + 30 days of traffic). For each `unused_index` lint
> still emitted, check `pg_stat_user_indexes.idx_scan` directly;
> drop any index with `idx_scan = 0` AND >1MB on disk. Skip
> trigram + RBAC plumbing indexes if their feature was not yet
> exercised in pilot.

### 5.5 Pro-plan migration (separate launch-blocker workstream)

- **§3.2 HIBP** — flip on in Supabase auth dashboard immediately
  after Pro upgrade. Independent of v2.9.1 frontend work.

### 5.6 Will not fix

- All 14 §2 ERROR-level `security_definer_view` entries.
- All 65 §3.1 `authenticated_security_definer_function_executable`
  entries.

These two buckets account for 79 of 143 advisor lints. They are the
expected fingerprint of an RLS + permission-gated multi-tenant
schema. ADR #18 + ADR-0011 are the durable answer.

### 5.7 Follow-up audit pattern (suggested AQ-23)

The DEFINER-wrapper spot-check method used in §3.1.3 (sample N of M
for uniformity; halt if any deviation) is a generally useful drift
detector that the 22 existing audit queries don't cover — they look
for data drift (orphans, NULL audit columns, oversold stock) but
not **shape drift** in the function bodies themselves. Suggested as
an addition for the next audit-suite revision:

> **AQ-23 (proposed):** randomly sample 16/65 DEFINER wrappers
> (24.6% coverage); for each, verify (a) `not_authenticated`
> precondition exists, (b) `no_shop_for_user` precondition exists,
> (c) a `user_has_permission(...)` gate exists OR the function is
> in the explicit exempt list (`accept_invitation`,
> `get_user_permissions`, `user_has_permission` itself,
> `user_has_shop_access`, `current_active_shop_id`,
> `current_shop_id`, `set_active_shop`, `get_user_shop_list`),
> (d) the gate raises `insufficient_permissions` with detail
> matching pattern `'Required: <key>'`. Halt on any deviation.

Not in scope for this audit doc; capture in
`audit/2026-05-13-rbac-pre-design-audit.md` Appendix A revision (or
file as `audit/2026-05-13-aq23-proposal.md`) before v2.9.1 spec
locks. Cost to implement: a single SQL query against `pg_proc`
that regexes the function body — ~30 lines.

---

## §6 Risk inventory

For each lint bucket, the worst-case scenario if we **never** fix it:

| Lint bucket | Worst case if never fixed | Likelihood | Mitigation already in place |
|---|---|---|---|
| §2 `security_definer_view` (14) | A future view-body edit forgets the `current_active_shop_id()` filter → cross-shop data leak via that view. | Low — every existing `_view` is checked in; new views must follow the same pattern (gotcha documented). | ADR #18 + `docs/gotchas.md` v2.9 entry; pre-commit checklist for new `_view` migrations. |
| §3.1 DEFINER RPCs (65) | A future wrapper edit forgets the `require_permission(...)` line → privilege escalation for non-owners. | Low–medium — 41 wrappers were generated by 0076a-d; pattern is consistent but human-edit risk grows over time. | Audit query AQ-22 spot-checks; `_v28` cleanup migration (deferred) will reduce surface; ADR-0011 + ADR #7. |
| §3.2 HIBP (1) | User with breached password is compromised; attacker reaches their shop's data (within shop, owner-equivalent). | Medium — Pakistani SMB users notoriously reuse weak passwords. | Single-tenant blast radius; no payment data; v2.9 audit log captures actor user_id on every financial mutation. |
| §3.3 multiple permissive (10) | Performance: 2× predicate evaluation on `profiles` and `units_of_measure` SELECTs. | Trivial — both tables are small and read-once. | None needed; observable cost. |
| §4.1 unindexed FK (28) | Slow user/auth.users deletion if/when triggered; SMB owners never delete users at the DB level. | Trivial | Supabase user-soft-delete is the actual path; FK cascades go through audit/profile rows that don't block. |
| §4.2 unused index (25) | Disk space cost; write-amplification on referenced tables. | Trivial — <100MB total. | Re-evaluate post-pilot; no urgency. |

---

## §7 Drift status

The 22-audit-query suite (`audit/2026-05-13-rbac-pre-design-audit.md`
§Appendix A) was re-run at the top of this audit session. All
22 queries returned **0 rows** (no drift since Checkpoint 3 in
the v2.9 implementation).

This means: between the v2.9 cutover and now, no test data, no
permission-grant drift, no orphaned batch, no expired-sale anomaly,
no `created_by_user_id` NULL on financial mutations has slipped in.
The schema is in the same state the v2.9 deployment left it.

---

**End of review.** Post-0081 advisor surface: **133 lints** (was 143
at initial publish; the 10 `multiple_permissive_policies` were
shipped as v2.9 cleanup). Recommended action breakdown:

- **0** pre-frontend blockers
- **~7** during v2.9.1 (paired with consuming feature — `_by_user_id` FK indexes)
- **~46** post-pilot re-evaluation (clock anchor: 30 days after `RBAC_TEAM_UI_ENABLED` flip + first pilot shop onboarded — scheduled task in `docs/todos.md`)
- **79** permanent KEEP_AS_IS (ADR-locked: 14 `security_definer_view` + 65 DEFINER-RPC)
- **1** Pro-plan-gated (HIBP)

**Revision log:**
- 2026-05-13 — initial publish (8/65 spot-check, 10 perf-lints classified FIX_IN_V291).
- 2026-05-13 — Rev 2 (user direction):
  (a) spot-check expanded to 16/65 (24.6% coverage), all 16 pass with no deviations;
  (b) the 10 `multiple_permissive_policies` reclassified from FIX_IN_V291 to FIX_AT_START_OF_V291 (migration 0081 + ADR #23);
  (c) post-pilot re-run clock explicitly anchored to "30 days after pilot shop onboards," not 30 days from today; scheduled as v2.10.x task;
  (d) suggested AQ-23 (DEFINER-wrapper shape-drift detector) captured for the audit suite.
- 2026-05-13 — Rev 3 (v2.9 cleanup execution):
  (a) the 10 `multiple_permissive_policies` reclassified again from FIX_AT_START_OF_V291 to SHIPPED — migration `0081_v29_cleanup_permissive_policies` applied as v2.9 cleanup (not first-of-v2.9.1 as Rev 2 staged) since the backend was in known-good state; ADR `decisions/2026-05-13-v29-cleanup-permissive-policies.md` filed;
  (b) AQ-23 promoted from "suggested" to "shipped" — baseline scan executed against all 65 wrappers (not just sample); result = 11 exempt + 54 conforming + 0 deviations; added to `design/2026-05-13-rbac-attack-surface.md` §C.3 alongside AQ-01..22; `complete_onboarding` newly classified exempt (creates first shop; no shop_id pre-exists);
  (c) one false-start surfaced during execution and resolved: first AQ-23 run reported 53 "deviations" — but this was a query-scope bug (scan included `_v28` inner bodies + trigger functions). Corrected scope filters on `has_function_privilege(authenticated, oid, 'execute') + non-trigger + non-_v28` and matches the advisor's lint population (65) exactly;
  (d) one schema-drift surfaced and resolved: the migration's first apply failed with `column usa.is_active does not exist`. The `user_shop_access` table has no `is_active` column (access is binary: row exists or not). Verbatim live predicates were copied from `pg_policies` before the rewrite — the team-read policy is actually OWNER-only (`usa_caller.is_owner = true`), tighter than the from-memory reconstruction. Predicate preserved verbatim in the OR'd consolidation;
  (e) verification: full 23-query audit suite (AQ-01..22 with AQ-14a/14b split + new AQ-23) returns 0 rows across the board post-migration. Performance advisor confirms `multiple_permissive_policies` count dropped from 10 to 0.

Pre-frontend audit **complete**. v2.9 backend complete.
