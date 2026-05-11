-- v2.6 §B2 — Backfill one default variant per product.
--
-- Every existing product (active or archived) gets exactly one variant
-- carrying its current stock / price / cost / avg_cost / last_purchase_cost.
-- is_default = true so the v2.6 compat view + record_sale/record_purchase
-- fallback path can find it.
--
-- Archived products get an archived variant (is_active = product.is_active)
-- so that history-bearing rows on sale_items / purchase_items always have
-- a matching default variant in the next migration's backfill — even if the
-- product was soft-deleted years ago.
--
-- Audit checkpoint 1 (run after this migration applies):
--   select p.id, count(v.id)
--   from public.products p
--   left join public.product_variants v
--     on v.product_id = p.id and v.is_default
--   group by p.id
--   having count(v.id) <> 1;
-- Must return zero rows.

insert into public.product_variants (
  product_id, sku, stock, price, cost, avg_cost, last_purchase_cost,
  is_default, is_active
)
select
  p.id,
  null::text,                              -- SKUs land in v2.7
  p.stock,
  p.price,
  case when p.cost = 0 then null else p.cost end,
  coalesce(p.avg_cost, 0),
  p.last_purchase_cost,
  true,
  p.is_active
from public.products p
where not exists (
  select 1 from public.product_variants v
   where v.product_id = p.id and v.is_default
);

-- Eager audit so the migration itself fails loud if the backfill missed
-- anything (per CLAUDE.md "Append-only triggers block backfill UPDATEs"
-- discipline — fail at migration time, not after deploy).
do $$
declare v_mismatched int;
begin
  select count(*) into v_mismatched
    from (
      select p.id
        from public.products p
        left join public.product_variants v
          on v.product_id = p.id and v.is_default
       group by p.id
      having count(v.id) <> 1
    ) bad;
  if v_mismatched > 0 then
    raise exception 'v26_default_variant_audit_failed: % product(s) with <> 1 default variant', v_mismatched;
  end if;
end$$;
