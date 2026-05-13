# 2026-05-12 v2.9.0.1 frontend sweep — minimal Plan A + customer-delete removal

## Context

v2.9 server-side (migrations 0068–0083) removed direct write
permissions on a small set of tables — most notably `customers`
(no INSERT, no DELETE policy) and `shops` (no UPDATE policy at all
per ADR #17 / F-NEW-02). The intent was that writes against those
tables flow through the DEFINER wrapper RPCs that carry permission
gates + audit-column writes.

The frontend predates that migration. v2.9.1 was supposed to do
the matching call-site sweep on the frontend as part of its
`customFetch` + team-page + permission-conditional-rendering
work. v2.9.1 hasn't started yet.

The first real authenticated client traffic after the post-wipe
new-owner onboarding surfaced **four** distinct regressions in
quick succession:

1. RLS recursion in `user_shop_access` policy (`42P17`) — fixed
   2026-05-12 in migration 0083 by dropping the inline-EXISTS team-
   read policy on `profiles`. Proper restore via a DEFINER helper
   is queued for v2.9.1.
2. SQL grouping error in `current_active_shop_id()` fallback path
   (`42803`) — fixed in migration 0085 (`array_agg` instead of
   `min(uuid)`/bare `shop_id`).
3. `42501` row-level-security violation on `customers` INSERT —
   hot-patched the same session by routing
   `useCreateCustomer` to `create_customer_full` RPC.
4. (anticipated) `42501` on `shops` UPDATE from the alerts /
   expired-sale-settings hooks — anticipated from inventory pass,
   confirmed by reading the policy set.

The inventory pass found:
- **3 broken paths** (Group A: customer INSERT, two `shops` UPDATEs)
- **1 design gap** (Group B: `customers` DELETE has no policy and
  no RPC)
- **11 working-as-is paths** (Group C: tables that kept their
  v2.9 write policies — owners pass via implicit shortcut)

The 11 Group C paths do NOT write the `_by_user_id` audit columns
that the wrapper RPCs would. That audit-coverage gap remains a
v2.9.1 follow-up; this ADR explicitly accepts it for now.

## Decision

**Plan A (minimal) sweep + option (b) for the DELETE gap.**

- Migrate the 3 Group A call sites to the matching DEFINER RPCs.
  - `useCreateCustomer` → `create_customer_full`
  - `useUpdateShopAlertDefaults` → `update_shop_settings`
    (passes `p_default_expiry_alert_days` +
    `p_default_warranty_alert_days`)
  - `useUpdateShopExpiredSaleSettings` → `update_shop_settings`
    (passes `p_default_expired_sale_policy` +
    `p_expired_sale_receipt_disclaimer`)
- Resolve Group B by **removing the delete UI**:
  - Delete `useDeleteCustomer` hook from
    `src/features/customers/hooks.ts`.
  - Strip the corresponding trash-icon column, `ConfirmDialog`,
    `useDeleteCustomer` import, and `onDelete` handler from
    `CustomersListPage.tsx`.
- Leave the 11 Group C paths untouched. Each one is admitted by a
  v2.9 RLS policy that gates on a permission the owner has via
  implicit shortcut. They work today; their migration to RPCs
  (for `_by_user_id` audit writes) is paired with the broader
  v2.9.1 frontend ticket.

## Alternatives considered

1. **Plan B — migrate every UPDATE path to RPCs too.** Rejected.
   ~150-LOC churn across ~7 files for an audit-coverage win that
   v2.9.1 was already committed to doing in context. Pulling
   forward into v2.9.0.1 risks rushed work and a poor
   intermediate state.
2. **Customer DELETE option (a) — add `customers.is_active` +
   `deactivate_customer` RPC.** Rejected. Soft-delete vs
   hard-delete vs khata-impact vs reactivation are coupled
   decisions that belong with the v2.10 customer-management
   ticket alongside returns/refunds/warranty work. Adding a
   half-resolved soft-delete now pre-commits one design path.
3. **Customer DELETE option (c) — hard-delete RPC gated on
   `manage_customers` with FK-cascade checks.** Rejected for the
   same reason as (a), and because hard-delete is rarely the
   right answer once ledger history exists.
4. **Block the broken paths client-side without server changes.**
   Rejected. The user is actively testing; pulling the broken
   buttons out of the UI without re-enabling the equivalent
   functionality (where one exists) is worse UX than the
   route-to-RPC patch.

## Consequences

**Positive:**
- Owner workflows for customer create, shop alert settings, and
  expired-sale settings work end-to-end.
- The Group A migrations earn `_by_user_id` audit-column writes
  via the wrappers' post-delegation UPDATEs (per the v2.9 audit
  pattern in migration 0080).
- The DELETE button on `CustomersListPage` no longer raises a
  silent `42501` — it simply isn't present.

**Negative / accepted:**
- The 11 Group C UPDATE paths do NOT yet write `_by_user_id`
  audit columns. Forensic reconstruction for those entities will
  show NULLs for `updated_by_user_id` on rows updated in this
  window. The v2.9.1 sweep restores this.
- Customer deletion is unavailable until v2.10. UI shows view +
  edit only.
- The audit `_by_user_id` gap means the AQ-suite cannot
  retroactively verify "every UPDATE row has audit". We accept
  this until v2.9.1.

## Discipline lesson

**Backend RPC migrations that remove or tighten RLS policies on
write-target tables MUST land in the same ticket as the
corresponding frontend call-site sweep.** Treating them as
sequential ("backend now, frontend later") creates a window where
the frontend works against a non-existent schema. v2.9 hit this
window because:

- No real authenticated client traffic exercised the new RPCs
  before the cutover (the synthetic test in 0076b used
  `set_config('request.jwt.claims', ...)` inside a transaction,
  which doesn't switch role and skips the planner path real
  clients use).
- The "v2.9.1 frontend is a separate ticket" framing felt natural
  but obscured the load-bearing dependency: removing INSERT/
  DELETE policies on `customers` and the FOR-ALL policy on
  `shops` was breaking change to the existing client.

For v2.10+ work, the rule is: **any migration that drops a
write-target policy must include the matching call-site sweep
PR**, not file a follow-up.

Recorded as a forward-looking rule in `docs/gotchas.md`.

## Bookkeeping

- Migrations 0082, 0083, 0084, 0085 (already filed) — backend
  hot-patches.
- This ADR — frontend sweep.
- `tasks.md` — customer deactivation/delete deferred to v2.10
  customer-management ticket.
- `docs/gotchas.md` — "no customer-delete in v2.9 frontend"
  one-paragraph note + the forward-looking discipline rule.
- All 23 audit queries return 0 post-sweep; synthetic test pass
  green under `SET ROLE authenticated` for all three migrated
  paths.
