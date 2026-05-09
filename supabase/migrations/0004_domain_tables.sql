-- products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  cost numeric(12,2) not null check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create index if not exists products_shop_active_idx on public.products (shop_id) where is_active;

-- customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);
alter table public.customers enable row level security;
create index if not exists customers_shop_idx on public.customers (shop_id);

-- invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id),
  total numeric(12,2) not null check (total >= 0),
  service_charge numeric(12,2) not null default 0 check (service_charge >= 0),
  payment_type text not null check (payment_type in ('cash','credit')),
  cashier_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
create index if not exists invoices_shop_created_idx on public.invoices (shop_id, created_at desc);

-- sale_items
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  price_at_sale numeric(12,2) not null,
  cost_at_sale numeric(12,2) not null
);
alter table public.sale_items enable row level security;
create index if not exists sale_items_invoice_idx on public.sale_items (invoice_id);

-- ledger_entries
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  invoice_id uuid references public.invoices(id),
  amount numeric(12,2) not null,
  type text not null check (type in ('debit','credit')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ledger_entries enable row level security;
create index if not exists ledger_shop_customer_idx on public.ledger_entries (shop_id, customer_id);

-- purchases
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  total_cost numeric(12,2) not null check (total_cost >= 0),
  source text,
  note text,
  purchase_date date not null default current_date,
  cashier_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
create index if not exists purchases_shop_date_idx on public.purchases (shop_id, purchase_date desc);

-- purchase_items
create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  cost_at_purchase numeric(12,2) not null
);
alter table public.purchase_items enable row level security;

-- expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
create index if not exists expenses_shop_date_idx on public.expenses (shop_id, expense_date desc);

-- monthly_targets
create table if not exists public.monthly_targets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  month date not null,
  target_sale numeric(12,2) not null default 0,
  target_gross_profit numeric(12,2) not null default 0,
  target_net_profit numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, month)
);
alter table public.monthly_targets enable row level security;
create index if not exists monthly_targets_shop_month_idx on public.monthly_targets (shop_id, month);
