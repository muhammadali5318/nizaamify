-- v1.6 ledger hardening: notes, occurred_at, reverses_entry_id, append-only,
-- stored outstanding_balance + balance trigger, amount>0 constraint, narrowed RLS,
-- reconciliation view.

-- 1. New columns on ledger_entries -----------------------------------------
alter table public.ledger_entries
  add column if not exists notes text,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists reverses_entry_id uuid null
    references public.ledger_entries(id);

-- Backfill occurred_at for existing rows.
update public.ledger_entries
   set occurred_at = created_at
 where occurred_at = created_at;

-- 2. Constraints (encode direction in type, never in sign) -----------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ledger_entries'::regclass
      and conname = 'ledger_entries_amount_positive'
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_amount_positive check (amount > 0);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ledger_entries'::regclass
      and conname = 'ledger_entries_no_self_reversal'
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_no_self_reversal
      check (reverses_entry_id is null or reverses_entry_id <> id);
  end if;
end$$;

create unique index if not exists uq_ledger_entries_reverses
  on public.ledger_entries (reverses_entry_id)
  where reverses_entry_id is not null;

-- 3. customers.outstanding_balance + backfill ------------------------------
alter table public.customers
  add column if not exists outstanding_balance numeric(12,2) not null default 0;

update public.customers c
   set outstanding_balance = coalesce(
     (select sum(case when type = 'debit' then amount else -amount end)
        from public.ledger_entries le
       where le.customer_id = c.id),
     0
   );

create index if not exists idx_customers_shop_outstanding
  on public.customers (shop_id, outstanding_balance);

-- 4. Balance-update trigger ------------------------------------------------
-- SECURITY DEFINER so the customers update goes through regardless of how
-- RLS evolves on customers; the trigger only fires for legitimate ledger inserts
-- that themselves passed RLS, so this is safe.
create or replace function public.ledger_entries_update_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric(12,2);
begin
  if TG_OP = 'INSERT' then
    v_delta := case when new.type = 'debit' then new.amount else -new.amount end;
    update public.customers
       set outstanding_balance = outstanding_balance + v_delta,
           updated_at = now()
     where id = new.customer_id;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists ledger_entries_balance on public.ledger_entries;
create trigger ledger_entries_balance
  after insert on public.ledger_entries
  for each row execute function public.ledger_entries_update_balance();

-- 5. Append-only enforcement ----------------------------------------------
create or replace function public.ledger_entries_immutable()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception 'ledger_entries are append-only — reverse the entry instead of updating it'
      using errcode = 'P0001';
  elsif TG_OP = 'DELETE' then
    raise exception 'ledger_entries are append-only — reverse the entry instead of deleting it'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

drop trigger if exists ledger_entries_no_modify on public.ledger_entries;
create trigger ledger_entries_no_modify
  before update or delete on public.ledger_entries
  for each row execute function public.ledger_entries_immutable();

-- 6. Narrow ledger_entries RLS to SELECT + INSERT --------------------------
drop policy if exists ledger_shop_all on public.ledger_entries;

create policy ledger_select_shop
  on public.ledger_entries
  for select
  using (shop_id = public.current_shop_id());

create policy ledger_insert_shop
  on public.ledger_entries
  for insert
  with check (shop_id = public.current_shop_id());

-- 7. Indexes for new query patterns ----------------------------------------
create index if not exists idx_ledger_entries_customer_occurred
  on public.ledger_entries (customer_id, occurred_at desc);

create index if not exists idx_ledger_entries_invoice_type
  on public.ledger_entries (invoice_id, type)
  where invoice_id is not null;

-- 8. Reconciliation view (audit safety net) --------------------------------
create or replace view public.customer_balance_reconciliation as
select
  c.id as customer_id,
  c.shop_id,
  c.outstanding_balance as stored_balance,
  coalesce(
    (select sum(case when type = 'debit' then amount else -amount end)
       from public.ledger_entries le where le.customer_id = c.id),
    0
  ) as computed_balance,
  c.outstanding_balance - coalesce(
    (select sum(case when type = 'debit' then amount else -amount end)
       from public.ledger_entries le where le.customer_id = c.id),
    0
  ) as drift
from public.customers c;
