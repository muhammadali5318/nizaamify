-- 0030_v22a_tier_rpcs_and_record_sale.sql
-- v2.2 Phase C — tier management RPCs + record_sale rewrite for line discounts
--                + tier discount + manual override.
--
--   §A define_tier(name, discount_percent, is_default, notes) → uuid
--   §B update_tier(tier_id, name, discount_percent, is_default, notes) → void
--   §C deactivate_tier(tier_id) → int  (rows reassigned to default)
--   §D set_default_tier(tier_id) → void  (atomic swap)
--   §E record_sale rewrite — applies line discounts, then tier/override
--   §F grants: revoke from public,anon; grant to authenticated
--
-- Snapshot discipline (from v1.x): every invoice + sale_item row preserves
-- the exact discount mechanics at the moment of sale. Future tier % edits,
-- product price edits, etc. never rewrite history.

-- ============================================================================
-- §A. define_tier
-- ============================================================================

create or replace function public.define_tier(
  p_name text,
  p_discount_percent numeric default 0,
  p_is_default boolean default false,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_tier_id uuid;
  v_normalized_name text := lower(trim(p_name));
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if v_normalized_name = '' then raise exception 'tier_name_required'; end if;
  if p_discount_percent is null
     or p_discount_percent < 0 or p_discount_percent > 100 then
    raise exception 'tier_discount_out_of_range';
  end if;

  -- Friendly duplicate-name check before the unique index would.
  if exists (
    select 1 from public.customer_tiers
     where shop_id = v_shop_id
       and is_active
       and lower(trim(name)) = v_normalized_name
  ) then
    raise exception 'tier_name_duplicate';
  end if;

  -- Atomically un-default the existing default if we're claiming it.
  if coalesce(p_is_default, false) then
    update public.customer_tiers
       set is_default = false, updated_at = now()
     where shop_id = v_shop_id and is_default and is_active;
  end if;

  insert into public.customer_tiers (
    shop_id, name, discount_percent, is_default, notes
  ) values (
    v_shop_id, trim(p_name), p_discount_percent,
    coalesce(p_is_default, false), nullif(trim(coalesce(p_notes, '')), '')
  ) returning id into v_tier_id;

  return v_tier_id;
end;
$function$;

-- ============================================================================
-- §B. update_tier
-- ============================================================================

create or replace function public.update_tier(
  p_tier_id uuid,
  p_name text,
  p_discount_percent numeric,
  p_is_default boolean,
  p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_tier record;
  v_normalized_name text := lower(trim(p_name));
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if v_normalized_name = '' then raise exception 'tier_name_required'; end if;
  if p_discount_percent is null
     or p_discount_percent < 0 or p_discount_percent > 100 then
    raise exception 'tier_discount_out_of_range';
  end if;

  select id, shop_id, is_default, is_active into v_tier
    from public.customer_tiers
   where id = p_tier_id and shop_id = v_shop_id;
  if not found then raise exception 'tier_not_in_shop'; end if;
  if not v_tier.is_active then raise exception 'tier_archived'; end if;

  -- Duplicate name check excluding self
  if exists (
    select 1 from public.customer_tiers
     where shop_id = v_shop_id
       and is_active
       and id <> p_tier_id
       and lower(trim(name)) = v_normalized_name
  ) then
    raise exception 'tier_name_duplicate';
  end if;

  if coalesce(p_is_default, false) and not v_tier.is_default then
    update public.customer_tiers
       set is_default = false, updated_at = now()
     where shop_id = v_shop_id and is_default and is_active and id <> p_tier_id;
  end if;

  -- Un-defaulting *this* tier when no other will be default leaves the shop
  -- with no default. Reject — the user must explicitly designate another
  -- default first via set_default_tier.
  if v_tier.is_default and not coalesce(p_is_default, false) then
    raise exception 'cannot_unset_default_tier'
      using hint = 'Set another tier as default first.';
  end if;

  update public.customer_tiers
     set name = trim(p_name),
         discount_percent = p_discount_percent,
         is_default = coalesce(p_is_default, is_default),
         notes = nullif(trim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_tier_id;
end;
$function$;

-- ============================================================================
-- §C. deactivate_tier — reassigns customers to default, returns count
-- ============================================================================

create or replace function public.deactivate_tier(p_tier_id uuid)
returns integer
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_tier record;
  v_default_id uuid;
  v_reassigned int := 0;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select id, is_default, is_active into v_tier
    from public.customer_tiers
   where id = p_tier_id and shop_id = v_shop_id;
  if not found then raise exception 'tier_not_in_shop'; end if;
  if not v_tier.is_active then return 0; end if;
  if v_tier.is_default then
    raise exception 'cannot_archive_default_tier'
      using hint = 'Set another tier as default first.';
  end if;

  select id into v_default_id
    from public.customer_tiers
   where shop_id = v_shop_id and is_default and is_active;

  -- Reassign customers BEFORE flipping is_active so concurrent reads always
  -- see a consistent (active or inactive) tier_id.
  update public.customers
     set tier_id = v_default_id,
         updated_at = now()
   where shop_id = v_shop_id and tier_id = p_tier_id;
  get diagnostics v_reassigned = row_count;

  update public.customer_tiers
     set is_active = false, is_default = false, updated_at = now()
   where id = p_tier_id;

  return v_reassigned;
end;
$function$;

-- ============================================================================
-- §D. set_default_tier — atomic swap
-- ============================================================================

create or replace function public.set_default_tier(p_tier_id uuid)
returns void
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_tier record;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select id, is_default, is_active into v_tier
    from public.customer_tiers
   where id = p_tier_id and shop_id = v_shop_id;
  if not found then raise exception 'tier_not_in_shop'; end if;
  if not v_tier.is_active then raise exception 'tier_archived'; end if;
  if v_tier.is_default then return; end if;

  update public.customer_tiers
     set is_default = false, updated_at = now()
   where shop_id = v_shop_id and is_default and is_active and id <> p_tier_id;

  update public.customer_tiers
     set is_default = true, updated_at = now()
   where id = p_tier_id;
end;
$function$;

-- ============================================================================
-- §E. record_sale rewrite (spec §4.2)
--      Signature changes (adding p_tier_override_type + p_tier_override_value),
--      so DROP the v2.1 shape first — CREATE OR REPLACE can't change params.
-- ============================================================================

drop function if exists public.record_sale(uuid, numeric, numeric, text, jsonb);

-- ============================================================================
-- §E. record_sale (continued)
--      Stacking order:
--        1. Negotiated unit price (already in price_at_sale)
--        2. Per-line discount (% or fixed, capped at line_subtotal)
--        3. Tier discount or manual override (% or fixed, capped at items_subtotal)
--        4. Service charge added last (no discounts apply to service)
-- ============================================================================

create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_tier_override_type text default null,
  p_tier_override_value numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_tier_id uuid;
  v_tier_discount_percent_snapshot numeric(5,2);
  v_tier_discount_amount numeric(12,2) := 0;
  v_total numeric(12,2);
  v_credit numeric(12,2);
  v_payment_type text;
  v_service numeric(12,2);
  v_item jsonb;
  v_qty int;
  v_price numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_discount_type text;
  v_line_discount_value numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_product record;
begin
  -- ---------------- guards ----------------
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  v_service := coalesce(p_service_charge, 0);
  if p_amount_paid is null or p_amount_paid < 0 then raise exception 'amount_paid_negative'; end if;
  if v_service < 0 then raise exception 'service_charge_negative'; end if;

  if jsonb_typeof(p_items) is null then p_items := '[]'::jsonb; end if;
  if jsonb_array_length(p_items) = 0 and v_service = 0 then
    raise exception 'empty_sale: a sale must have items or a service charge';
  end if;

  -- Override params come as a pair: both set or both null.
  if (p_tier_override_type is null) <> (p_tier_override_value is null) then
    raise exception 'override_type_and_value_must_both_be_set_or_neither';
  end if;
  if p_tier_override_type is not null
     and p_tier_override_type not in ('percent', 'fixed') then
    raise exception 'invalid_override_type';
  end if;
  if p_tier_override_type = 'percent'
     and (p_tier_override_value < 0 or p_tier_override_value > 100) then
    raise exception 'override_percent_out_of_range';
  end if;
  if p_tier_override_type = 'fixed' and p_tier_override_value < 0 then
    raise exception 'override_fixed_negative';
  end if;

  -- ---------------- Pass 1: validate items, compute items_subtotal ----------------
  -- We compute (and validate) line totals here so the override-capping check
  -- can fire before any DB writes.
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

  -- ---------------- Resolve tier discount or override ----------------
  if p_tier_override_type is not null then
    v_tier_id := null;
    if p_tier_override_type = 'percent' then
      v_tier_discount_percent_snapshot := p_tier_override_value;
      v_tier_discount_amount := round(v_items_subtotal * p_tier_override_value / 100, 2);
    else
      v_tier_discount_percent_snapshot := null;
      if p_tier_override_value > v_items_subtotal then
        raise exception 'override_fixed_exceeds_items_subtotal';
      end if;
      v_tier_discount_amount := p_tier_override_value;
    end if;
  elsif p_customer_id is not null then
    select c.tier_id, t.discount_percent
      into v_tier_id, v_tier_discount_percent_snapshot
      from public.customers c
      left join public.customer_tiers t on t.id = c.tier_id and t.is_active
     where c.id = p_customer_id and c.shop_id = v_shop_id;
    -- Customer with no/inactive tier → fall back to shop default
    if v_tier_discount_percent_snapshot is null then
      select id, discount_percent
        into v_tier_id, v_tier_discount_percent_snapshot
        from public.customer_tiers
       where shop_id = v_shop_id and is_default and is_active;
    end if;
    v_tier_discount_percent_snapshot := coalesce(v_tier_discount_percent_snapshot, 0);
    v_tier_discount_amount := round(v_items_subtotal * v_tier_discount_percent_snapshot / 100, 2);
  else
    -- Walk-in: use shop default
    select id, discount_percent
      into v_tier_id, v_tier_discount_percent_snapshot
      from public.customer_tiers
     where shop_id = v_shop_id and is_default and is_active;
    v_tier_discount_percent_snapshot := coalesce(v_tier_discount_percent_snapshot, 0);
    v_tier_discount_amount := round(v_items_subtotal * v_tier_discount_percent_snapshot / 100, 2);
  end if;

  v_total := (v_items_subtotal - v_tier_discount_amount) + v_service;

  -- ---------------- payment / customer guards (v1.6) ----------------
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

  -- ---------------- Insert invoice with full snapshot ----------------
  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id,
    tier_id, tier_discount_percent_snapshot, tier_discount_amount,
    tier_override_type, tier_override_value
  ) values (
    v_shop_id, p_customer_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id,
    v_tier_id, v_tier_discount_percent_snapshot, v_tier_discount_amount,
    p_tier_override_type, p_tier_override_value
  ) returning id into v_invoice_id;

  -- ---------------- Pass 2: lock products, decrement stock, snapshot lines ----------------
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    v_line_subtotal := v_qty * v_price;

    select id, stock, avg_cost into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
     for update;
    if not found then raise exception 'product_not_in_shop'; end if;
    if v_product.stock < v_qty then
      raise exception 'insufficient_stock for product %', v_product.id;
    end if;

    -- Recompute line discount (same logic as Pass 1 — pure function of input)
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

    insert into public.sale_items (
      invoice_id, product_id, qty, price_at_sale, cost_at_sale,
      line_discount_type, line_discount_value, line_discount_amount
    ) values (
      v_invoice_id, v_product.id, v_qty, v_price, v_product.avg_cost,
      v_line_discount_type, v_line_discount_value, v_line_discount_amount
    );

    update public.products set stock = stock - v_qty, updated_at = now()
     where id = v_product.id;
  end loop;

  -- ---------------- Ledger entry on credit/partial (v1.6 logic, post-discount total) ----------------
  if v_credit > 0 then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit');
  end if;

  return v_invoice_id;
end;
$function$;

-- ============================================================================
-- §F. Grants — revoke from public,anon; grant to authenticated
-- ============================================================================

revoke execute on function public.define_tier(text, numeric, boolean, text) from public, anon;
grant  execute on function public.define_tier(text, numeric, boolean, text) to authenticated;

revoke execute on function public.update_tier(uuid, text, numeric, boolean, text) from public, anon;
grant  execute on function public.update_tier(uuid, text, numeric, boolean, text) to authenticated;

revoke execute on function public.deactivate_tier(uuid) from public, anon;
grant  execute on function public.deactivate_tier(uuid) to authenticated;

revoke execute on function public.set_default_tier(uuid) from public, anon;
grant  execute on function public.set_default_tier(uuid) to authenticated;

revoke execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric)
  from public, anon;
grant  execute on function public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric)
  to authenticated;
