# Warn as the default expired-sale policy

**Date:** 2026-05-13 (v2.8.4)
**Status:** Accepted

## Context

With the three-mode enum (see
[expired-sale-policy-three-modes](2026-05-13-expired-sale-policy-three-modes.md)),
new shops need a default. Three candidates:

- `block` — strictest. Refuses every expired-stock sale outright.
- `warn` — cashier confirms before drawing from expired stock.
- `allow` — silent (v2.8 behavior).

## Decision

**Default is `warn`.** A shop that turned on `has_batches` is signaling
that expiry matters — `allow` is the v2.8 behavior they implicitly accepted
only because no alternative existed. `block` is too strict as a default;
a cosmetics shop legitimately wants to sell a foundation that expired
yesterday at a discount, and a hard block forces a write-off-then-restock
loop that doesn't match reality.

`warn` puts the decision in the cashier's hands at the moment that
matters — the register — and snapshots the outcome via `sold_expired`
on `sale_items` for after-the-fact audit. The shop owner is the
governance, not the schema.

## Alternatives considered

1. **`block` as default.** Safer in the abstract, but trades real
   transactions for a write-off cycle in shops that can legitimately
   sell expired stock. Pharmacies will override to block at the shop
   level anyway.
2. **`allow` as default.** Preserves v2.8 silence, which is exactly
   what the v2.8.4 ticket exists to fix.
3. **Default at first per-product creation, none at shop level.** Adds
   per-product friction at scale (500 SKUs × explicit policy each is
   tedious). Shop default + per-product override mirrors the v2.8
   alert-window pattern, which works well.

## Consequences

- `shops.default_expired_sale_policy` ships with `NOT NULL DEFAULT 'warn'`.
  Existing shops (pre-v2.8.4) inherit `warn` automatically; no
  per-row backfill needed.
- `products.expired_sale_policy` is nullable; null falls back to the
  shop default via `coalesce(...)`. This means turning the shop default
  from `warn` to `block` retroactively tightens every product that
  hasn't been overridden, which is the user-intuitive outcome.
- A pharmacy customer can override the shop default to `block` and
  set the receipt disclaimer on; per-product overrides handle
  exceptions (e.g. expired but still-saleable items).
- v2.8.4 spec §6 manual test 6.1 verifies the resolution order.
