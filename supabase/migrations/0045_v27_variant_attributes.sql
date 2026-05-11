-- v2.7 §3 — Variant attribute schema.
--
-- Three new tables (variant_attributes, variant_attribute_values,
-- product_variant_attribute_values), one new column (products.has_variants),
-- and a row trigger that prevents setting is_default = true on a variant whose
-- product is flagged has_variants = true. The v2.6 partial unique index
-- uq_variant_default_per_product stays (covers the single-default-per-product
-- case without subquerying products); the trigger covers the
-- "multi-variant products may not have a default" case that the partial
-- predicate can't express.

-- ===========================================================================
-- §3.1 variant_attributes — shop-wide
-- ===========================================================================

create table if not exists public.variant_attributes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variant_attr_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists uq_variant_attr_shop_name
  on public.variant_attributes
     (shop_id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
  where is_active;

create index if not exists idx_variant_attr_shop
  on public.variant_attributes (shop_id, is_active) where is_active;

alter table public.variant_attributes enable row level security;

drop policy if exists "variant_attr_shop_read" on public.variant_attributes;
create policy "variant_attr_shop_read" on public.variant_attributes
  for select using (shop_id = (select public.current_shop_id()));

drop policy if exists "variant_attr_shop_write" on public.variant_attributes;
create policy "variant_attr_shop_write" on public.variant_attributes
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

drop trigger if exists variant_attributes_touch on public.variant_attributes;
create trigger variant_attributes_touch
  before update on public.variant_attributes
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- §3.2 variant_attribute_values — pool of values per attribute
-- ===========================================================================

create table if not exists public.variant_attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.variant_attributes(id) on delete cascade,
  value text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variant_value_not_blank check (length(trim(value)) > 0)
);

create unique index if not exists uq_variant_value_attr_value
  on public.variant_attribute_values
     (attribute_id, lower(regexp_replace(trim(value), '\s+', ' ', 'g')))
  where is_active;

create index if not exists idx_variant_value_attr
  on public.variant_attribute_values (attribute_id, is_active) where is_active;

alter table public.variant_attribute_values enable row level security;

drop policy if exists "variant_values_shop_read" on public.variant_attribute_values;
create policy "variant_values_shop_read" on public.variant_attribute_values
  for select using (
    exists (select 1 from public.variant_attributes a
             where a.id = attribute_id and a.shop_id = (select public.current_shop_id()))
  );

drop policy if exists "variant_values_shop_write" on public.variant_attribute_values;
create policy "variant_values_shop_write" on public.variant_attribute_values
  for all using (
    exists (select 1 from public.variant_attributes a
             where a.id = attribute_id and a.shop_id = (select public.current_shop_id()))
  ) with check (
    exists (select 1 from public.variant_attributes a
             where a.id = attribute_id and a.shop_id = (select public.current_shop_id()))
  );

drop trigger if exists variant_attribute_values_touch on public.variant_attribute_values;
create trigger variant_attribute_values_touch
  before update on public.variant_attribute_values
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- §3.3 product_variant_attribute_values — link variants to their attribute combo
-- ===========================================================================

create table if not exists public.product_variant_attribute_values (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  attribute_value_id uuid not null references public.variant_attribute_values(id) on delete restrict,
  primary key (variant_id, attribute_value_id)
);

create index if not exists idx_pvav_variant on public.product_variant_attribute_values (variant_id);
create index if not exists idx_pvav_value   on public.product_variant_attribute_values (attribute_value_id);

alter table public.product_variant_attribute_values enable row level security;

drop policy if exists "pvav_shop_read" on public.product_variant_attribute_values;
create policy "pvav_shop_read" on public.product_variant_attribute_values
  for select using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.shop_id = (select public.current_shop_id())
    )
  );

drop policy if exists "pvav_shop_write" on public.product_variant_attribute_values;
create policy "pvav_shop_write" on public.product_variant_attribute_values
  for all using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.shop_id = (select public.current_shop_id())
    )
  ) with check (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.shop_id = (select public.current_shop_id())
    )
  );

-- ===========================================================================
-- §3.4 products.has_variants
-- ===========================================================================

alter table public.products
  add column if not exists has_variants boolean not null default false;

create index if not exists idx_products_has_variants
  on public.products (shop_id, has_variants) where has_variants;

-- ===========================================================================
-- §3.5 Multi-variant default-flag invariant via row trigger
--   (partial unique index can't express "no default on has_variants products"
--    because Postgres rejects subqueries in the WHERE predicate of an index.)
-- ===========================================================================

create or replace function public.enforce_variant_default_invariants() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_has_variants boolean;
begin
  if NEW.is_default then
    select has_variants into v_has_variants
      from public.products where id = NEW.product_id;
    if v_has_variants then
      raise exception 'cannot_set_default_on_multi_variant_product'
        using detail = format('variant %s belongs to product %s which has_variants = true',
                              NEW.id, NEW.product_id);
    end if;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.enforce_variant_default_invariants() from public, anon, authenticated;

drop trigger if exists variants_default_invariant on public.product_variants;
create trigger variants_default_invariant
  before insert or update on public.product_variants
  for each row execute function public.enforce_variant_default_invariants();

-- ===========================================================================
-- §3.6 Audit checkpoint
-- ===========================================================================

do $$
declare v_bad int;
begin
  select count(*) into v_bad from (
    select p.id from public.products p
    left join public.product_variants v on v.product_id = p.id and v.is_default and v.is_active
    where p.is_active and not p.has_variants
    group by p.id having count(v.id) <> 1
  ) x;
  if v_bad > 0 then
    raise exception 'v27_default_variant_audit_failed: % single-variant product(s) without exactly one default', v_bad;
  end if;
end$$;
