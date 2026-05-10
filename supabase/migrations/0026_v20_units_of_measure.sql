-- 0026_v20_units_of_measure.sql
-- v2.0: Units of Measure & Pack Pricing
-- Companion to MVP_v2.0_UNITS_OF_MEASURE.md
--
-- Single migration covering:
--   §A new tables (units_of_measure, product_packs)
--   §B alter products / shops / sale_items / purchase_items
--   §C backfill (with append-only triggers temporarily disabled)
--   §D indexes
--   §E patch complete_onboarding to seed default 'each' UoM
--   §F patch create_product_with_opening_stock to set base_unit_id
--      (minimal patch so the NOT NULL constraint added in §C does not
--       break product creation in the gap before the Phase C rewrite)
--
-- Append-only trigger gotcha (CLAUDE.md): financial_records_immutable on
-- sale_items / purchase_items blocks the qty_in_base backfill UPDATE.
-- Same pattern as v1.9 §B — DISABLE → UPDATE → ENABLE.

-- ============================================================================
-- §A. New tables
-- ============================================================================

-- A.1 units_of_measure (per shop)
create table if not exists public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uom_code_format check (code = lower(trim(code)) and code ~ '^[a-z][a-z0-9_]*$')
);

create unique index if not exists uq_uom_shop_code
  on public.units_of_measure (shop_id, code) where is_active = true;

create index if not exists idx_uom_shop
  on public.units_of_measure (shop_id) where is_active = true;

drop trigger if exists uom_touch on public.units_of_measure;
create trigger uom_touch
  before update on public.units_of_measure
  for each row execute function public.touch_updated_at();

alter table public.units_of_measure enable row level security;

drop policy if exists "uom_shop_read"  on public.units_of_measure;
drop policy if exists "uom_shop_write" on public.units_of_measure;
create policy "uom_shop_read" on public.units_of_measure
  for select using (shop_id = (select public.current_shop_id()));
create policy "uom_shop_write" on public.units_of_measure
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

-- A.2 product_packs
create table if not exists public.product_packs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit_id uuid not null references public.units_of_measure(id) on delete restrict,
  base_qty integer not null check (base_qty > 1),
  price numeric(12,2) check (price is null or price >= 0),
  is_default_purchase boolean not null default false,
  is_default_sale boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_pack_default_purchase
  on public.product_packs (product_id) where is_default_purchase and is_active;
create unique index if not exists uq_pack_default_sale
  on public.product_packs (product_id) where is_default_sale and is_active;
create unique index if not exists uq_pack_product_unit
  on public.product_packs (product_id, unit_id) where is_active;
create index if not exists idx_pack_product
  on public.product_packs (product_id) where is_active;

drop trigger if exists product_packs_touch on public.product_packs;
create trigger product_packs_touch
  before update on public.product_packs
  for each row execute function public.touch_updated_at();

alter table public.product_packs enable row level security;

drop policy if exists "packs_shop_read"  on public.product_packs;
drop policy if exists "packs_shop_write" on public.product_packs;
create policy "packs_shop_read" on public.product_packs
  for select using (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  );
create policy "packs_shop_write" on public.product_packs
  for all using (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  ) with check (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  );

-- ============================================================================
-- §B. Existing-table changes
-- ============================================================================

-- B.1 products: add base_unit_id and allow price to be null
alter table public.products
  add column if not exists base_unit_id uuid references public.units_of_measure(id);
alter table public.products alter column price drop not null;

-- B.2 shops: business_type
alter table public.shops
  add column if not exists business_type text not null default 'retail';
alter table public.shops
  drop constraint if exists shops_business_type_check;
alter table public.shops
  add constraint shops_business_type_check check (business_type in ('retail','hybrid'));

-- B.3 sale_items: pack snapshot columns
alter table public.sale_items
  add column if not exists pack_id uuid references public.product_packs(id),
  add column if not exists pack_qty integer,
  add column if not exists pack_base_qty_snapshot integer,
  add column if not exists qty_in_base integer;

alter table public.sale_items
  drop constraint if exists sale_items_pack_consistent;
alter table public.sale_items
  add constraint sale_items_pack_consistent check (
    (pack_id is null and pack_qty is null and pack_base_qty_snapshot is null)
    or
    (pack_id is not null and pack_qty is not null and pack_base_qty_snapshot is not null
     and pack_qty > 0 and pack_base_qty_snapshot > 1)
  );

-- B.4 purchase_items: same shape
alter table public.purchase_items
  add column if not exists pack_id uuid references public.product_packs(id),
  add column if not exists pack_qty integer,
  add column if not exists pack_base_qty_snapshot integer,
  add column if not exists qty_in_base integer;

alter table public.purchase_items
  drop constraint if exists purchase_items_pack_consistent;
alter table public.purchase_items
  add constraint purchase_items_pack_consistent check (
    (pack_id is null and pack_qty is null and pack_base_qty_snapshot is null)
    or
    (pack_id is not null and pack_qty is not null and pack_base_qty_snapshot is not null
     and pack_qty > 0 and pack_base_qty_snapshot > 1)
  );

-- ============================================================================
-- §C. Backfill
-- ============================================================================

-- C.1 Default 'each' UoM per shop (idempotent)
insert into public.units_of_measure (shop_id, code, name)
select s.id, 'each', 'Each'
from public.shops s
where not exists (
  select 1 from public.units_of_measure u
  where u.shop_id = s.id and u.code = 'each'
);

-- C.2 Set base_unit_id on every product, then enforce NOT NULL
update public.products p
set base_unit_id = u.id
from public.units_of_measure u
where u.shop_id = p.shop_id
  and u.code = 'each'
  and p.base_unit_id is null;

alter table public.products alter column base_unit_id set not null;

-- C.3 Backfill qty_in_base on sale_items (append-only trigger blocks UPDATE)
alter table public.sale_items disable trigger sale_items_no_modify;
update public.sale_items set qty_in_base = qty where qty_in_base is null;
alter table public.sale_items enable trigger sale_items_no_modify;
alter table public.sale_items alter column qty_in_base set not null;

-- C.4 Same for purchase_items
alter table public.purchase_items disable trigger purchase_items_no_modify;
update public.purchase_items set qty_in_base = qty where qty_in_base is null;
alter table public.purchase_items enable trigger purchase_items_no_modify;
alter table public.purchase_items alter column qty_in_base set not null;

-- ============================================================================
-- §D. Indexes for the new base-unit qty column
-- ============================================================================

create index if not exists idx_sale_items_qty_in_base
  on public.sale_items (product_id, qty_in_base);
create index if not exists idx_purchase_items_qty_in_base
  on public.purchase_items (product_id, qty_in_base);

-- ============================================================================
-- §E. complete_onboarding patch — seed default 'each' UoM for new shops
-- ============================================================================

create or replace function public.complete_onboarding(
  p_shop_name text, p_shop_address text, p_shop_phone text, p_shop_type text,
  p_owner_name text, p_owner_phone text, p_owner_cnic text, p_owner_address text
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.shops (owner_user_id, shop_name, shop_address, shop_phone, shop_type)
  values (v_user_id, p_shop_name, p_shop_address, p_shop_phone, p_shop_type)
  returning id into v_shop_id;

  insert into public.shop_owner_details (shop_id, owner_name, owner_phone, owner_cnic, owner_address)
  values (v_shop_id, p_owner_name, p_owner_phone, p_owner_cnic, p_owner_address);

  -- v2.0: seed default base unit so subsequent product creation can set base_unit_id
  insert into public.units_of_measure (shop_id, code, name)
  values (v_shop_id, 'each', 'Each');

  update public.profiles set onboarding_completed = true, updated_at = now() where id = v_user_id;

  return v_shop_id;
end;
$function$;

revoke execute on function public.complete_onboarding(text,text,text,text,text,text,text,text)
  from public, anon;
grant  execute on function public.complete_onboarding(text,text,text,text,text,text,text,text)
  to authenticated;

-- ============================================================================
-- §F. create_product_with_opening_stock patch — set base_unit_id on insert
--      Minimal change to keep the NOT NULL constraint satisfied during the
--      gap before the Phase C rewrite (which adds p_base_unit_code, opening
--      stock pack support, and the assert_product_sellable call).
-- ============================================================================

create or replace function public.create_product_with_opening_stock(
  p_name text,
  p_type text,
  p_description text default null::text,
  p_price numeric default 0,
  p_opening_stock integer default 0,
  p_opening_cost numeric default 0
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_purchase_id uuid;
  v_base_unit_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_price < 0 then raise exception 'price_negative'; end if;
  if p_opening_stock < 0 then raise exception 'opening_stock_negative'; end if;
  if p_opening_cost < 0 then raise exception 'opening_cost_negative'; end if;

  select id into v_base_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id and code = 'each' and is_active = true;
  if v_base_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, 'each', 'Each')
    returning id into v_base_unit_id;
  end if;

  insert into public.products (shop_id, name, type, description, price, stock, avg_cost, cost, base_unit_id)
  values (v_shop_id, p_name, p_type, p_description, p_price, 0, 0, 0, v_base_unit_id)
  returning id into v_product_id;

  if p_opening_stock > 0 then
    insert into public.purchases (shop_id, total_cost, source, note, purchase_date, cashier_id, is_opening)
    values (v_shop_id, p_opening_stock * p_opening_cost, 'Opening Stock', 'Initial inventory', current_date, v_user_id, true)
    returning id into v_purchase_id;

    -- qty_in_base = qty for opening stock (no pack support in opening flow per spec §5.5)
    insert into public.purchase_items (purchase_id, product_id, qty, cost_at_purchase, qty_in_base)
    values (v_purchase_id, v_product_id, p_opening_stock, p_opening_cost, p_opening_stock);

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
$function$;

revoke execute on function public.create_product_with_opening_stock(text,text,text,numeric,integer,numeric)
  from public, anon;
grant  execute on function public.create_product_with_opening_stock(text,text,text,numeric,integer,numeric)
  to authenticated;
