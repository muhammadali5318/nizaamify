-- record_purchase: atomic stock-in.
-- p_items shape: jsonb array of { product_id uuid, qty int, cost numeric }
create or replace function public.record_purchase(
  p_source text,
  p_note text,
  p_purchase_date date,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
  v_purchase_id uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_cost numeric(12,2);
  v_owns boolean;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;

  v_shop_id := public.current_shop_id();
  if v_shop_id is null then raise exception 'no shop for user'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty array';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    v_cost := (v_item->>'cost')::numeric(12,2);
    if v_qty is null or v_qty <= 0 then raise exception 'qty must be positive'; end if;
    if v_cost is null or v_cost < 0 then raise exception 'cost must be non-negative'; end if;
    v_total := v_total + (v_qty * v_cost);
  end loop;

  insert into public.purchases (shop_id, total_cost, source, note, purchase_date, cashier_id)
  values (v_shop_id, v_total, nullif(p_source,''), nullif(p_note,''),
          coalesce(p_purchase_date, current_date), v_user_id)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    v_cost := (v_item->>'cost')::numeric(12,2);

    select exists (
      select 1 from public.products
      where id = v_product_id and shop_id = v_shop_id
    ) into v_owns;
    if not v_owns then raise exception 'product % not in current shop', v_product_id; end if;

    insert into public.purchase_items (purchase_id, product_id, qty, cost_at_purchase)
    values (v_purchase_id, v_product_id, v_qty, v_cost);

    update public.products
    set stock = stock + v_qty,
        cost = v_cost,
        updated_at = now()
    where id = v_product_id;
  end loop;

  return v_purchase_id;
end;
$$;

revoke execute on function public.record_purchase(text, text, date, jsonb) from public, anon;
grant execute on function public.record_purchase(text, text, date, jsonb) to authenticated;

-- record_sale: atomic POS sale.
-- p_items shape: jsonb array of { product_id uuid, qty int, price numeric }
create or replace function public.record_sale(
  p_customer_id uuid,
  p_payment_type text,
  p_service_charge numeric,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
  v_invoice_id uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12,2);
  v_cost numeric(12,2);
  v_stock integer;
  v_service numeric(12,2);
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  v_shop_id := public.current_shop_id();
  if v_shop_id is null then raise exception 'no shop for user'; end if;

  if p_payment_type not in ('cash','credit') then
    raise exception 'payment_type must be cash or credit';
  end if;

  if p_payment_type = 'credit' and p_customer_id is null then
    raise exception 'credit sale requires customer_id';
  end if;

  if p_customer_id is not null then
    if not exists (
      select 1 from public.customers
      where id = p_customer_id and shop_id = v_shop_id
    ) then
      raise exception 'customer % not in current shop', p_customer_id;
    end if;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty array';
  end if;

  v_service := coalesce(p_service_charge, 0);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    v_price := (v_item->>'price')::numeric(12,2);
    if v_qty is null or v_qty <= 0 then raise exception 'qty must be positive'; end if;
    if v_price is null or v_price < 0 then raise exception 'price must be non-negative'; end if;
    v_total := v_total + (v_qty * v_price);
  end loop;
  v_total := v_total + v_service;

  insert into public.invoices (shop_id, customer_id, total, service_charge, payment_type, cashier_id)
  values (v_shop_id, p_customer_id, v_total, v_service, p_payment_type, v_user_id)
  returning id into v_invoice_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    v_price := (v_item->>'price')::numeric(12,2);

    select stock, cost into v_stock, v_cost
    from public.products
    where id = v_product_id and shop_id = v_shop_id
    for update;

    if v_stock is null then raise exception 'product % not in current shop', v_product_id; end if;
    if v_stock < v_qty then raise exception 'insufficient stock for product %', v_product_id; end if;

    insert into public.sale_items (invoice_id, product_id, qty, price_at_sale, cost_at_sale)
    values (v_invoice_id, v_product_id, v_qty, v_price, v_cost);

    update public.products
    set stock = stock - v_qty, updated_at = now()
    where id = v_product_id;
  end loop;

  if p_payment_type = 'credit' then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_total, 'debit');
  end if;

  return v_invoice_id;
end;
$$;

revoke execute on function public.record_sale(uuid, text, numeric, jsonb) from public, anon;
grant execute on function public.record_sale(uuid, text, numeric, jsonb) to authenticated;
