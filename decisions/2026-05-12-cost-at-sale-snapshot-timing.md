# `cost_at_sale` snapshot timing

**Date:** 2026-05-12
**Ticket:** v2.6 hardening (Stage 2 folded-in scope)
**Status:** Accepted — verified against migration 0041

## Context

`sale_items.cost_at_sale` is the cost-of-goods snapshot at the moment of
sale. Subsequent purchases that update a variant's `avg_cost` must NOT
retroactively change the historical sale's profit calculation. The
snapshot integrity is what makes per-sale profit numbers stable across
time.

Three sub-questions:

1. Is the snapshot taken AFTER the `FOR UPDATE` lock on
   `product_variants` (race-safe vs. concurrent stock-ins)?
2. Is the snapshot taken from `product_variants.avg_cost` (v2.6 source
   of truth) and NOT from the deprecated `products.avg_cost`?
3. Is the snapshot frozen — never recomputed after the `sale_items`
   insert?

## Decision

Verified directly against migration `0041_v26_record_sale.sql`:

### 1. Snapshot is taken AFTER the FOR UPDATE lock

Lines 197-202:

```sql
select v.id, v.stock, v.avg_cost, v.price as variant_price, p.shop_id,
       p.id as product_id
  into v_variant
  from public.product_variants v
  join public.products p on p.id = v.product_id
 where v.id = v_resolved_variant_id and v.is_active
 for update;
```

The `select ... for update` reads `v.avg_cost` AND acquires the variant
row lock in the same statement. The value cannot change between the
read and the subsequent `sale_items` insert because the row is locked
for the rest of the transaction. Concurrent `record_purchase` calls on
the same variant block on this lock until the sale transaction commits.

### 2. Snapshot reads from `product_variants.avg_cost`, not `products.avg_cost`

Line 199: `from public.product_variants v`. The deprecated
`products.avg_cost` column (kept for back-compat per ADR-0024) is
never read in `record_sale`. Single source of cost = the variant.

### 3. Snapshot is frozen after the insert

Line 227-233:

```sql
insert into public.sale_items (
  invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
  line_discount_type, line_discount_value, line_discount_amount
) values (
  v_invoice_id, v_variant.id, v_qty, v_price, v_variant.avg_cost,
  ...
);
```

`v_variant.avg_cost` is the value captured at line 197 above. After
insert, the variant's `avg_cost` may be re-computed by subsequent
`record_purchase` calls (which lock the variant, recompute the weighted
average, and write it back). Those future writes do NOT touch
`sale_items` — the snapshot is invariant. Also enforced by the v1.8
append-only trigger `sale_items_no_modify` on UPDATE/DELETE: even a
malicious direct UPDATE on the snapshot would be rejected.

## Alternatives considered

1. **Read `avg_cost` without `FOR UPDATE`.** Rejected. A concurrent
   `record_purchase` could change the variant's avg_cost between read
   and insert, producing a snapshot that doesn't match the stock state
   at sale time.
2. **Compute a fresh avg_cost from purchase history at sale time.**
   Rejected. The variant's running `avg_cost` is the right number — it
   reflects every prior purchase including overhead allocation per v2.3.
   Recomputing is redundant and slower.
3. **Store `cost_at_sale` as a foreign key to a `cost_history` table.**
   Massive over-engineering. The snapshot column is exactly what's
   needed: cheap to query, immutable by trigger, and audit-grade.

## Consequences

- Sale profit numbers are stable. A sale recorded today at avg_cost
  100, then a stock-in tomorrow that raises avg_cost to 110, then a
  view of today's sale tomorrow — still shows cost_at_sale = 100.
- The `invoice_financials` view's `total_cost` is the sum of
  `sale_items.cost_at_sale × qty`. Same snapshot integrity carries
  through.
- Any future write path that bypasses `record_sale` and writes
  `sale_items` directly MUST mirror this discipline (lock variant, read
  avg_cost, freeze in insert). The append-only trigger prevents
  post-insert mutation regardless.

## References

- Migration `0041_v26_record_sale.sql:197-233`
- ADR-0007 (original sale/purchase SQL functions)
- ADR-0011 (intentional SECURITY DEFINER)
- ADR-0024 (deprecate-without-drop product_id columns)
- v1.8 `sale_items_no_modify` append-only trigger
