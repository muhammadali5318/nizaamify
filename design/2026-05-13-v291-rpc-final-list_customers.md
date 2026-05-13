# Final production state: `list_customers`

Generated 2026-05-13 from `mcp__supabase__execute_sql` against project `orfggrnyychmmqdlbfhf`.

## Migration provenance

- **First introduced**: `0013_v14_partial_payments_and_customer_search.sql §6` — server-paginated customer list with computed `outstanding`, `invoice_count`, and `last_activity_at` columns. Used by `/customers` and the customer-picker recent fallback when search is empty.
- **Subsequent rewrites**:
  - `0020_v18_db_hardening.sql` — `search_path` hardening; revoke from anon.
  - `0021_v18a_revoke_public_execute.sql` — revoke public; grant authenticated.
  - (no functional rewrites between v1.4 and v2.9 — the SQL CTE-based body is stable)
  - `0076_v29_modify_existing_rpcs.sql §35` — **rename-and-wrap**: `ALTER FUNCTION ... RENAME TO list_customers_v28`; thin wrapper that does `not_authenticated`/`no_shop_for_user`/`view_customers` permission check. (superseded)
  - `0076b_v29_conditional_projection_and_caps.sql §3` — **(live)** wrapper rewritten to apply **conditional projection** on `phone`, `address` (gated by `view_customer_contact`) and `outstanding` (gated by `view_customer_outstanding`).
- **Final state**: post-0076b wrapper + the v1.4 `_v28` body (unchanged).

## Wrapper signature

```sql
CREATE OR REPLACE FUNCTION public.list_customers(
    p_query text DEFAULT ''::text,
    p_limit integer DEFAULT 25,
    p_offset integer DEFAULT 0
)
 RETURNS TABLE(
    id uuid, name text, phone text, address text,
    outstanding numeric, invoice_count bigint,
    last_activity_at timestamp with time zone, total_count bigint
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_can_see_contact boolean;
  v_can_see_outstanding boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_customers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_customers'; end if;
  v_can_see_contact := public.user_has_permission(v_shop_id, 'view_customer_contact');
  v_can_see_outstanding := public.user_has_permission(v_shop_id, 'view_customer_outstanding');
  return query
    select inner_t.id, inner_t.name,
           case when v_can_see_contact then inner_t.phone end,
           case when v_can_see_contact then inner_t.address end,
           case when v_can_see_outstanding then inner_t.outstanding end,
           inner_t.invoice_count, inner_t.last_activity_at, inner_t.total_count
      from public.list_customers_v28(p_query, p_limit, p_offset) inner_t;
end; $function$
```

## Inner `_v28` body

```sql
CREATE OR REPLACE FUNCTION public.list_customers_v28(
    p_query text DEFAULT ''::text,
    p_limit integer DEFAULT 25,
    p_offset integer DEFAULT 0
)
 RETURNS TABLE(
    id uuid, name text, phone text, address text,
    outstanding numeric, invoice_count bigint,
    last_activity_at timestamp with time zone, total_count bigint
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with shop as (select public.current_shop_id() as id),
  filtered as (
    select c.id, c.name, c.phone, c.address, c.created_at
    from public.customers c, shop
    where c.shop_id = shop.id
      and (
        coalesce(p_query, '') = ''
        or c.name ilike '%' || p_query || '%'
        or c.phone ilike '%' || p_query || '%'
      )
  ),
  agg as (
    select
      f.id,
      f.name,
      f.phone,
      f.address,
      f.created_at,
      coalesce(
        (select sum(case when type = 'debit' then amount else -amount end)
         from public.ledger_entries l where l.customer_id = f.id),
        0
      ) as outstanding,
      coalesce(
        (select count(*) from public.invoices i where i.customer_id = f.id),
        0
      ) as invoice_count,
      greatest(
        coalesce((select max(created_at) from public.invoices i where i.customer_id = f.id), 'epoch'),
        coalesce((select max(created_at) from public.ledger_entries l where l.customer_id = f.id), 'epoch'),
        f.created_at
      ) as last_activity_at
    from filtered f
  )
  select
    a.id, a.name, a.phone, a.address,
    a.outstanding, a.invoice_count, a.last_activity_at,
    (select count(*) from filtered) as total_count
  from agg a
  order by a.last_activity_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$
```

## Conditional projection map

The wrapper applies a `CASE WHEN <boolean> THEN inner_t.<col> END` to each gated column. There are **two** independent gates here, so a user can see contact but not outstanding (or vice versa).

| Column | Gated by | Behavior when caller lacks the permission |
|---|---|---|
| `id` | (none) | always returned |
| `name` | (none) | always returned |
| `phone` | `view_customer_contact` | NULL |
| `address` | `view_customer_contact` | NULL |
| `outstanding` | `view_customer_outstanding` | NULL |
| `invoice_count` | (none) | always returned (the count itself is not PII / financial detail) |
| `last_activity_at` | (none) | always returned |
| `total_count` | (none) | always returned (used for pagination) |

**Important**: the inner `_v28` body's `outstanding` is computed in PKR; a user with `view_customers` but without `view_customer_outstanding` sees `null` here. The `invoice_count` is left visible because it's a count, not a balance. Frontend UX: render "—" for null cells.

## Error envelope

| Where | Error message | errcode | When raised | Frontend UX mapping |
|---|---|---|---|---|
| wrapper | `not_authenticated` | P0001 | `auth.uid()` null | redirect to `/login` |
| wrapper | `no_shop_for_user` | P0001 | `current_active_shop_id()` returns null | redirect to `/onboarding` or shop switcher |
| wrapper | `insufficient_permissions` (detail: `Required: view_customers`) | P0001 | `user_has_permission(shop, 'view_customers')` false | toast per B.5 — `/customers` page should ideally hide search entry for non-permitted users |
| inner | (none) | — | inner is `LANGUAGE sql` — no `RAISE` possible. If `current_shop_id()` returns null, the result is zero rows. | n/a |

## Invocation contract

- **Params**:
  - `p_query text default ''` — empty string disables filter; non-empty is `ilike '%...%'` against `name` OR `phone`
  - `p_limit integer default 25` — clipped at `greatest(p_limit, 1)`
  - `p_offset integer default 0` — clipped at `greatest(p_offset, 0)`
- **Returns**: `TABLE(id uuid, name text, phone text, address text, outstanding numeric, invoice_count bigint, last_activity_at timestamptz, total_count bigint)`. `phone`+`address` masked when missing `view_customer_contact`; `outstanding` masked when missing `view_customer_outstanding`.
- **Permission gates**:
  - Wrapper: `view_customers` (always)
  - Wrapper: `view_customer_contact` (drives phone+address)
  - Wrapper: `view_customer_outstanding` (drives outstanding)
- **Side effects**: none (read-only)
- **Append-only constraints**: not applicable (read-only)

## Notes

- **`total_count` is computed inside the CTE** before pagination — every row in the result set carries the same `total_count` (the count of `filtered`). Frontend reads `total_count` from row 0 (or any row) for pagination.
- **`outstanding` is computed from `ledger_entries` directly** (not from `customers.outstanding_balance`). Sum of `debit - credit` over all ledger rows for that customer. This is the authoritative way to compute outstanding (the materialized `customers.outstanding_balance` is a trigger-maintained denormalization).
- **`last_activity_at` is the `greatest` of max-invoice-created, max-ledger-created, and `customers.created_at`**. Customers with no invoices and no ledger entries still sort by `created_at`, so newly-created customers land near the top.
- **Ordering**: `last_activity_at desc` — most recent activity first. Pagination is server-side via `limit/offset`.
- **`ilike '%' || p_query || '%'`** has no fuzzy / trigram matching — exact substring on `name` OR `phone`. For the v2.9 design this is intentional (the khata page has its own RPC with full-text matching).
- **Inner uses `current_shop_id()`** inside the `shop` CTE; the wrapper's `no_shop_for_user` check is the surfaced error.
- **Frontend masking UX**: when `phone` / `address` / `outstanding` are NULL, render "—" (em-dash) or hide the column entirely. The wrapper does not return a sentinel value — true NULL.

## Discrepancies vs RPC inventory

None. Inventory §1.4 entry for `list_customers` correctly enumerates:
- `view_customers` permission gate
- `phone`+`address` NULL when missing `view_customer_contact`
- `outstanding` NULL when missing `view_customer_outstanding`
- Migration 0076b as the source of the conditional projection
