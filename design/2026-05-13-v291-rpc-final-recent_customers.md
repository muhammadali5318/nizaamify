# Final production state: `recent_customers`

Generated 2026-05-13 from `mcp__supabase__execute_sql` against project `orfggrnyychmmqdlbfhf`.

## Migration provenance

- **First introduced**: `0013_v14_partial_payments_and_customer_search.sql §5` — empty-state default for the customer picker. Returns top N customers ordered by most-recent-activity (invoice or ledger entry or `created_at`).
- **Subsequent rewrites**:
  - `0020_v18_db_hardening.sql` — `search_path` hardening; revoke from anon.
  - `0021_v18a_revoke_public_execute.sql` — revoke public; grant authenticated.
  - (no functional rewrites between v1.4 and v2.9)
  - `0076_v29_modify_existing_rpcs.sql §34` — **rename-and-wrap**: `ALTER FUNCTION ... RENAME TO recent_customers_v28`; thin wrapper with `view_customers` permission check. (superseded)
  - `0076b_v29_conditional_projection_and_caps.sql §4` — **(live)** wrapper rewritten to apply **conditional projection** on `phone`, `address` (gated by `view_customer_contact`). Per the migration comment header, this gap was discovered at Checkpoint 2 (recent_customers had been missed in the initial 0076b draft alongside list_customers). No `outstanding` column on this RPC, so no `view_customer_outstanding` gate.
- **Final state**: post-0076b wrapper + the v1.4 `_v28` body (unchanged).

## Wrapper signature

```sql
CREATE OR REPLACE FUNCTION public.recent_customers(p_limit integer DEFAULT 10)
 RETURNS TABLE(
    id uuid, name text, phone text, address text,
    last_activity_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_can_see_contact boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_customers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_customers'; end if;
  v_can_see_contact := public.user_has_permission(v_shop_id, 'view_customer_contact');
  return query
    select inner_t.id, inner_t.name,
           case when v_can_see_contact then inner_t.phone end,
           case when v_can_see_contact then inner_t.address end,
           inner_t.last_activity_at
      from public.recent_customers_v28(p_limit) inner_t;
end; $function$
```

## Inner `_v28` body

```sql
CREATE OR REPLACE FUNCTION public.recent_customers_v28(p_limit integer DEFAULT 10)
 RETURNS TABLE(
    id uuid, name text, phone text, address text,
    last_activity_at timestamp with time zone
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with shop as (select public.current_shop_id() as id)
  select
    c.id, c.name, c.phone, c.address,
    greatest(
      coalesce((select max(created_at) from public.invoices i where i.customer_id = c.id), 'epoch'),
      coalesce((select max(created_at) from public.ledger_entries l where l.customer_id = c.id), 'epoch'),
      c.created_at
    ) as last_activity_at
  from public.customers c, shop
  where c.shop_id = shop.id
  order by last_activity_at desc
  limit greatest(p_limit, 1);
$function$
```

## Conditional projection map

| Column | Gated by | Behavior when caller lacks the permission |
|---|---|---|
| `id` | (none) | always returned |
| `name` | (none) | always returned |
| `phone` | `view_customer_contact` | NULL |
| `address` | `view_customer_contact` | NULL |
| `last_activity_at` | (none) | always returned |

There is no `outstanding` column on this RPC's shape (unlike `list_customers`), so no `view_customer_outstanding` gate is needed at the wrapper.

## Error envelope

| Where | Error message | errcode | When raised | Frontend UX mapping |
|---|---|---|---|---|
| wrapper | `not_authenticated` | P0001 | `auth.uid()` null | redirect to `/login` |
| wrapper | `no_shop_for_user` | P0001 | `current_active_shop_id()` returns null | redirect to `/onboarding` or shop switcher |
| wrapper | `insufficient_permissions` (detail: `Required: view_customers`) | P0001 | `user_has_permission(shop, 'view_customers')` false | toast per B.5; ideally the picker hides the recent-customers list entirely for non-permitted users |
| inner | (none) | — | inner is `LANGUAGE sql` — no `RAISE`. Null `current_shop_id()` produces zero rows. | n/a |

## Invocation contract

- **Params**:
  - `p_limit integer default 10` — clipped at `greatest(p_limit, 1)`
- **Returns**: `TABLE(id uuid, name text, phone text, address text, last_activity_at timestamptz)`. `phone` + `address` are NULL when caller lacks `view_customer_contact`.
- **Permission gates**:
  - Wrapper: `view_customers` (always)
  - Wrapper: `view_customer_contact` (drives phone+address)
- **Side effects**: none (read-only)
- **Append-only constraints**: not applicable (read-only)

## Notes

- **Default empty-state behavior of the customer picker**: when the user opens the picker with no query, this RPC returns the most-recently-active N customers. When the user types, the frontend switches to `list_customers` (or `search_khata_customers` on the khata page).
- **`last_activity_at` is computed identically to `list_customers`**: `greatest(max invoice created_at, max ledger_entries created_at, customers.created_at)`. Customers with no activity sort by `created_at`.
- **No `outstanding` in the result shape** — the picker doesn't need it for the empty state. If the page needs outstanding for these rows, it should make a separate `list_customers` call (or accept the `view_customer_outstanding`-gated value there).
- **Inner uses `current_shop_id()`** — the wrapper's `no_shop_for_user` check is the surfaced error.
- **Ordering**: `last_activity_at desc`. No secondary sort, so ties are non-deterministic across re-runs (acceptable for an empty-state list of 10).
- **Frontend masking UX**: when `phone` / `address` are NULL, the picker should hide those subfields entirely (don't show "—" for an empty-state list — it adds noise). The customer is still selectable by name+id.

## Discrepancies vs RPC inventory

None. Inventory §1.4 entry for `recent_customers` correctly notes:
- `view_customers` permission gate
- conditional `phone`+`address` projection (NULL without `view_customer_contact`)
- 0076b as the source of the projection (the migration's own comment flags this as the "NEW gap from Checkpoint 2" — i.e. the rewrite was added because the first 0076b draft only patched `list_customers` and missed `recent_customers`)
