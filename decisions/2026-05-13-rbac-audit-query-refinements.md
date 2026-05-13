# 2026-05-13 — Audit query refinements for AQ-13 and AQ-14

## Context

During Day 0 verification (post-migration 0076) the full audit-query
suite from Phase C §C.3 was run. 18 of 20 queries returned zero rows;
**AQ-13 returned 1 row** and **AQ-14 returned 2 rows**. Investigation
showed both are FALSE POSITIVES caused by audit-query design issues
that pre-existed v2.9; the underlying data is correct.

Per Phase D deploy discipline ("Pause if any audit query returns
non-zero rows during stabilization; root cause documented in
decisions/ before remediation"), this ADR documents the analysis and
the refinements applied.

## AQ-13 analysis

Original query (from Phase C §C.3):

```sql
select p.id, p.name, p.shop_id
  from public.products p
 where not exists (select 1 from public.product_variants v
                    where v.product_id = p.id and v.is_active);
```

**Intent:** every product should have at least one active variant
(v2.6 invariant per ADR-0022).

**False positive found:** product `614801bd-9129-40c3-8b09-0895c76e0f61`
("New product"), `is_active = false`, 1 inactive variant.

**Analysis:** the product itself is archived (`is_active = false`).
The variant is correctly also inactive. **An inactive product is
allowed to have inactive variants** — that's the normal soft-delete
state. The query failed to filter the parent by `is_active = true`.

**Refinement (locked):**

```sql
-- AQ-13 refined: only flag ACTIVE products with no active variant
select p.id, p.name, p.shop_id
  from public.products p
 where p.is_active = true
   and not exists (select 1 from public.product_variants v
                    where v.product_id = p.id and v.is_active);
```

Refined query returns **0 rows** post-verification.

## AQ-14 analysis

Original query (from Phase C §C.3):

```sql
select p.id, p.name
  from public.products p
 where p.has_batches = true
   and p.is_active = true
   and not exists (
     select 1 from public.product_variants v
     join public.inventory_batches b on b.variant_id = v.id
     where v.product_id = p.id and b.is_active);
```

**Intent:** every batched product should have at least one active
batch row (v2.8 invariant).

**False positives found:**

1. Product `fa86ff8d-...` ("QA284-G Warn Eyeliner (only expired)"):
   `has_batches = true`, `is_active = true`, 1 inactive batch (history),
   0 active batches. The batch was auto-deactivated when `qty_remaining`
   hit 0 per the v2.8.2 trigger `batch_auto_deactivate_when_empty`.
   This is the normal "all stock sold" state.
2. Product `53d2fc9d-...` ("CA shoes"): `has_batches = true`,
   `is_active = true`, 0 total batches. Created 2026-05-11 with
   `has_batches = true` but never stocked in. This is the legitimate
   v2.8.1 "save first, then stock-in" workflow (per ADR
   `2026-05-12-pricing-decoupled-from-product-creation.md`).

**Analysis:** the v2.8 invariant "every batched product has at least
one batch row" was implicitly relaxed by v2.8.1's decoupling of stock
creation from product creation, and by v2.8.2's auto-deactivation when
batches sell out. AQ-14 was defined in Phase C without accounting for
these post-v2.8 state transitions.

**Refinement (locked):**

AQ-14 is **demoted from regression-blocking to informational**. The
two states it catches are both legitimate:
- Recently-created batched products before first stock-in.
- Fully-sold-out batched products whose last batch auto-deactivated.

Neither represents data corruption.

The replacement is two narrower queries that catch genuine integrity
issues:

```sql
-- AQ-14a: batched products NEVER stocked in but older than 30 days
-- (suggests stale product definition — investigation, not corruption)
select p.id, p.name, p.created_at
  from public.products p
 where p.has_batches = true
   and p.is_active = true
   and p.created_at < now() - interval '30 days'
   and not exists (
     select 1 from public.product_variants v
     join public.inventory_batches b on b.variant_id = v.id
     where v.product_id = p.id);

-- AQ-14b: orphan batches whose variant or product was deleted
-- (FK should prevent but verify)
select b.id from public.inventory_batches b
  left join public.product_variants v on v.id = b.variant_id
  left join public.products p on p.id = v.product_id
 where v.id is null or p.id is null;
```

AQ-14a is informational (returns rows for cleanup investigation, not
data corruption). AQ-14b is a true integrity check (should always
return 0).

## Decision

1. Update Phase C §C.3 AQ-13 to include `p.is_active = true` filter.
2. Demote AQ-14 to informational; replace regression-blocking version
   with AQ-14a (informational) and AQ-14b (regression).
3. Re-run AQ-13 (refined) — confirmed 0 rows.
4. Update `docs/gotchas.md` to note that v2.8.1's "save first" workflow
   means batched products can legitimately have zero batches until
   first stock-in.

## Alternatives considered

1. **Treat as data corruption; fix the offending rows.** Rejected —
   the rows reflect legitimate workflow states (archived product,
   sold-out batches, pre-stock-in product). Modifying them would
   break audit trails.
2. **Add a `batches_have_been_stocked_in` flag to products.** Over-
   engineered for the small population of affected products. Would
   require backfilling and re-orienting the auto-deactivate trigger.
3. **Drop AQ-14 entirely.** Considered but AQ-14b catches a real
   integrity case (orphan batches via FK violation). Keep that piece.

## Consequences

- Phase C §C.3 documentation updated with AQ-13 refined + AQ-14
  split into AQ-14a (informational) + AQ-14b (regression).
- Audit suite size grows from 22 to 23 queries (AQ-14 became two).
- Stabilization week proceeds with refined queries.
- No data modification required.
- `docs/gotchas.md` gets a one-line entry: "AQ-14 was originally a
  strict v2.8 invariant; v2.8.1 + v2.8.2 changes relaxed it. Refined
  2026-05-13."

Related: ADR `2026-05-12-pricing-decoupled-from-product-creation.md`,
ADR `2026-05-12-partial-writeoff-and-auto-deactivate.md`.
