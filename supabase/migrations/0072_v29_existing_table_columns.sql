
-- v2.9 Phase A migration 0072: new columns on existing tables + FK hardening
-- All new columns are NULL-able or have safe defaults; no data loss.

-- shops: salesperson cap (renamed to non_owner_cap in spirit, kept original name per Phase D F-PD-05 deferral)
alter table public.shops
  add column if not exists salesperson_payment_cap_pkr numeric(12,2) not null default 10000
    check (salesperson_payment_cap_pkr >= 0);

-- shops.owner_user_id FK: CASCADE → RESTRICT (per audit F-M-23)
alter table public.shops drop constraint shops_owner_user_id_fkey;
alter table public.shops add constraint shops_owner_user_id_fkey
  foreign key (owner_user_id) references public.profiles(id) on delete restrict;

comment on column public.shops.owner_user_id is
  'Founding owner snapshot. NOT the authoritative source of "who is the owner today" — '
  'that comes from user_shop_access WHERE is_owner=true. Kept as a denormalized pointer.';

-- ledger_entries: who recorded
alter table public.ledger_entries
  add column if not exists created_by_user_id uuid references public.profiles(id);

-- customers: soft-delete + creator
alter table public.customers
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by_user_id uuid references public.profiles(id);

-- monthly_targets: updater
alter table public.monthly_targets
  add column if not exists updated_by_user_id uuid references public.profiles(id);

-- inventory_batches: last modifier (works around immutability trigger which allows notes + is_active + qty_remaining + last_modified_by_user_id)
alter table public.inventory_batches
  add column if not exists last_modified_by_user_id uuid references public.profiles(id);

-- Generic created_by / updated_by on writable catalog tables
alter table public.products
  add column if not exists created_by_user_id uuid references public.profiles(id),
  add column if not exists updated_by_user_id uuid references public.profiles(id);

alter table public.product_variants
  add column if not exists created_by_user_id uuid references public.profiles(id),
  add column if not exists updated_by_user_id uuid references public.profiles(id);

alter table public.product_categories
  add column if not exists created_by_user_id uuid references public.profiles(id),
  add column if not exists updated_by_user_id uuid references public.profiles(id);

alter table public.suppliers
  add column if not exists created_by_user_id uuid references public.profiles(id),
  add column if not exists updated_by_user_id uuid references public.profiles(id);

alter table public.product_packs
  add column if not exists created_by_user_id uuid references public.profiles(id),
  add column if not exists updated_by_user_id uuid references public.profiles(id);

alter table public.variant_attributes
  add column if not exists created_by_user_id uuid references public.profiles(id);

alter table public.variant_attribute_values
  add column if not exists created_by_user_id uuid references public.profiles(id);

alter table public.customer_tiers
  add column if not exists created_by_user_id uuid references public.profiles(id),
  add column if not exists updated_by_user_id uuid references public.profiles(id);
