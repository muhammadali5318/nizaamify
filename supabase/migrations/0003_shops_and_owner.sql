-- shops: 1:1 with profile in MVP; modeled 1:N for future
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  shop_name text not null,
  shop_address text not null,
  shop_phone text not null,
  shop_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

alter table public.shops enable row level security;

drop policy if exists "shops_owner_read" on public.shops;
create policy "shops_owner_read" on public.shops
  for select using (owner_user_id = auth.uid());

drop policy if exists "shops_owner_update" on public.shops;
create policy "shops_owner_update" on public.shops
  for update using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- shop_owner_details: 1:1 with shops
create table if not exists public.shop_owner_details (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  owner_name text not null,
  owner_phone text not null,
  owner_cnic text,
  owner_address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id)
);

alter table public.shop_owner_details enable row level security;
-- shop-scoped policies in 0007 (depend on current_shop_id() helper from 0005)
