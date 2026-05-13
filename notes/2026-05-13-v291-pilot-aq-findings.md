# v2.9.1 Self-Pilot — Post-Pilot AQ Findings

**Date:** 2026-05-13
**Pilot log:** [v291-self-pilot-log.md](./v291-self-pilot-log.md)
**AQ suite:** `audit/2026-05-13-v291-phase-e-owner-synthetic-test.sql` §6 (AQ-01..AQ-24)
**Result:** 3 non-zero rows. AQ-05 is new (pilot-created); AQ-22 + AQ-23 are pre-existing soft-asserts.

> Note: the pilot doc refers to "17 daily AQs" — that count is pre-frontend and stale. The canonical v2.9.1 suite is **24 queries**. All three findings below were caught by queries that did not exist in the older 17-query suite, so they would have been missed entirely against the doc as written. Update the pilot log when convenient.

---

## AQ-05 — NEW, pilot-created (2 rows)

> Every invoice cashier exists in `user_shop_access` for the shop.

### Offending rows

| invoice_id | cashier_id | cashier_email | created_at |
|---|---|---|---|
| `270307db-7a0b-4ddd-92f0-db272755886c` | `27fbbc8f-…` | `muhammad.ali.dev97+manager@gmail.com` | 2026-05-13 13:57:13 UTC |
| `36906cf2-76c5-43c0-be43-e6638b28a5f4` | `27fbbc8f-…` | `muhammad.ali.dev97+manager@gmail.com` | 2026-05-13 13:51:04 UTC |

### Root cause

`revoke_user_access` (mig `0075_v29_new_rpcs.sql`) performs a hard `DELETE FROM user_shop_access`. The `user_shop_access` table has no `is_active` / `revoked_at` columns (verified via `information_schema.columns`), so revocation leaves no row to satisfy AQ-05's `EXISTS` predicate against historical invoices recorded by that user.

The two orphaned invoices were created during pilot Step 6 (manager workflow). At Step 7 (or later) the owner clicked "Revoke access" on the manager, which hard-deleted the `user_shop_access` row — instantly turning both invoices into AQ-05 violations.

**Not caused by today's two fixes** (`c860ffd` topo sort, `3195984` no_access_to_shop handler). This is a pre-existing v2.9 architectural gap that the pilot's first end-to-end revoke happened to surface.

### Resolution options

1. **Soft-delete refactor.** Add `is_active boolean default true` + `revoked_at timestamptz` to `user_shop_access`. `revoke_user_access` flips the flag instead of deleting. RLS policies and AQ-05 update to ignore inactive rows for write-side checks but treat them as legitimate for read-side audit-membership cross-references. Non-trivial — touches every RLS policy that joins on `user_shop_access`, plus `user_has_shop_access` / `current_active_shop_id` / `user_has_permission`.
2. **AQ-05 refinement.** Accept that a revoked user orphans their historical cashier rows. Refine AQ-05 to fail only when a *current* (active) member has an orphaned reference — i.e. the historical-orphan case is no longer a violation. Requires no schema change; weakens audit coverage but matches current implementation.

### Action

**Defer.** Per the v2.9.2 multi-target authorization rule (`decisions/2026-05-13-multi-target-authorization-rule.md`), neither change ships during the pilot. Decide between (1) and (2) afterward. Until then, AQ-05 = 2 is a known pilot-induced state.

---

## AQ-22 — pre-existing soft-assert (1 row)

> Every `preset_applied` action has a matching audit row with `action='preset_applied'`.

### Offending row

| user_id | preset_applied | is_owner | email |
|---|---|---|---|
| `6472366f-8f5a-40ba-b2b4-b348675020b3` | salesperson | false | `muhammad.ali.dev97+salesperson@gmail.com` |

### Root cause

`accept_invitation` (mig `0075_v29_new_rpcs.sql`) writes the audit row with `action='access_granted'`, carrying the resolved preset in `new_value.preset`. AQ-22 specifically looks for `action='preset_applied'`, which only `apply_preset_to_user` emits. Every successfully accepted invitation produces one AQ-22 row.

### Resolution options

1. Widen AQ-22 to accept `action='access_granted'` when `new_value->>'preset' = preset_applied`. Pure query change; no migration.
2. Modify `accept_invitation` to emit a second `action='preset_applied'` row. Migration; tighter symmetry with `apply_preset_to_user`.

### Action

File against follow-up tracker. Option 1 is the lighter fix and doesn't expand the audit table. No pilot impact.

---

## AQ-23 — pre-existing soft-assert (1 row)

> Every DEFINER wrapper granted to `authenticated` has all three guards (P1 `not_authenticated`, P2 `no_shop_for_user`, P3 `user_has_permission`) unless explicitly exempt.

### Offending row

| name | deviation_reason |
|---|---|
| `get_my_pending_invitation` | missing `no_shop_for_user` |

### Root cause

`get_my_pending_invitation` was added by mig `0090_v291_get_my_pending_invitation.sql` as a v2.9.1 hot-patch. It runs *before* the invitee has any shop access (called by `RequireOnboarded` to redirect to `/invite/accept` instead of `/onboarding`), exactly like `get_invitation_for_acceptance` (mig 0088) — which **is** in the AQ-23 exempt list.

`get_my_pending_invitation` was simply omitted from the exempt list. Same pre-shop helper category; same rationale.

### Resolution

Add `'get_my_pending_invitation'` to the exempt list in AQ-23 (both the SQL audit file and any inline rule docs). One-line change in `audit/2026-05-13-v291-phase-e-owner-synthetic-test.sql`; no migration.

`decisions/2026-05-13-v291-aq24-baseline-allowlist.md` is the v2.9.1 precedent for documenting this kind of allowlist addition — a parallel ADR for AQ-23 would help future maintainers.

### Action

Two-line fix (add to exempt list + ADR). No pilot impact.

---

## Summary

| Finding | Class | Pilot impact | Suggested follow-up |
|---|---|---|---|
| AQ-05 = 2 | architecture gap (new this pilot) | accepted; defer | choose between soft-delete refactor and AQ-05 refinement |
| AQ-22 = 1 | audit-shape mismatch (pre-existing) | none | widen AQ-22 query (1-line) |
| AQ-23 = 1 | exempt list omission (pre-existing) | none | add `get_my_pending_invitation` to exempt list (1-line) |
