-- v2.5 — product_categories entity, products.category_id FK, category RPCs,
-- search_products / create_product_with_opening_stock updated to take p_category_id.
--
-- §A  Create public.product_categories
-- §B  Add products.category_id (nullable for backfill window)
-- §C  Backfill: distinct types per shop → category rows, link products
-- §D  Verify zero NULL category_id, enforce NOT NULL
-- §E  Drop old (shop_id, name, type) unique index; create (shop_id, name, category_id)
-- §F  RPCs: search_categories, create_category_inline, update_category
-- §G  Replace search_products / search_products_count to accept p_category_id
-- §H  Replace create_product_with_opening_stock to accept p_category_id
-- §I  Grants (revoke from public/anon, grant to authenticated)
-- §J  Ledger gotcha: products.type column is INTENTIONALLY kept; future cleanup migration drops it.

-- ============================================================================
-- §A. product_categories table
-- ============================================================================

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_name_not_blank check (length(trim(name)) > 0)
);

-- Case-insensitive uniqueness within a shop, only among active categories.
-- Matches the products.name normalization style (collapse interior whitespace).
create unique index if not exists uq_category_shop_name
  on public.product_categories
     (shop_id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
  where is_active;

-- Trigram for fuzzy search in the combobox (pg_trgm lives in the extensions schema
-- per v1.8 hardening — set_limit() / % must reach it via search_path).
create index if not exists idx_category_name_trgm
  on public.product_categories using gin (name extensions.gin_trgm_ops);

create index if not exists idx_category_shop_active
  on public.product_categories (shop_id, is_active) where is_active;

alter table public.product_categories enable row level security;

drop policy if exists "categories_shop_read" on public.product_categories;
create policy "categories_shop_read" on public.product_categories
  for select using (shop_id = (select public.current_shop_id()));

drop policy if exists "categories_shop_write" on public.product_categories;
create policy "categories_shop_write" on public.product_categories
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

drop trigger if exists product_categories_touch on public.product_categories;
create trigger product_categories_touch
  before update on public.product_categories
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- §B. products.category_id (nullable initially)
-- ============================================================================

alter table public.products
  add column if not exists category_id uuid
    references public.product_categories(id) on delete restrict;

create index if not exists idx_products_category
  on public.products (category_id) where category_id is not null;

-- ============================================================================
-- §C. Backfill: distinct existing type values become category rows,
--     then each product is linked to its matching category.
-- ============================================================================

insert into public.product_categories (shop_id, name)
select distinct p.shop_id,
       regexp_replace(trim(p.type), '\s+', ' ', 'g') as name
  from public.products p
 where p.type is not null
   and length(trim(p.type)) > 0
on conflict do nothing;

update public.products p
   set category_id = c.id
  from public.product_categories c
 where c.shop_id = p.shop_id
   and lower(regexp_replace(trim(c.name), '\s+', ' ', 'g'))
       = lower(regexp_replace(trim(p.type), '\s+', ' ', 'g'))
   and p.category_id is null;

-- ============================================================================
-- §D. Verify and enforce NOT NULL.
-- ============================================================================

do $$
declare v_unmatched int;
begin
  select count(*) into v_unmatched
    from public.products where category_id is null;
  if v_unmatched > 0 then
    raise exception 'v25_backfill_incomplete: % product(s) have no category_id', v_unmatched;
  end if;
end$$;

alter table public.products alter column category_id set not null;

-- ============================================================================
-- §E. Swap the unique index: (name, type) → (name, category_id).
--     Two products may share the same name across different categories within a shop.
-- ============================================================================

drop index if exists public.uq_products_shop_name_type;

create unique index if not exists uq_products_shop_name_category
  on public.products
     (shop_id,
      lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
      category_id)
  where is_active;

-- ============================================================================
-- §F. Category management RPCs
-- ============================================================================

create or replace function public.search_categories(
  p_query text default null,
  p_limit int default 10,
  p_offset int default 0
) returns table (
  id uuid,
  name text,
  product_count bigint
)
language plpgsql stable security definer
set search_path = public, extensions, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  if v_shop_id is null then
    raise exception 'no_shop_for_user';
  end if;

  perform set_limit(0.2);

  if v_q is null then
    return query
      select c.id, c.name,
             count(p.id) filter (where p.is_active) as product_count
        from public.product_categories c
        left join public.products p on p.category_id = c.id
       where c.shop_id = v_shop_id and c.is_active
       group by c.id, c.name
       order by product_count desc, c.name asc
       limit greatest(p_limit, 1)
       offset greatest(p_offset, 0);
  else
    return query
      select c.id, c.name,
             count(p.id) filter (where p.is_active) as product_count
        from public.product_categories c
        left join public.products p on p.category_id = c.id
       where c.shop_id = v_shop_id
         and c.is_active
         and (c.name % v_q or c.name ilike '%' || v_q || '%')
       group by c.id, c.name
       order by
         case when c.name ilike v_q || '%' then 0 else 1 end,
         similarity(c.name, v_q) desc nulls last,
         count(p.id) filter (where p.is_active) desc,
         c.name asc
       limit greatest(p_limit, 1)
       offset greatest(p_offset, 0);
  end if;
end;
$$;

create or replace function public.create_category_inline(p_name text)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_id uuid;
  v_trimmed text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if length(v_trimmed) = 0 then raise exception 'category_name_blank'; end if;

  -- Try to revive a previously-archived match before inserting a new row.
  -- Without this, archived names create a confusing dead-end if the owner
  -- types the same name again.
  update public.product_categories
     set is_active = true, updated_at = now()
   where shop_id = v_shop_id
     and is_active = false
     and lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(v_trimmed)
   returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.product_categories (shop_id, name)
  values (v_shop_id, v_trimmed)
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'category_already_exists';
end;
$$;

create or replace function public.update_category(
  p_id uuid,
  p_name text default null,
  p_is_active boolean default null
) returns void
language plpgsql security definer
set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_trimmed text;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  if p_name is not null then
    v_trimmed := regexp_replace(trim(p_name), '\s+', ' ', 'g');
    if length(v_trimmed) = 0 then raise exception 'category_name_blank'; end if;
  end if;

  update public.product_categories
     set name      = coalesce(v_trimmed, name),
         is_active = coalesce(p_is_active, is_active)
   where id = p_id and shop_id = v_shop_id;

  if not found then
    raise exception 'category_not_found';
  end if;
exception
  when unique_violation then
    raise exception 'category_already_exists';
end;
$$;

-- ============================================================================
-- §G. search_products / search_products_count — add p_category_id filter.
--     Replaces v2.3 definitions. Signatures change, so DROP first per CLAUDE.md
--     "signature-changing rewrites need DROP + CREATE" gotcha.
-- ============================================================================

drop function if exists public.search_products(text, integer, integer, boolean);
drop function if exists public.search_products_count(text, boolean);

create or replace function public.search_products(
  p_query text default null::text,
  p_limit integer default 50,
  p_offset integer default 0,
  p_only_in_stock boolean default false,
  p_category_id uuid default null
) returns table (
  id uuid,
  name text,
  type text,
  category_id uuid,
  description text,
  price numeric,
  avg_cost numeric,
  last_purchase_cost numeric,
  stock integer,
  is_active boolean,
  relevance real
)
language plpgsql stable security definer
set search_path = public, extensions, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query  text;
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
       and (p_category_id is null or p.category_id = p_category_id)
  ),
  scored as (
    select
      b.*,
      case
        when v_query is null then 0::real
        else greatest(
          case when b.name ilike v_query || '%' then 1.0::real else 0.0::real end,
          case when b.name ilike '%' || v_query || '%' then 0.8::real else 0.0::real end,
          similarity(b.name, v_query)
        )
      end as relevance
    from base b
  )
  select
    s.id, s.name, s.type, s.category_id, s.description,
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
  p_query text default null::text,
  p_only_in_stock boolean default false,
  p_category_id uuid default null
) returns bigint
language plpgsql stable security definer
set search_path = public, extensions, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query  text;
  v_count  bigint;
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
       and (not p_only_in_stock or p.stock > 0)
       and (p_category_id is null or p.category_id = p_category_id);
  else
    select count(*) into v_count
      from public.products p
     where p.shop_id = v_shop_id
       and p.is_active = true
       and (not p_only_in_stock or p.stock > 0)
       and (p_category_id is null or p.category_id = p_category_id)
       and (p.name ilike '%' || v_query || '%' or p.name % v_query);
  end if;

  return v_count;
end;
$$;

-- ============================================================================
-- §H. create_product_with_opening_stock — accept p_category_id.
--     For back-compat, p_type is still accepted as a fallback: if p_category_id
--     is NULL the function resolves/creates a category from p_type. Once the
--     frontend has been switched (this same migration cycle), p_type will be
--     ignored / NULL on every call. This belt-and-suspenders shape is so a
--     stale tab in the field doesn't break product creation.
-- ============================================================================

drop function if exists public.create_product_with_opening_stock(text, text, text, numeric, integer, numeric);

create or replace function public.create_product_with_opening_stock(
  p_name text,
  p_category_id uuid default null,
  p_description text default null::text,
  p_price numeric default 0,
  p_opening_stock integer default 0,
  p_opening_cost numeric default 0,
  p_type text default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_purchase_id uuid;
  v_base_unit_id uuid;
  v_category_id uuid := p_category_id;
  v_category_name text;
  v_type_label text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_price < 0 then raise exception 'price_negative'; end if;
  if p_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
  if p_opening_cost < 0 then raise exception 'opening_cost_negative'; end if;

  -- Category resolution
  if v_category_id is null then
    -- Legacy callers: derive the category from p_type so older clients keep working.
    if p_type is null or length(trim(p_type)) = 0 then
      raise exception 'category_required';
    end if;
    v_category_name := regexp_replace(trim(p_type), '\s+', ' ', 'g');
    select id into v_category_id
      from public.product_categories
     where shop_id = v_shop_id
       and is_active
       and lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(v_category_name)
     limit 1;
    if v_category_id is null then
      insert into public.product_categories (shop_id, name)
      values (v_shop_id, v_category_name)
      returning id into v_category_id;
    end if;
  else
    -- Authoritative path: validate the category belongs to the caller's shop.
    perform 1 from public.product_categories
      where id = v_category_id and shop_id = v_shop_id and is_active;
    if not found then
      raise exception 'category_not_found';
    end if;
  end if;

  -- products.type is still NOT NULL until a future cleanup migration drops it,
  -- so snapshot the category name into it for back-compat with any read path
  -- that still references the column.
  select name into v_type_label
    from public.product_categories where id = v_category_id;

  -- Base unit (unchanged from v2.1)
  select id into v_base_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id and code = 'each' and is_active = true;
  if v_base_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, 'each', 'Each')
    returning id into v_base_unit_id;
  end if;

  insert into public.products (
    shop_id, name, type, category_id, description,
    price, stock, avg_cost, cost, base_unit_id
  )
  values (
    v_shop_id, p_name, v_type_label, v_category_id, p_description,
    p_price, 0, 0, 0, v_base_unit_id
  )
  returning id into v_product_id;

  if p_opening_stock > 0 then
    insert into public.purchases (
      shop_id, total_cost, source, note, purchase_date, cashier_id, is_opening
    ) values (
      v_shop_id, p_opening_stock * p_opening_cost, 'Opening Stock',
      'Initial inventory', current_date, v_user_id, true
    )
    returning id into v_purchase_id;

    insert into public.purchase_items (
      purchase_id, product_id, qty, cost_at_purchase, qty_in_base
    ) values (
      v_purchase_id, v_product_id, p_opening_stock, p_opening_cost, p_opening_stock
    );

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

-- ============================================================================
-- §I. Grants — revoke from public + anon, grant to authenticated.
--     Matches v1.8a / v1.9a hardening pattern; supabase auto-grants public+anon
--     on creation so explicit revoke is required.
-- ============================================================================

revoke execute on function public.search_categories(text, int, int)        from public, anon;
revoke execute on function public.create_category_inline(text)              from public, anon;
revoke execute on function public.update_category(uuid, text, boolean)      from public, anon;
revoke execute on function public.search_products(text, integer, integer, boolean, uuid)
                                                                            from public, anon;
revoke execute on function public.search_products_count(text, boolean, uuid) from public, anon;
revoke execute on function public.create_product_with_opening_stock(text, uuid, text, numeric, integer, numeric, text)
                                                                            from public, anon;

grant  execute on function public.search_categories(text, int, int)        to authenticated;
grant  execute on function public.create_category_inline(text)              to authenticated;
grant  execute on function public.update_category(uuid, text, boolean)      to authenticated;
grant  execute on function public.search_products(text, integer, integer, boolean, uuid)
                                                                            to authenticated;
grant  execute on function public.search_products_count(text, boolean, uuid) to authenticated;
grant  execute on function public.create_product_with_opening_stock(text, uuid, text, numeric, integer, numeric, text)
                                                                            to authenticated;
