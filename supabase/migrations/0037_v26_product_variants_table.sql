-- v2.6 §B1 — Create product_variants table.
--
-- This is the first slice of the v2.6 silent variant refactor (ADR forthcoming).
-- We create the table only; backfill of one default variant per product happens
-- in 0038, repointing of transaction tables in 0039, sync trigger + views in 0040.
-- Splitting the migration keeps every audit gate cheap to re-run.
--
-- SKU uniqueness within a shop is deferred to v2.7 when the UI starts generating
-- SKUs. Spec §2.1 sketched a partial unique index with a SELECT subquery in the
-- key expression — Postgres rejects that; v2.7 will reintroduce uniqueness via
-- either a denormalized shop_id column or a row trigger when there is something
-- to enforce.

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,                                                    -- v2.7 will auto-suggest
  stock integer not null default 0 check (stock >= 0),
  price numeric(12,2) check (price is null or price >= 0),     -- null = not sellable
  cost numeric(12,2) check (cost is null or cost >= 0),
  avg_cost numeric(12,2) not null default 0 check (avg_cost >= 0),
  last_purchase_cost numeric(12,2),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one default variant per product (single-variant rule from §2.10).
-- v2.7 adjusts the constraint when has_variants flips on; for now every product
-- has exactly one variant with is_default = true.
create unique index if not exists uq_variant_default_per_product
  on public.product_variants (product_id) where is_default and is_active;

create index if not exists idx_variant_product
  on public.product_variants (product_id) where is_active;

create index if not exists idx_variant_stock
  on public.product_variants (product_id, stock) where is_active;

alter table public.product_variants enable row level security;

drop policy if exists "variants_shop_read" on public.product_variants;
create policy "variants_shop_read" on public.product_variants
  for select using (
    exists (
      select 1 from public.products p
       where p.id = product_id
         and p.shop_id = (select public.current_shop_id())
    )
  );

drop policy if exists "variants_shop_write" on public.product_variants;
create policy "variants_shop_write" on public.product_variants
  for all using (
    exists (
      select 1 from public.products p
       where p.id = product_id
         and p.shop_id = (select public.current_shop_id())
    )
  ) with check (
    exists (
      select 1 from public.products p
       where p.id = product_id
         and p.shop_id = (select public.current_shop_id())
    )
  );

drop trigger if exists product_variants_touch on public.product_variants;
create trigger product_variants_touch
  before update on public.product_variants
  for each row execute function public.touch_updated_at();
