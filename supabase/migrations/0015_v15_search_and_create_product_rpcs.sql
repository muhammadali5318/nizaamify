-- v1.5: search_products / search_products_count / create_product_with_opening_stock,
-- and record_purchase patched with an optional p_is_opening flag.

create or replace function public.search_products(
  p_query text default null,
  p_limit int default 50,
  p_offset int default 0,
  p_only_in_stock boolean default false
) returns table (
  id uuid,
  name text,
  type text,
  description text,
  price numeric(12,2),
  avg_cost numeric(12,2),
  last_purchase_cost numeric(12,2),
  stock integer,
  is_active boolean,
  relevance real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
begin
  if v_shop_id is null then
    raise exception 'no_shop_for_user';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');

  perform set_limit(0.2);

  return query
  with base as (
    select p.*
    from public.products p
    where p.shop_id = v_shop_id
      and p.is_active = true
      and (not p_only_in_stock or p.stock > 0)
  ),
  scored as (
    select
      b.*,
      case
        when v_query is null then 0::real
        else greatest(
          case when b.name ilike v_query || '%' then 1.0::real else 0.0::real end,
          case when b.type ilike v_query || '%' then 0.9::real else 0.0::real end,
          case when b.name ilike '%' || v_query || '%' then 0.8::real else 0.0::real end,
          case when b.type ilike '%' || v_query || '%' then 0.7::real else 0.0::real end,
          similarity(b.name, v_query),
          similarity(b.type, v_query),
          similarity(b.name || ' ' || b.type, v_query)
        )
      end as relevance
    from base b
  )
  select
    s.id, s.name, s.type, s.description,
    s.price::numeric(12,2), s.avg_cost::numeric(12,2),
    s.last_purchase_cost::numeric(12,2), s.stock, s.is_active, s.relevance
  from scored s
  where v_query is null or s.relevance > 0.2
  order by
    case when v_query is null then 0 else 1 end,
    s.relevance desc,
    s.name asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

create or replace function public.search_products_count(
  p_query text default null,
  p_only_in_stock boolean default false
) returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
  v_count bigint;
begin
  if v_shop_id is null then
    raise exception 'no_shop_for_user';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  if v_query is null then
    select count(*) into v_count
    from public.products p
    where p.shop_id = v_shop_id
      and p.is_active = true
      and (not p_only_in_stock or p.stock > 0);
  else
    select count(*) into v_count
    from public.products p
    where p.shop_id = v_shop_id
      and p.is_active = true
      and (not p_only_in_stock or p.stock > 0)
      and (
        p.name ilike '%' || v_query || '%'
        or p.type ilike '%' || v_query || '%'
        or p.name % v_query
        or p.type % v_query
        or (p.name || ' ' || p.type) % v_query
      );
  end if;

  return v_count;
end;
$$;

create or replace function public.create_product_with_opening_stock(
  p_name text,
  p_type text,
  p_description text default null,
  p_price numeric(12,2) default 0,
  p_opening_stock integer default 0,
  p_opening_cost numeric(12,2) default 0
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_purchase_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_price < 0 then raise exception 'price_negative'; end if;
  if p_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
  if p_opening_cost < 0 then raise exception 'opening_cost_negative'; end if;

  insert into public.products (shop_id, name, type, description, price, stock, avg_cost, cost)
  values (v_shop_id, p_name, p_type, p_description, p_price, 0, 0, 0)
  returning id into v_product_id;

  if p_opening_stock > 0 then
    insert into public.purchases (shop_id, total_cost, source, note, purchase_date, cashier_id, is_opening)
    values (v_shop_id, p_opening_stock * p_opening_cost, 'Opening Stock', 'Initial inventory', current_date, v_user_id, true)
    returning id into v_purchase_id;

    insert into public.purchase_items (purchase_id, product_id, qty, cost_at_purchase)
    values (v_purchase_id, v_product_id, p_opening_stock, p_opening_cost);

    update public.products
       set stock = p_opening_stock,
           avg_cost = p_opening_cost,
           last_purchase_cost = p_opening_cost,
           cost = p_opening_cost,
           updated_at = now()
     where id = v_product_id;
  end if;

  return v_product_id;
end;
$$;

create or replace function public.record_purchase(
  p_source text,
  p_note text,
  p_purchase_date date,
  p_items jsonb,
  p_is_opening boolean default false
)
returns uuid
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
  v_old_stock integer;
  v_old_avg numeric(12,2);
  v_new_avg numeric(12,2);
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

  insert into public.purchases (shop_id, total_cost, source, note, purchase_date, cashier_id, is_opening)
  values (v_shop_id, v_total, nullif(p_source,''), nullif(p_note,''),
          coalesce(p_purchase_date, current_date), v_user_id, coalesce(p_is_opening, false))
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    v_cost := (v_item->>'cost')::numeric(12,2);

    select stock, avg_cost into v_old_stock, v_old_avg
    from public.products
    where id = v_product_id and shop_id = v_shop_id
    for update;

    if v_old_stock is null then
      raise exception 'product % not in current shop', v_product_id;
    end if;

    if v_old_stock <= 0 then
      v_new_avg := v_cost;
    else
      v_new_avg := round(
        (v_old_stock * v_old_avg + v_qty * v_cost) / (v_old_stock + v_qty),
        2
      );
    end if;

    insert into public.purchase_items (purchase_id, product_id, qty, cost_at_purchase)
    values (v_purchase_id, v_product_id, v_qty, v_cost);

    update public.products
    set stock = stock + v_qty,
        avg_cost = v_new_avg,
        last_purchase_cost = v_cost,
        cost = case when v_old_stock <= 0 then v_cost else cost end,
        updated_at = now()
    where id = v_product_id;
  end loop;

  return v_purchase_id;
end;
$$;

grant execute on function public.search_products(text, int, int, boolean) to authenticated;
grant execute on function public.search_products_count(text, boolean) to authenticated;
grant execute on function public.create_product_with_opening_stock(text, text, text, numeric, integer, numeric) to authenticated;
grant execute on function public.record_purchase(text, text, date, jsonb, boolean) to authenticated;
