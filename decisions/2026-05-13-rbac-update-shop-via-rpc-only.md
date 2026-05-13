# 2026-05-13 — Shop settings editable only via `update_shop_settings` RPC

## Context

Audit Phase C surfaced F-NEW-02: under Rev 1's `shops_owner_update`
policy (`for update using (owner_user_id = auth.uid())`), an owner
could overwrite `shops.owner_user_id` to a stranger via a direct
PostgREST `from('shops').update({owner_user_id: '<stranger>'})` call.
This is a covert ownership-transfer path that bypasses any audit
trail.

Rev 2 §B.4.2 locked the closure: drop the broad `shops_owner_update`
policy and route every shop edit through an `update_shop_settings`
RPC whose parameter list does not include `owner_user_id`.

## Decision

1. Drop `shops_owner_update` policy on the `shops` table. The v2.8.5
   policy remains during stabilization (additive); 0077 drops it.
2. Create `update_shop_settings(p_shop_name text, p_shop_address text,
   p_shop_phone text, p_shop_type text, p_default_expiry_alert_days int,
   p_default_warranty_alert_days int, p_default_expired_sale_policy
   expired_sale_policy, p_expired_sale_receipt_disclaimer boolean,
   p_salesperson_payment_cap_pkr numeric)` RPC. Each parameter is
   nullable; the RPC body uses `coalesce` to skip unset ones. No
   `owner_user_id` parameter exists.
3. Defense in depth: `revoke update (owner_user_id) on public.shops
   from authenticated;` so that even if a future policy mistake admits
   direct UPDATE, the `owner_user_id` column can't be the target.

Migrations 0073 (RLS additions + column-level revoke) and 0075
(`update_shop_settings` RPC) deliver this design.

## Alternatives considered

1. **Keep the `shops_owner_update` policy; rely on UI to never expose
   owner_user_id editing.** Rejected — the threat model assumes
   devtools / direct PostgREST access; UI gating is insufficient.
2. **Add an UPDATE trigger that blocks owner_user_id changes.**
   Considered. Equivalent in effect to the column revoke, but more
   code and an extra trigger. Rejected as redundant.
3. **Allow owner_user_id changes only via a separate
   `transfer_ownership` RPC.** Deferred to v2.10+. The audit-trail
   work and atomic-cutover semantics for ownership transfer are
   non-trivial; not v2.9 scope.

## Consequences

- All shop edits go through one RPC. Easier to audit (`actor_user_id`
  on the future audit table; not yet implemented).
- The `shops.owner_user_id` column is functionally read-only for
  authenticated users.
- Ownership-transfer workflow remains a v2.10+ ticket. Until then,
  ownership is set once at `complete_onboarding` time and cannot
  change.
- The audit `F-NEW-02` finding from Phase C is closed.

Related: Phase C `F-NEW-02` (`design/2026-05-13-rbac-attack-surface.md`
§C.4), [[2026-05-13-rbac-permission-model-over-roles]].
