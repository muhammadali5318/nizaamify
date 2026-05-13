
-- v2.9 Phase C migration 0076b: complete the remediation set from Checkpoint 2
-- 6 wrapper rewrites covering 8 logical items (projection × 4 + record_sale × 3 + receive_payment cap)

-- =====================================================================
-- 1. search_products — conditional projection
-- =====================================================================
create or replace function public.search_products(
  p_query text default null, p_limit integer default 50, p_offset integer default 0,
  p_only_in_stock boolean default false, p_category_id uuid default null, p_needs_pricing boolean default false
) returns table(id uuid, name text, type text, category_id uuid, description text, price numeric,
                avg_cost numeric, last_purchase_cost numeric, stock integer, is_active boolean,
                relevance real, has_variants boolean, variant_count bigint, min_price numeric, max_price numeric,
                total_stock_all_variants bigint, has_null_price_variant boolean, has_batches boolean, default_variant_id uuid)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
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
end; $fn$;

-- =====================================================================
-- 2. recent_purchase_products — conditional projection
-- =====================================================================
create or replace function public.recent_purchase_products(p_limit integer default 10)
returns table(id uuid, name text, type text, price numeric, avg_cost numeric, stock integer, last_used_at timestamp with time zone)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
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
end; $fn$;

-- =====================================================================
-- 3. list_customers — conditional projection (phone + address + outstanding)
-- =====================================================================
create or replace function public.list_customers(p_query text default '', p_limit integer default 25, p_offset integer default 0)
returns table(id uuid, name text, phone text, address text, outstanding numeric, invoice_count bigint, last_activity_at timestamp with time zone, total_count bigint)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
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
end; $fn$;

-- =====================================================================
-- 4. recent_customers — conditional projection (phone + address) (NEW gap from Checkpoint 2)
-- =====================================================================
create or replace function public.recent_customers(p_limit integer default 10)
returns table(id uuid, name text, phone text, address text, last_activity_at timestamp with time zone)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
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
end; $fn$;

-- =====================================================================
-- 5/6/7. record_sale — add discount cap, implicit-discount check, confirm_expired_sale_at_pos enforcement
-- All three checks fire in the WRAPPER before delegation to record_sale_v28.
-- =====================================================================
create or replace function public.record_sale(
  p_customer_id uuid default null, p_amount_paid numeric default 0,
  p_service_charge numeric default 0, p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_sale_discount_type text default null, p_sale_discount_value numeric default null,
  p_confirm_expired_sale boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $fn$
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
  v_warn_expired_needs_confirm boolean := false;
  v_pol public.expired_sale_policy;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_sale') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_sale'; end if;

  -- Resolve caller's effective limits (owner bypasses)
  select usa.is_owner, usa.discount_limits into v_is_owner, v_limits
    from public.user_shop_access usa
   where usa.user_id = auth.uid() and usa.shop_id = v_shop_id;
  if v_is_owner is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;

  v_line_max_pct := nullif(v_limits ->> 'per_line_max_pct', '')::numeric;
  v_invoice_max_pct := nullif(v_limits ->> 'per_invoice_max_pct', '')::numeric;
  v_line_max_pkr := nullif(v_limits ->> 'per_line_max_pkr', '')::numeric;
  v_invoice_max_pkr := nullif(v_limits ->> 'per_invoice_max_pkr', '')::numeric;

  -- Per-line checks: explicit + implicit discount via price=0
  if jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_qty := (v_item->>'qty')::int;
      v_price := (v_item->>'price_at_sale')::numeric;
      if v_qty is null or v_price is null or v_qty <= 0 then continue; end if;
      v_line_subtotal := v_qty * v_price;
      v_items_subtotal := v_items_subtotal + v_line_subtotal;

      -- Explicit per-line discount → percent + PKR amount
      if v_item->>'line_discount_type' = 'percent' then
        v_line_disc_pct := (v_item->>'line_discount_value')::numeric;
        v_line_disc_amt := round(v_line_subtotal * v_line_disc_pct / 100, 2);
      elsif v_item->>'line_discount_type' = 'fixed' then
        v_line_disc_amt := (v_item->>'line_discount_value')::numeric;
        v_line_disc_pct := case when v_line_subtotal > 0 then (v_line_disc_amt / v_line_subtotal * 100) else 0 end;
      else
        v_line_disc_amt := 0; v_line_disc_pct := 0;
      end if;

      -- Non-owner cap checks (owner bypasses)
      if not v_is_owner then
        if v_line_max_pct is not null and v_line_disc_pct > v_line_max_pct + 0.001 then
          raise exception 'discount_exceeds_line_pct_limit' using errcode = 'P0001',
            detail = format('line discount %s%% exceeds cap %s%%', v_line_disc_pct, v_line_max_pct);
        end if;
        if v_line_max_pkr is not null and v_line_disc_amt > v_line_max_pkr + 0.001 then
          raise exception 'discount_exceeds_line_pkr_limit' using errcode = 'P0001',
            detail = format('line discount %s PKR exceeds cap %s PKR', v_line_disc_amt, v_line_max_pkr);
        end if;
      end if;

      -- Implicit-discount check: price_at_sale << variant.price
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
              detail = format('implicit discount %s%% (price %s vs variant.price %s) exceeds cap %s%%',
                              round(v_implicit_disc_pct, 2), v_price, v_variant_price, v_line_max_pct);
          end if;
        end if;
      end if;
    end loop;
  end if;

  -- Per-invoice discount checks
  if p_sale_discount_type = 'percent' then
    v_invoice_disc_pct := p_sale_discount_value;
    v_invoice_disc_amt := round(v_items_subtotal * p_sale_discount_value / 100, 2);
  elsif p_sale_discount_type = 'fixed' then
    v_invoice_disc_amt := p_sale_discount_value;
    v_invoice_disc_pct := case when v_items_subtotal > 0 then (p_sale_discount_value / v_items_subtotal * 100) else 0 end;
  else
    v_invoice_disc_pct := 0; v_invoice_disc_amt := 0;
  end if;

  if not v_is_owner then
    if v_invoice_max_pct is not null and v_invoice_disc_pct > v_invoice_max_pct + 0.001 then
      raise exception 'discount_exceeds_invoice_pct_limit' using errcode = 'P0001',
        detail = format('invoice discount %s%% exceeds cap %s%%', v_invoice_disc_pct, v_invoice_max_pct);
    end if;
    if v_invoice_max_pkr is not null and v_invoice_disc_amt > v_invoice_max_pkr + 0.001 then
      raise exception 'discount_exceeds_invoice_pkr_limit' using errcode = 'P0001',
        detail = format('invoice discount %s PKR exceeds cap %s PKR', v_invoice_disc_amt, v_invoice_max_pkr);
    end if;
  end if;

  -- F-PD-11: confirm_expired_sale_at_pos permission gate
  -- If caller passes p_confirm_expired_sale=true, they must have the permission.
  if coalesce(p_confirm_expired_sale, false) = true
     and not public.user_has_permission(v_shop_id, 'confirm_expired_sale_at_pos') then
    raise exception 'insufficient_permissions' using errcode = 'P0001',
      detail = 'Required: confirm_expired_sale_at_pos (to confirm a warn-policy expired-batch sale)';
  end if;

  -- All checks passed; delegate to v2.8.5 body for the actual sale
  return public.record_sale_v28(p_customer_id, p_amount_paid, p_service_charge, p_notes, p_items, p_sale_discount_type, p_sale_discount_value, p_confirm_expired_sale);
end; $fn$;

-- =====================================================================
-- 8. receive_payment — non-owner daily cap
-- =====================================================================
create or replace function public.receive_payment(p_customer_id uuid, p_amount numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_is_owner boolean;
  v_cap numeric;
  v_today_total numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'receive_payment') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: receive_payment'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive' using errcode = 'P0001'; end if;

  select is_owner into v_is_owner from public.user_shop_access
   where user_id = auth.uid() and shop_id = v_shop_id;
  if v_is_owner is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;

  -- Owner bypasses the cap. Non-owners are capped at shops.salesperson_payment_cap_pkr per day.
  if not v_is_owner then
    -- Advisory lock per (shop, user, day) to serialize concurrent attempts
    perform pg_advisory_xact_lock(
      hashtextextended(v_shop_id::text || auth.uid()::text || current_date::text, 0));
    select salesperson_payment_cap_pkr into v_cap from public.shops where id = v_shop_id;
    select coalesce(sum(amount), 0) into v_today_total
      from public.ledger_entries
     where created_by_user_id = auth.uid()
       and shop_id = v_shop_id
       and type = 'credit'
       and created_at::date = current_date;
    if v_today_total + p_amount > v_cap + 0.001 then
      raise exception 'salesperson_payment_cap_exceeded' using errcode = 'P0001',
        detail = format('today total %s + this payment %s exceeds cap %s', v_today_total, p_amount, v_cap);
    end if;
  end if;

  -- Delegate to v2.8.5 body for the actual ledger insert
  return public.receive_payment_v28(p_customer_id, p_amount, p_notes);
end; $fn$;
