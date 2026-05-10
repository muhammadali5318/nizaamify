-- 0028_v21_stock_in_units.sql
-- v2.1 — Stock-In Unit Handling (simplified, supersedes v2.0)
-- Companion to MVP_v2.1_STOCK_IN_UNITS.md
--
-- Walks back v2.0's sale-side complications (per spec §3.7):
--   §A drop sale_items pack columns + idx + check constraint
--   §B drop product_packs.price + product_packs.is_default_sale + uq idx
--   §C drop shops.business_type
--   §D drop product_stock_display view (recreated in §I)
--   §E drop v2.0 RPCs: assert_product_sellable, define_pack, update_pack
--   §F restore record_sale to v1.6 body (no pack handling)
--   §G restore create_product_with_opening_stock without assert_product_sellable
--   §H add products.is_scan_only
--   §I recreate product_stock_display per spec §3.8
--   §J new v2.1 RPCs: define_pack_inline, simpler update_pack, deactivate_pack unchanged
--   §K grants: revoke from public,anon; grant to authenticated
--
-- After this migration:
--   - sale_items has no pack awareness (sales are always in base units)
--   - product_packs is stock-in-only (no price, no default_sale)
--   - record_sale is byte-equivalent to v1.6
--   - record_purchase keeps its v2.0 pack-aware shape — already matches v2.1 §4.3
--   - frontend never recomputes pack breakdown (view exposes whole_packs/remainder_base)

-- ============================================================================
-- §D (moved earlier). Drop the v2.0 stock display view first, since its body
--      references product_packs.price which §B is about to drop. Postgres
--      blocks a column drop while a view depends on it.
-- ============================================================================

drop view if exists public.product_stock_display;

-- ============================================================================
-- §A. Drop sale_items pack columns
-- ============================================================================

alter table public.sale_items drop constraint if exists sale_items_pack_consistent;
drop index if exists public.idx_sale_items_qty_in_base;

alter table public.sale_items
  drop column if exists pack_id,
  drop column if exists pack_qty,
  drop column if exists pack_base_qty_snapshot,
  drop column if exists qty_in_base;

-- ============================================================================
-- §B. Drop product_packs price + default-sale columns
-- ============================================================================

drop index if exists public.uq_pack_default_sale;

alter table public.product_packs
  drop column if exists price,
  drop column if exists is_default_sale;

-- ============================================================================
-- §C. Drop shops.business_type
-- ============================================================================

alter table public.shops drop constraint if exists shops_business_type_check;
alter table public.shops drop column if exists business_type;

-- ============================================================================
-- §E. Drop v2.0 RPCs that are gone or replaced in v2.1
-- ============================================================================

drop function if exists public.assert_product_sellable(uuid);
drop function if exists public.define_pack(uuid, uuid, integer, numeric, boolean, boolean);
drop function if exists public.update_pack(uuid, numeric, boolean, boolean, boolean);

-- ============================================================================
-- §F. Restore record_sale to v1.6 body
--      (cached from the Phase A discovery read; no pack handling, sales are
--      always in base units per v2.1 mental model)
-- ============================================================================

create or replace function public.record_sale(
  p_customer_id uuid default null::uuid,
  p_amount_paid numeric default 0,
  p_service_charge numeric default 0,
  p_notes text default null::text,
  p_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $function$
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
  if p_amount_paid is null or p_amount_paid < 0 then raise exception 'amount_paid_negative'; end if;
  if v_service < 0 then raise exception 'service_charge_negative'; end if;

  if jsonb_typeof(p_items) is null then p_items := '[]'::jsonb; end if;
  if jsonb_array_length(p_items) = 0 and v_service = 0 then
    raise exception 'empty_sale: a sale must have items or a service charge';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::integer;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    if v_qty is null or v_qty <= 0 then raise exception 'qty must be positive'; end if;
    if v_price is null or v_price < 0 then raise exception 'price must be non-negative'; end if;
    v_total := v_total + (v_qty * v_price);
  end loop;
  v_total := v_total + v_service;

  if p_amount_paid > v_total then raise exception 'amount_paid_exceeds_total'; end if;

  v_credit := v_total - p_amount_paid;
  v_payment_type := case
    when v_credit = 0 then 'cash'
    when p_amount_paid = 0 then 'credit'
    else 'partial'
  end;

  if v_credit > 0 and p_customer_id is null then raise exception 'customer_required_for_credit'; end if;

  if p_customer_id is not null then
    if not exists (
      select 1 from public.customers where id = p_customer_id and shop_id = v_shop_id
    ) then raise exception 'customer_not_in_shop'; end if;
  end if;

  insert into public.invoices (
    shop_id, customer_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id
  ) values (
    v_shop_id, p_customer_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id
  ) returning id into v_invoice_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
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

    update public.products set stock = stock - v_qty, updated_at = now()
    where id = v_product_id;
  end loop;

  if v_credit > 0 then
    insert into public.ledger_entries (shop_id, customer_id, invoice_id, amount, type)
    values (v_shop_id, p_customer_id, v_invoice_id, v_credit, 'debit');
  end if;

  return v_invoice_id;
end;
$function$;

-- ============================================================================
-- §G. create_product_with_opening_stock without the assert_sellable call
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

-- ============================================================================
-- §H. products.is_scan_only — POS rule (§2.3, §5.5)
-- ============================================================================

alter table public.products
  add column if not exists is_scan_only boolean not null default false;

-- ============================================================================
-- §I. product_stock_display — recreated per spec §3.8
--     Frontend MUST consume whole_packs / remainder_base from this view
--     (never recompute in TS — that was the diagnosed compound-display bug).
-- ============================================================================

create view public.product_stock_display
with (security_invoker = true) as
select
  p.id              as product_id,
  p.shop_id         as shop_id,
  p.stock           as base_qty,
  bu.code           as base_unit_code,
  bu.name           as base_unit_name,
  p.is_scan_only    as is_scan_only,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'pack_id',        pk.id,
      'unit_code',      u.code,
      'unit_name',      u.name,
      'base_qty',       pk.base_qty,
      'whole_packs',    floor(p.stock::numeric / pk.base_qty)::int,
      'remainder_base', (p.stock - floor(p.stock::numeric / pk.base_qty)::int * pk.base_qty)::int,
      'is_default_purchase', pk.is_default_purchase
    ) order by pk.base_qty desc), '[]'::jsonb)
    from public.product_packs pk
    join public.units_of_measure u on u.id = pk.unit_id
    where pk.product_id = p.id and pk.is_active
  ) as pack_breakdown
from public.products p
join public.units_of_measure bu on bu.id = p.base_unit_id;

-- ============================================================================
-- §J. v2.1 pack-management RPCs
-- ============================================================================

-- define_pack_inline: stock-in form's "+ Create new pack" — flexible UoM
-- handling. p_unit_code and p_unit_name allow inline UoM creation: if a UoM
-- with the given code doesn't exist for the shop, it's inserted using the
-- given display name.
create or replace function public.define_pack_inline(
  p_product_id uuid,
  p_unit_code text,
  p_unit_name text,
  p_base_qty integer,
  p_is_default_purchase boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_unit_id uuid;
  v_pack_id uuid;
  v_normalized_code text := lower(trim(p_unit_code));
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_base_qty <= 1 then
    raise exception 'base_qty_must_be_greater_than_one'
      using hint = 'Pack must contain at least 2 base units';
  end if;
  if v_normalized_code !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'invalid_unit_code';
  end if;

  perform 1 from public.products
    where id = p_product_id and shop_id = v_shop_id;
  if not found then raise exception 'product_not_in_shop'; end if;

  -- Resolve or create the UoM scoped to this shop
  select id into v_unit_id
    from public.units_of_measure
   where shop_id = v_shop_id and code = v_normalized_code and is_active = true;

  if v_unit_id is null then
    insert into public.units_of_measure (shop_id, code, name)
    values (v_shop_id, v_normalized_code, coalesce(nullif(trim(p_unit_name), ''), p_unit_code))
    returning id into v_unit_id;
  end if;

  -- Atomically un-default any existing default pack on this product
  if p_is_default_purchase then
    update public.product_packs
       set is_default_purchase = false, updated_at = now()
     where product_id = p_product_id and is_default_purchase and is_active;
  end if;

  insert into public.product_packs (
    product_id, unit_id, base_qty, is_default_purchase
  ) values (
    p_product_id, v_unit_id, p_base_qty, coalesce(p_is_default_purchase, false)
  ) returning id into v_pack_id;

  return v_pack_id;
end;
$function$;

-- update_pack: simpler v2.1 signature (base_qty editable per §4.2 note,
-- though deactivate-and-redefine is the recommended workflow for size changes).
create or replace function public.update_pack(
  p_pack_id uuid,
  p_base_qty integer,
  p_is_default_purchase boolean
) returns void
language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_product_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_base_qty <= 1 then
    raise exception 'base_qty_must_be_greater_than_one';
  end if;

  select pp.product_id into v_product_id
    from public.product_packs pp
    join public.products p on p.id = pp.product_id
   where pp.id = p_pack_id and p.shop_id = v_shop_id
   for update;
  if v_product_id is null then raise exception 'pack_not_in_shop'; end if;

  if p_is_default_purchase then
    update public.product_packs
       set is_default_purchase = false, updated_at = now()
     where product_id = v_product_id
       and is_default_purchase
       and is_active
       and id <> p_pack_id;
  end if;

  update public.product_packs
     set base_qty = p_base_qty,
         is_default_purchase = p_is_default_purchase,
         updated_at = now()
   where id = p_pack_id;
end;
$function$;

-- deactivate_pack: keep the v2.0 body, since the contract is unchanged
-- (set is_active=false, clear is_default_purchase). The v2.0 version also
-- cleared is_default_sale — harmless no-op now that the column is gone.
create or replace function public.deactivate_pack(p_pack_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_product_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select pp.product_id into v_product_id
    from public.product_packs pp
    join public.products p on p.id = pp.product_id
   where pp.id = p_pack_id and p.shop_id = v_shop_id;
  if v_product_id is null then raise exception 'pack_not_found_or_not_in_shop'; end if;

  update public.product_packs
     set is_active = false,
         is_default_purchase = false,
         updated_at = now()
   where id = p_pack_id;
end;
$function$;

-- ============================================================================
-- §K. Grants — revoke from public,anon; grant to authenticated
-- ============================================================================

revoke execute on function public.record_sale(uuid,numeric,numeric,text,jsonb)
  from public, anon;
grant  execute on function public.record_sale(uuid,numeric,numeric,text,jsonb)
  to authenticated;

revoke execute on function public.create_product_with_opening_stock(text,text,text,numeric,integer,numeric)
  from public, anon;
grant  execute on function public.create_product_with_opening_stock(text,text,text,numeric,integer,numeric)
  to authenticated;

revoke execute on function public.define_pack_inline(uuid,text,text,integer,boolean)
  from public, anon;
grant  execute on function public.define_pack_inline(uuid,text,text,integer,boolean)
  to authenticated;

revoke execute on function public.update_pack(uuid,integer,boolean) from public, anon;
grant  execute on function public.update_pack(uuid,integer,boolean) to authenticated;

revoke execute on function public.deactivate_pack(uuid) from public, anon;
grant  execute on function public.deactivate_pack(uuid) to authenticated;
