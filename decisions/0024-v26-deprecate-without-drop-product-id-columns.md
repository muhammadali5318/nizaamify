# 0024 — Deprecate (don't drop) legacy product_id and products.* columns

**Date:** 2026-05-12
**Ticket:** v2.6
**Status:** Accepted

## Context

After v2.6, `sale_items` / `purchase_items` / `product_packs` carry both
`variant_id` (canonical) and `product_id` (now denormalized). On `products`,
the `stock` / `price` / `cost` / `avg_cost` / `last_purchase_cost` columns
became redundant when ADR-0022 moved them to `product_variants`. We had to
decide what to do with the old columns.

The naive choice is "drop them in the same migration." That's wrong for two
reasons:

1. **External consumers we don't control.** Legacy reports, ad-hoc SQL,
   possibly external dashboards may still reference `products.stock` /
   `sale_items.product_id`. Dropping them mid-migration breaks reads with
   no warning.
2. **Rollback insurance.** If v2.6 turns up a critical bug in production
   and we have to revert the function rewrites, the old columns + the old
   `product_id` references on transaction tables are the only path back
   to a working system.

## Decision

Keep both sets of columns. Specifically:

**Transaction tables (`sale_items`, `purchase_items`, `product_packs`):**
- `variant_id` is NOT NULL, FK to `product_variants`. Writers MUST pass it.
- `product_id` stays NOT NULL but is automatically kept in sync from
  `variant_id` by the `sync_product_id_from_variant` trigger (one trigger
  per table, installed in migration 0040). New writers ignore product_id;
  the trigger fills it.

**`products` table:**
- `stock`, `price`, `cost`, `avg_cost`, `last_purchase_cost` stay as columns
  but are **not** kept in sync with the variant. Variant is the source of
  truth. Reads via the `product_with_default_variant` compat view see the
  variant's values; direct reads against `products.*` see whatever was there
  before v2.6.

When the cleanup migration runs (target: v2.8 or v3.0 after v2.7 is fully
stabilized), it will:
1. Audit every codepath for `*.product_id` references on the three transaction
   tables and replace them with `variant_id` joins.
2. Drop the sync trigger.
3. Drop `*.product_id` from `sale_items`, `purchase_items`, `product_packs`.
4. Drop `products.stock` / `products.price` / `products.cost` /
   `products.avg_cost` / `products.last_purchase_cost`.
5. Drop the deprecated `products.type` column (already deferred from v2.5).

## Alternatives considered

1. **Drop immediately in v2.6.** Rejected: breaks external consumers; loses
   the rollback path.
2. **Keep products columns in sync via trigger.** Rejected: the variant
   layer needs to be the source of truth for v2.7 multi-variant cases, where
   "the product's stock" is a derived sum. Maintaining sync would require
   choosing which variant's number wins, which is the bolt-on bug from
   ADR-0022.
3. **Drop products.* but keep transaction product_id.** Rejected: half-done
   migration. Either commit to the rename or don't.

## Consequences

- One trigger per transaction table fires on every INSERT / UPDATE. The
  trigger is read-only on `product_variants` and writes only `NEW.product_id`,
  so the per-row overhead is one lookup. v2.6 §10's "performance benchmark"
  acceptance criterion exists to catch any regression — current data volumes
  (≤ 100k transactions / shop) are well within margin.
- The `products` table's deprecated columns will drift from reality the
  moment v2.7 multi-variant products land. Reports that read them directly
  WILL show wrong numbers. CLAUDE.md gotcha documents this; the
  `product_with_default_variant` view is the documented read path for
  v2.5-era code.
- The cleanup migration is on the open-todo list. It's risky enough that
  it needs its own pass after v2.7 has been running in production for a
  while.

## References

- ADR-0022 (template/variant architecture)
- ADR-0023 (default variant pattern)
- Migrations: 0039 (transaction tables get variant_id), 0040 (sync trigger)
- `MVP_v2.6_VARIANT_REFACTOR.md` §2.8, §2.9, §10
