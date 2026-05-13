# Final production state: `recent_purchase_products`

Generated 2026-05-13 from `mcp__supabase__execute_sql` against project `orfggrnyychmmqdlbfhf`.

## Migration provenance

- **First introduced**: `0024_v19_suppliers_landed_cost.sql §H` — created for the stock-in form's product picker empty state (top N most-recently-purchased products in the shop).
- **Subsequent rewrites**:
  - `0025_v19a_revoke_anon_v19_rpcs.sql` — revoke from anon.
  - (no functional rewrites between v1.9 and v2.9; the body is a thin SQL function)
  - `0076_v29_modify_existing_rpcs.sql §32` — **rename-and-wrap**: `ALTER FUNCTION ... RENAME TO recent_purchase_products_v28`; thin wrapper with `view_products` permission check. (superseded)
  - `0076b_v29_conditional_projection_and_caps.sql §2` — **(live)** wrapper rewritten to apply **conditional projection** on `avg_cost` (NULL when caller lacks `view_product_cost`).
- **Final state**: post-0076b wrapper + the v2.8.5 `_v28` body (unchanged since 0024).

## Wrapper signature

```sql
CREATE OR REPLACE FUNCTION public.recent_purchase_products(p_limit integer DEFAULT 10)
 RETURNS TABLE(
    id uuid, name text, type text, price numeric, avg_cost numeric,
    stock integer, last_used_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_can_see_cost boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_products') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_products'; end if;
  v_can_see_cost := public.user_has_permission(v_shop_id, 'view_product_cost');
  return query
    select inner_t.id, inner_t.name, inner_t.type, inner_t.price,
           case when v_can_see_cost then inner_t.avg_cost end,
           inner_t.stock, inner_t.last_used_at
      from public.recent_purchase_products_v28(p_limit) inner_t;
end; $function$
```

## Inner `_v28` body

```sql
CREATE OR REPLACE FUNCTION public.recent_purchase_products_v28(p_limit integer DEFAULT 10)
 RETURNS TABLE(
    id uuid, name text, type text, price numeric, avg_cost numeric,
    stock integer, last_used_at timestamp with time zone
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  with last_use as (
    select pi.product_id, max(p.created_at) as last_used_at
      from public.purchase_items pi
      join public.purchases p on p.id = pi.purchase_id
     where p.shop_id = public.current_shop_id()
     group by pi.product_id
  )
  select pr.id, pr.name, pr.type, pr.price, pr.avg_cost, pr.stock, l.last_used_at
    from public.products pr
    left join last_use l on l.product_id = pr.id
   where pr.shop_id = public.current_shop_id() and pr.is_active = true
   order by l.last_used_at desc nulls last, pr.updated_at desc
   limit greatest(p_limit, 1);
$function$
```

## Conditional projection map

| Column | NULL'd when caller lacks `view_product_cost`? | Note |
|---|---|---|
| `id` | no | — |
| `name` | no | — |
| `type` | no | legacy snapshotted category name |
| `price` | no | the default-variant selling price (read from deprecated `products.price`) |
| `avg_cost` | **yes** | weighted average cost (cost-bearing) |
| `stock` | no | — |
| `last_used_at` | no | timestamp |

Only `avg_cost` is masked — there is no `last_purchase_cost` in this RPC's shape, and `price` is the selling price (not cost-gated for this RPC, consistent with `search_products`'s treatment of the default variant's `price`).

## Error envelope

| Where | Error message | errcode | When raised | Frontend UX mapping |
|---|---|---|---|---|
| wrapper | `not_authenticated` | P0001 | `auth.uid()` null | redirect to `/login` |
| wrapper | `no_shop_for_user` | P0001 | `current_active_shop_id()` returns null | redirect to `/onboarding` or shop switcher |
| wrapper | `insufficient_permissions` (detail: `Required: view_products`) | P0001 | `user_has_permission(shop, 'view_products')` false | toast per B.5 — frontend should ideally hide the stock-in product picker for non-permitted users |
| inner | (none) | — | the inner is `LANGUAGE sql`, no `RAISE` possible. If `current_shop_id()` is null inside the query, it produces zero rows rather than an error. | n/a |

The inner's lack of error paths is consistent with read RPCs. The wrapper does the active-shop and permission checks. (Note: the inner SQL function does not even guard `no_shop_for_user` — this is the only `_v28` of the seven where the inner skips that check because there's no `plpgsql` to host the `if ... then raise`. The wrapper's check is the only barrier.)

## Invocation contract

- **Params**:
  - `p_limit integer default 10` — clipped at `greatest(p_limit, 1)` to prevent zero/negative limits
- **Returns**: `TABLE(id uuid, name text, type text, price numeric, avg_cost numeric, stock integer, last_used_at timestamptz)`. `avg_cost` is NULL when caller lacks `view_product_cost`.
- **Permission gates**:
  - Wrapper: `view_products` (always; gates the entire result set)
  - Wrapper: `view_product_cost` (per-call boolean — drives `avg_cost` NULL)
- **Side effects**: none (read-only)
- **Append-only constraints**: not applicable (read-only)

## Notes

- **Reads from deprecated `products` table directly**, not from `product_with_default_variant`. The columns `products.{price, avg_cost, stock}` are deprecated per ADR-0022 (v2.6) and stale for variant-enabled products — but `recent_purchase_products` was last touched in v1.9 and never updated for v2.6. For multi-variant products, `avg_cost` here will be the legacy (stale) value, not the default-variant cost.

  Frontend mitigation: this RPC is used only by the stock-in product picker (autocomplete empty state). The picker shows it to suggest "recently used products"; once the user selects, the form fetches fresh data via the product-detail RPC. So the staleness window is acceptable for v2.9.

  Cleanup is tracked in `docs/todos.md` under "legacy column cleanups (deprecated `products.*` post-v2.6)".
- **Inner uses `current_shop_id()`** in the CTE filter (twice) — the SQL function has no preamble. If `current_shop_id()` returns NULL (no `app-shop-id` header), the query naturally returns zero rows. The wrapper's `no_shop_for_user` check is the surfaced error.
- **No `auth.uid()` check inside `_v28`** — guard delegated to wrapper.
- **Ordering**: `last_used_at desc nulls last, updated_at desc`. Products that have never been purchased fall to the end (sorted by `updated_at`). The result is "most recently purchased, then most recently edited."

## Discrepancies vs RPC inventory

None. Inventory §1.2 entry for `recent_purchase_products` correctly notes:
- `view_products` permission gate
- conditional `avg_cost` projection (NULL when missing `view_product_cost`)
- Use-case: stock-in autocomplete empty state

One minor note: the inventory does not flag that this RPC reads from the deprecated `products.*` columns. This is captured in the open todos but worth noting here as a known-stale-data hazard for variant-enabled shops.
