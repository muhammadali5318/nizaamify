
-- 0086_ledger_audit_at_insert.sql
--
-- Fixes "ledger_entries are append-only — reverse the entry instead of
-- updating it" P0001 raised by ledger_entries_no_modify trigger.
--
-- Root cause: migration 0080's post-delegation audit pattern (UPDATE
-- the affected row to stamp created_by_user_id = auth.uid()) is
-- incompatible with append-only tables. ledger_entries blocks every
-- UPDATE by design — there's no allowlist for "this is an audit
-- write, let it through."
--
-- Scope verification done before this migration:
--   Six append-only tables exist (ledger_entries, invoices, sale_items,
--   purchases, purchase_items, purchase_overhead_items). Only three v2.9
--   wrappers do post-delegation UPDATEs on any of them — all three target
--   ledger_entries. The other five append-only tables receive their audit
--   columns at INSERT time inside the _v28 body (invoices.cashier_id is
--   already inline, etc.). No other wrapper needs this fix.
--
-- Discipline rule (added to docs/gotchas.md): for append-only tables,
-- audit columns must be written at INSERT inside the function doing the
-- insert. Post-delegation UPDATEs do not work.

begin;

-- ─────────────────────────────────────────────────────────────────────
-- record_sale_v28 — credit/partial sale path inserts a debit row
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.record_sale_v28(
  p_customer_id uuid default null::uuid,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null::text,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null::text,
  p_sale_discount_value numeric default null::numeric,
  p_confirm_expired_sale boolean default false
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
        select b.id, b.qty_remaining, b.cost_per_unit, b.expiry_date
          into v_batch
          from public.inventory_batches b
         where b.id = v_override_batch_id
           and b.variant_id = v_variant.id
           and b.is_active
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
              v_batch.expiry_date is not null and v_batch.expiry_date < current_date
            );
            v_remaining_qty := v_remaining_qty - v_chunk_qty;
          end loop;
        else
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
              raise exception 'expired_stock_needs_confirmation';
            end if;

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
          raise exception 'no_batch_stock_available for variant %', v_variant.id;
        end if;
      end if;

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
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- receive_payment_v28 — payment receipt inserts a credit row
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.receive_payment_v28(
  p_customer_id uuid, p_amount numeric, p_notes text default null::text
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_outstanding numeric(12,2);
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_must_be_positive' using errcode = 'P0001';
  end if;

  select outstanding_balance into v_outstanding
    from public.customers
   where id = p_customer_id and shop_id = v_shop_id
   for update;
  if not found then raise exception 'customer_not_in_shop' using errcode = 'P0001'; end if;
  if p_amount > v_outstanding then
    raise exception 'overpayment_customer max=%', v_outstanding using errcode = 'P0001';
  end if;

  -- 0086: write created_by_user_id inline.
  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type,
    occurred_at, paid_at, notes, created_by_user_id
  ) values (
    v_shop_id, p_customer_id, null, p_amount, 'credit',
    now(), now(), nullif(trim(p_notes), ''), v_user_id
  ) returning id into v_entry_id;

  return v_entry_id;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- reverse_ledger_entry_v28 — inserts the reversal row
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.reverse_ledger_entry_v28(
  p_entry_id uuid, p_notes text default null::text
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_orig record;
  v_new_id uuid;
  v_new_type text;
  v_new_invoice_id uuid;
  v_already_reversed uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select * into v_orig
    from public.ledger_entries
   where id = p_entry_id and shop_id = v_shop_id
   for update;
  if not found then raise exception 'entry_not_in_shop' using errcode = 'P0001'; end if;

  if v_orig.reverses_entry_id is not null then
    raise exception 'cannot_reverse_a_reversal' using errcode = 'P0001';
  end if;

  if v_orig.invoice_id is not null then
    raise exception 'cannot_reverse_invoice_tied_debit'
      using errcode = 'P0001',
            hint = 'Sale-tied debits cannot be reversed directly. Use receive_payment if the customer paid; void_sale (v1.9) for full sale reversal.';
  end if;

  select id into v_already_reversed
    from public.ledger_entries
   where reverses_entry_id = p_entry_id;
  if v_already_reversed is not null then
    raise exception 'entry_already_reversed' using errcode = 'P0001';
  end if;

  v_new_type := case when v_orig.type = 'debit' then 'credit' else 'debit' end;
  v_new_invoice_id := case when v_new_type = 'credit' then null else v_orig.invoice_id end;

  -- 0086: write created_by_user_id inline.
  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type,
    occurred_at, paid_at, notes, reverses_entry_id, created_by_user_id
  ) values (
    v_orig.shop_id, v_orig.customer_id, v_new_invoice_id, v_orig.amount, v_new_type,
    now(),
    case when v_new_type = 'credit' then now() else null end,
    coalesce(nullif(trim(p_notes), ''), 'Reversal of entry ' || substr(p_entry_id::text, 1, 8)),
    p_entry_id, v_user_id
  ) returning id into v_new_id;

  return v_new_id;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- Outer wrappers: drop the post-delegation UPDATE on ledger_entries.
-- Everything else (auth/shop preconditions, permission gate,
-- salesperson cap on receive_payment, discount caps on record_sale,
-- reversal preconditions on reverse_ledger_entry) stays.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.record_sale(
  p_customer_id uuid default null::uuid,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null::text,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null::text,
  p_sale_discount_value numeric default null::numeric,
  p_confirm_expired_sale boolean default false
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
end; $function$;

create or replace function public.receive_payment(
  p_customer_id uuid, p_amount numeric, p_notes text default null::text
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_is_owner boolean; v_cap numeric; v_today_total numeric; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'receive_payment') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: receive_payment'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive' using errcode = 'P0001'; end if;
  select is_owner into v_is_owner from public.user_shop_access where user_id = auth.uid() and shop_id = v_shop_id;
  if v_is_owner is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not v_is_owner then
    perform pg_advisory_xact_lock(hashtextextended(v_shop_id::text || auth.uid()::text || current_date::text, 0));
    select salesperson_payment_cap_pkr into v_cap from public.shops where id = v_shop_id;
    select coalesce(sum(amount), 0) into v_today_total
      from public.ledger_entries
     where created_by_user_id = auth.uid() and shop_id = v_shop_id
       and type = 'credit' and created_at::date = current_date;
    if v_today_total + p_amount > v_cap + 0.001 then
      raise exception 'salesperson_payment_cap_exceeded' using errcode = 'P0001',
        detail = format('today total %s + this %s > cap %s', v_today_total, p_amount, v_cap); end if;
  end if;

  -- Delegate; created_by_user_id written inline (0086). No post-update.
  v_id := public.receive_payment_v28(p_customer_id, p_amount, p_notes);
  return v_id;
end; $function$;

create or replace function public.reverse_ledger_entry(
  p_entry_id uuid, p_notes text default null::text
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'reverse_ledger_entry') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: reverse_ledger_entry'; end if;

  -- Delegate; created_by_user_id written inline (0086). No post-update.
  v_id := public.reverse_ledger_entry_v28(p_entry_id, p_notes);
  return v_id;
end; $function$;

commit;
