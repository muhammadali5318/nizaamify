# Batches and serials are mutually exclusive per product

**Date:** 2026-05-12 (v2.8)
**Status:** Accepted

## Context

v2.8 introduces `products.has_batches` (per-product opt-in for batch tracking).
v2.9 will introduce `products.has_serials` (every individual unit uniquely
identified via IMEI / serial number). The two represent different ways of
identifying inventory and should not coexist on the same product:

- **Batched** — many identical units grouped by batch (same expiry, same
  supplier warranty window). FEFO at sale time. Cosmetics, food, medicines,
  generic LCD panels.
- **Serialized** — each unit is one-of-one. Sale picks a specific IMEI.
  Premium electronics.

A "batched + serialized" product doesn't fit either model: serial implies
unit-level identity, batch implies grouped identity.

## Decision

`has_batches` and `has_serials` are mutually exclusive at the **application
layer**. v2.8 only has `has_batches`; v2.9 will add `has_serials` and the
mutual-exclusion enforcement (UI radio + RPC guard).

For v2.8 there's nothing to enforce because the second flag doesn't exist.
Document the rule so v2.9 inherits the constraint.

## Alternatives considered

1. **DB-level CHECK constraint** — `not (has_batches and has_serials)`.
   Rejected for v2.8: the second column doesn't exist yet. v2.9 should
   add it together with the constraint in one migration.
2. **Allow both** — would require modeling a "serialized batch" — every
   serial belongs to a batch, batch carries expiry, serial overrides cost.
   Out of scope for current MVP; would double the complexity of FEFO,
   record_sale, and the audit suite. Revisit only if a real customer needs it.

## Consequences

- v2.9 must add `has_serials` and the mutual-exclusion constraint together.
- Product form's "Inventory behavior" section is a two-radio group when
  v2.9 ships (none / batches / serials). For v2.8 it's a single toggle.
- The audit suite gains a query that no product has both flags true
  (zero rows) when v2.9 lands.
