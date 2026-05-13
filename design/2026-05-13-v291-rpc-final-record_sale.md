# Final production state: `record_sale`

Generated 2026-05-13 from `mcp__supabase__execute_sql` against project `orfggrnyychmmqdlbfhf`.

## Migration provenance

- **First introduced**: `0009_sale_purchase_functions.sql` — original baseline `record_sale(uuid, text, numeric, jsonb)` (cash-only, no split payment, no discounts, pre-variant).
- **Subsequent rewrites** (only the rewrites whose contributions survive into the final body are tagged "live"; intermediate rewrites that were superseded are tagged "superseded"):
  - `0012_v13_avg_cost_and_links.sql` — snapshot `cost_at_sale = avg_cost` on each line.
  - `0013_v14_partial_payments_and_customer_search.sql` — signature change: split payment (`p_amount_paid`), service charge, partial/credit/cash `payment_type`.
  - `0028_v21_stock_in_units.sql §F` — restored to v1.6 body shape (pack-free); stock-in moves to its own pack-aware path.
  - `0030_v22_record_sale_rewrite.sql` — added line-discount semantics (v2.2 tiers + per-line discount).
  - `0032_v23_record_sale_rewrite.sql` — v2.3 tier reversal (`tier_*` → `sale_discount_*` rename, manual sale-time discount popup).
  - `0057_v28_batch_tracking.sql` — FEFO batch allocation for products with `has_batches=true`.
  - `0064_v284_expired_sale_policy.sql` — added `p_confirm_expired_sale` parameter, `expired_sale_policy` resolution.
  - `0076_v29_modify_existing_rpcs.sql §1` — **rename-and-wrap**: `ALTER FUNCTION ... RENAME TO record_sale_v28`; new wrapper that delegates after the basic permission check. Bare wrapper at this point — no caps, no audit. (superseded)
  - `0076b_v29_conditional_projection_and_caps.sql §5/6/7` — wrapper gains: (a) non-owner per-line + per-invoice discount caps (percent + PKR), (b) implicit-discount cap (price_at_sale << variant.price), (c) `confirm_expired_sale_at_pos` permission gate when `p_confirm_expired_sale=true`. (superseded by 0080+0086)
  - `0080_v29_audit_by_user_id_writes.sql` — wrapper post-delegation `UPDATE ledger_entries set created_by_user_id = auth.uid() where invoice_id = v_invoice_id and created_by_user_id is null`. **(superseded by 0086 — append-only trigger blocks the UPDATE.)**
  - `0086_ledger_audit_at_insert.sql` — **(live)** moves the audit write inline to `record_sale_v28` (`insert into ledger_entries ... created_by_user_id = v_user_id`). The outer wrapper drops the post-delegation UPDATE; everything else stays.
- **Final state**: the body as it exists today on prod is the post-0086 wrapper + the post-0086 `_v28` body. See SQL below.

## Wrapper signature

```sql
CREATE OR REPLACE FUNCTION public.record_sale(
    p_customer_id uuid DEFAULT NULL::uuid,
    p_amount_paid numeric DEFAULT 0,
    p_service_charge numeric DEFAULT 0,
    p_notes text DEFAULT NULL::text,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_sale_discount_type text DEFAULT NULL::text,
    p_sale_discount_value numeric DEFAULT NULL::numeric,
    p_confirm_expired_sale boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_is_owner boolean;
  v_limits jsonb;
  v_line_max_pct numeric; v_invoice_max_pct numeric;
  v_line_max_pkr numeric; v_invoice_max_pkr numeric;
  v_item jsonb;
  v_qty int; v_price numeric; v_line_subtotal numeric;
  v_line_disc_amt numeric; v_line_disc_pct numeric;
  v_implicit_disc_pct numeric;
  v_variant_id uuid; v_variant_price numeric;
  v_items_subtotal numeric := 0;
  v_invoice_disc_amt numeric := 0; v_invoice_disc_pct numeric;
  v_invoice_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_sale') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_sale'; end if;
  select usa.is_owner, usa.discount_limits into v_is_owner, v_limits
    from public.user_shop_access usa where usa.user_id = auth.uid() and usa.shop_id = v_shop_id;
  if v_is_owner is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  v_line_max_pct := nullif(v_limits ->> 'per_line_max_pct', '')::numeric;
  v_invoice_max_pct := nullif(v_limits ->> 'per_invoice_max_pct', '')::numeric;
  v_line_max_pkr := nullif(v_limits ->> 'per_line_max_pkr', '')::numeric;
  v_invoice_max_pkr := nullif(v_limits ->> 'per_invoice_max_pkr', '')::numeric;

  if jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_qty := (v_item->>'qty')::int; v_price := (v_item->>'price_at_sale')::numeric;
      if v_qty is null or v_price is null or v_qty <= 0 then continue; end if;
      v_line_subtotal := v_qty * v_price;
      v_items_subtotal := v_items_subtotal + v_line_subtotal;
      if v_item->>'line_discount_type' = 'percent' then
        v_line_disc_pct := (v_item->>'line_discount_value')::numeric;
        v_line_disc_amt := round(v_line_subtotal * v_line_disc_pct / 100, 2);
      elsif v_item->>'line_discount_type' = 'fixed' then
        v_line_disc_amt := (v_item->>'line_discount_value')::numeric;
        v_line_disc_pct := case when v_line_subtotal > 0 then (v_line_disc_amt / v_line_subtotal * 100) else 0 end;
      else v_line_disc_amt := 0; v_line_disc_pct := 0; end if;
      if not v_is_owner then
        if v_line_max_pct is not null and v_line_disc_pct > v_line_max_pct + 0.001 then
          raise exception 'discount_exceeds_line_pct_limit' using errcode = 'P0001', detail = format('line %s%% > cap %s%%', v_line_disc_pct, v_line_max_pct); end if;
        if v_line_max_pkr is not null and v_line_disc_amt > v_line_max_pkr + 0.001 then
          raise exception 'discount_exceeds_line_pkr_limit' using errcode = 'P0001', detail = format('line %s PKR > cap %s PKR', v_line_disc_amt, v_line_max_pkr); end if;
      end if;
      v_variant_id := null;
      if v_item ? 'variant_id' and nullif(v_item->>'variant_id','') is not null then
        v_variant_id := (v_item->>'variant_id')::uuid;
      elsif v_item ? 'product_id' and nullif(v_item->>'product_id','') is not null then
        select id into v_variant_id from public.product_variants
         where product_id = (v_item->>'product_id')::uuid and is_default and is_active;
      end if;
      if v_variant_id is not null then
        select price into v_variant_price from public.product_variants where id = v_variant_id;
        if v_variant_price is not null and v_variant_price > 0 then
          v_implicit_disc_pct := (1 - (v_price / v_variant_price)) * 100;
          if not v_is_owner and v_line_max_pct is not null and v_implicit_disc_pct > v_line_max_pct + 0.001 then
            raise exception 'implicit_discount_exceeds_line_pct_limit' using errcode = 'P0001',
              detail = format('implicit %s%% (price %s vs %s) > cap %s%%', round(v_implicit_disc_pct,2), v_price, v_variant_price, v_line_max_pct); end if;
        end if;
      end if;
    end loop;
  end if;
  if p_sale_discount_type = 'percent' then
    v_invoice_disc_pct := p_sale_discount_value;
    v_invoice_disc_amt := round(v_items_subtotal * p_sale_discount_value / 100, 2);
  elsif p_sale_discount_type = 'fixed' then
    v_invoice_disc_amt := p_sale_discount_value;
    v_invoice_disc_pct := case when v_items_subtotal > 0 then (p_sale_discount_value / v_items_subtotal * 100) else 0 end;
  else v_invoice_disc_pct := 0; v_invoice_disc_amt := 0; end if;
  if not v_is_owner then
    if v_invoice_max_pct is not null and v_invoice_disc_pct > v_invoice_max_pct + 0.001 then
      raise exception 'discount_exceeds_invoice_pct_limit' using errcode = 'P0001', detail = format('invoice %s%% > cap %s%%', v_invoice_disc_pct, v_invoice_max_pct); end if;
    if v_invoice_max_pkr is not null and v_invoice_disc_amt > v_invoice_max_pkr + 0.001 then
      raise exception 'discount_exceeds_invoice_pkr_limit' using errcode = 'P0001', detail = format('invoice %s PKR > cap %s PKR', v_invoice_disc_amt, v_invoice_max_pkr); end if;
  end if;
  if coalesce(p_confirm_expired_sale, false) = true
     and not public.user_has_permission(v_shop_id, 'confirm_expired_sale_at_pos') then
    raise exception 'insufficient_permissions' using errcode = 'P0001',
      detail = 'Required: confirm_expired_sale_at_pos'; end if;

  -- Delegate; created_by_user_id is written inline by record_sale_v28's
  -- INSERT into ledger_entries (0086). No post-delegation UPDATE.
  v_invoice_id := public.record_sale_v28(p_customer_id, p_amount_paid, p_service_charge, p_notes,
                                          p_items, p_sale_discount_type, p_sale_discount_value,
                                          p_confirm_expired_sale);
  return v_invoice_id;
end; $function$
```

## Inner `_v28` body

```sql
CREATE OR REPLACE FUNCTION public.record_sale_v28(
    p_customer_id uuid DEFAULT NULL::uuid,
    p_amount_paid numeric DEFAULT 0,
    p_service_charge numeric DEFAULT 0,
    p_notes text DEFAULT NULL::text,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_sale_discount_type text DEFAULT NULL::text,
    p_sale_discount_value numeric DEFAULT NULL::numeric,
    p_confirm_expired_sale boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_sale_discount_percent_snapshot numeric(5,2);
  v_sale_discount_amount numeric(12,2) := 0;
  v_total numeric(12,2);
  v_credit numeric(12,2);
  v_payment_type text;
  v_service numeric(12,2);
  v_customer_tier_id uuid;
  v_item jsonb;
  v_qty int;
  v_price numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_discount_type text;
  v_line_discount_value numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_variant record;
  v_resolved_variant_id uuid;
  v_override_batch_id uuid;
  v_batch record;
  v_remaining_qty int;
  v_chunk_qty int;
  v_chunk_idx int;
  v_chunk_count int;
  v_qty_arr int[];
  v_batch_id_arr uuid[];
  v_cost_arr numeric(12,2)[];
  v_sold_expired_arr boolean[];
  v_discount_alloc numeric(12,2)[];
  v_alloc_sum numeric(12,2);
  v_max_qty_idx int;
  v_effective_policy public.expired_sale_policy;
  v_batch_expired boolean;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  v_service := coalesce(p_service_charge, 0);
  if p_amount_paid is null or p_amount_paid < 0 then raise exception 'amount_paid_negative'; end if;
  if v_service < 0 then raise exception 'service_charge_negative'; end if;

  if jsonb_typeof(p_items) is null then p_items := '[]'::jsonb; end if;
  if jsonb_array_length(p_items) = 0 and v_service = 0 then
    raise exception 'empty_sale: a sale must have items or a service charge';
  end if;

  if (p_sale_discount_type is null) <> (p_sale_discount_value is null) then
    raise exception 'sale_discount_type_and_value_must_both_be_set_or_neither';
  end if;
  if p_sale_discount_type is not null and p_sale_discount_type not in ('percent','fixed') then
    raise exception 'invalid_sale_discount_type';
  end if;
  if p_sale_discount_type = 'percent' and (p_sale_discount_value < 0 or p_sale_discount_value > 100) then
    raise exception 'sale_discount_percent_out_of_range';
  end if;
  if p_sale_discount_type = 'fixed' and p_sale_discount_value < 0 then
    raise exception 'sale_discount_fixed_negative';
  end if;

  if p_customer_id is not null then
    select tier_id into v_customer_tier_id
      from public.customers
     where id = p_customer_id and shop_id = v_shop_id;
  end if;

  -- First pass: validate every line and accumulate items_subtotal (post line-discount).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    if v_qty is null or v_qty <= 0 then raise exception 'qty must be positive'; end if;
    if v_price is null or v_price < 0 then raise exception 'price must be non-negative'; end if;
    v_line_subtotal := v_qty * v_price;

    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    if v_item->>'line_discount_value' is null then
      v_line_discount_value := null;
    else
      v_line_discount_value := (v_item->>'line_discount_value')::numeric(12,2);
    end if;

    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      if v_line_discount_value is null or v_line_discount_value < 0 or v_line_discount_value > 100 then
        raise exception 'line_discount_percent_out_of_range';
      end if;
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    elsif v_line_discount_type = 'fixed' then
      if v_line_discount_value is null or v_line_discount_value < 0 then
        raise exception 'line_discount_fixed_negative';
      end if;
      if v_line_discount_value > v_line_subtotal then
        raise exception 'line_discount_exceeds_line_subtotal';
      end if;
      v_line_discount_amount := v_line_discount_value;
    else
      raise exception 'invalid_line_discount_type';
    end if;

    v_line_total := v_line_subtotal - v_line_discount_amount;
    v_items_subtotal := v_items_subtotal + v_line_total;
  end loop;

  if p_sale_discount_type = 'percent' then
    v_sale_discount_percent_snapshot := p_sale_discount_value;
    v_sale_discount_amount := round(v_items_subtotal * p_sale_discount_value / 100, 2);
  elsif p_sale_discount_type = 'fixed' then
    v_sale_discount_percent_snapshot := null;
    if p_sale_discount_value > v_items_subtotal then
      raise exception 'sale_discount_fixed_exceeds_items_subtotal';
    end if;
    v_sale_discount_amount := p_sale_discount_value;
  else
    v_sale_discount_percent_snapshot := null;
    v_sale_discount_amount := 0;
  end if;

  v_total := (v_items_subtotal - v_sale_discount_amount) + v_service;

  if p_amount_paid > v_total then raise exception 'amount_paid_exceeds_total'; end if;
  v_credit := v_total - p_amount_paid;
  v_payment_type := case
    when v_credit = 0 then 'cash'
    when p_amount_paid = 0 then 'credit'
    else 'partial'
  end;
  if v_credit > 0 and p_customer_id is null then raise exception 'customer_required_for_credit'; end if;
  if p_customer_id is not null then
    if not exists (select 1 from public.customers where id = p_customer_id and shop_id = v_shop_id) then
      raise exception 'customer_not_in_shop';
    end if;
  end if;

  -- Write the invoice row first; cashier_id = v_user_id is the authoritative audit column.
  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id, tier_id,
    sale_discount_type, sale_discount_value,
    sale_discount_percent_snapshot, sale_discount_amount
  ) values (
    v_shop_id, p_customer_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id, v_customer_tier_id,
    p_sale_discount_type, p_sale_discount_value,
    v_sale_discount_percent_snapshot, v_sale_discount_amount
  ) returning id into v_invoice_id;

  -- Second pass: stock arithmetic, batch FEFO allocation, sale_items inserts.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    v_line_subtotal := v_qty * v_price;

    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_resolved_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select id into v_resolved_variant_id
        from public.product_variants
       where product_id = (v_item->>'product_id')::uuid
         and is_default and is_active;
      if v_resolved_variant_id is null then raise exception 'product_has_no_default_variant'; end if;
    else
      raise exception 'item_missing_variant_or_product_id';
    end if;

    select v.id, v.stock, v.avg_cost, v.price as variant_price, p.shop_id, p.id as product_id, p.has_batches,
           p.expired_sale_policy as product_policy
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_resolved_variant_id and v.is_active
     for update;

    if not found then raise exception 'variant_not_found_or_inactive'; end if;
    if v_variant.shop_id <> v_shop_id then raise exception 'variant_not_in_shop'; end if;
    if v_variant.variant_price is null then raise exception 'variant_not_sellable'; end if;
    if v_variant.stock < v_qty then raise exception 'insufficient_stock for variant %', v_variant.id; end if;

    -- Re-derive line discount values (identical to first-pass calc)
    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    if v_item->>'line_discount_value' is null then v_line_discount_value := null;
    else v_line_discount_value := (v_item->>'line_discount_value')::numeric(12,2); end if;
    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    else
      v_line_discount_amount := v_line_discount_value;
    end if;

    if not v_variant.has_batches then
      -- Non-batched path: single sale_items row, cost_at_sale = variant.avg_cost.
      insert into public.sale_items (
        invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
        line_discount_type, line_discount_value, line_discount_amount,
        batch_id, sold_expired
      ) values (
        v_invoice_id, v_variant.id, v_qty, v_price, v_variant.avg_cost,
        v_line_discount_type, v_line_discount_value, v_line_discount_amount,
        null, false
      );
    else
      -- Batched path: FEFO allocation. Either user-picked batch (override) or auto-FEFO.
      v_override_batch_id := nullif(v_item->>'batch_id', '')::uuid;
      select coalesce(
        v_variant.product_policy,
        (select default_expired_sale_policy from public.shops where id = v_shop_id),
        'warn'::public.expired_sale_policy
      ) into v_effective_policy;

      v_qty_arr := array[]::int[];
      v_batch_id_arr := array[]::uuid[];
      v_cost_arr := array[]::numeric(12,2)[];
      v_sold_expired_arr := array[]::boolean[];

      if v_override_batch_id is not null then
        -- Cashier manually picked a specific batch
        select b.id, b.qty_remaining, b.cost_per_unit, b.expiry_date
          into v_batch
          from public.inventory_batches b
         where b.id = v_override_batch_id and b.variant_id = v_variant.id and b.is_active
         for update;
        if not found then raise exception 'batch_not_in_variant_or_inactive'; end if;
        if v_batch.qty_remaining < v_qty then raise exception 'selected_batch_insufficient'; end if;
        v_batch_expired := (v_batch.expiry_date is not null and v_batch.expiry_date < current_date);
        if v_batch_expired then
          if v_effective_policy = 'block' then raise exception 'expired_stock_blocked';
          elsif v_effective_policy = 'warn' and not coalesce(p_confirm_expired_sale, false) then
            raise exception 'expired_stock_needs_confirmation';
          end if;
        end if;
        v_qty_arr := array[v_qty];
        v_batch_id_arr := array[v_batch.id];
        v_cost_arr := array[v_batch.cost_per_unit];
        v_sold_expired_arr := array[v_batch_expired];
      else
        v_remaining_qty := v_qty;
        if v_effective_policy = 'allow' then
          -- Allow-policy: FEFO across all batches including expired (rare; opt-in)
          for v_batch in
            select id, qty_remaining, cost_per_unit, expiry_date
              from public.inventory_batches
             where variant_id = v_variant.id and is_active and qty_remaining > 0
             order by expiry_date nulls last, received_at asc, id asc
             for update
          loop
            exit when v_remaining_qty <= 0;
            v_chunk_qty := least(v_batch.qty_remaining, v_remaining_qty);
            v_qty_arr := v_qty_arr || v_chunk_qty;
            v_batch_id_arr := v_batch_id_arr || v_batch.id;
            v_cost_arr := v_cost_arr || v_batch.cost_per_unit;
            v_sold_expired_arr := v_sold_expired_arr || (
              v_batch.expiry_date is not null and v_batch.expiry_date < current_date);
            v_remaining_qty := v_remaining_qty - v_chunk_qty;
          end loop;
        else
          -- warn/block: first pass over non-expired batches only
          for v_batch in
            select id, qty_remaining, cost_per_unit, expiry_date
              from public.inventory_batches
             where variant_id = v_variant.id and is_active and qty_remaining > 0
               and (expiry_date is null or expiry_date >= current_date)
             order by expiry_date nulls last, received_at asc, id asc
             for update
          loop
            exit when v_remaining_qty <= 0;
            v_chunk_qty := least(v_batch.qty_remaining, v_remaining_qty);
            v_qty_arr := v_qty_arr || v_chunk_qty;
            v_batch_id_arr := v_batch_id_arr || v_batch.id;
            v_cost_arr := v_cost_arr || v_batch.cost_per_unit;
            v_sold_expired_arr := v_sold_expired_arr || false;
            v_remaining_qty := v_remaining_qty - v_chunk_qty;
          end loop;

          if v_remaining_qty > 0 then
            -- Not enough non-expired stock. Either fail or draw on expired with confirmation.
            if v_effective_policy = 'block' then
              raise exception 'insufficient_non_expired_stock for variant %', v_variant.id;
            elsif not coalesce(p_confirm_expired_sale, false) then
              raise exception 'expired_stock_needs_confirmation';
            end if;
            -- warn + confirmed: draw the remainder from expired batches
            for v_batch in
              select id, qty_remaining, cost_per_unit, expiry_date
                from public.inventory_batches
               where variant_id = v_variant.id and is_active and qty_remaining > 0
                 and expiry_date is not null and expiry_date < current_date
               order by expiry_date desc, received_at asc, id asc
               for update
            loop
              exit when v_remaining_qty <= 0;
              v_chunk_qty := least(v_batch.qty_remaining, v_remaining_qty);
              v_qty_arr := v_qty_arr || v_chunk_qty;
              v_batch_id_arr := v_batch_id_arr || v_batch.id;
              v_cost_arr := v_cost_arr || v_batch.cost_per_unit;
              v_sold_expired_arr := v_sold_expired_arr || true;
              v_remaining_qty := v_remaining_qty - v_chunk_qty;
            end loop;
          end if;
        end if;

        if v_remaining_qty > 0 then
          raise exception 'no_batch_stock_available for variant %', v_variant.id;
        end if;
      end if;

      -- Allocate line discount pro-rata across chunks; largest chunk absorbs rounding remainder.
      v_chunk_count := array_length(v_qty_arr, 1);
      v_discount_alloc := array[]::numeric(12,2)[];
      v_alloc_sum := 0;
      v_max_qty_idx := 1;
      for v_chunk_idx in 1..v_chunk_count loop
        v_discount_alloc := v_discount_alloc || round(
          v_line_discount_amount * v_qty_arr[v_chunk_idx] / v_qty, 2);
        v_alloc_sum := v_alloc_sum + v_discount_alloc[v_chunk_idx];
        if v_qty_arr[v_chunk_idx] > v_qty_arr[v_max_qty_idx] then v_max_qty_idx := v_chunk_idx; end if;
      end loop;
      if v_alloc_sum <> v_line_discount_amount then
        v_discount_alloc[v_max_qty_idx] :=
          v_discount_alloc[v_max_qty_idx] + (v_line_discount_amount - v_alloc_sum);
      end if;

      -- One sale_items row per allocated batch chunk; decrement each batch's qty_remaining.
      for v_chunk_idx in 1..v_chunk_count loop
        insert into public.sale_items (
          invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
          line_discount_type, line_discount_value, line_discount_amount,
          batch_id, sold_expired
        ) values (
          v_invoice_id, v_variant.id, v_qty_arr[v_chunk_idx], v_price,
          v_cost_arr[v_chunk_idx],
          v_line_discount_type, v_line_discount_value, v_discount_alloc[v_chunk_idx],
          v_batch_id_arr[v_chunk_idx], v_sold_expired_arr[v_chunk_idx]
        );
        update public.inventory_batches
           set qty_remaining = qty_remaining - v_qty_arr[v_chunk_idx], updated_at = now()
         where id = v_batch_id_arr[v_chunk_idx];
      end loop;
    end if;

    update public.product_variants set stock = stock - v_qty, updated_at = now()
     where id = v_variant.id;
  end loop;

  -- 0086: write created_by_user_id inline; append-only trigger blocks
  -- any post-delegation UPDATE on ledger_entries.
  if v_credit > 0 then
    insert into public.ledger_entries (
      shop_id, customer_id, invoice_id, amount, type, created_by_user_id
    ) values (
      v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit', v_user_id
    );
  end if;

  return v_invoice_id;
end;
$function$
```

## Error envelope

Every wrapper-layer raise uses `using errcode = 'P0001'`. **The `_v28` inner raises do NOT add `using errcode` (and `using detail` is only set for a couple), so they default to SQLSTATE P0001 with no detail.** Frontend dispatch must therefore match on the raw `message` text — see ADR `2026-05-13-v291-rpc-inventory.md §0.5` and the v2.9.1 dispatch ADR.

| Where | Error message | errcode | When raised | Frontend UX mapping |
|---|---|---|---|---|
| wrapper | `not_authenticated` | P0001 | `auth.uid()` is null | redirect to `/login` |
| wrapper | `no_shop_for_user` | P0001 | `current_active_shop_id()` returns null **OR** the `user_shop_access` row doesn't exist | redirect to `/onboarding` or shop switcher |
| wrapper | `insufficient_permissions` (detail: `Required: record_sale`) | P0001 | `user_has_permission(shop, 'record_sale')` is false | toast per B.5 |
| wrapper | `insufficient_permissions` (detail: `Required: confirm_expired_sale_at_pos`) | P0001 | `p_confirm_expired_sale=true` and user lacks `confirm_expired_sale_at_pos` | hide / disable the "Confirm expired sale" toggle for non-permitted users |
| wrapper | `discount_exceeds_line_pct_limit` | P0001 | non-owner; line discount % > `discount_limits.per_line_max_pct` | inline POS line error: "Discount per line cannot exceed {cap}%" |
| wrapper | `discount_exceeds_line_pkr_limit` | P0001 | non-owner; line discount PKR > `per_line_max_pkr` | inline POS line error |
| wrapper | `implicit_discount_exceeds_line_pct_limit` | P0001 | non-owner; computed `1 - price_at_sale/variant.price` > `per_line_max_pct` | "Selling below {variant.price * (1 - cap%)} requires manager approval" |
| wrapper | `discount_exceeds_invoice_pct_limit` | P0001 | non-owner; invoice discount % > `per_invoice_max_pct` | banner above checkout button |
| wrapper | `discount_exceeds_invoice_pkr_limit` | P0001 | non-owner; invoice discount PKR > `per_invoice_max_pkr` | banner |
| inner | `not_authenticated` | P0001 | unreachable in practice (wrapper checks first); inner defensive | redirect to /login |
| inner | `no_shop_for_user` | P0001 | unreachable in practice (`current_shop_id()` would return null only if header missing — wrapper already checks) | redirect to onboarding/switcher |
| inner | `amount_paid_negative` | P0001 | `p_amount_paid < 0` | bug-class — UI prevents |
| inner | `service_charge_negative` | P0001 | `p_service_charge < 0` | bug-class |
| inner | `empty_sale: a sale must have items or a service charge` | P0001 | items empty and service charge is 0 | bug-class — UI prevents checkout when cart empty |
| inner | `sale_discount_type_and_value_must_both_be_set_or_neither` | P0001 | XOR mismatch on (type, value) | invoice-discount popup field error |
| inner | `invalid_sale_discount_type` | P0001 | type not in `('percent','fixed')` | invoice-discount popup field error |
| inner | `sale_discount_percent_out_of_range` | P0001 | percent < 0 or > 100 | invoice-discount popup field error |
| inner | `sale_discount_fixed_negative` | P0001 | fixed value < 0 | invoice-discount popup field error |
| inner | `sale_discount_fixed_exceeds_items_subtotal` | P0001 | fixed > items_subtotal (post-line-discount) | invoice-discount popup field error |
| inner | `qty must be positive` | P0001 | line qty null/<=0 | per-line cart error |
| inner | `price must be non-negative` | P0001 | line price null/<0 | per-line cart error |
| inner | `line_discount_percent_out_of_range` | P0001 | line discount % null/<0/>100 | per-line cart error |
| inner | `line_discount_fixed_negative` | P0001 | line discount fixed < 0 | per-line cart error |
| inner | `line_discount_exceeds_line_subtotal` | P0001 | line discount fixed > line_subtotal | per-line cart error |
| inner | `invalid_line_discount_type` | P0001 | line_discount_type not in (null, 'percent', 'fixed') | bug-class |
| inner | `amount_paid_exceeds_total` | P0001 | `p_amount_paid > v_total` | "Amount received exceeds total" |
| inner | `customer_required_for_credit` | P0001 | `v_credit > 0` and `p_customer_id` is null | "Choose a customer to record on khata" |
| inner | `customer_not_in_shop` | P0001 | `p_customer_id` not in this shop | "Customer not found — reload" |
| inner | `product_has_no_default_variant` | P0001 | legacy `product_id` path; no `is_default && is_active` variant | bug-class |
| inner | `item_missing_variant_or_product_id` | P0001 | line has neither `variant_id` nor `product_id` | bug-class |
| inner | `variant_not_found_or_inactive` | P0001 | variant doesn't exist or `is_active=false` | "This variant is not sellable — refresh" |
| inner | `variant_not_in_shop` | P0001 | variant belongs to another shop | "This variant is not in your shop — refresh" |
| inner | `variant_not_sellable` | P0001 | `variant.price IS NULL` | "Set a price before selling" |
| inner | `insufficient_stock for variant <uuid>` | P0001 | `variant.stock < v_qty` (post `FOR UPDATE` lock) | "Out of stock" — refresh prices |
| inner | `batch_not_in_variant_or_inactive` | P0001 | manual batch pick: batch not in variant or inactive | re-open batch picker |
| inner | `selected_batch_insufficient` | P0001 | manual batch pick: `qty_remaining < v_qty` | re-open batch picker |
| inner | `expired_stock_blocked` | P0001 | manual batch pick is expired AND policy = `'block'` | "This product is blocked on expired stock" |
| inner | `expired_stock_needs_confirmation` | P0001 | warn-policy expired batch and user did NOT pass `p_confirm_expired_sale=true` | toggle "Confirm expired sale" switch (if permission) |
| inner | `insufficient_non_expired_stock for variant <uuid>` | P0001 | block-policy and not enough non-expired stock to cover qty | offer expired-sale confirmation if user has `confirm_expired_sale_at_pos` |
| inner | `no_batch_stock_available for variant <uuid>` | P0001 | after all branches, still couldn't allocate full qty (data anomaly) | refresh stock |

## Invocation contract

- **Params**:
  - `p_customer_id uuid default null` — nullable for cash sales; required if `amount_paid < total`
  - `p_amount_paid numeric default 0` — `>= 0`, `<= total`
  - `p_service_charge numeric default 0` — `>= 0`
  - `p_notes text default null` — free text or null
  - `p_items jsonb default '[]'::jsonb` — array of `{ variant_id? (preferred), product_id? (legacy fallback to default variant), qty: int>0, price_at_sale: numeric>=0, line_discount_type? 'percent'|'fixed', line_discount_value? numeric, batch_id? uuid (manual batch pick for has_batches=true products) }`
  - `p_sale_discount_type text default null` — `'percent'` | `'fixed'` | null; XOR-paired with value
  - `p_sale_discount_value numeric default null` — XOR-paired with type
  - `p_confirm_expired_sale boolean default false` — wrapper-side: requires `confirm_expired_sale_at_pos` permission when true; inner-side: lets warn-policy expired-batch FEFO proceed
- **Returns**: `uuid` (the new `invoices.id`)
- **Permission gates**:
  - Wrapper: `record_sale` (always)
  - Wrapper: `confirm_expired_sale_at_pos` (only when `p_confirm_expired_sale=true`)
  - Wrapper: non-owner discount caps (`user_shop_access.discount_limits.{per_line_max_pct, per_line_max_pkr, per_invoice_max_pct, per_invoice_max_pkr}`); owner bypasses entirely
- **Side effects** (atomic; one transaction):
  - INSERT into `invoices` (sets `cashier_id = v_user_id` inline)
  - INSERT N rows into `sale_items` (one per line for non-batched; one per allocated batch chunk for batched products; sets `cost_at_sale`, `batch_id`, `sold_expired`)
  - UPDATE `product_variants.stock` (decrement; locked `FOR UPDATE`)
  - UPDATE `inventory_batches.qty_remaining` (decrement per chunk; the `batch_auto_deactivate_when_empty` trigger flips `is_active=false` when remaining hits 0)
  - INSERT one `ledger_entries` debit row when `v_credit > 0`; `created_by_user_id = v_user_id` inline (post-0086)
- **Append-only constraints respected**:
  - `invoices` — write `cashier_id` at INSERT, never UPDATE
  - `sale_items` — write all columns at INSERT, never UPDATE
  - `ledger_entries` — write `created_by_user_id` at INSERT; post-delegation UPDATE was removed in 0086 (`ledger_entries_no_modify` trigger blocks any UPDATE)

## Notes

- **The `_v28` body is the sole source of stock arithmetic and FEFO/batch logic.** No JS should anticipate or replicate it. POS preview math is cosmetic only.
- **Two passes over `p_items`** are required because invoice-level totals must be computed before line discount allocation and the invoice insert. The first pass also validates every line.
- **Lock ordering**: variant rows are locked `FOR UPDATE` via `product_variants` join, and batches are locked `FOR UPDATE` in FEFO order (`expiry_date nulls last, received_at asc, id asc`). For two concurrent sales of the same variant, the second waits on the first; deadlocks are avoided because batch order is deterministic.
- **Auditable user identity**: `invoices.cashier_id` is the v2.8.5 audit column. `ledger_entries.created_by_user_id` is the v2.9 audit column (0086). There is no `_v28`-internal use of post-delegation UPDATE; this is correct because both target append-only tables.
- **Implicit discount cap**: the wrapper compares `price_at_sale` against `product_variants.price` (the "list price") on the inferred variant. If `variant.price` is null (v2.8.1 priceless variant), the implicit check is skipped — the inner body will raise `variant_not_sellable` instead. If the line uses `product_id` legacy fallback, the wrapper resolves to the default variant before reading price.
- **Empty `p_items` array**: still allowed when service charge > 0 (service-only invoice). Inner body raises `empty_sale` if both are zero.
- **`product_with_default_variant` is NOT used here** — the inner body queries `product_variants` directly because it needs `FOR UPDATE` row locks.

## Discrepancies vs RPC inventory

None for the wrapper. The inventory section §1.1 lists the live wrapper errors correctly and notes the `_v28` raises lack explicit `using errcode`. Three minor clarifications:
- Inventory line 198 says "no `using errcode` so codes are `'P0001'` by default" — confirmed by reading every `raise exception` in the body. The wrapper raises (and a small subset of inner raises — `sale_discount_*`, `line_discount_*` family) do specify `using errcode = 'P0001'` explicitly, but P0001 is also the plpgsql default for bare `raise exception`, so all raises in this RPC resolve to P0001.
- Inventory line 213 says "wrapper computes both explicit discounts (from `line_discount_*` keys) and implicit discounts (`price_at_sale << variant.price`)" — confirmed; the wrapper's first loop now drives both cap checks.
- The variable `v_warn_expired_needs_confirm` / `v_pol` that appears in migration 0076b's wrapper declaration was removed by the time 0086 wrote the live body; both 0080 and 0086 don't declare them. Live wrapper is the 0086 shape.
