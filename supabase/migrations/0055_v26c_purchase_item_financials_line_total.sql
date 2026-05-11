-- v2.6c — add line_total to purchase_item_financials.
--
-- Final no-JS-Number-on-money push: the purchase detail page was summing
-- `Number(line_subtotal) + Number(line_overhead)` in JS for the line total
-- column. Push the sum into the view so the page reads a single column.
--
-- All three computed money columns (line_subtotal, line_overhead, line_total)
-- are numeric(12,2) and computed in Postgres.

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
  (coalesce(pi.pack_qty, pi.qty) * pi.cost_at_purchase)::numeric(12,2) as line_subtotal,
  (case
    when pi.line_overhead_amount > 0 then pi.line_overhead_amount
    else (coalesce(pi.overhead_per_unit, 0) * pi.qty_in_base)
   end)::numeric(12,2) as line_overhead,
  ((coalesce(pi.pack_qty, pi.qty) * pi.cost_at_purchase)
    + (case
        when pi.line_overhead_amount > 0 then pi.line_overhead_amount
        else (coalesce(pi.overhead_per_unit, 0) * pi.qty_in_base)
       end))::numeric(12,2) as line_total,
  case
    when pi.avg_cost_before is null or pi.avg_cost_after is null then null
    else (pi.avg_cost_after - pi.avg_cost_before)::numeric(12,2)
  end as cost_delta
from public.purchase_items pi;
