-- v2.6c — generated outstanding column on invoices.
--
-- SalesListPage was computing `Math.max(0, Number(total) - Number(amount_paid))`
-- per row in JS — violates no-JS-Number-on-money. Adding a STORED generated
-- column means the value is computed in Postgres at insert time and exposed
-- through `select * from invoices` without a join.
--
-- amount_paid is sealed by the v1.8 append-only trigger after insert
-- (financial_records_immutable), so the generated column never needs to
-- recompute post-insert.
--
-- DDL ADD COLUMN bypasses the BEFORE UPDATE trigger — the back-fill of
-- existing rows happens as part of the schema change, not as a normal
-- UPDATE on each row.

alter table public.invoices
  add column if not exists outstanding numeric(12,2)
    generated always as (greatest(0::numeric(12,2), total - coalesce(amount_paid, 0))) stored;
