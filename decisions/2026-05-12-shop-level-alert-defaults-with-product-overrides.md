# Shop-level alert defaults with per-product overrides

**Date:** 2026-05-12 (v2.8)
**Status:** Accepted

## Context

Different shops have different alert tolerances:
- Cosmetics shop: 30 days to expiry is the right window.
- Dairy / fast-perishable shop: 7 days is more useful.
- Mobile-panel shop: 30 days for supplier-warranty-expiring is fine.

Within a shop, different products may also need different windows: a
medicine product might warrant a 60-day alert while a cosmetic stays
at 30.

## Decision

Two-level configuration:

1. **Shop default** — `shops.default_expiry_alert_days` (default 30) and
   `shops.default_warranty_alert_days` (default 30). Configurable in
   Settings.
2. **Per-product override** — `products.expiry_alert_days` and
   `products.warranty_alert_days`. Nullable; null means "use shop default."

Alert views (`batches_expiring_soon`, `batches_warranty_expiring_soon`)
use `coalesce(product.x_alert_days, shop.default_x_alert_days)` so the
override applies automatically.

## Alternatives considered

1. **Shop-only setting** — too coarse; can't tune the medicine vs.
   cosmetic case above.
2. **Per-batch override** — too granular; would invite "I forgot to set
   this on this batch" support tickets.
3. **No alerts** — would still ship batch tracking but rely on the user
   to remember to check expiries. Defeats one of the main value props.

## Consequences

- Views compute on read — changing shop defaults retroactively re-evaluates
  every batch. No backfill needed.
- The product detail edit form surfaces the override fields when
  `has_batches = true` with placeholder text indicating the shop default.
- The settings page exposes both shop defaults in a single section.
- If a user sets a per-product override that equals the shop default,
  the override stays in place (we don't auto-clear). Slightly redundant
  data but simpler mental model.
