# v2.9.1 — AQ-05 audit-history exception for revoked cashiers

**Status:** Filed (post-pilot)
**Date:** 2026-05-13
**Related:** `audit/2026-05-13-v291-phase-e-owner-synthetic-test.sql`, `notes/2026-05-13-v291-pilot-aq-findings.md`, migration `0075_v29_new_rpcs.sql` (revoke_user_access)

## Context

AQ-05 asserts: *every invoice cashier exists in `user_shop_access` for the shop.* The original query reads only the **current** membership table, so any cashier whose access was revoked breaks the EXISTS predicate — even though revocation is a legitimate, supported flow.

`revoke_user_access` (mig 0075) implements revocation as a hard `DELETE FROM user_shop_access`. The table has no `is_active` / `revoked_at` columns; once revoked, the row is gone. This was intentional in v2.9 (simplicity), with the trade-off accepted that the strict reading of AQ-05 would flag historical orphans.

The v2.9.1 self-pilot exercised this for the first time end-to-end. The owner revoked the manager (`+manager@`) after two recorded invoices, and AQ-05 went from 0 → 2. Both rows traced to the same legitimate revoke, not data loss.

The audit table `user_shop_permission_audit` survives revocation (it's append-only, not cascaded). For every revoked user, the audit chain ends with `action='access_revoked'` (emitted by `revoke_user_access`'s wrapper).

## Decision

Refine AQ-05 to accept historical orphans **only when the audit log records the legitimate revocation**:

```sql
and not exists (
  select 1 from public.user_shop_permission_audit uspa
  where uspa.target_user_id = i.cashier_id
    and uspa.shop_id = i.shop_id
    and uspa.action = 'access_revoked')
```

The cashier-with-no-membership-row case now splits in two:

| audit lineage | reading |
|---|---|
| has `access_revoked` for the shop | history; AQ-05 passes |
| no `access_revoked` for the shop | true orphan; AQ-05 fails |

This keeps the failure mode AQ-05 was designed to catch (a `cashier_id` written by a non-member — RPC bypass, broken FK, mis-typed UUID) while admitting the legitimate revoke flow.

## Alternatives considered

1. **Soft-delete refactor.** Add `is_active boolean default true` + `revoked_at timestamptz` to `user_shop_access`. `revoke_user_access` flips the flag; AQ-05 ignores inactive rows. Cleaner end-state but non-trivial — every RLS policy that joins on `user_shop_access` (and every helper: `user_has_shop_access`, `current_active_shop_id`, `user_has_permission`) needs an `is_active = true` predicate. Deferred to v2.10 per the multi-target authorization rule; should not ship during pilot.
2. **Drop AQ-05 entirely.** Rejected — the audit is one of the few defenses against a buggy RPC writing a cashier_id for a non-member.
3. **Accept any access-related audit row** (`access_granted`, `preset_applied`, `permission_granted`). Rejected — `access_revoked` is the precise signal; the others would admit a user who was *granted* access (so the row should exist) but somehow has no membership row anyway, which is the failure mode AQ-05 is meant to catch.

## Consequences

- AQ-05 now passes for legitimately-revoked users with historical invoices. The two pilot orphans (manager's `36906cf2-…` and `270307db-…`) move from "halt criterion" to "history".
- Any new failure mode that produces a cashier_id with no membership row and no `access_revoked` audit row will still be caught — including the case where someone bypasses `revoke_user_access` and DELETEs the row directly, since the audit row is only written by the RPC.
- **TODO(v2.10):** replace audit-row exception with `usa.is_active=false` check after soft-delete refactor ships as part of contacts unification. The soft-delete columns (`is_active`, `revoked_at`) land alongside v2.10 Phase A's `user_shop_access` RLS touch for contacts — one careful design pass instead of two. When that ships, this query simplifies to `where not (usa exists and usa.is_active)` and the audit-history clause is removed. TODO comment in the SQL file mirrors this.
- AQ-05 remains a hard-assert (halt criterion, not soft-assert) — the refined predicate is still strict enough to be load-bearing for audit defense.
