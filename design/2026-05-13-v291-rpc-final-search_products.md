# Final production state: `search_products`

Generated 2026-05-13 from `mcp__supabase__execute_sql` against project `orfggrnyychmmqdlbfhf`.

## Migration provenance

- **First introduced**: `0015_v15_search_and_create_product_rpcs.sql` — original `search_products(text, int, int, boolean)` with `pg_trgm` relevance scoring, returning per-product rows.
- **Subsequent rewrites**:
  - `0020_v18_db_hardening.sql` — `search_path` lock-down to `public, extensions, pg_catalog`.
  - `0021_v18a_revoke_public_execute.sql` — revoke from public; grant to authenticated.
  - `0063_v283_visibility_fixes.sql` — adds `p_category_id` and `p_needs_pricing` filters; signature change (DROP + CREATE).
  - `0066_v285_search_products_default_variant.sql` (and predecessors) — return shape gains variant rollup columns from `product_with_default_variant` view (`has_variants`, `variant_count`, `min_price`, `max_price`, `total_stock_all_variants`, `has_null_price_variant`).
  - `0067_v285_search_products_batch_fields.sql §B` — return shape gains `has_batches` and `default_variant_id`. Signature change (DROP + CREATE).
  - `0076_v29_modify_existing_rpcs.sql §28` — **rename-and-wrap**: `ALTER FUNCTION ... RENAME TO search_products_v28`; thin wrapper that does `not_authenticated`/`no_shop_for_user`/`view_products` permission check and `return query select * from search_products_v28(...)`. No projection logic. (superseded)
  - `0076b_v29_conditional_projection_and_caps.sql §1` — **(live)** rewrites the wrapper to apply **conditional projection**: cost-bearing columns (`avg_cost`, `last_purchase_cost`, `min_price`, `max_price`) are NULL when the caller lacks `view_product_cost`. The shape of the result set is unchanged; only the column values are masked.
- **Final state**: post-0076b wrapper + the v2.8.5 `_v28` body (unchanged since 0067).

## Wrapper signature

```sql
CREATE OR REPLACE FUNCTION public.search_products(
    p_query text DEFAULT NULL::text,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0,
    p_only_in_stock boolean DEFAULT false,
    p_category_id uuid DEFAULT NULL::uuid,
    p_needs_pricing boolean DEFAULT false
)
 RETURNS TABLE(
    id uuid, name text, type text, category_id uuid, description text,
    price numeric, avg_cost numeric, last_purchase_cost numeric, stock integer,
    is_active boolean, relevance real,
    has_variants boolean, variant_count bigint,
    min_price numeric, max_price numeric,
    total_stock_all_variants bigint, has_null_price_variant boolean,
    has_batches boolean, default_variant_id uuid
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
    select inner_t.id, inner_t.name, inner_t.type, inner_t.category_id, inner_t.description, inner_t.price,
           case when v_can_see_cost then inner_t.avg_cost end,
           case when v_can_see_cost then inner_t.last_purchase_cost end,
           inner_t.stock, inner_t.is_active, inner_t.relevance,
           inner_t.has_variants, inner_t.variant_count,
           case when v_can_see_cost then inner_t.min_price end,
           case when v_can_see_cost then inner_t.max_price end,
           inner_t.total_stock_all_variants, inner_t.has_null_price_variant, inner_t.has_batches, inner_t.default_variant_id
      from public.search_products_v28(p_query, p_limit, p_offset, p_only_in_stock, p_category_id, p_needs_pricing) inner_t;
end; $function$
```

## Inner `_v28` body

```sql
CREATE OR REPLACE FUNCTION public.search_products_v28(
    p_query text DEFAULT NULL::text,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0,
    p_only_in_stock boolean DEFAULT false,
    p_category_id uuid DEFAULT NULL::uuid,
    p_needs_pricing boolean DEFAULT false
)
 RETURNS TABLE(
    id uuid, name text, type text, category_id uuid, description text,
    price numeric, avg_cost numeric, last_purchase_cost numeric, stock integer,
    is_active boolean, relevance real,
    has_variants boolean, variant_count bigint,
    min_price numeric, max_price numeric,
    total_stock_all_variants bigint, has_null_price_variant boolean,
    has_batches boolean, default_variant_id uuid
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  return query
  with base as (
    select
      pv.product_id             as id,
      pv.name                   as name,
      pv.legacy_type_column     as type,
      pv.category_id            as category_id,
      pv.description            as description,
      pv.price                  as price,
      pv.avg_cost               as avg_cost,
      pv.last_purchase_cost     as last_purchase_cost,
      pv.stock                  as stock,
      pv.product_is_active      as is_active,
      pv.has_variants           as has_variants,
      pv.variant_count          as variant_count,
      pv.min_price              as min_price,
      pv.max_price              as max_price,
      pv.total_stock_all_variants as total_stock,
      pv.has_null_price_variant as has_null_price_variant,
      pv.has_batches            as has_batches,
      pv.variant_id             as default_variant_id
    from public.product_with_default_variant pv
    where pv.shop_id = v_shop_id
      and pv.product_is_active
      and (not p_only_in_stock or
           (not pv.has_variants and coalesce(pv.stock, 0) > 0) or
           (pv.has_variants and coalesce(pv.total_stock_all_variants, 0) > 0))
      and (p_category_id is null or pv.category_id = p_category_id)
      and (not p_needs_pricing or pv.has_null_price_variant)
  ),
  scored as (
    select
      b.*,
      case
        when v_query is null then 0::real
        else greatest(
          case when b.name ilike v_query || '%' then 1.0::real else 0.0::real end,
          case when b.name ilike '%' || v_query || '%' then 0.8::real else 0.0::real end,
          similarity(b.name, v_query)
        )
      end as relevance
    from base b
  )
  select
    s.id, s.name, s.type, s.category_id, s.description,
    s.price::numeric(12,2), s.avg_cost::numeric(12,2),
    s.last_purchase_cost::numeric(12,2), s.stock, s.is_active, s.relevance,
    s.has_variants, s.variant_count,
    s.min_price::numeric(12,2), s.max_price::numeric(12,2),
    s.total_stock::bigint,
    s.has_null_price_variant,
    s.has_batches,
    s.default_variant_id
  from scored s
  where v_query is null or s.relevance > 0.2
  order by
    case when v_query is null then 0 else 1 end,
    s.relevance desc,
    s.name asc
  limit p_limit offset p_offset;
end;
$function$
```

## Conditional projection map

The wrapper applies a `CASE WHEN v_can_see_cost THEN inner_t.<col> END` to each cost-bearing column. When the caller lacks `view_product_cost`, those columns return NULL (the `else` branch of a bare `CASE WHEN ... THEN ...` is NULL). The 0076b source is the authoritative definition.

| Column | NULL'd when caller lacks `view_product_cost`? | Note |
|---|---|---|
| `id` | no | — |
| `name` | no | — |
| `type` | no | legacy snapshotted from category name |
| `category_id` | no | — |
| `description` | no | — |
| `price` | no | the default-variant selling price |
| `avg_cost` | **yes** | weighted average cost (cost-bearing) |
| `last_purchase_cost` | **yes** | most recent purchase cost (cost-bearing) |
| `stock` | no | — |
| `is_active` | no | — |
| `relevance` | no | trigram score |
| `has_variants` | no | — |
| `variant_count` | no | — |
| `min_price` | **yes** | rollup of variant selling prices (cost-bearing per 0076b) |
| `max_price` | **yes** | rollup of variant selling prices (cost-bearing per 0076b) |
| `total_stock_all_variants` | no | — |
| `has_null_price_variant` | no | needed for "needs-pricing" workflows |
| `has_batches` | no | — |
| `default_variant_id` | no | — |

**Note on `min_price` / `max_price` semantics**: these are *selling* prices, not costs. But the 0076b wrapper treats them as cost-gated. This is an intentional choice — for non-cost-permitted users (cashiers, view-only roles), the price range of the multi-variant rollup is considered sensitive information alongside cost. Without it, those users would see only the default-variant `price`. The inventory doc §1.2 (`#search_products`) is explicit about this.

## Error envelope

| Where | Error message | errcode | When raised | Frontend UX mapping |
|---|---|---|---|---|
| wrapper | `not_authenticated` | P0001 | `auth.uid()` null | redirect to `/login` |
| wrapper | `no_shop_for_user` | P0001 | `current_active_shop_id()` returns null | redirect to `/onboarding` or shop switcher |
| wrapper | `insufficient_permissions` (detail: `Required: view_products`) | P0001 | `user_has_permission(shop, 'view_products')` false | toast per B.5 — `/products` and POS should ideally hide search box; this is the safety net |
| inner | `no_shop_for_user` | P0001 (default; no `using errcode`) | defensive — unreachable when called via wrapper | redirect to onboarding/switcher |

No data-shape errors (this is a read RPC). No `pg_trgm`-related errors are raised at this layer — `set_limit(0.2)` configures the trigram threshold for the `similarity()` call later in the query.

## Invocation contract

- **Params**:
  - `p_query text default null` — null/empty disables relevance filter and returns all matching rows
  - `p_limit integer default 50`
  - `p_offset integer default 0`
  - `p_only_in_stock boolean default false` — filters to products whose default variant (or any variant for multi-variant) has stock > 0
  - `p_category_id uuid default null` — exact-match category filter
  - `p_needs_pricing boolean default false` — when true, returns only products that have `has_null_price_variant = true` (workflow to find products missing prices)
- **Returns**: `TABLE(id uuid, name text, type text, category_id uuid, description text, price numeric, avg_cost numeric, last_purchase_cost numeric, stock integer, is_active boolean, relevance real, has_variants boolean, variant_count bigint, min_price numeric, max_price numeric, total_stock_all_variants bigint, has_null_price_variant boolean, has_batches boolean, default_variant_id uuid)`. Conditional projection NULLs the 4 cost-bearing columns when the caller lacks `view_product_cost`.
- **Permission gates**:
  - Wrapper: `view_products` (always; gates the entire result set)
  - Wrapper: `view_product_cost` (per-call boolean — drives conditional NULLs)
- **Side effects**: none (read-only)
- **Append-only constraints**: not applicable (read-only)

## Notes

- **Pagination is at the inner level**: `limit p_limit offset p_offset` is applied inside `_v28`. The wrapper's projection runs on the already-paginated rows. This means a user without `view_product_cost` still gets the same row count and the same relevance ordering — the only difference is the masked columns.
- **The wrapper does NOT bypass the inner**: every projected row is fetched from `_v28` and then column-NULL'd. There is no path that reads `products` or `product_with_default_variant` directly from the wrapper.
- **Inner uses `current_shop_id()`, wrapper uses `current_active_shop_id()`** — equivalent today (both read the `app-shop-id` header).
- **Inner reads `product_with_default_variant`** (the v2.6 compat view). This view does its own `security_invoker = true` projection on the underlying `products` and `product_variants` tables. The view is `STABLE` so the planner can hoist constant filters.
- **`pg_trgm` threshold**: `set_limit(0.2)` is called inside the function; combined with the post-filter `where v_query is null or s.relevance > 0.2`, this enforces a minimum trigram similarity of 0.2 for fuzzy matches. The relevance scoring uses three signals (prefix match = 1.0, substring match = 0.8, trigram similarity) and takes the max.
- **Ordering**: results without query are sorted by name; results with a query are sorted by `relevance desc, name asc`.
- **Frontend should call this RPC and NOT read `products` directly** — table-level RLS on `products` requires `view_product_cost` and would hide the entire row for a view-only user. The wrapper is the only correct entry point.

## Discrepancies vs RPC inventory

None. The inventory §1.2 entry for `search_products` correctly notes the conditional projection on `avg_cost`, `last_purchase_cost`, `min_price`, `max_price`, the permission gate `view_products`, and the secondary `view_product_cost` gate that drives masking.
