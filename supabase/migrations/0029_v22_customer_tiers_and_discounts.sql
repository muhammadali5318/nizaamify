-- 0029_v22_customer_tiers_and_discounts.sql
-- v2.2 — Customer Tiers & Discount Lines
-- Companion to MVP_v2.2_CUSTOMER_TIERS.md
--
-- Schema additions only — record_sale rewrite + tier RPCs land in 0030.
--   §A customer_tiers table + indexes + RLS + touch trigger
--   §B customers.tier_id column + index
--   §C invoices snapshot columns (tier_id, percent_snapshot, amount, override type/value)
--      + override-consistency + override-no-tier-id constraints
--   §D sale_items line discount columns + consistency + percent-range constraints
--   §E seed Walk-in (default), Wholesale (5%), VIP (3%) per shop
--   §F backfill existing customers to default tier
--   §G invoice_with_discount_detail view (security_invoker = true per ADR-0015)
--
-- Append-only triggers (financial_records_immutable on invoices/sale_items)
-- are NOT touched: defaults on the new columns satisfy the new constraints
-- for every existing row, so no UPDATE backfill against those tables is
-- needed.

-- ============================================================================
-- §A. customer_tiers
-- ============================================================================

create table if not exists public.customer_tiers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tier_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists uq_tier_shop_name
  on public.customer_tiers (shop_id, lower(trim(name))) where is_active;

create unique index if not exists uq_tier_default_per_shop
  on public.customer_tiers (shop_id) where is_default and is_active;

create index if not exists idx_customer_tiers_shop
  on public.customer_tiers (shop_id) where is_active;

alter table public.customer_tiers enable row level security;

drop policy if exists "tiers_shop_read"  on public.customer_tiers;
drop policy if exists "tiers_shop_write" on public.customer_tiers;
create policy "tiers_shop_read" on public.customer_tiers
  for select using (shop_id = (select public.current_shop_id()));
create policy "tiers_shop_write" on public.customer_tiers
  for all using (shop_id = (select public.current_shop_id()))
       with check (shop_id = (select public.current_shop_id()));

drop trigger if exists customer_tiers_touch on public.customer_tiers;
create trigger customer_tiers_touch
  before update on public.customer_tiers
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- §B. customers.tier_id
-- ============================================================================

alter table public.customers
  add column if not exists tier_id uuid references public.customer_tiers(id);

create index if not exists idx_customers_tier
  on public.customers (tier_id) where tier_id is not null;

-- ============================================================================
-- §C. invoices: tier + override snapshot columns
-- ============================================================================

alter table public.invoices
  add column if not exists tier_id uuid references public.customer_tiers(id),
  add column if not exists tier_discount_percent_snapshot numeric(5,2)
    check (tier_discount_percent_snapshot is null
           or (tier_discount_percent_snapshot >= 0
               and tier_discount_percent_snapshot <= 100)),
  add column if not exists tier_discount_amount numeric(12,2) not null default 0
    check (tier_discount_amount >= 0),
  add column if not exists tier_override_type text
    check (tier_override_type is null
           or tier_override_type in ('percent', 'fixed')),
  add column if not exists tier_override_value numeric(12,2)
    check (tier_override_value is null or tier_override_value >= 0);

-- An override invoice has both type and value set, or neither.
alter table public.invoices
  drop constraint if exists invoices_tier_override_consistent;
alter table public.invoices
  add constraint invoices_tier_override_consistent check (
    (tier_override_type is null and tier_override_value is null)
    or
    (tier_override_type is not null and tier_override_value is not null)
  );

-- An override invoice has tier_id = NULL — overriding deliberately walks
-- away from the tier system. The customer's current tier is still queryable
-- via customer_id when the receipt-time tooltip needs to render it.
alter table public.invoices
  drop constraint if exists invoices_tier_override_no_tier_id;
alter table public.invoices
  add constraint invoices_tier_override_no_tier_id check (
    tier_override_type is null or tier_id is null
  );

create index if not exists idx_invoices_tier
  on public.invoices (tier_id) where tier_id is not null;

-- ============================================================================
-- §D. sale_items: per-line discount columns
-- ============================================================================

alter table public.sale_items
  add column if not exists line_discount_type text
    check (line_discount_type is null
           or line_discount_type in ('percent', 'fixed')),
  add column if not exists line_discount_value numeric(12,2)
    check (line_discount_value is null or line_discount_value >= 0),
  add column if not exists line_discount_amount numeric(12,2) not null default 0
    check (line_discount_amount >= 0);

-- A line either has a discount (type+value, amount may be > 0) or has none
-- (type and value null, amount 0). The line_discount_amount <= line_subtotal
-- cap is enforced at function level since it crosses qty + price columns.
alter table public.sale_items
  drop constraint if exists sale_items_line_discount_consistent;
alter table public.sale_items
  add constraint sale_items_line_discount_consistent check (
    (line_discount_type is null and line_discount_value is null and line_discount_amount = 0)
    or
    (line_discount_type is not null and line_discount_value is not null)
  );

alter table public.sale_items
  drop constraint if exists sale_items_line_discount_percent_range;
alter table public.sale_items
  add constraint sale_items_line_discount_percent_range check (
    line_discount_type is distinct from 'percent'
    or (line_discount_value >= 0 and line_discount_value <= 100)
  );

-- ============================================================================
-- §E. Seed default tiers per shop (idempotent)
-- ============================================================================

insert into public.customer_tiers (shop_id, name, discount_percent, is_default, notes)
select s.id, 'Walk-in', 0, true, 'Default tier for walk-in customers'
from public.shops s
where not exists (
  select 1 from public.customer_tiers t
  where t.shop_id = s.id and lower(trim(t.name)) = 'walk-in'
);

insert into public.customer_tiers (shop_id, name, discount_percent, notes)
select s.id, 'Wholesale', 5, 'Resellers and small shopkeepers'
from public.shops s
where not exists (
  select 1 from public.customer_tiers t
  where t.shop_id = s.id and lower(trim(t.name)) = 'wholesale'
);

insert into public.customer_tiers (shop_id, name, discount_percent, notes)
select s.id, 'VIP', 3, 'Loyal regular customers'
from public.shops s
where not exists (
  select 1 from public.customer_tiers t
  where t.shop_id = s.id and lower(trim(t.name)) = 'vip'
);

-- ============================================================================
-- §F. Backfill existing customers to the shop's default tier
-- ============================================================================

update public.customers c
   set tier_id = t.id
  from public.customer_tiers t
 where t.shop_id = c.shop_id
   and t.is_default
   and t.is_active
   and c.tier_id is null;

-- ============================================================================
-- §G. invoice_with_discount_detail view (spec §4.3)
-- ============================================================================

drop view if exists public.invoice_with_discount_detail;
create view public.invoice_with_discount_detail
with (security_invoker = true) as
select
  i.*,
  t.name as tier_name,
  -- Sum of line totals (after line discounts, before tier discount):
  -- total = items_subtotal_after_line_discounts - tier_discount + service.
  -- Reversing: items_subtotal_after_line = total + tier_discount - service.
  (i.total + i.tier_discount_amount - i.service_charge)
    as items_subtotal_post_line_discounts,
  case
    when i.tier_override_type = 'percent' then 'manual_override_percent'
    when i.tier_override_type = 'fixed'   then 'manual_override_fixed'
    when i.tier_id is not null            then 'customer_tier'
    else                                       'no_discount'
  end as discount_source
from public.invoices i
left join public.customer_tiers t on t.id = i.tier_id;
