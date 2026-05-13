# 2026-05-13 — `archive_product` permission gated via BEFORE-UPDATE trigger

## Context

`archive_product` is a separate permission from `edit_product`. The
distinction: edit_product covers name / description / price changes,
archive_product covers the `is_active = false` toggle. RLS gates rows,
not columns; we can't write a SELECT/UPDATE policy that says "this
column requires archive_product but everything else requires
edit_product."

## Decision

A BEFORE UPDATE trigger `v29_products_archive_gate` (Phase B §B.4.3,
implemented in 0073) fires per row on `products` UPDATE. Body:

```sql
if OLD.is_active is distinct from NEW.is_active then
  if not public.user_has_permission(NEW.shop_id, 'archive_product') then
    raise exception 'insufficient_permissions'
      using errcode = 'P0001',
            detail = 'is_active toggle requires archive_product permission';
  end if;
end if;
return NEW;
```

This fires only when `is_active` actually changes. Other UPDATEs pass
through unchanged (gated by the broader `edit_product` RLS policy).

Same pattern applied for `assign_customer_tier` via
`v29_customers_tier_change_gate` on the `customers` table.

## Alternatives considered

1. **Column-level RLS via PostgreSQL policy `WITH CHECK (column =
   OLD.column OR has_permission)`.** Not supported in standard RLS;
   policies operate on row predicates, not column-level diffs.
2. **Make archive_product a function-only operation** (`archive_product(p_id)`
   RPC). Rejected — would force every "archive" call to be an RPC
   call, inconsistent with the rest of edit_product's direct-DML
   pattern.
3. **Conflate the two permissions.** Rejected — owner asked for the
   granularity ("split read from write per resource"; archive is a
   distinct action from edit).

## Consequences

- Two new BEFORE-UPDATE triggers (one on products, one on customers).
- Both trigger functions are DEFINER, search_path pinned, revoked
  from authenticated.
- Per-row evaluation cost is negligible (a single
  `user_has_permission` call on rows where the gated column actually
  changes).
- If a future migration adds another column requiring a separate
  permission, follow the same trigger pattern.

Related: [[2026-05-13-rbac-permission-model-over-roles]],
[[2026-05-13-rbac-50-permission-catalog]].
