-- v2.6c — extend purchase_item_financials with effective line_overhead.
--
-- The frontend was falling back to (overhead_per_unit × qty_in_base) for
-- legacy v1.x rows where line_overhead_amount = 0. That arithmetic happened
-- in JS, violating no-JS-Number-on-money. Push the fallback into the view
-- so the frontend reads a single effective `line_overhead` column.
--
-- Effective overhead = line_overhead_amount if > 0, else legacy fallback.
-- For new rows (v2.3+) the fallback branch is never taken because
-- record_purchase always populates line_overhead_amount via largest-remainder.

drop view if exists public.purchase_item_financials cascade;
create view public.purchase_item_financials
with (security_invoker = true) as
select
  pi.id as purchase_item_id,
  pi.purchase_id,
  pi.variant_id,
  pi.product_id,
  pi.qty,
  pi.qty_in_base,
  pi.cost_at_purchase,
  pi.pack_id,
  pi.pack_qty,
  pi.pack_base_qty_snapshot,
  pi.line_overhead_amount,
  pi.overhead_per_unit,
  pi.avg_cost_before,
  pi.avg_cost_after,
  -- Subtotal: invoiced units × cost. For pack lines, the pack_qty is the
  -- invoiced unit-count; for base-unit lines, qty IS the invoiced count.
  (coalesce(pi.pack_qty, pi.qty) * pi.cost_at_purchase)::numeric(12,2)
                                                   as line_subtotal,
  -- v2.6c: effective overhead = line_overhead_amount if > 0 else legacy
  -- per-unit fallback. All numeric arithmetic stays in Postgres.
  case
    when pi.line_overhead_amount > 0 then pi.line_overhead_amount
    else (coalesce(pi.overhead_per_unit, 0) * pi.qty_in_base)
  end::numeric(12,2)                               as line_overhead,
  -- Cost delta (avg_cost_after − avg_cost_before). NULL on legacy rows
  -- where either side wasn't snapshotted.
  case
    when pi.avg_cost_before is null or pi.avg_cost_after is null then null
    else (pi.avg_cost_after - pi.avg_cost_before)::numeric(12,2)
  end                                              as cost_delta
from public.purchase_items pi;
