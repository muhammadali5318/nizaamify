# v2.6b audit query suite — three new financial integrity audits

**Date:** 2026-05-12
**Ticket:** v2.6 hardening (Stage 2 folded-in scope)
**Status:** Accepted

## Context

v2.6 §6 shipped six audit queries (default-variant integrity + variant_id
backfill correctness). After the profit-bug forensic uncovered drift
between `invoices.total` (write side) and the recomputed revenue formula
(read side), three additional audits are warranted to catch future
financial-integrity regressions early.

## Decision

Three new audits to run alongside the v2.6 §6 set. All nine must return
zero rows after every migration:

### Audit 7 — stored_total ≡ post_discount_items + service_charge

```sql
select count(*) from (
  select if2.invoice_id
  from public.invoice_financials if2
  where abs(if2.stored_total - (if2.post_discount_items + if2.service_charge))
        > 0.01
) x;
```

Catches divergence between `record_sale`'s `i.total` write and the
view-side recomputation. 1¢ tolerance for the unlikely cumulative-rounding
edge case. Today: zero rows.

### Audit 8 — invoice_financials math sanity

```sql
select count(*) from public.invoice_financials
where revenue < 0 or total_cost < 0 or gross_profit > revenue;
```

Trip-wire for impossible numbers: negative revenue or cost, or a profit
larger than the revenue it came from. Today: zero rows.

### Audit 9 — ledger debit ≡ invoice outstanding

```sql
select count(*) from public.ledger_entries le
join public.invoices i on i.id = le.invoice_id
where le.type = 'debit'
  and abs(le.amount - (i.total - i.amount_paid)) > 0.01;
```

Confirms each invoice's outstanding-balance debit matches
`i.total − i.amount_paid` exactly. Catches partial-payment / void
regressions before they corrupt customer khata. Today: zero rows.

## Alternatives considered

1. **Compute as a CHECK constraint on invoices.** Rejected — CHECK
   constraints can't reference other tables; the audit math depends on
   `sale_items`. A trigger could enforce it, but a periodic audit catches
   the same drift with no write-path cost.
2. **A materialized audit_results table refreshed nightly.** Considered
   for visibility but rejected for now — the audit queries are sub-second
   on current volumes; CRON the snapshot once we have a dashboard
   surface for them.
3. **Run these in CI on every migration.** Worth doing but out of
   scope. The CLAUDE.md update notes the existence of the audit suite so
   the next Claude session knows to run it manually after schema or RPC
   changes.

## Consequences

- The migration cycle gains a documented audit gate. Nine queries
  (six v2.6 §6 + three new). Zero rows required.
- Any future Stage that touches `record_sale`, `record_purchase`,
  `ledger_entries`, or invoice math runs these queries before declaring
  done. The audit query bundle lives in the open-todo list as a CI
  candidate.
- If a future migration introduces a new financial table (e.g., refunds,
  tax line items), extend this audit suite accordingly.

## References

- `decisions/2026-05-12-invoice-financials-single-source-of-truth.md`
- `MVP_v2.6_VARIANT_REFACTOR.md` §6 (the original six)
- `decisions/0015-v18-database-hardening.md` (the audit discipline)
