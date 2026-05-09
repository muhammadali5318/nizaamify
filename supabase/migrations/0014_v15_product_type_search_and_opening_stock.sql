-- v1.5: products.type / products.description, normalization, composite uniqueness,
-- opening-stock flag, synthetic opening-stock backfill, trigram indexes for fuzzy search.

-- 1. Add columns ------------------------------------------------------------
alter table public.products
  add column if not exists type text,
  add column if not exists description text;

alter table public.purchases
  add column if not exists is_opening boolean not null default false;

-- 2. Normalization function + trigger --------------------------------------
create or replace function public.normalize_product_text(s text)
returns text
language sql
immutable
as $$
  select case
    when s is null then null
    else trim(regexp_replace(s, '\s+', ' ', 'g'))
  end;
$$;

create or replace function public.products_normalize_trigger()
returns trigger
language plpgsql
as $$
begin
  new.name := public.normalize_product_text(new.name);
  new.type := public.normalize_product_text(new.type);
  if new.description is not null then
    new.description := trim(new.description);
    if new.description = '' then new.description := null; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_normalize on public.products;
create trigger products_normalize
  before insert or update of name, type, description on public.products
  for each row execute function public.products_normalize_trigger();

-- 3. Backfill type for existing rows ---------------------------------------
update public.products
   set name = public.normalize_product_text(name)
 where name is not null;

update public.products
   set type = 'General'
 where type is null;

alter table public.products
  alter column type set not null;

alter table public.products
  drop constraint if exists products_type_not_blank;
alter table public.products
  add constraint products_type_not_blank check (length(type) > 0);

alter table public.products
  drop constraint if exists products_name_not_blank;
alter table public.products
  add constraint products_name_not_blank check (length(name) > 0);

-- 4. Composite unique index (case- and whitespace-insensitive) -------------
create unique index if not exists uq_products_shop_name_type
  on public.products (
    shop_id,
    lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(type), '\s+', ' ', 'g'))
  )
  where is_active = true;

-- 5. Synthetic opening-stock backfill --------------------------------------
-- For existing products with stock>0 and no purchase history, create one
-- "Opening Stock" purchase row each so the audit trail stays consistent.
with seed as (
  select
    p.shop_id,
    p.id as product_id,
    p.stock as qty,
    coalesce(p.avg_cost, p.cost, 0) as cost_each
  from public.products p
  where p.stock > 0
    and not exists (
      select 1
      from public.purchase_items pi
      join public.purchases pu on pu.id = pi.purchase_id
      where pi.product_id = p.id
    )
),
new_purchases as (
  insert into public.purchases (shop_id, total_cost, source, note, purchase_date, cashier_id, is_opening)
  select
    s.shop_id,
    s.qty * s.cost_each,
    'Opening Stock',
    'Auto-generated during v1.5 migration',
    current_date,
    sh.owner_user_id,
    true
  from seed s
  join public.shops sh on sh.id = s.shop_id
  returning id, shop_id
)
insert into public.purchase_items (purchase_id, product_id, qty, cost_at_purchase)
select np.id, s.product_id, s.qty, s.cost_each
from new_purchases np
join seed s on s.shop_id = np.shop_id;

-- 6. Trigram indexes for fuzzy search --------------------------------------
create extension if not exists pg_trgm;

create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);

create index if not exists idx_products_type_trgm
  on public.products using gin (type gin_trgm_ops);

create index if not exists idx_products_name_type_trgm
  on public.products using gin ((name || ' ' || type) gin_trgm_ops);

create index if not exists idx_products_shop_name_active
  on public.products (shop_id, name) where is_active = true;
