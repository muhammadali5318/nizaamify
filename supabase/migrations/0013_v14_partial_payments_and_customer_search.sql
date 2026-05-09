-- v1.4: split payments + walk-in customers + customer search/edit + service-only sales

-- 1. customers: address, notes, updated_at + touch trigger
alter table public.customers
  add column if not exists address text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch
  before update on public.customers
  for each row execute function public.touch_updated_at();

-- 2. trigram + supporting indexes
create extension if not exists pg_trgm;
create index if not exists idx_customers_name_trgm
  on public.customers using gin (name gin_trgm_ops);
create index if not exists idx_customers_phone_trgm
  on public.customers using gin (phone gin_trgm_ops);
create index if not exists idx_ledger_entries_customer_created
  on public.ledger_entries (customer_id, created_at desc);
create index if not exists idx_invoices_customer_created
  on public.invoices (customer_id, created_at desc);

-- 3. invoices: amount_paid, notes, extended payment_type CHECK
alter table public.invoices
  add column if not exists amount_paid numeric(12,2) not null default 0
    check (amount_paid >= 0),
  add column if not exists notes text;

-- Backfill BEFORE adding the upper-bound constraint
update public.invoices
set amount_paid = total
where payment_type = 'cash' and amount_paid = 0;
-- credit rows already have amount_paid = 0 (default), nothing to do.

alter table public.invoices
  drop constraint if exists invoices_amount_paid_lte_total;
alter table public.invoices
  add constraint invoices_amount_paid_lte_total
  check (amount_paid <= total);

-- payment_type is text+CHECK (not enum). Replace the check.
alter table public.invoices
  drop constraint if exists invoices_payment_type_check;
alter table public.invoices
  add constraint invoices_payment_type_check
  check (payment_type = any (array['cash','credit','partial']));

-- 4. record_sale: rewrite for split payments + service-only.
-- Drop the old (uuid, text, numeric, jsonb) signature first; CREATE OR REPLACE
-- on a different param list would create an overload, not replace.
drop function if exists public.record_sale(uuid, text, numeric, jsonb);

create or replace function public.record_sale(
  p_customer_id uuid default null,
  p_amount_paid numeric(12,2) default 0,
  p_service_charge numeric(12,2) default 0,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
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
  v_credit numeric(12,2);
  v_payment_type text;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12,2);
  v_stock integer;
  v_avg_cost numeric(12,2);
  v_service numeric(12,2);
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  v_shop_id := public.current_shop_id();
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  v_service := coalesce(p_service_charge, 0);

  if p_amount_paid is null or p_amount_paid < 0 then
    raise exception 'amount_paid_negative';
  end if;
  if v_service < 0 then raise exception 'service_charge_negative'; end if;

  if jsonb_typeof(p_items) is null then
    p_items := '[]'::jsonb;
  end if;

  if jsonb_array_length(p_items) = 0 and v_service = 0 then
    raise exception 'empty_sale: a sale must have items or a service charge';
  end if;

  -- Validate items + accumulate total
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    if v_qty is null or v_qty <= 0 then raise exception 'qty must be positive'; end if;
    if v_price is null or v_price < 0 then raise exception 'price must be non-negative'; end if;
    v_total := v_total + (v_qty * v_price);
  end loop;
  v_total := v_total + v_service;

  if p_amount_paid > v_total then
    raise exception 'amount_paid_exceeds_total';
  end if;

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
      select 1 from public.customers
      where id = p_customer_id and shop_id = v_shop_id
    ) then
      raise exception 'customer_not_in_shop';
    end if;
  end if;

  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id
  ) values (
    v_shop_id, p_customer_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id
  ) returning id into v_invoice_id;

  -- Items: snapshot price_at_sale + cost_at_sale (=avg_cost), decrement stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);

    select stock, avg_cost into v_stock, v_avg_cost
    from public.products
    where id = v_product_id and shop_id = v_shop_id
    for update;

    if v_stock is null then raise exception 'product_not_in_shop'; end if;
    if v_stock < v_qty then raise exception 'insufficient_stock for product %', v_product_id; end if;

    insert into public.sale_items (invoice_id, product_id, qty, price_at_sale, cost_at_sale)
    values (v_invoice_id, v_product_id, v_qty, v_price, v_avg_cost);

    update public.products
    set stock = stock - v_qty, updated_at = now()
    where id = v_product_id;
  end loop;

  -- Ledger debit only when there's a credit balance, amount = credit portion
  if v_credit > 0 then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit');
  end if;

  return v_invoice_id;
end;
$$;

-- 5. recent_customers: empty-state default for the picker
create or replace function public.recent_customers(p_limit int default 10)
returns table (
  id uuid,
  name text,
  phone text,
  address text,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with shop as (select public.current_shop_id() as id)
  select
    c.id, c.name, c.phone, c.address,
    greatest(
      coalesce((select max(created_at) from public.invoices i where i.customer_id = c.id), 'epoch'),
      coalesce((select max(created_at) from public.ledger_entries l where l.customer_id = c.id), 'epoch'),
      c.created_at
    ) as last_activity_at
  from public.customers c, shop
  where c.shop_id = shop.id
  order by last_activity_at desc
  limit greatest(p_limit, 1);
$$;

-- 6. list_customers: server-paginated list with outstanding + last_activity (used by /customers and the picker recent fallback when search is empty).
create or replace function public.list_customers(
  p_query text default '',
  p_limit int default 25,
  p_offset int default 0
) returns table (
  id uuid,
  name text,
  phone text,
  address text,
  outstanding numeric,
  invoice_count bigint,
  last_activity_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with shop as (select public.current_shop_id() as id),
  filtered as (
    select c.id, c.name, c.phone, c.address, c.created_at
    from public.customers c, shop
    where c.shop_id = shop.id
      and (
        coalesce(p_query, '') = ''
        or c.name ilike '%' || p_query || '%'
        or c.phone ilike '%' || p_query || '%'
      )
  ),
  agg as (
    select
      f.id,
      f.name,
      f.phone,
      f.address,
      f.created_at,
      coalesce(
        (select sum(case when type = 'debit' then amount else -amount end)
         from public.ledger_entries l where l.customer_id = f.id),
        0
      ) as outstanding,
      coalesce(
        (select count(*) from public.invoices i where i.customer_id = f.id),
        0
      ) as invoice_count,
      greatest(
        coalesce((select max(created_at) from public.invoices i where i.customer_id = f.id), 'epoch'),
        coalesce((select max(created_at) from public.ledger_entries l where l.customer_id = f.id), 'epoch'),
        f.created_at
      ) as last_activity_at
    from filtered f
  )
  select
    a.id, a.name, a.phone, a.address,
    a.outstanding, a.invoice_count, a.last_activity_at,
    (select count(*) from filtered) as total_count
  from agg a
  order by a.last_activity_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

-- 7. Revoke EXECUTE from anon to match existing security pattern
revoke execute on function public.record_sale(uuid, numeric, numeric, text, jsonb) from anon;
revoke execute on function public.recent_customers(int) from anon;
revoke execute on function public.list_customers(text, int, int) from anon;
