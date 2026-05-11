-- v2.6 §C1 — Rewrite record_sale to operate on product_variants.
--
-- Signature is unchanged from v2.3 (DROP + CREATE not needed). What changes is
-- the *body*: stock + avg_cost are read from product_variants, and stock is
-- decremented on product_variants.stock — never on products.stock.
--
-- Per-item resolution:
--   v_item.variant_id (preferred)            → use it directly
--   v_item.product_id only (v1.x–v2.5 shape) → resolve to the product's
--                                              is_default + is_active variant
--   neither                                  → raise
--
-- INSERT into sale_items writes variant_id; the sync_product_id_from_variant
-- trigger from 0040 fills product_id for legacy report SQL. All v2.3 line
-- discount + sale-level discount + service charge math is byte-equivalent
-- to the prior version.

create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null,
  p_sale_discount_value numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $function$
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

  -- v2.3 sale-level discount guards (unchanged)
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

  -- v2.3 tier categorization snapshot (no pricing effect; analytics only)
  if p_customer_id is not null then
    select tier_id into v_customer_tier_id
      from public.customers
     where id = p_customer_id and shop_id = v_shop_id;
  end if;

  -- ---- Pass 1: line totals (with line discounts) — v2.3 math unchanged ----
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
      if v_line_discount_value is null
         or v_line_discount_value < 0
         or v_line_discount_value > 100 then
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

  -- ---- Apply sale-level discount (v2.3 logic) ----
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

  -- ---- Payment / customer guards (v1.6 logic) ----
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

  -- ---- Insert invoice ----
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

  -- ---- Pass 2: variant-aware locking, stock decrement, sale_items insert ----
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    v_line_subtotal := v_qty * v_price;

    -- v2.6 resolution: prefer variant_id; fall back to product_id → default variant.
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

    -- Lock the variant + verify shop ownership through the product join.
    select v.id, v.stock, v.avg_cost, v.price as variant_price, p.shop_id, p.id as product_id
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

    -- Recompute line discount details for the sale_items row.
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

    -- Insert variant_id; sync_product_id_from_variant trigger fills product_id.
    insert into public.sale_items (
      invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
      line_discount_type, line_discount_value, line_discount_amount
    ) values (
      v_invoice_id, v_variant.id, v_qty, v_price, v_variant.avg_cost,
      v_line_discount_type, v_line_discount_value, v_line_discount_amount
    );

    -- THE critical line of v2.6: stock decrements on variants, not products.
    update public.product_variants set stock = stock - v_qty, updated_at = now()
     where id = v_variant.id;
  end loop;

  -- ---- Ledger entry on credit / partial (v1.6 logic, post-discount total) ----
  if v_credit > 0 then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit');
  end if;

  return v_invoice_id;
end;
$function$;

revoke execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric)
  from public, anon;
grant  execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric)
  to authenticated;
