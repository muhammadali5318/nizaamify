# Final production state: `record_purchase`

Generated 2026-05-13 from `mcp__supabase__execute_sql` against project `orfggrnyychmmqdlbfhf`.

## Migration provenance

- **First introduced**: `0009_sale_purchase_functions.sql` — original baseline `record_purchase(text, text, date, jsonb)` (per-shop product creation via name lookup, no suppliers).
- **Subsequent rewrites**:
  - `0012_v13_avg_cost_and_links.sql` — adds WAC (`avg_cost`) update on stock-in.
  - `0015_v15_search_and_create_product_rpcs.sql` — adds `p_is_opening boolean` flag.
  - `0016_v15_drop_old_record_purchase_overload.sql` — drops the legacy 4-arg overload.
  - `0024_v19_suppliers_landed_cost.sql` — full rewrite: signature becomes `(p_supplier_id uuid, p_purchase_date date, p_note text, p_items jsonb, p_overhead_items jsonb, p_is_opening boolean)`. Suppliers as first-class FK; landed-cost pro-rata-by-value allocation across lines.
  - `0028_v21_stock_in_units.sql` — pack-aware: items can be expressed in `pack_id` + `pack_qty`, converted to base units via `pack.base_qty`.
  - `0031_v23_fixes.sql` — largest-remainder overhead allocation (replaces floor-then-redistribute to make the column total exact).
  - `0057_v28_batch_tracking.sql` — adds `inventory_batches` creation for `has_batches=true` products. Initial post-insert UPDATE of `purchase_items.batch_id` (broken — see 0059).
  - `0058_v28_record_purchase_with_batches.sql` — alongside 0057 introduces the FEFO batch row insert.
  - `0059_v28_record_purchase_append_only_fix.sql` — **append-only fix**: 0057/0058 used a post-insert UPDATE on `purchase_items.batch_id` which tripped `purchase_items_no_modify`. Fixed by reordering: INSERT `inventory_batches` first (without `purchase_item_id`), INSERT `purchase_items` with `batch_id` already set, then UPDATE `inventory_batches.purchase_item_id` (the `batch_immutable_fields` trigger was relaxed in the same migration to permit a one-time NULL→non-null transition on `purchase_item_id`).
  - `0076_v29_modify_existing_rpcs.sql §2` — **rename-and-wrap**: `ALTER FUNCTION ... RENAME TO record_purchase_v28`; thin wrapper that does `not_authenticated`/`no_shop_for_user`/`record_purchase` permission check and delegates. No caps, no audit UPDATE (purchases are cost-side, no customer-facing discount, and `purchases.cashier_id` is written inline by the inner body).
  - `0080_v29_audit_by_user_id_writes.sql` — `record_purchase` wrapper is **NOT** changed here. The inventory doc explicitly omits a post-delegation UPDATE because `purchases.cashier_id` already has the audit identity from the v2.8.5 inner body. Other tables touched (`purchase_items`, `purchase_overhead_items`, `inventory_batches`) have no `*_by_user_id` columns that need backfill.
- **Final state**: the body as it exists today is the 0076 wrapper + the 0059 `_v28` body. See SQL below.

## Wrapper signature

```sql
CREATE OR REPLACE FUNCTION public.record_purchase(
    p_supplier_id uuid DEFAULT NULL::uuid,
    p_purchase_date date DEFAULT CURRENT_DATE,
    p_note text DEFAULT NULL::text,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_overhead_items jsonb DEFAULT '[]'::jsonb,
    p_is_opening boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_purchase') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_purchase'; end if;
  return public.record_purchase_v28(p_supplier_id, p_purchase_date, p_note, p_items, p_overhead_items, p_is_opening);
end; $function$
```

## Inner `_v28` body

```sql
CREATE OR REPLACE FUNCTION public.record_purchase_v28(
    p_supplier_id uuid DEFAULT NULL::uuid,
    p_purchase_date date DEFAULT CURRENT_DATE,
    p_note text DEFAULT NULL::text,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_overhead_items jsonb DEFAULT '[]'::jsonb,
    p_is_opening boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_overhead_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_overhead jsonb;
  v_variant record;
  v_pack record;
  v_idx int := 0;
  v_qty int;
  v_pack_qty int;
  v_pack_id uuid;
  v_pack_base_qty_snapshot int;
  v_qty_in_base int;
  v_cost numeric(12,2);
  v_line_value numeric(12,2);
  v_per_base_unit_cost numeric(12,2);
  v_line_overhead numeric(12,2);
  v_overhead_per_base_unit numeric(12,2);
  v_effective_per_base_cost numeric(12,2);
  v_supplier_name text;
  v_source text;
  v_shares numeric(12,2)[];
  v_resolved_variant_id uuid;
  v_purchase_item_id uuid;
  v_batch jsonb;
  v_batch_id uuid;
  v_batch_no text;
  v_warranty_days int;
  v_warranty_expires date;
  v_expiry_date date;
  v_mfg_date date;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_purchase' using errcode = 'P0001';
  end if;

  -- Supplier check (skipped when null; required = enforced upstream / by frontend for non-opening)
  if p_supplier_id is not null then
    select name into v_supplier_name
      from public.suppliers
     where id = p_supplier_id and shop_id = v_shop_id and is_active = true;
    if not found then raise exception 'supplier_not_in_shop' using errcode = 'P0001'; end if;
  end if;

  -- First pass: validate lines, accumulate items_subtotal.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);
    if v_cost is null or v_cost < 0 then
      raise exception 'cost_must_be_non_negative' using errcode = 'P0001';
    end if;
    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_qty := (v_item->>'pack_qty')::int;
      if v_pack_qty is null or v_pack_qty <= 0 then
        raise exception 'pack_qty_must_be_positive' using errcode = 'P0001';
      end if;
      v_items_subtotal := v_items_subtotal + (v_pack_qty * v_cost);
    else
      v_qty := (v_item->>'qty')::int;
      if v_qty is null or v_qty <= 0 then
        raise exception 'qty_must_be_positive' using errcode = 'P0001';
      end if;
      v_items_subtotal := v_items_subtotal + (v_qty * v_cost);
    end if;
  end loop;

  -- Validate overheads + accumulate.
  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      if (v_overhead->>'category') not in ('delivery','labor','customs','packaging','other') then
        raise exception 'invalid_overhead_category' using errcode = 'P0001';
      end if;
      if ((v_overhead->>'amount')::numeric(12,2)) <= 0 then
        raise exception 'overhead_amount_must_be_positive' using errcode = 'P0001';
      end if;
      v_overhead_subtotal := v_overhead_subtotal + (v_overhead->>'amount')::numeric(12,2);
    end loop;
  end if;

  -- Pro-rata-by-value overhead allocation (largest-remainder; rk=1 absorbs delta).
  if v_overhead_subtotal > 0 and v_items_subtotal > 0 then
    with input_lines as (
      select
        elem.idx::int as idx,
        case
          when (elem.row->>'pack_id') is not null
            then (elem.row->>'pack_qty')::int * (elem.row->>'cost_at_purchase')::numeric
          else (elem.row->>'qty')::int * (elem.row->>'cost_at_purchase')::numeric
        end as line_value
      from jsonb_array_elements(p_items) with ordinality as elem(row, idx)
    ),
    raw_shares as (
      select idx, line_value,
             round(v_overhead_subtotal * line_value / v_items_subtotal, 2) as raw,
             row_number() over (order by line_value desc, idx) as rk
        from input_lines
    ),
    delta as (
      select v_overhead_subtotal - coalesce(sum(raw), 0) as d from raw_shares
    )
    select array_agg(
      case when rs.rk = 1 then rs.raw + d.d else rs.raw end
      order by rs.idx
    )
      into v_shares
      from raw_shares rs cross join delta d;
  end if;

  -- Resolve source label.
  v_source := case
    when p_is_opening then 'Opening Stock'
    when p_supplier_id is not null then v_supplier_name
    else 'Direct purchase'
  end;
  insert into public.purchases (
    shop_id, supplier_id, total_cost, items_subtotal, overhead_subtotal,
    source, note, purchase_date, cashier_id, is_opening
  ) values (
    v_shop_id, p_supplier_id,
    v_items_subtotal + v_overhead_subtotal,
    v_items_subtotal, v_overhead_subtotal,
    v_source,
    nullif(trim(coalesce(p_note,'')),''),
    coalesce(p_purchase_date, current_date),
    v_user_id, coalesce(p_is_opening, false)
  ) returning id into v_purchase_id;

  -- Insert overhead rows.
  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      insert into public.purchase_overhead_items (purchase_id, category, amount, description)
      values (
        v_purchase_id, v_overhead->>'category',
        (v_overhead->>'amount')::numeric(12,2),
        nullif(trim(coalesce(v_overhead->>'description','')),'')
      );
    end loop;
  end if;

  -- Second pass: resolve variant, lock variant FOR UPDATE, compute landed cost,
  -- create batch (if has_batches), insert purchase_items WITH batch_id set,
  -- back-fill inventory_batches.purchase_item_id, then bump variant stock + WAC.
  v_idx := 0;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);

    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_resolved_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select id into v_resolved_variant_id
        from public.product_variants
       where product_id = (v_item->>'product_id')::uuid
         and is_default and is_active;
      if v_resolved_variant_id is null then
        raise exception 'product_has_no_default_variant' using errcode = 'P0001';
      end if;
    else
      raise exception 'item_missing_variant_or_product_id' using errcode = 'P0001';
    end if;

    select v.id, v.product_id, v.stock, v.avg_cost, p.shop_id, p.has_batches
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_resolved_variant_id and v.is_active
     for update;

    if not found then raise exception 'variant_not_found_or_inactive' using errcode = 'P0001'; end if;
    if v_variant.shop_id <> v_shop_id then raise exception 'variant_not_in_shop' using errcode = 'P0001'; end if;

    -- Pack expansion or direct qty
    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_id := (v_item->>'pack_id')::uuid;
      v_pack_qty := (v_item->>'pack_qty')::int;
      select id, base_qty into v_pack
        from public.product_packs
       where id = v_pack_id and variant_id = v_variant.id and is_active;
      if not found then raise exception 'pack_not_found_or_inactive' using errcode = 'P0001'; end if;
      v_pack_base_qty_snapshot := v_pack.base_qty;
      v_qty_in_base := v_pack_qty * v_pack_base_qty_snapshot;
      v_line_value := v_pack_qty * v_cost;
    else
      v_pack_id := null;
      v_pack_qty := null;
      v_pack_base_qty_snapshot := null;
      v_qty_in_base := (v_item->>'qty')::int;
      v_line_value := v_qty_in_base * v_cost;
    end if;

    v_per_base_unit_cost := round(v_line_value / v_qty_in_base, 2);
    v_line_overhead := coalesce(v_shares[v_idx], 0);
    v_overhead_per_base_unit := case when v_qty_in_base > 0
      then round(v_line_overhead / v_qty_in_base, 2)
      else 0
    end;
    v_effective_per_base_cost := round(
      v_per_base_unit_cost + (v_line_overhead / nullif(v_qty_in_base, 0)::numeric),
      2
    );

    -- v2.8.1: if the product is batched, create the inventory_batches row
    -- FIRST (without purchase_item_id), then insert purchase_items WITH
    -- batch_id already set. This avoids a post-insert UPDATE on
    -- purchase_items which would trip the v1.8 append-only trigger.
    v_batch_id := null;
    if v_variant.has_batches then
      v_batch := v_item -> 'batch';
      if v_batch is null or jsonb_typeof(v_batch) <> 'object' then
        raise exception 'batch_info_required_for_batched_product' using errcode = 'P0001';
      end if;
      v_batch_no := nullif(trim(coalesce(v_batch->>'batch_no', '')), '');
      if v_batch_no is null then
        raise exception 'batch_no_required' using errcode = 'P0001';
      end if;
      v_mfg_date := nullif(v_batch->>'manufactured_date', '')::date;
      v_expiry_date := nullif(v_batch->>'expiry_date', '')::date;
      v_warranty_days := nullif(v_batch->>'supplier_warranty_days', '')::int;
      if v_warranty_days is not null and v_warranty_days > 0 then
        v_warranty_expires := coalesce(p_purchase_date, current_date) + v_warranty_days;
      else
        v_warranty_expires := null;
      end if;

      begin
        insert into public.inventory_batches (
          variant_id, batch_no, supplier_id,
          qty_received, qty_remaining, cost_per_unit,
          manufactured_date, expiry_date,
          supplier_warranty_days, warranty_expires_at,
          received_at
        ) values (
          v_variant.id, v_batch_no, p_supplier_id,
          v_qty_in_base, v_qty_in_base, v_effective_per_base_cost,
          v_mfg_date, v_expiry_date,
          v_warranty_days, v_warranty_expires,
          coalesce(p_purchase_date, current_date)
        ) returning id into v_batch_id;
      exception
        when unique_violation then
          raise exception 'duplicate_batch_no' using errcode = 'P0001';
      end;
    end if;

    insert into public.purchase_items (
      purchase_id, variant_id, qty, qty_in_base,
      cost_at_purchase,
      line_overhead_amount, overhead_per_unit,
      pack_id, pack_qty, pack_base_qty_snapshot,
      avg_cost_before, avg_cost_after,
      batch_id
    ) values (
      v_purchase_id, v_variant.id, v_qty_in_base, v_qty_in_base,
      v_cost,
      v_line_overhead, v_overhead_per_base_unit,
      v_pack_id, v_pack_qty, v_pack_base_qty_snapshot,
      v_variant.avg_cost,
      case
        when v_variant.stock + v_qty_in_base = 0 then v_variant.avg_cost
        when v_variant.stock <= 0                then v_effective_per_base_cost
        else round(
          (v_variant.stock * v_variant.avg_cost + v_qty_in_base * v_effective_per_base_cost)
          / (v_variant.stock + v_qty_in_base), 2
        )
      end,
      v_batch_id
    ) returning id into v_purchase_item_id;

    -- v2.8.1: now set the back-reference. Trigger permits NULL → non-null
    -- but blocks any later mutation.
    if v_batch_id is not null then
      update public.inventory_batches
         set purchase_item_id = v_purchase_item_id
       where id = v_batch_id;
    end if;

    update public.product_variants
       set stock = stock + v_qty_in_base,
           avg_cost = case
             when stock + v_qty_in_base = 0 then avg_cost
             when stock <= 0                then v_effective_per_base_cost
             else round(
               (stock * avg_cost + v_qty_in_base * v_effective_per_base_cost)
               / (stock + v_qty_in_base), 2
             )
           end,
           last_purchase_cost = v_cost,
           cost = case when stock <= 0 then v_cost else cost end,
           updated_at = now()
     where id = v_variant.id;
  end loop;

  return v_purchase_id;
end;
$function$
```

## Error envelope

The wrapper uses `using errcode = 'P0001'` explicitly. The `_v28` inner body uses `using errcode = 'P0001'` for **most** raises (`empty_purchase`, `supplier_not_in_shop`, `cost_must_be_non_negative`, `pack_qty_must_be_positive`, `qty_must_be_positive`, `invalid_overhead_category`, `overhead_amount_must_be_positive`, `product_has_no_default_variant`, `item_missing_variant_or_product_id`, `variant_not_found_or_inactive`, `variant_not_in_shop`, `pack_not_found_or_inactive`, `batch_info_required_for_batched_product`, `batch_no_required`, `duplicate_batch_no`). The two preconditions (`not_authenticated`, `no_shop_for_user`) raise without `using errcode` but default to P0001.

| Where | Error message | errcode | When raised | Frontend UX mapping |
|---|---|---|---|---|
| wrapper | `not_authenticated` | P0001 | `auth.uid()` null | redirect to `/login` |
| wrapper | `no_shop_for_user` | P0001 | `current_active_shop_id()` returns null | redirect to `/onboarding` or shop switcher |
| wrapper | `insufficient_permissions` (detail: `Required: record_purchase`) | P0001 | `user_has_permission(shop, 'record_purchase')` false | toast per B.5 |
| inner | `not_authenticated` | P0001 | defensive | redirect to /login |
| inner | `no_shop_for_user` | P0001 | defensive | redirect to onboarding/switcher |
| inner | `empty_purchase` | P0001 | `p_items` not an array or empty | bug-class |
| inner | `supplier_not_in_shop` | P0001 | `p_supplier_id` not in shop or `is_active=false` | re-pick supplier |
| inner | `cost_must_be_non_negative` | P0001 | line `cost_at_purchase` null or < 0 | line field error |
| inner | `pack_qty_must_be_positive` | P0001 | pack mode: `pack_qty` null/<=0 | line field error |
| inner | `qty_must_be_positive` | P0001 | non-pack mode: `qty` null/<=0 | line field error |
| inner | `invalid_overhead_category` | P0001 | overhead category not in `('delivery','labor','customs','packaging','other')` | category picker error |
| inner | `overhead_amount_must_be_positive` | P0001 | overhead amount <= 0 | overhead row field error |
| inner | `item_missing_variant_or_product_id` | P0001 | line has neither | bug-class |
| inner | `product_has_no_default_variant` | P0001 | legacy `product_id` path; no default variant | bug-class |
| inner | `variant_not_found_or_inactive` | P0001 | variant doesn't exist or `is_active=false` | "Variant unavailable — refresh" |
| inner | `variant_not_in_shop` | P0001 | variant belongs to another shop | "Variant not in your shop — refresh" |
| inner | `pack_not_found_or_inactive` | P0001 | `pack_id` doesn't match variant or `is_active=false` | re-pick pack |
| inner | `batch_info_required_for_batched_product` | P0001 | `has_batches=true` variant but line has no `batch` object | prompt for batch fields |
| inner | `batch_no_required` | P0001 | has_batches variant; empty or whitespace `batch_no` | "Batch number required" — call `suggest_batch_no` |
| inner | `duplicate_batch_no` | P0001 | re-raised from `unique_violation` (variant_id, batch_no) collision | suggest auto-batch-no |

Note the inventory doc §3.5 uses slightly different message forms (`qty must be positive`, `qty_in_base must be positive`, `cost_at_purchase_negative`, `batch_no_required_for_has_batches_product`, `expiry_or_warranty_required_for_has_batches_product`, `duplicate_batch_no_in_variant`). Several of these are **stale** — the live production body uses the messages above. See "Discrepancies" section.

## Invocation contract

- **Params**:
  - `p_supplier_id uuid default null` — required for non-opening purchases (frontend-enforced; inner body only errors if a non-null supplier doesn't exist in the shop)
  - `p_purchase_date date default current_date` — backdating allowed
  - `p_note text default null` — free text or null
  - `p_items jsonb default '[]'::jsonb` — array of `{ variant_id? (preferred), product_id? (legacy fallback to default variant), qty: int>0 OR pack_id+pack_qty: int>0, cost_at_purchase: numeric>=0, batch? { batch_no: text, manufactured_date?, expiry_date?, supplier_warranty_days? } (required when variant.has_batches=true) }`
  - `p_overhead_items jsonb default '[]'::jsonb` — array of `{ category: 'delivery'|'labor'|'customs'|'packaging'|'other', amount: numeric>0, description? text }`
  - `p_is_opening boolean default false` — opening-stock import flag; sets `source = 'Opening Stock'` and skips supplier check (caller may pass null supplier)
- **Returns**: `uuid` (the new `purchases.id`)
- **Permission gates**:
  - Wrapper: `record_purchase` (only)
  - No caps; purchase volume is not capped on non-owners in v2.9.
- **Side effects** (atomic; one transaction):
  - INSERT into `purchases` (sets `cashier_id = v_user_id` inline; `source` derived from supplier name / 'Opening Stock' / 'Direct purchase')
  - INSERT N rows into `purchase_overhead_items` (one per overhead category in `p_overhead_items`)
  - INSERT M rows into `purchase_items` (one per line; `qty`, `qty_in_base`, `cost_at_purchase`, `line_overhead_amount`, `overhead_per_unit`, `pack_id`/`pack_qty`/`pack_base_qty_snapshot`, `avg_cost_before` snapshot, `avg_cost_after` snapshot, `batch_id` (set if has_batches))
  - INSERT M rows into `inventory_batches` for `has_batches=true` lines (`qty_received = qty_remaining`, `cost_per_unit = effective landed cost`)
  - UPDATE `inventory_batches.purchase_item_id` once per batched line (the one-time NULL→non-null transition permitted by the v2.8.1 trigger relaxation)
  - UPDATE `product_variants` per line: `stock += qty_in_base`, `avg_cost = WAC formula`, `last_purchase_cost = v_cost`, `cost = v_cost` only when prior `stock <= 0`, `updated_at = now()`
- **Append-only constraints respected**:
  - `purchases` — written once at INSERT; `cashier_id` inline (post-v2.8.5)
  - `purchase_items` — written once at INSERT with `batch_id` already set (post-0059); no post-insert UPDATE possible (`purchase_items_no_modify` trigger blocks all UPDATEs)
  - `purchase_overhead_items` — written once at INSERT; no UPDATE allowed
  - `inventory_batches` — written once at INSERT; one-time `purchase_item_id` back-fill is permitted by `batch_immutable_fields` trigger (NULL→non-null only)

## Notes

- **Two passes over `p_items`** — first pass validates per-line fields and accumulates `items_subtotal`; second pass resolves variants, locks rows, computes WAC, and writes. The first pass exists so overhead allocation can be done before any DB write.
- **Largest-remainder overhead allocation**: with N lines and total overhead T, each line's raw share is `round(T * line_value / items_subtotal, 2)`. Rounding may leave `delta = T - sum(raw)`. The line with `rk=1` (max line_value, ties broken by `idx`) absorbs the entire delta. This guarantees `sum(line_overhead_amount) == overhead_subtotal` exactly. ADR-0017 / v2.3 fixes.
- **WAC formula** (Weighted Average Cost):
  - If `stock + qty_in_base == 0`: avg_cost unchanged (idempotent on a zero-add)
  - Else if `stock <= 0`: avg_cost := `v_effective_per_base_cost` (reset; we were holding "zero or negative stock" so prior WAC is meaningless)
  - Else: `round((stock*avg_cost + qty_in_base*effective_per_base_cost) / (stock + qty_in_base), 2)`
  - `v_effective_per_base_cost` includes both the line's `cost_at_purchase` and its allocated overhead share, normalized to base units.
- **`avg_cost_before` / `avg_cost_after` snapshots on `purchase_items`** preserve the WAC trajectory line by line (ADR-0016). The `case` expression in the INSERT mirrors the variant UPDATE's formula.
- **Lock ordering**: variants are locked `FOR UPDATE` in line-iteration order. Concurrent purchases of the same variant serialize on the variant row lock. No deadlock risk because order is fixed (input array order).
- **`batch_id` is set at INSERT time on `purchase_items`** (post-0059). Pre-0059 versions did a post-insert UPDATE that tripped `purchase_items_no_modify`. The fix is to create the batch first (without `purchase_item_id`), insert the purchase_item with `batch_id` already populated, then back-fill the batch's `purchase_item_id`. The `batch_immutable_fields` trigger permits the one-time NULL→non-null transition.
- **Pack expansion**: `qty_in_base = pack_qty * pack.base_qty`. The pack must belong to this variant (`variant_id = v_variant.id`) and be `is_active`. `pack_base_qty_snapshot` is stored on `purchase_items` so reports survive future `base_qty` edits.
- **Auditable user identity**: `purchases.cashier_id = v_user_id` (inline; no post-delegation UPDATE needed).

## Discrepancies vs RPC inventory

The inventory doc lists several error messages in `§3.5` that do NOT match the live production body:

| Inventory says | Live body says | Why |
|---|---|---|
| `qty must be positive` | `qty_must_be_positive` | underscored form is current; space-form was the v2.0/v2.1 message before 0024/0028 rewrites — stale |
| `qty_in_base must be positive` | (not raised) | inventory wrong — the body validates `qty` and `pack_qty` directly; `qty_in_base` is derived |
| `cost_at_purchase_negative` | `cost_must_be_non_negative` | underscored form is current; the `_at_purchase` form was pre-0028 |
| `batch_no_required_for_has_batches_product` | `batch_no_required` (and `batch_info_required_for_batched_product`) | the live body has TWO distinct raises — one for missing `batch` object, one for missing `batch_no`. Inventory collapses them |
| `expiry_or_warranty_required_for_has_batches_product` | (not raised) | inventory wrong — `record_purchase` does not enforce expiry-or-warranty at insert. The v2.8.4 expired-sale policy gates SALES, not purchases. Manufactured / expiry / warranty fields are all optional on the input batch object |
| `duplicate_batch_no_in_variant` | `duplicate_batch_no` | both are P0001; live message is shorter |

Frontend dispatch in v2.9.1 should match on the **live** message forms. The inventory doc should be patched (separate task) — flagged here as the canonical source.

There is no append-only `purchase_items_no_modify` issue in the live body — the 0059 reorder is correctly preserved.
