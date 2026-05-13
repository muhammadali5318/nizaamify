# 2026-05-13 — `record_sale` wrapper enforces discount caps + implicit-discount + confirm_expired

## Context

Phase B §B.2.4 + Phase B §B.5.1 + Phase D §D.6 (F-PD-03, F-PD-11)
lock three new checks for `record_sale`:

1. **Per-line and per-invoice discount caps** (per `user_shop_access.discount_limits`).
2. **Implicit-discount check** when `price_at_sale < variant.price`
   (F-PD-03). Forces the cap to apply even when the cashier "discounts
   via low price" rather than via an explicit discount field.
3. **`confirm_expired_sale_at_pos` permission gate** in the
   warn-policy branch (F-PD-11). The cashier may set
   `p_confirm_expired_sale = true` only if they hold this permission.

Migration 0076 (rename-and-wrap) added the basic permission check.
0076b extends the wrapper with the three new checks.

## Decision

The `record_sale` wrapper (rewritten in 0076b) executes the three new
checks BEFORE delegating to the inner `record_sale_v28` body:

```pseudocode
1. AUTH + SHOP + record_sale permission check (existing from 0076).
2. Read caller's user_shop_access.is_owner and discount_limits.
3. For each item in p_items:
   a. Compute explicit per-line discount % and PKR amount.
      Raise discount_exceeds_line_pct_limit / discount_exceeds_line_pkr_limit
      if non-owner exceeds limit.
   b. If variant_id resolvable AND variant.price > 0:
      Compute implicit_discount_pct = (1 - price_at_sale / variant.price) * 100.
      Raise implicit_discount_exceeds_line_pct_limit if non-owner exceeds limit.
4. Compute per-invoice discount %:
   - 'percent' → use p_sale_discount_value as-is.
   - 'fixed' → divide by items_subtotal.
   Raise discount_exceeds_invoice_pct_limit / discount_exceeds_invoice_pkr_limit
   if non-owner exceeds limit.
5. If p_confirm_expired_sale = true AND caller lacks confirm_expired_sale_at_pos:
   Raise insufficient_permissions.
6. Delegate to record_sale_v28 (the v2.8.5 body, unchanged).
```

Owner bypasses all four cap checks via `is_owner = true`. Non-owners
hit each check; any failure raises before the inner is reached.

## Alternatives considered

1. **Modify record_sale_v28 inner body to add the checks.** Rejected.
   The inner body is 15.5KB of v2.8.5 logic; adding new checks
   increases the blast radius. Wrapper-level checks are surgical.
2. **Validate only explicit discounts, ignore implicit.** Rejected.
   F-PD-03 explicitly required closure; a salesperson with a 5%
   per-line cap could ring up free items by setting `price_at_sale = 0`.
3. **Treat all discounts identically (no separate implicit check).**
   Considered. The implicit check uses the same cap value as the
   explicit per-line cap, but reads from `variant.price` not from
   `line_discount_value`. Keeping them as separate checks lets the
   error message differentiate so the cashier knows which input to
   adjust. Adopted.
4. **Make confirm_expired_sale_at_pos a record_sale-gating permission
   independent of warn policy.** Rejected — the permission is only
   meaningful when the policy is 'warn' (under 'block' the policy
   denies anyway; under 'allow' no confirmation needed). Gating
   only on `p_confirm_expired_sale = true` is precise.

## Consequences

- Four new error codes raised by record_sale:
  - `discount_exceeds_line_pct_limit`
  - `discount_exceeds_line_pkr_limit`
  - `discount_exceeds_invoice_pct_limit`
  - `discount_exceeds_invoice_pkr_limit`
  - `implicit_discount_exceeds_line_pct_limit`
  - `insufficient_permissions` (with `Required: confirm_expired_sale_at_pos`)
- The inner `record_sale_v28` body is unchanged. The wrapper does all
  the new gating.
- Phase D §C.4 F-PD-03 and F-PD-11 are closed.
- Audit query AQ-09 (Phase C §C.3) continues to verify historical
  data does not show cap exceedances.

Related: [[2026-05-13-rbac-receive-payment-cap-applies-to-all-non-owners]],
[[2026-05-13-rbac-permission-model-over-roles]].
