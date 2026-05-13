
-- v2.9 Phase H migration 0080: audit `_by_user_id` writes
-- Pattern: each wrapper does post-delegation UPDATE to set the appropriate
-- _by_user_id column from auth.uid(). Idempotent via "is null" guards.
-- _v28 bodies are NOT touched.

-- =====================================================================
-- record_sale: ledger_entries.created_by_user_id for credit/partial sales
-- (refactored from "return inner()" to "v_id := inner(); update; return v_id;")
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

  -- Delegate to v2.8.5 body
  v_invoice_id := public.record_sale_v28(p_customer_id, p_amount_paid, p_service_charge, p_notes,
                                          p_items, p_sale_discount_type, p_sale_discount_value,
                                          p_confirm_expired_sale);

  -- Audit write: if credit/partial sale created a ledger_entries debit row, stamp created_by_user_id
  update public.ledger_entries
     set created_by_user_id = auth.uid()
   where invoice_id = v_invoice_id and created_by_user_id is null;

  return v_invoice_id;
end; $fn$;

-- =====================================================================
-- receive_payment: ledger_entries.created_by_user_id (refactor return, add audit)
-- =====================================================================
create or replace function public.receive_payment(p_customer_id uuid, p_amount numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
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

  v_id := public.receive_payment_v28(p_customer_id, p_amount, p_notes);

  -- Audit write
  update public.ledger_entries set created_by_user_id = auth.uid() where id = v_id;

  return v_id;
end; $fn$;

-- =====================================================================
-- reverse_ledger_entry
-- =====================================================================
create or replace function public.reverse_ledger_entry(p_entry_id uuid, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'reverse_ledger_entry') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: reverse_ledger_entry'; end if;
  v_id := public.reverse_ledger_entry_v28(p_entry_id, p_notes);
  update public.ledger_entries set created_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $fn$;

-- =====================================================================
-- Batch ops: deactivate_batch, record_partial_writeoff
-- =====================================================================
create or replace function public.deactivate_batch(p_batch_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'writeoff_batch') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: writeoff_batch'; end if;
  perform public.deactivate_batch_v28(p_batch_id, p_reason);
  update public.inventory_batches set last_modified_by_user_id = auth.uid() where id = p_batch_id;
end; $fn$;

create or replace function public.record_partial_writeoff(p_batch_id uuid, p_qty integer, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'writeoff_batch') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: writeoff_batch'; end if;
  perform public.record_partial_writeoff_v28(p_batch_id, p_qty, p_reason);
  update public.inventory_batches set last_modified_by_user_id = auth.uid() where id = p_batch_id;
end; $fn$;

-- =====================================================================
-- Customer tiers
-- =====================================================================
create or replace function public.define_tier(p_name text, p_is_default boolean default false, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_customer_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_customer_tiers'; end if;
  v_id := public.define_tier_v28(p_name, p_is_default, p_notes);
  update public.customer_tiers set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $fn$;

create or replace function public.update_tier(p_tier_id uuid, p_name text, p_is_default boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_customer_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_customer_tiers'; end if;
  perform public.update_tier_v28(p_tier_id, p_name, p_is_default, p_notes);
  update public.customer_tiers set updated_by_user_id = auth.uid() where id = p_tier_id;
end; $fn$;

create or replace function public.set_default_tier(p_tier_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_customer_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_customer_tiers'; end if;
  perform public.set_default_tier_v28(p_tier_id);
  update public.customer_tiers set updated_by_user_id = auth.uid() where id = p_tier_id;
end; $fn$;

create or replace function public.deactivate_tier(p_tier_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_int int;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_customer_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_customer_tiers'; end if;
  v_int := public.deactivate_tier_v28(p_tier_id);
  update public.customer_tiers set updated_by_user_id = auth.uid() where id = p_tier_id;
  return v_int;
end; $fn$;

-- =====================================================================
-- Suppliers, categories
-- =====================================================================
create or replace function public.create_supplier_inline(p_name text, p_contact text default null, p_address text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_suppliers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_suppliers'; end if;
  v_id := public.create_supplier_inline_v28(p_name, p_contact, p_address, p_notes);
  update public.suppliers set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $fn$;

create or replace function public.create_category_inline(p_name text) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_categories') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_categories'; end if;
  v_id := public.create_category_inline_v28(p_name);
  update public.product_categories set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $fn$;

create or replace function public.update_category(p_id uuid, p_name text default null, p_is_active boolean default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_categories') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_categories'; end if;
  perform public.update_category_v28(p_id, p_name, p_is_active);
  update public.product_categories set updated_by_user_id = auth.uid() where id = p_id;
end; $fn$;

-- =====================================================================
-- Variant attributes (only the new-row functions; update/deactivate funcs have no _by column to set)
-- =====================================================================
create or replace function public.create_variant_attribute(p_name text, p_display_order integer default 0)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_variant_attributes') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_variant_attributes'; end if;
  v_id := public.create_variant_attribute_v28(p_name, p_display_order);
  update public.variant_attributes set created_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $fn$;

create or replace function public.add_variant_value(p_attribute_id uuid, p_value text, p_display_order integer default 0)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_variant_attributes') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_variant_attributes'; end if;
  v_id := public.add_variant_value_v28(p_attribute_id, p_value, p_display_order);
  update public.variant_attribute_values set created_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $fn$;

-- =====================================================================
-- Products: add_variant_to_product, create_product_with_*
-- =====================================================================
create or replace function public.add_variant_to_product(p_product_id uuid, p_attribute_value_ids uuid[], p_sku text default null, p_price numeric default null, p_opening_stock integer default 0, p_opening_cost numeric default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_product'; end if;
  v_id := public.add_variant_to_product_v28(p_product_id, p_attribute_value_ids, p_sku, p_price, p_opening_stock, p_opening_cost);
  update public.product_variants set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $fn$;

create or replace function public.create_product_with_opening_stock(
  p_name text, p_category_id uuid, p_price numeric default null, p_opening_stock integer default 0,
  p_opening_cost numeric default null, p_is_scan_only boolean default false, p_base_unit_code text default 'each',
  p_description text default null, p_has_batches boolean default false,
  p_expiry_alert_days integer default null, p_warranty_alert_days integer default null
) returns table(product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
        v_pid uuid; v_vid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_product'; end if;
  select t.product_id, t.variant_id into v_pid, v_vid
    from public.create_product_with_opening_stock_v28(p_name, p_category_id, p_price, p_opening_stock, p_opening_cost, p_is_scan_only, p_base_unit_code, p_description, p_has_batches, p_expiry_alert_days, p_warranty_alert_days) t;
  update public.products set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_pid;
  update public.product_variants set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_vid;
  return query select v_pid, v_vid;
end; $fn$;

create or replace function public.create_product_with_variants(
  p_name text, p_category_id uuid, p_default_price numeric default null, p_is_scan_only boolean default false,
  p_base_unit_code text default 'each', p_attribute_ids uuid[] default array[]::uuid[],
  p_variants jsonb default '[]'::jsonb, p_description text default null, p_has_batches boolean default false,
  p_expiry_alert_days integer default null, p_warranty_alert_days integer default null
) returns table(product_id uuid, variant_ids uuid[])
language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
        v_pid uuid; v_vids uuid[];
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_product') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: create_product'; end if;
  select t.product_id, t.variant_ids into v_pid, v_vids
    from public.create_product_with_variants_v28(p_name, p_category_id, p_default_price, p_is_scan_only, p_base_unit_code, p_attribute_ids, p_variants, p_description, p_has_batches, p_expiry_alert_days, p_warranty_alert_days) t;
  update public.products set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_pid;
  update public.product_variants set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = any(v_vids);
  return query select v_pid, v_vids;
end; $fn$;

-- =====================================================================
-- Packs
-- =====================================================================
create or replace function public.define_pack_inline(p_product_id uuid, p_unit_code text, p_unit_name text, p_base_qty integer, p_is_default_purchase boolean default false)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_packs') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_packs'; end if;
  v_id := public.define_pack_inline_v28(p_product_id, p_unit_code, p_unit_name, p_base_qty, p_is_default_purchase);
  update public.product_packs set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $fn$;

create or replace function public.update_pack(p_pack_id uuid, p_base_qty integer, p_is_default_purchase boolean)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_packs') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_packs'; end if;
  perform public.update_pack_v28(p_pack_id, p_base_qty, p_is_default_purchase);
  update public.product_packs set updated_by_user_id = auth.uid() where id = p_pack_id;
end; $fn$;

create or replace function public.deactivate_pack(p_pack_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $fn$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_product_packs') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_product_packs'; end if;
  perform public.deactivate_pack_v28(p_pack_id);
  update public.product_packs set updated_by_user_id = auth.uid() where id = p_pack_id;
end; $fn$;
