-- v2.8.4 — Expired sale policy enforcement.
--   §A. expired_sale_policy enum ('block', 'warn', 'allow').
--   §B. shops gain default_expired_sale_policy (NOT NULL DEFAULT 'warn')
--       + expired_sale_receipt_disclaimer (NOT NULL DEFAULT false).
--   §C. products gain expired_sale_policy (NULL = use shop default).
--   §D. sale_items gain sold_expired (NOT NULL DEFAULT false) +
--       partial index for the audit / widget queries.
--   §E. No trigger change — the blanket sale_items_no_modify trigger
--       (0020 §B) already rejects UPDATE/DELETE, so sold_expired is
--       automatically immutable once written by record_sale.
--
-- Backend RPC rewrites (record_sale signature change, new
-- preflight_expired_sale_check) ship in migration 0065.

-- §A. enum type
do $$ begin
  create type public.expired_sale_policy as enum ('block', 'warn', 'allow');
exception when duplicate_object then null;
end $$;

-- §B. shops — default policy + receipt disclaimer
alter table public.shops
  add column if not exists default_expired_sale_policy public.expired_sale_policy
    not null default 'warn',
  add column if not exists expired_sale_receipt_disclaimer boolean
    not null default false;

-- §C. products — per-product override (null = use shop default)
alter table public.products
  add column if not exists expired_sale_policy public.expired_sale_policy;

-- §D. sale_items — historical flag + partial index
alter table public.sale_items
  add column if not exists sold_expired boolean not null default false;

create index if not exists idx_sale_items_sold_expired
  on public.sale_items (sold_expired) where sold_expired;
