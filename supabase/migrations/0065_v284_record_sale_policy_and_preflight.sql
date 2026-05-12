-- v2.8.4 — record_sale policy enforcement + preflight check RPC.
--   §A. record_sale rewrite: adds p_confirm_expired_sale param.
--       For batched lines, resolves coalesce(product.policy, shop.default, 'warn'):
--         • block — refuses expired batches; raises insufficient_non_expired_stock
--                   when only-expired stock remains. Manual override of an
--                   expired batch raises expired_stock_blocked.
--         • warn  — FEFO skips expired by default; if non-expired insufficient
--                   AND p_confirm_expired_sale = false, raises
--                   expired_stock_needs_confirmation. With confirmation,
--                   extends FEFO into expired batches ordered expiry_date DESC
--                   (least-expired first per spec §3.2). Manual override of
--                   an expired batch follows the same confirmation gate.
--         • allow — v2.8 behaviour preserved (single-pass FEFO without
--                   expiry filter); sold_expired flag still snapshotted.
--       Each sale_items insert carries the per-chunk sold_expired snapshot.
--
--   §B. preflight_expired_sale_check(p_items jsonb): a read-only RPC the
--       POS calls before submit. Returns (variant_id, would_draw_expired,
--       expired_batch_ids, policy) per item so the frontend can render the
--       block / warn dialog without a round-trip failure. Gated on
--       products.has_batches — non-batched lines always return
--       would_draw_expired = false.

-- =====================================================================
-- §A. record_sale rewrite — DROP + CREATE because the signature changes.
-- =====================================================================
drop function if exists public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric);

create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null,
  p_sale_discount_value numeric default null,
  p_confirm_expired_sale boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $$
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
  if p_sale_discount_type is not null
     and p_sale_discount_type not in ('percent', 'fixed') then
    raise exception 'invalid_sale_discount_type';
  end if;
  if p_sale_discount_type = 'percent'
     and (p_sale_discount_value < 0 or p_sale_discount_value > 100) then
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

  -- Subtotal validation pass (unchanged from v2.6c / v2.8).
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
  if v_credit > 0 and p_customer_id is null then
    raise exception 'customer_required_for_credit';
  end if;
  if p_customer_id is not null then
    if not exists (
      select 1 from public.customers where id = p_customer_id and shop_id = v_shop_id
    ) then raise exception 'customer_not_in_shop'; end if;
  end if;

  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id,
    tier_id,
    sale_discount_type, sale_discount_value,
    sale_discount_percent_snapshot, sale_discount_amount
  ) values (
    v_shop_id, p_customer_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id,
    v_customer_tier_id,
    p_sale_discount_type, p_sale_discount_value,
    v_sale_discount_percent_snapshot, v_sale_discount_amount
  ) returning id into v_invoice_id;

  -- Insertion pass — per cart line
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    v_line_subtotal := v_qty * v_price;

    -- Resolve variant_id (existing logic — v2.6 ADR-0025)
    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_resolved_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select id into v_resolved_variant_id
        from public.product_variants
       where product_id = (v_item->>'product_id')::uuid
         and is_default and is_active;
      if v_resolved_variant_id is null then
        raise exception 'product_has_no_default_variant';
      end if;
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
    if v_variant.stock < v_qty then
      raise exception 'insufficient_stock for variant %', v_variant.id;
    end if;

    -- Re-compute line discount for this row
    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    if v_item->>'line_discount_value' is null then
      v_line_discount_value := null;
    else
      v_line_discount_value := (v_item->>'line_discount_value')::numeric(12,2);
    end if;
    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    else
      v_line_discount_amount := v_line_discount_value;
    end if;

    if not v_variant.has_batches then
      -- ─── Non-batched: unchanged from v2.6c ────────────────────────
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
      -- ─── Batched: FEFO or override, with policy enforcement ──────
      v_override_batch_id := nullif(v_item->>'batch_id', '')::uuid;

      -- Resolve effective policy: product override → shop default → 'warn'
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
        -- ─── Manual override path ───────────────────────────────────
        select b.id, b.qty_remaining, b.cost_per_unit, b.expiry_date
          into v_batch
          from public.inventory_batches b
         where b.id = v_override_batch_id
           and b.variant_id = v_variant.id
           and b.is_active
           for update;
        if not found then raise exception 'batch_not_in_variant_or_inactive'; end if;
        if v_batch.qty_remaining < v_qty then
          raise exception 'selected_batch_insufficient';
        end if;

        v_batch_expired := (v_batch.expiry_date is not null
                            and v_batch.expiry_date < current_date);

        if v_batch_expired then
          if v_effective_policy = 'block' then
            raise exception 'expired_stock_blocked';
          elsif v_effective_policy = 'warn' and not coalesce(p_confirm_expired_sale, false) then
            raise exception 'expired_stock_needs_confirmation';
          end if;
        end if;

        v_qty_arr := array[v_qty];
        v_batch_id_arr := array[v_batch.id];
        v_cost_arr := array[v_batch.cost_per_unit];
        v_sold_expired_arr := array[v_batch_expired];
      else
        -- ─── FEFO walk ──────────────────────────────────────────────
        v_remaining_qty := v_qty;

        if v_effective_policy = 'allow' then
          -- Single pass: v2.8 candidate set (no expiry filter); flag
          -- each chunk's sold_expired from the batch's own expiry_date.
          for v_batch in
            select id, qty_remaining, cost_per_unit, expiry_date
              from public.inventory_batches
             where variant_id = v_variant.id
               and is_active and qty_remaining > 0
             order by expiry_date nulls last, received_at asc, id asc
             for update
          loop
            exit when v_remaining_qty <= 0;
            v_chunk_qty := least(v_batch.qty_remaining, v_remaining_qty);
            v_qty_arr := v_qty_arr || v_chunk_qty;
            v_batch_id_arr := v_batch_id_arr || v_batch.id;
            v_cost_arr := v_cost_arr || v_batch.cost_per_unit;
            v_sold_expired_arr := v_sold_expired_arr || (
              v_batch.expiry_date is not null
              and v_batch.expiry_date < current_date
            );
            v_remaining_qty := v_remaining_qty - v_chunk_qty;
          end loop;
        else
          -- block / warn: Pass 1 over non-expired batches only.
          for v_batch in
            select id, qty_remaining, cost_per_unit, expiry_date
              from public.inventory_batches
             where variant_id = v_variant.id
               and is_active and qty_remaining > 0
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
            if v_effective_policy = 'block' then
              raise exception 'insufficient_non_expired_stock for variant %', v_variant.id;
            elsif not coalesce(p_confirm_expired_sale, false) then
              -- warn + not confirmed
              raise exception 'expired_stock_needs_confirmation';
            end if;

            -- warn + confirmed: Pass 2 over expired batches, least-expired
            -- first (expiry_date DESC — the largest past date is closest
            -- to today). Spec §3.2.
            for v_batch in
              select id, qty_remaining, cost_per_unit, expiry_date
                from public.inventory_batches
               where variant_id = v_variant.id
                 and is_active and qty_remaining > 0
                 and expiry_date is not null
                 and expiry_date < current_date
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
          -- Audit invariant breach (variant.stock said we could cover it,
          -- but the batch ledger disagreed).
          raise exception 'no_batch_stock_available for variant %', v_variant.id;
        end if;
      end if;

      -- Allocate line_discount_amount across chunks via largest-remainder
      v_chunk_count := array_length(v_qty_arr, 1);
      v_discount_alloc := array[]::numeric(12,2)[];
      v_alloc_sum := 0;
      v_max_qty_idx := 1;
      for v_chunk_idx in 1..v_chunk_count loop
        v_discount_alloc := v_discount_alloc || round(
          v_line_discount_amount * v_qty_arr[v_chunk_idx] / v_qty, 2
        );
        v_alloc_sum := v_alloc_sum + v_discount_alloc[v_chunk_idx];
        if v_qty_arr[v_chunk_idx] > v_qty_arr[v_max_qty_idx] then
          v_max_qty_idx := v_chunk_idx;
        end if;
      end loop;
      if v_alloc_sum <> v_line_discount_amount then
        v_discount_alloc[v_max_qty_idx] :=
          v_discount_alloc[v_max_qty_idx] + (v_line_discount_amount - v_alloc_sum);
      end if;

      -- Emit one sale_items row per chunk; decrement the batch.
      for v_chunk_idx in 1..v_chunk_count loop
        insert into public.sale_items (
          invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
          line_discount_type, line_discount_value, line_discount_amount,
          batch_id, sold_expired
        ) values (
          v_invoice_id, v_variant.id, v_qty_arr[v_chunk_idx], v_price,
          v_cost_arr[v_chunk_idx],
          v_line_discount_type, v_line_discount_value,
          v_discount_alloc[v_chunk_idx],
          v_batch_id_arr[v_chunk_idx],
          v_sold_expired_arr[v_chunk_idx]
        );
        update public.inventory_batches
           set qty_remaining = qty_remaining - v_qty_arr[v_chunk_idx],
               updated_at = now()
         where id = v_batch_id_arr[v_chunk_idx];
      end loop;
    end if;

    -- Always decrement variant.stock by the full qty (unchanged from v2.6).
    update public.product_variants set stock = stock - v_qty, updated_at = now()
     where id = v_variant.id;
  end loop;

  if v_credit > 0 then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit');
  end if;

  return v_invoice_id;
end;
$$;

revoke all on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric, boolean) from public, anon;
grant execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric, boolean) to authenticated;

-- =====================================================================
-- §B. preflight_expired_sale_check — read-only pre-submit check.
-- =====================================================================
create or replace function public.preflight_expired_sale_check(
  p_items jsonb default '[]'::jsonb
) returns table (
  variant_id uuid,
  would_draw_expired boolean,
  expired_batch_ids uuid[],
  policy public.expired_sale_policy
)
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_item jsonb;
  v_variant_id uuid;
  v_qty int;
  v_override_batch_id uuid;
  v_has_batches boolean;
  v_product_policy public.expired_sale_policy;
  v_effective_policy public.expired_sale_policy;
  v_non_expired_stock int;
  v_would_draw_expired boolean;
  v_expired_batch_ids uuid[];
  v_batch_expiry date;
begin
  if v_shop_id is null then return; end if;
  if jsonb_typeof(p_items) is null then p_items := '[]'::jsonb; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then continue; end if;

    -- Resolve variant_id, mirroring record_sale.
    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select id into v_variant_id
        from public.product_variants
       where product_id = (v_item->>'product_id')::uuid
         and is_default and is_active;
      if v_variant_id is null then continue; end if;
    else
      continue;
    end if;

    -- Pull product flag + per-product policy; gate on cross-shop access.
    select p.has_batches, p.expired_sale_policy
      into v_has_batches, v_product_policy
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where pv.id = v_variant_id
       and p.shop_id = v_shop_id;

    if not found then continue; end if;

    -- Resolve effective policy (always — useful even for non-batched).
    select coalesce(
      v_product_policy,
      (select default_expired_sale_policy from public.shops where id = v_shop_id),
      'warn'::public.expired_sale_policy
    ) into v_effective_policy;

    -- Non-batched products never draw from "expired stock" (there is none).
    if not v_has_batches then
      variant_id := v_variant_id;
      would_draw_expired := false;
      expired_batch_ids := array[]::uuid[];
      policy := v_effective_policy;
      return next;
      continue;
    end if;

    v_override_batch_id := nullif(v_item->>'batch_id', '')::uuid;

    if v_override_batch_id is not null then
      -- Manual override: check that specific batch's expiry only.
      select expiry_date into v_batch_expiry
        from public.inventory_batches
       where id = v_override_batch_id
         and variant_id = v_variant_id
         and is_active;
      v_would_draw_expired := (v_batch_expiry is not null
                               and v_batch_expiry < current_date);
      if v_would_draw_expired then
        v_expired_batch_ids := array[v_override_batch_id];
      else
        v_expired_batch_ids := array[]::uuid[];
      end if;
    else
      -- FEFO path: would non-expired stock alone cover the requested qty?
      select coalesce(sum(qty_remaining), 0)::int
        into v_non_expired_stock
        from public.inventory_batches
       where variant_id = v_variant_id
         and is_active
         and qty_remaining > 0
         and (expiry_date is null or expiry_date >= current_date);

      v_would_draw_expired := (v_non_expired_stock < v_qty);

      if v_would_draw_expired then
        select coalesce(array_agg(id order by expiry_date desc), array[]::uuid[])
          into v_expired_batch_ids
          from public.inventory_batches
         where variant_id = v_variant_id
           and is_active
           and qty_remaining > 0
           and expiry_date is not null
           and expiry_date < current_date;
      else
        v_expired_batch_ids := array[]::uuid[];
      end if;
    end if;

    variant_id := v_variant_id;
    would_draw_expired := v_would_draw_expired;
    expired_batch_ids := v_expired_batch_ids;
    policy := v_effective_policy;
    return next;
  end loop;
end;
$$;

revoke all on function public.preflight_expired_sale_check(jsonb) from public, anon;
grant execute on function public.preflight_expired_sale_check(jsonb) to authenticated;
