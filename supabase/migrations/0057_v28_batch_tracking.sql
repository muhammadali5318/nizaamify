-- v2.8 — Batch tracking, FEFO, supplier warranty + expiry alerts.
--
-- Per-product opt-in via `products.has_batches`. When true:
--   - stock-in captures batch_no + manufactured/expiry/warranty per batch
--   - sales draw FEFO from active batches (overridable per cart line)
--   - sale_items.cost_at_sale is the BATCH's cost_per_unit (not variant.avg_cost)
--     so invoice_financials profit reads correctly
--   - dashboards surface expiring-soon + warranty-expiring batches
--
-- Most products stay non-batched (the default) and behave exactly as v2.6/v2.7.
-- This migration is additive — every column is nullable or carries a default,
-- and no existing row needs backfill.
--
-- Schema phases (audit checkpoints inline):
--   §A  products opt-in flag + per-product alert window overrides
--   §B  shops shop-level alert defaults
--   §C  inventory_batches table + RLS + indexes + immutable trigger
--   §D  sale_items.batch_id + index
--   §E  purchase_items.batch_id + index
--
-- Backend functions and views ship in migration 0058.

-- =====================================================================
-- §A. products opt-in flag + per-product alert overrides
-- =====================================================================

alter table public.products
  add column if not exists has_batches boolean not null default false,
  add column if not exists expiry_alert_days int
    check (expiry_alert_days is null or expiry_alert_days > 0),
  add column if not exists warranty_alert_days int
    check (warranty_alert_days is null or warranty_alert_days > 0);

comment on column public.products.has_batches is
  'v2.8: per-product opt-in for batch tracking. When true, stock-in captures '
  'batch info and sales decrement FEFO from inventory_batches.';
comment on column public.products.expiry_alert_days is
  'v2.8: per-product override of shop.default_expiry_alert_days. null = use shop default.';
comment on column public.products.warranty_alert_days is
  'v2.8: per-product override of shop.default_warranty_alert_days. null = use shop default.';

-- =====================================================================
-- §B. shops shop-level alert defaults
-- =====================================================================

alter table public.shops
  add column if not exists default_expiry_alert_days int not null default 30
    check (default_expiry_alert_days > 0),
  add column if not exists default_warranty_alert_days int not null default 30
    check (default_warranty_alert_days > 0);

-- =====================================================================
-- §C. inventory_batches table
-- =====================================================================

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  batch_no text not null,
  purchase_item_id uuid references public.purchase_items(id) on delete set null,
  supplier_id uuid references public.suppliers(id),
  qty_received int not null check (qty_received > 0),
  qty_remaining int not null check (qty_remaining >= 0),
  cost_per_unit numeric(12,2) not null check (cost_per_unit >= 0),
  manufactured_date date,
  expiry_date date,
  supplier_warranty_days int
    check (supplier_warranty_days is null or supplier_warranty_days >= 0),
  warranty_expires_at date,
  received_at date not null default current_date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch_no_not_blank check (length(trim(batch_no)) > 0),
  constraint batch_qty_remaining_lte_received check (qty_remaining <= qty_received)
);

comment on table public.inventory_batches is
  'v2.8: per-variant batches. Stock-in creates a batch; sales decrement '
  'qty_remaining FEFO. Mostly append-only — only qty_remaining, is_active, '
  'and notes are mutable post-insert (enforced by batch_immutable_fields trigger).';

-- Hot path: FEFO query
create index if not exists idx_batch_fefo
  on public.inventory_batches (variant_id, expiry_date nulls last, received_at)
  where is_active and qty_remaining > 0;

-- Alert query: batches expiring soon
create index if not exists idx_batch_expiry_active
  on public.inventory_batches (expiry_date)
  where is_active and qty_remaining > 0 and expiry_date is not null;

-- Alert query: warranty expiring soon
create index if not exists idx_batch_warranty_active
  on public.inventory_batches (warranty_expires_at)
  where is_active and qty_remaining > 0 and warranty_expires_at is not null;

create index if not exists idx_batch_variant on public.inventory_batches (variant_id);

-- Uniqueness: same batch_no twice for the same variant (active) is a data-entry error.
-- Allow reuse after the prior batch is deactivated.
create unique index if not exists uq_batch_variant_batchno
  on public.inventory_batches (variant_id, lower(trim(batch_no))) where is_active;

-- RLS scoped through variant → product → shop
alter table public.inventory_batches enable row level security;

drop policy if exists "batches_shop_read" on public.inventory_batches;
create policy "batches_shop_read" on public.inventory_batches
  for select using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory_batches.variant_id
        and p.shop_id = (select public.current_shop_id())
    )
  );

drop policy if exists "batches_shop_write" on public.inventory_batches;
create policy "batches_shop_write" on public.inventory_batches
  for all using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory_batches.variant_id
        and p.shop_id = (select public.current_shop_id())
    )
  ) with check (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory_batches.variant_id
        and p.shop_id = (select public.current_shop_id())
    )
  );

-- touch_updated_at trigger so notes/qty_remaining updates bump updated_at
drop trigger if exists inventory_batches_touch on public.inventory_batches;
create trigger inventory_batches_touch
  before update on public.inventory_batches
  for each row execute function public.touch_updated_at();

-- Immutability trigger: variant_id, batch_no, qty_received, cost, all dates,
-- warranty_days, warranty_expires_at, received_at are frozen at insert time.
-- Only qty_remaining, is_active, notes, updated_at may change.
create or replace function public.batch_immutable_fields() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if old.id is distinct from new.id then raise exception 'batch_id_immutable'; end if;
  if old.variant_id is distinct from new.variant_id then raise exception 'batch_variant_immutable'; end if;
  if lower(trim(old.batch_no)) is distinct from lower(trim(new.batch_no))
    then raise exception 'batch_no_immutable'; end if;
  if old.qty_received is distinct from new.qty_received then raise exception 'batch_qty_received_immutable'; end if;
  if old.cost_per_unit is distinct from new.cost_per_unit then raise exception 'batch_cost_immutable'; end if;
  if old.manufactured_date is distinct from new.manufactured_date then raise exception 'batch_mfg_date_immutable'; end if;
  if old.expiry_date is distinct from new.expiry_date then raise exception 'batch_expiry_immutable'; end if;
  if old.supplier_warranty_days is distinct from new.supplier_warranty_days then raise exception 'batch_warranty_days_immutable'; end if;
  if old.warranty_expires_at is distinct from new.warranty_expires_at then raise exception 'batch_warranty_date_immutable'; end if;
  if old.received_at is distinct from new.received_at then raise exception 'batch_received_at_immutable'; end if;
  if old.purchase_item_id is distinct from new.purchase_item_id then raise exception 'batch_purchase_item_immutable'; end if;
  if old.supplier_id is distinct from new.supplier_id then raise exception 'batch_supplier_immutable'; end if;
  return new;
end;
$$;

revoke all on function public.batch_immutable_fields() from public, anon;
-- Trigger function: not directly invoked by clients, only by Postgres trigger machinery.

drop trigger if exists inventory_batches_immutable on public.inventory_batches;
create trigger inventory_batches_immutable
  before update on public.inventory_batches
  for each row execute function public.batch_immutable_fields();

-- =====================================================================
-- §D. sale_items.batch_id
-- =====================================================================

alter table public.sale_items
  add column if not exists batch_id uuid
    references public.inventory_batches(id) on delete restrict;

comment on column public.sale_items.batch_id is
  'v2.8: which batch this line drew from. NULL for non-batched products. '
  'NOT enforced NOT NULL at DB level — pre-v2.8 rows are legacy NULL; '
  'record_sale enforces NOT NULL when variant.product.has_batches.';

create index if not exists idx_sale_items_batch
  on public.sale_items (batch_id) where batch_id is not null;

-- =====================================================================
-- §E. purchase_items.batch_id
-- =====================================================================

alter table public.purchase_items
  add column if not exists batch_id uuid
    references public.inventory_batches(id) on delete set null;

comment on column public.purchase_items.batch_id is
  'v2.8: which batch this stock-in line created. NULL for non-batched products. '
  'Bidirectional FK with inventory_batches.purchase_item_id (the batch points '
  'back to its source purchase_item) — both are denormalized for fast joins.';

create index if not exists idx_purchase_items_batch
  on public.purchase_items (batch_id) where batch_id is not null;
