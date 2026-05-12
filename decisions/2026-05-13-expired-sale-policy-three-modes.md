# Expired-sale policy as a three-mode enum (block / warn / allow)

**Date:** 2026-05-13 (v2.8.4)
**Status:** Accepted

## Context

v2.8 introduced batch tracking with FEFO; v2.8.3 made expired-with-stock
batches visible. The remaining gap was selling-time enforcement — FEFO
silently drew from expired batches. v2.8.4 closes that gap.

How shops want to handle expired sales splits into categorically different
behaviors:

- A pharmacy never wants to sell expired stock — the answer is "no, even
  if the shop owner clicks yes."
- A cosmetics shop wants the cashier to confirm at the register — usually
  the answer is no, but a clearance-bin foundation can legitimately ship.
- A clearance-only outlet wants the v2.8 silent behavior — expired stock
  is the product line.

Two ways to model that:

1. A **numeric strictness level** (1–5, or a single "strictness" slider).
2. An **enum** of categorically named modes.

## Decision

**Enum: `('block', 'warn', 'allow')`.** Three named modes, settable at
the shop level (`shops.default_expired_sale_policy`, NOT NULL DEFAULT
`warn`) and overridable per product (`products.expired_sale_policy`,
nullable — null means "use shop default").

The names map 1:1 to the three behaviors:

- `block` → FEFO excludes expired batches; sale fails if non-expired
  stock is insufficient.
- `warn` → FEFO excludes expired batches by default; cashier confirms
  to extend to expired stock if non-expired runs out.
- `allow` → FEFO treats expired batches like any other (v2.8 behavior).

Effective policy resolves via
`coalesce(product.expired_sale_policy, shop.default_expired_sale_policy, 'warn')`.

## Alternatives considered

1. **Numeric strictness level.** Ambiguous at the UI ("what does 3 mean?").
   The three behaviors aren't on a continuum — there's no "30% block,
   70% warn." Adding a fourth or fifth value (auto-discount, batch-confirm)
   is also a fresh decision, not an extension along the same axis.
2. **A single boolean `allow_expired_sales`.** Collapses block + warn
   into a no/yes binary, which loses the "warn with confirmation" middle
   ground — the most useful default.

## Consequences

- The enum is exported in `src/types/database.ts` and consumed by the
  product edit form, settings page, and POS dialogs.
- `record_sale` and `preflight_expired_sale_check` accept the enum
  through the standard `coalesce` resolution; no per-callsite branching
  on a strictness threshold.
- A future "pharmacy mode" can layer on top of the enum by defaulting
  the shop's policy + receipt disclaimer + audit settings to block-flavored
  values; the enum doesn't need to change to support it.
- See companion ADRs: [warn-as-default](2026-05-13-warn-as-default-policy.md),
  [preflight-rpc](2026-05-13-preflight-rpc-for-expired-stock-check.md),
  [sold_expired-snapshotted](2026-05-13-sold-expired-flag-snapshotted-not-derived.md),
  [receipt-disclaimer-opt-in](2026-05-13-receipt-disclaimer-opt-in.md).
