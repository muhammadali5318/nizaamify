# 2026-05-13 — `cashier_role` snapshot column dropped under permission model

## Context

Phase B Rev 1 (role-based) §B.3.2 proposed adding `invoices.cashier_role
text` and `purchases.cashier_role text` columns. The idea: snapshot the
role tag at sale / purchase time so future audit lookups would show
"this sale was made by a manager" even if that user later got promoted
or demoted.

Phase B Rev 2 (permission-based) pivoted to grant-level permissions
with no fixed roles. Three system presets exist (Owner / Manager /
Salesperson) but they're starting templates only; per-user permissions
diverge from preset over time.

## Decision

Drop the `cashier_role` snapshot column entirely. `invoices.cashier_id`
(existing v2.8.5 column) is retained — it points to `profiles(id)`.

Audit reconstruction for "what permissions did this user have at sale
time" goes through `user_shop_permission_audit`:

```sql
-- Sample audit reconstruction (for a single sale)
with sale as (
  select cashier_id, shop_id, created_at as t
    from public.invoices where id = '<invoice_id>'
)
select pc.key,
       coalesce(
         (select uspa.new_granted
            from public.user_shop_permission_audit uspa
            where uspa.shop_id = sale.shop_id
              and uspa.target_user_id = sale.cashier_id
              and uspa.permission_key = pc.key
              and uspa.changed_at <= sale.t
            order by uspa.changed_at desc
            limit 1),
         false) as had_permission_at_sale_time
  from sale, public.permissions_catalog pc;
```

The reconstruction is heavier than reading a snapshot column, but the
data is complete (audit log persists every change with `changed_at`),
and the cost is paid only when an audit investigation runs (rare,
manual).

## Alternatives considered

1. **Snapshot `preset_applied` instead of role.** Considered. The
   preset is set at invitation time and modified by `apply_preset_to_user`.
   Doesn't track per-permission deviations. Rejected — too imprecise
   to be useful for forensic audit.
2. **Snapshot the full permission set as JSONB on the invoice.** Bloats
   every invoice row with 50-key JSONB ≈ 1.5KB. For a shop doing 200
   sales/day, that's 11MB/year of redundant data. Rejected — the audit
   log already captures every change with timestamps.
3. **Keep the column but populate from `user_shop_access.preset_applied`
   at sale time.** Half-measure. The preset name diverges from actual
   permissions after manual overrides; the snapshot would mislead.
   Rejected.

## Consequences

- `invoices` and `purchases` retain only `cashier_id`. No
  `cashier_role` / `cashier_preset` / `cashier_permissions_snapshot`
  column.
- The team UI in Phase E shows audit-time data inline on sale-detail:
  "Sold by Asad on 2026-05-13 14:23." If the owner needs to know what
  permissions Asad had at that moment, the audit log is the source.
- Phase B Rev 1's §B.3.2 column adds (`invoices.cashier_role`,
  `purchases.cashier_role`) are explicitly NOT in the v2.9 migration
  set.
- Decision D26 from Phase B B.1.2 is OVERRIDDEN by the permission-
  model pivot. Per Rev 2 §B.1.4 supersession table.

Related: [[2026-05-13-rbac-permission-model-over-roles]],
[[2026-05-13-rbac-presets-as-templates]].
