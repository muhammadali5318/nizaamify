-- v1.9 — Suppliers, landed-cost allocation, snapshot avg-before/after on purchase_items.
-- See MVP_FIXES_v1.9.md and decisions/0016-v19-suppliers-landed-cost.md.
--
-- Sub-sections:
--   A. Suppliers table + RLS + indexes + updated_at trigger
--   B. purchases — supplier_id, items_subtotal, overhead_subtotal (+ backfill)
--   C. purchase_items — overhead_per_unit, avg_cost_before, avg_cost_after
--   D. purchase_overhead_items table + RLS + append-only trigger
--   E. record_purchase rewrite (supplier + landed cost + snapshots)
--   F. Supplier RPCs: search / recent / inline-create
--   G. Purchases search RPCs (paginated list)
--   H. recent_purchase_products RPC (form combobox empty state)

-- ============================================================================
-- A. SUPPLIERS
-- ============================================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  contact text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_name_not_blank check (length(trim(name)) > 0)
);

alter table public.suppliers enable row level security;

drop policy if exists suppliers_shop_read on public.suppliers;
create policy suppliers_shop_read on public.suppliers
  for select using (shop_id = (select public.current_shop_id()));

drop policy if exists suppliers_shop_write on public.suppliers;
create policy suppliers_shop_write on public.suppliers
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

create unique index if not exists uq_suppliers_shop_name
  on public.suppliers (shop_id, lower(trim(name)))
  where is_active = true;

create index if not exists idx_suppliers_name_trgm
  on public.suppliers using gin (name extensions.gin_trgm_ops);

drop trigger if exists suppliers_touch on public.suppliers;
create trigger suppliers_touch
  before update on public.suppliers
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- B. PURCHASES — supplier_id, subtotals, backfill
-- ============================================================================

alter table public.purchases
  add column if not exists supplier_id uuid references public.suppliers(id) on delete restrict;

create index if not exists idx_purchases_supplier
  on public.purchases (supplier_id) where supplier_id is not null;

alter table public.purchases
  add column if not exists items_subtotal    numeric(12,2) not null default 0,
  add column if not exists overhead_subtotal numeric(12,2) not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'purchases_items_subtotal_non_negative') then
    alter table public.purchases
      add constraint purchases_items_subtotal_non_negative check (items_subtotal >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchases_overhead_subtotal_non_negative') then
    alter table public.purchases
      add constraint purchases_overhead_subtotal_non_negative check (overhead_subtotal >= 0);
  end if;
end $$;

-- Backfill: existing rows have items_subtotal = total_cost, overhead = 0.
-- purchases is append-only (v1.8) so disable the trigger for the duration.
alter table public.purchases disable trigger purchases_no_modify;

update public.purchases
   set items_subtotal = total_cost
 where items_subtotal = 0 and overhead_subtotal = 0 and total_cost > 0;

alter table public.purchases enable trigger purchases_no_modify;

-- ============================================================================
-- C. PURCHASE_ITEMS — landed-cost + WAC snapshots
-- ============================================================================

alter table public.purchase_items
  add column if not exists overhead_per_unit numeric(12,2) not null default 0,
  add column if not exists avg_cost_before   numeric(12,2),
  add column if not exists avg_cost_after    numeric(12,2);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_items_overhead_per_unit_non_negative') then
    alter table public.purchase_items
      add constraint purchase_items_overhead_per_unit_non_negative check (overhead_per_unit >= 0);
  end if;
end $$;

-- ============================================================================
-- D. PURCHASE_OVERHEAD_ITEMS
-- ============================================================================

create table if not exists public.purchase_overhead_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  category text not null check (category in ('delivery','labor','customs','packaging','other')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_overhead_purchase
  on public.purchase_overhead_items (purchase_id);

alter table public.purchase_overhead_items enable row level security;

drop policy if exists overhead_shop_read on public.purchase_overhead_items;
create policy overhead_shop_read on public.purchase_overhead_items
  for select using (
    exists (
      select 1 from public.purchases p
       where p.id = purchase_overhead_items.purchase_id
         and p.shop_id = (select public.current_shop_id())
    )
  );

drop policy if exists overhead_shop_write on public.purchase_overhead_items;
create policy overhead_shop_write on public.purchase_overhead_items
  for all using (
    exists (
      select 1 from public.purchases p
       where p.id = purchase_overhead_items.purchase_id
         and p.shop_id = (select public.current_shop_id())
    )
  )
  with check (
    exists (
      select 1 from public.purchases p
       where p.id = purchase_overhead_items.purchase_id
         and p.shop_id = (select public.current_shop_id())
    )
  );

-- Append-only enforcement (reuse the v1.8 financial_records_immutable function)
drop trigger if exists overhead_no_modify on public.purchase_overhead_items;
create trigger overhead_no_modify
  before update or delete on public.purchase_overhead_items
  for each row execute function public.financial_records_immutable();

-- ============================================================================
-- E. record_purchase REWRITE
-- ============================================================================

-- Drop the old (text, text, date, jsonb, boolean) signature explicitly so
-- the new signature is the only one. Other v1.5/v1.8 callers go through
-- create_product_with_opening_stock which inserts directly, not via
-- record_purchase, so this is safe.
drop function if exists public.record_purchase(text, text, date, jsonb, boolean);

create or replace function public.record_purchase(
  p_supplier_id uuid default null,
  p_purchase_date date default current_date,
  p_note text default null,
  p_items jsonb default '[]'::jsonb,
  p_overhead_items jsonb default '[]'::jsonb,
  p_is_opening boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_overhead_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_overhead jsonb;
  v_product record;
  v_qty int;
  v_cost numeric(12,2);
  v_overhead_share numeric(12,2);
  v_overhead_per_unit numeric(12,2);
  v_effective_unit_cost numeric(12,2);
  v_supplier_name text;
  v_source text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_purchase' using errcode = 'P0001';
  end if;

  -- Validate supplier (when provided)
  if p_supplier_id is not null then
    select name into v_supplier_name
      from public.suppliers
     where id = p_supplier_id and shop_id = v_shop_id and is_active = true;
    if not found then
      raise exception 'supplier_not_in_shop' using errcode = 'P0001';
    end if;
  end if;

  -- Compute items subtotal + per-line validation
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := (v_item->>'qty')::int;
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);
    if v_qty is null or v_qty <= 0 then
      raise exception 'qty_must_be_positive' using errcode = 'P0001';
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'cost_must_be_non_negative' using errcode = 'P0001';
    end if;
    v_items_subtotal := v_items_subtotal + (v_qty * v_cost);
  end loop;

  -- Compute overhead subtotal + per-row validation
  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      if (v_overhead->>'category') not in ('delivery','labor','customs','packaging','other') then
        raise exception 'invalid_overhead_category' using errcode = 'P0001';
      end if;
      if ((v_overhead->>'amount')::numeric(12,2)) <= 0 then
        raise exception 'overhead_amount_must_be_positive' using errcode = 'P0001';
      end if;
      v_overhead_subtotal := v_overhead_subtotal + (v_overhead->>'amount')::numeric(12,2);
    end loop;
  end if;

  -- Source label (legacy column, kept for back-compat with pre-v1.9 rows)
  v_source := case
    when p_is_opening then 'Opening Stock'
    when p_supplier_id is not null then v_supplier_name
    else 'Direct purchase'
  end;

  -- Header
  insert into public.purchases (
    shop_id, supplier_id, total_cost, items_subtotal, overhead_subtotal,
    source, note, purchase_date, cashier_id, is_opening
  ) values (
    v_shop_id,
    p_supplier_id,
    v_items_subtotal + v_overhead_subtotal,
    v_items_subtotal,
    v_overhead_subtotal,
    v_source,
    nullif(trim(coalesce(p_note,'')),''),
    coalesce(p_purchase_date, current_date),
    v_user_id,
    coalesce(p_is_opening, false)
  ) returning id into v_purchase_id;

  -- Overhead audit trail
  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      insert into public.purchase_overhead_items (purchase_id, category, amount, description)
      values (
        v_purchase_id,
        v_overhead->>'category',
        (v_overhead->>'amount')::numeric(12,2),
        nullif(trim(coalesce(v_overhead->>'description','')),'')
      );
    end loop;
  end if;

  -- Per-line: lock product, allocate overhead, snapshot avg_before/after, update WAC
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := (v_item->>'qty')::int;
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);

    select id, stock, avg_cost into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id
     for update;
    if not found then
      raise exception 'product_not_in_shop' using errcode = 'P0001';
    end if;

    -- Pro-rata overhead share by line value
    if v_items_subtotal > 0 then
      v_overhead_share := round(
        v_overhead_subtotal * (v_qty * v_cost) / v_items_subtotal, 2
      );
    else
      v_overhead_share := 0;
    end if;

    v_overhead_per_unit   := case when v_qty > 0 then round(v_overhead_share / v_qty, 2) else 0 end;
    v_effective_unit_cost := v_cost + v_overhead_per_unit;

    insert into public.purchase_items (
      purchase_id, product_id, qty,
      cost_at_purchase, overhead_per_unit,
      avg_cost_before, avg_cost_after
    ) values (
      v_purchase_id, v_product.id, v_qty,
      v_cost, v_overhead_per_unit,
      v_product.avg_cost,
      case
        when v_product.stock + v_qty = 0 then v_product.avg_cost
        when v_product.stock <= 0        then v_effective_unit_cost
        else round(
          (v_product.stock * v_product.avg_cost + v_qty * v_effective_unit_cost)
          / (v_product.stock + v_qty), 2
        )
      end
    );

    update public.products
       set stock = stock + v_qty,
           avg_cost = case
             when stock + v_qty = 0 then avg_cost
             when stock <= 0        then v_effective_unit_cost
             else round(
               (stock * avg_cost + v_qty * v_effective_unit_cost)
               / (stock + v_qty), 2
             )
           end,
           last_purchase_cost = v_cost,
           cost = case when stock <= 0 then v_cost else cost end,
           updated_at = now()
     where id = v_product.id;
  end loop;

  return v_purchase_id;
end;
$$;

revoke execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) from public;
grant  execute on function public.record_purchase(uuid, date, text, jsonb, jsonb, boolean) to authenticated;

-- ============================================================================
-- F. SUPPLIER RPCs
-- ============================================================================

create or replace function public.search_suppliers(
  p_query text default null,
  p_limit integer default 10,
  p_offset integer default 0
) returns table(
  id uuid, name text, contact text, address text, is_active boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_q text;
  v_total bigint;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  v_q := nullif(trim(coalesce(p_query,'')), '');
  perform extensions.set_limit(0.2);

  with base as (
    select s.* from public.suppliers s
     where s.shop_id = v_shop_id
       and s.is_active = true
       and (
         v_q is null
         or s.name ilike '%' || v_q || '%'
         or coalesce(s.contact,'') ilike '%' || v_q || '%'
         or s.name % v_q
       )
  )
  select count(*) into v_total from base;

  return query
  select b.id, b.name, b.contact, b.address, b.is_active, v_total
  from (
    select s.* from public.suppliers s
     where s.shop_id = v_shop_id
       and s.is_active = true
       and (
         v_q is null
         or s.name ilike '%' || v_q || '%'
         or coalesce(s.contact,'') ilike '%' || v_q || '%'
         or s.name % v_q
       )
  ) b
   order by
     case when v_q is null then 0 else 1 end,
     case when v_q is not null then extensions.similarity(b.name, v_q) else 0 end desc,
     b.name asc
   limit greatest(p_limit, 1)
   offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.search_suppliers(text, integer, integer) from public;
grant  execute on function public.search_suppliers(text, integer, integer) to authenticated;

create or replace function public.recent_suppliers(p_limit integer default 10)
returns table(id uuid, name text, contact text, last_used_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with last_use as (
    select supplier_id, max(created_at) as last_used_at
      from public.purchases
     where shop_id = public.current_shop_id() and supplier_id is not null
     group by supplier_id
  )
  select s.id, s.name, s.contact, l.last_used_at
    from public.suppliers s
    left join last_use l on l.supplier_id = s.id
   where s.shop_id = public.current_shop_id() and s.is_active = true
   order by l.last_used_at desc nulls last, s.name asc
   limit greatest(p_limit, 1);
$$;

revoke execute on function public.recent_suppliers(integer) from public;
grant  execute on function public.recent_suppliers(integer) to authenticated;

create or replace function public.create_supplier_inline(
  p_name text,
  p_contact text default null,
  p_address text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_supplier_id uuid;
  v_name text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  v_name := nullif(trim(coalesce(p_name,'')), '');
  if v_name is null then
    raise exception 'name_required' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.suppliers
     where shop_id = v_shop_id
       and lower(trim(name)) = lower(v_name)
       and is_active = true
  ) then
    raise exception 'duplicate_supplier_name' using errcode = 'P0001';
  end if;

  insert into public.suppliers (shop_id, name, contact, address, notes)
  values (
    v_shop_id, v_name,
    nullif(trim(coalesce(p_contact,'')),''),
    nullif(trim(coalesce(p_address,'')),''),
    nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into v_supplier_id;

  return v_supplier_id;
end;
$$;

revoke execute on function public.create_supplier_inline(text, text, text, text) from public;
grant  execute on function public.create_supplier_inline(text, text, text, text) to authenticated;

-- ============================================================================
-- G. PURCHASES SEARCH RPCs
-- ============================================================================

create or replace function public.search_purchases(
  p_from date default null,
  p_to date default null,
  p_supplier_id uuid default null,
  p_include_opening boolean default false,
  p_limit integer default 10,
  p_offset integer default 0
) returns table(
  id uuid,
  purchase_date date,
  supplier_id uuid,
  supplier_name text,
  source text,
  note text,
  items_count bigint,
  items_subtotal numeric,
  overhead_subtotal numeric,
  total_cost numeric,
  is_opening boolean
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.id,
         p.purchase_date,
         p.supplier_id,
         s.name as supplier_name,
         p.source,
         p.note,
         (select count(distinct pi.product_id)
            from public.purchase_items pi
           where pi.purchase_id = p.id) as items_count,
         p.items_subtotal,
         p.overhead_subtotal,
         p.total_cost,
         p.is_opening
    from public.purchases p
    left join public.suppliers s on s.id = p.supplier_id
   where p.shop_id = public.current_shop_id()
     and (p_from is null or p.purchase_date >= p_from)
     and (p_to is null or p.purchase_date <= p_to)
     and (p_supplier_id is null or p.supplier_id = p_supplier_id)
     and (p_include_opening or p.is_opening = false)
   order by p.purchase_date desc, p.created_at desc
   limit greatest(p_limit, 1)
   offset greatest(p_offset, 0);
$$;

revoke execute on function public.search_purchases(date, date, uuid, boolean, integer, integer) from public;
grant  execute on function public.search_purchases(date, date, uuid, boolean, integer, integer) to authenticated;

create or replace function public.search_purchases_count(
  p_from date default null,
  p_to date default null,
  p_supplier_id uuid default null,
  p_include_opening boolean default false
) returns bigint
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::bigint
    from public.purchases p
   where p.shop_id = public.current_shop_id()
     and (p_from is null or p.purchase_date >= p_from)
     and (p_to is null or p.purchase_date <= p_to)
     and (p_supplier_id is null or p.supplier_id = p_supplier_id)
     and (p_include_opening or p.is_opening = false);
$$;

revoke execute on function public.search_purchases_count(date, date, uuid, boolean) from public;
grant  execute on function public.search_purchases_count(date, date, uuid, boolean) to authenticated;

-- ============================================================================
-- H. recent_purchase_products — empty-state for the form's product picker
-- ============================================================================

create or replace function public.recent_purchase_products(p_limit integer default 10)
returns table(
  id uuid,
  name text,
  type text,
  price numeric,
  avg_cost numeric,
  stock integer,
  last_used_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with last_use as (
    select pi.product_id, max(p.created_at) as last_used_at
      from public.purchase_items pi
      join public.purchases p on p.id = pi.purchase_id
     where p.shop_id = public.current_shop_id()
     group by pi.product_id
  )
  select pr.id, pr.name, pr.type, pr.price, pr.avg_cost, pr.stock, l.last_used_at
    from public.products pr
    left join last_use l on l.product_id = pr.id
   where pr.shop_id = public.current_shop_id() and pr.is_active = true
   order by l.last_used_at desc nulls last, pr.updated_at desc
   limit greatest(p_limit, 1);
$$;

revoke execute on function public.recent_purchase_products(integer) from public;
grant  execute on function public.recent_purchase_products(integer) to authenticated;
