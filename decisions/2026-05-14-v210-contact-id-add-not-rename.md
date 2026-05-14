# 2026-05-14 — v2.10 `contact_id` is a new column, not a rename

**Status:** Accepted
**Phase:** v2.10 Phase C (implementation-sequence correction, surfaced
while writing migration 0098)
**Supersedes:** the `RENAME COLUMN` framing in the first draft of
`design/2026-05-14-v210-contacts-model-design.md §2` and
`design/2026-05-14-v210-contacts-implementation-plan.md §1` (both patched
in the same commit as this ADR).

## Context

The v2.10 contacts unification replaces `customers` + `suppliers` with a
single `contacts` table. Four tables reference the legacy entities:
`invoices.customer_id`, `ledger_entries.customer_id`,
`purchases.supplier_id`, `inventory_batches.supplier_id`.

The Phase B design docs, drafted before the migration sequence was
written out in SQL, described the transition as an in-place
`ALTER TABLE … RENAME COLUMN customer_id TO contact_id` (and likewise for
`supplier_id`), with `ALTER INDEX … RENAME` to follow. While writing
migration 0098 this was found to be both internally inconsistent and
incorrect on the merits:

1. **Internally inconsistent.** `implementation-plan.md §1` had migration
   0098 do `ADD COLUMN contact_id`, while `model-design.md §2` had
   migration 0100 do `RENAME COLUMN customer_id TO contact_id`. You
   cannot both add a column named `contact_id` and later rename another
   column to the same name — the second statement fails on a name
   collision.

2. **Incorrect on the merits.** The 0099 backfill creates `contacts` rows
   with fresh `gen_random_uuid()` ids. It also merges a supplier into an
   existing customer's contact row when their `(shop_id, phone)`
   collides — the migration-time form of the L3 promotion flow. As a
   result the legacy `customer_id` / `supplier_id` UUID values do **not**
   map 1:1 to the resolved `contacts.id`: in the merge case a
   `purchases.supplier_id` pointing at the old supplier's id has no
   corresponding `contacts` row at all (the supplier was absorbed into
   the customer's contact id). An in-place rename would leave the column
   holding ids that cease to exist once `customers` / `suppliers` are
   dropped in 0106.

## Decision

`contact_id` on all four dependent tables is a **new column**, added by
migration 0098, distinct from the legacy `customer_id` / `supplier_id`
columns. It is explicitly backfilled by migration 0099 (which resolves
each legacy id to its unified contact, including the merge case). The
legacy columns — with their indexes and FK constraints — are dropped in
migration 0104, before the legacy tables are dropped in 0106.

Column lifecycle:

| Stage | Migration | Action |
|---|---|---|
| Add | 0098 | `ADD COLUMN contact_id` (new, nullable, FK → `contacts`; `ON DELETE RESTRICT` for `purchases`, `NO ACTION` elsewhere, matching each legacy FK) |
| Backfill | 0099 | populate `contact_id` by resolving legacy ids → unified contact |
| Collateral | 0100 | `direction`, `amount_paid`, cap column, `contact_id` indexes, `NOT NULL` swap onto `ledger_entries.contact_id` |
| Drop legacy | 0104 | drop `customer_id` / `supplier_id` columns + indexes + FKs |

This changes **no locked B.0–B.6 decision**. It is purely an
implementation-sequence correction; the unified-contacts model, the
unified ledger, the permission catalog, and every other Phase B
decision are untouched.

## Alternatives considered

1. **In-place `RENAME COLUMN` (the original draft).** Rejected: fails in
   the supplier-merge case as described above, and would also require
   the backfill to preserve legacy ids as `contacts.id` — impossible
   when two legacy rows (a customer and a supplier) merge into one
   contact.

2. **Preserve legacy ids as `contacts.id` for the non-merge case, rename
   in place, special-case only the merges.** Rejected: a hybrid that is
   harder to reason about and test than a uniform "new column +
   explicit backfill" approach, for no benefit. The backfill has to run
   either way.

3. **Keep both columns forever (never drop the legacy ones).** Rejected:
   violates L9 (clean break — `customers` / `suppliers` tables dropped,
   all code migrates to `contacts`). Dead columns pointing at dropped
   tables would also fail AQ-style FK-integrity checks.

## Consequences

- Migration 0098 is `ADD COLUMN` only — additive, low-risk, no renames,
  no drops, no index changes. Applied to staging 2026-05-14.
- Migration 0099 must perform a real backfill (not a no-op even on the
  currently-empty staging DB) and must be replayable against an
  environment that still holds legacy rows. This is the first high-risk
  migration in the chain (backfill + `ledger_entries_immutable`
  append-only trigger interaction); it gets a dedicated review
  checkpoint.
- Migration 0104 gains responsibility for dropping the legacy
  `customer_id` / `supplier_id` columns (plus their indexes and FKs),
  which must happen before the 0106 table drop.
- During the 0098→0104 window, the dependent tables carry **both** the
  legacy column and `contact_id`. RPCs rewritten in 0102/0103 write
  `contact_id`; the legacy columns are frozen (no new writes) from 0103
  onward. This dual-column window is expected and bounded.
- The Phase B design docs (`model-design.md §2`,
  `implementation-plan.md §1`) were patched in the same commit as this
  ADR so no committed artifact references the obsolete RENAME framing.
