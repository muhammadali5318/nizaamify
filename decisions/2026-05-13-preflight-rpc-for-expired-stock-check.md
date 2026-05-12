# Pre-flight RPC for the expired-stock policy check

**Date:** 2026-05-13 (v2.8.4)
**Status:** Accepted

## Context

The POS needs to render the block-error dialog or the warn-confirmation
dialog **before** submitting `record_sale`. Two ways to get there:

1. **Submit-and-handle-error.** Call `record_sale`; if it raises
   `expired_stock_blocked` or `expired_stock_needs_confirmation`, render
   the appropriate dialog and (for warn) re-submit with
   `p_confirm_expired_sale = true`.
2. **Pre-flight RPC.** A separate read-only function
   (`preflight_expired_sale_check`) that, given the cart items, returns
   one row per variant with `would_draw_expired`, `expired_batch_ids`,
   and the resolved `policy`. POS renders the dialog directly on the
   pre-flight result and only calls `record_sale` once the user
   confirms (or cancels).

## Decision

**Pre-flight RPC.** The render-dialog-before-submit UX is the goal —
"your sale just failed because of expired stock" is a worse experience
than "we noticed before submitting, would you like to confirm." The
trade-off is one extra RPC round-trip per submit, which is acceptable
for POS volumes.

The RPC is read-only (`SECURITY DEFINER` for the shop-id resolution but
no writes), gates on `products.has_batches = true` per item (non-batched
items always return `would_draw_expired = false`), and returns
`expired_batch_ids` as an empty array `'{}'` when nothing is expired so
the client never has to null-check the array.

`record_sale` still enforces the policy server-side as the
authoritative gate — the pre-flight is purely a UX optimization.

## Alternatives considered

1. **Single submit-and-handle-error path.** Forces every warn-mode
   confirmation into a failed-then-retried RPC. The visible UX is worse
   (the cashier sees a transient red state), and the inner transaction
   rolls back twice for what is functionally a single user decision.
2. **Embedding the pre-flight inside `record_sale` as a "dry-run" mode**
   (e.g. `p_dry_run = true`). Conflates two responsibilities; the
   pre-flight returns *table* data while record_sale returns a UUID,
   and the SQL would branch on the flag in awkward ways.
3. **Client-side check using a cart-level batch query.** Possible —
   the data is readable via RLS — but duplicates the FEFO + policy
   logic on the client. Two implementations diverge over time.

## Consequences

- `preflight_expired_sale_check(p_items jsonb) returns table (variant_id
  uuid, would_draw_expired boolean, expired_batch_ids uuid[], policy
  public.expired_sale_policy)` is the single client-facing surface.
  Grants follow the v1.8 hardening pattern: `revoke from public, anon;
  grant to authenticated`.
- `usePreflightExpiredSaleCheck` is a `useMutation` (not `useQuery`) —
  it fires on demand at submit, not on every cart change.
- Race: between pre-flight and `record_sale`, a concurrent sale could
  consume non-expired stock, flipping a `would_draw_expired = false`
  into a true. `record_sale` will raise
  `expired_stock_needs_confirmation` in that case; POSPage catches that
  and re-opens the warn dialog. No silent expired-stock sale.
- Pre-flight failure (network or policy error) is non-blocking: POSPage
  falls through to `record_sale`, which still enforces the policy. The
  worst outcome is one round-trip error rather than two.
