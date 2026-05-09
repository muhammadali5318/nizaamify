-- v1.8 — Database hardening
-- See MVP_FIXES_v1.8.md for full context. Sub-sections:
--   A. Cross-tenant view leak (S0)
--   B. Append-only triggers on financial tables (S0)
--   C. Revoke anon / public EXECUTE on RPCs and trigger functions (S0/S1)
--   D. Foreign-key indexes (S1)
--   E. RLS auth.uid() per-row → cached (S1)
--   F. search_path on non-SECURITY-DEFINER helpers (S1)
--   G. Missing CHECK constraints (S1)
--   H. Move pg_trgm out of public (S2)
--   I. reverse_ledger_entry FOR UPDATE on original entry (S2)
--   J. Cast computed numeric sums in views (S2)
--   K. customers.phone non-empty CHECK (S3)
-- Auth-side toggles (leaked-password protection + email confirmation, S1) are
-- project-level settings and must be enabled in the Supabase dashboard.

begin;

-- ============================================================================
-- A. CROSS-TENANT VIEW LEAK — fix SECURITY DEFINER views (S0)
-- ============================================================================
-- customer_balance_reconciliation and ledger_entries_view were created without
-- security_invoker=true. They executed as the view owner (postgres) and
-- bypassed RLS entirely — every authenticated user could read every shop's
-- customer balances and entire ledger. Recreate with security_invoker=true and
-- (for customer_balance_reconciliation) cast computed sums to numeric(12,2).

drop view if exists public.customer_balance_reconciliation;
create view public.customer_balance_reconciliation
with (security_invoker = true) as
select c.id          as customer_id,
       c.shop_id,
       c.outstanding_balance as stored_balance,
       coalesce((
         select sum(case when le.type = 'debit' then le.amount else -le.amount end)
           from public.ledger_entries le
          where le.customer_id = c.id
       ), 0)::numeric(12,2) as computed_balance,
       (c.outstanding_balance - coalesce((
         select sum(case when le.type = 'debit' then le.amount else -le.amount end)
           from public.ledger_entries le
          where le.customer_id = c.id
       ), 0))::numeric(12,2) as drift
  from public.customers c;

drop view if exists public.ledger_entries_view;
create view public.ledger_entries_view
with (security_invoker = true) as
select le.id,
       le.shop_id,
       le.customer_id,
       le.invoice_id,
       le.amount,
       le.type,
       le.occurred_at,
       le.created_at,
       le.notes,
       le.reverses_entry_id,
       (select r.id          from public.ledger_entries r where r.reverses_entry_id = le.id) as reversed_by_entry_id,
       (select r.occurred_at from public.ledger_entries r where r.reverses_entry_id = le.id) as reversed_at,
       i.notes        as invoice_notes,
       i.total        as invoice_total,
       i.amount_paid  as invoice_amount_paid,
       i.payment_type as invoice_payment_type,
       (
         select case
           when count(*) = 0 then null::text
           when count(*) <= 2 then string_agg(p.name, ', ' order by si.id)
           else (
             (select string_agg(p2.name, ', ')
                from (
                  select p3.name
                    from public.sale_items si3
                    join public.products p3 on p3.id = si3.product_id
                   where si3.invoice_id = le.invoice_id
                   order by si3.id
                   limit 2
                ) p2)
             || ' + ' || ((count(*) - 2))::text || ' more'
           )
         end
           from public.sale_items si
           join public.products p on p.id = si.product_id
          where si.invoice_id = le.invoice_id
       ) as products_summary,
       (select count(*) from public.sale_items si where si.invoice_id = le.invoice_id) as items_count
  from public.ledger_entries le
  left join public.invoices i on i.id = le.invoice_id;

-- ============================================================================
-- B. APPEND-ONLY ENFORCEMENT ON FINANCIAL TABLES (S0)
-- ============================================================================
-- Mirrors ledger_entries_immutable. Block UPDATE and DELETE on every row of
-- invoices, sale_items, purchases, purchase_items. Corrections must take the
-- form of a fresh sale, purchase, or ledger reversal.

create or replace function public.financial_records_immutable()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception '% are append-only — record a corrective entry instead', TG_TABLE_NAME
      using errcode = 'P0001';
  elsif TG_OP = 'DELETE' then
    raise exception '% are append-only — record a corrective entry instead', TG_TABLE_NAME
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

drop trigger if exists invoices_no_modify on public.invoices;
create trigger invoices_no_modify
  before update or delete on public.invoices
  for each row execute function public.financial_records_immutable();

drop trigger if exists sale_items_no_modify on public.sale_items;
create trigger sale_items_no_modify
  before update or delete on public.sale_items
  for each row execute function public.financial_records_immutable();

drop trigger if exists purchases_no_modify on public.purchases;
create trigger purchases_no_modify
  before update or delete on public.purchases
  for each row execute function public.financial_records_immutable();

drop trigger if exists purchase_items_no_modify on public.purchase_items;
create trigger purchase_items_no_modify
  before update or delete on public.purchase_items
  for each row execute function public.financial_records_immutable();

-- ============================================================================
-- C. REVOKE ANON / PUBLIC EXECUTE ON RPCS AND TRIGGER FUNCTIONS (S0/S1)
-- ============================================================================
-- All write RPCs already check auth.uid() internally and reject anon, but the
-- API surface should not be reachable unauthenticated. Trigger functions
-- should never be reachable as RPCs. Revoking EXECUTE from a trigger function
-- does not affect trigger firing (Postgres bypasses function-level EXECUTE
-- checks for triggers).

revoke execute on function public.record_sale(uuid, numeric, numeric, text, jsonb)         from anon;
revoke execute on function public.record_purchase(text, text, date, jsonb, boolean)        from anon;
revoke execute on function public.receive_payment(uuid, numeric, text)                     from anon;
revoke execute on function public.reverse_ledger_entry(uuid, text)                         from anon;
revoke execute on function public.create_product_with_opening_stock(text, text, text, numeric, integer, numeric) from anon;

revoke execute on function public.list_customers(text, integer, integer)                   from anon;
revoke execute on function public.recent_customers(integer)                                from anon;
revoke execute on function public.search_khata_customers(text, text, integer, integer)     from anon;
revoke execute on function public.search_khata_customers_count(text, text)                 from anon;
revoke execute on function public.search_products(text, integer, integer, boolean)         from anon;
revoke execute on function public.search_products_count(text, boolean)                     from anon;

-- Trigger / internal functions — not RPCs. Strip from PUBLIC, anon, authenticated.
revoke execute on function public.ledger_entries_update_balance() from public, anon, authenticated;
revoke execute on function public.ledger_entries_immutable()      from public, anon, authenticated;
revoke execute on function public.financial_records_immutable()   from public, anon, authenticated;
revoke execute on function public.touch_updated_at()              from public, anon, authenticated;
revoke execute on function public.products_normalize_trigger()    from public, anon, authenticated;

-- ============================================================================
-- D. FOREIGN KEY INDEXES (S1)
-- ============================================================================
create index if not exists idx_expenses_created_by         on public.expenses(created_by);
create index if not exists idx_invoices_cashier_id         on public.invoices(cashier_id);
create index if not exists idx_purchase_items_product_id   on public.purchase_items(product_id);
create index if not exists idx_purchases_cashier_id        on public.purchases(cashier_id);
create index if not exists idx_sale_items_product_id       on public.sale_items(product_id);

-- ============================================================================
-- E. RLS auth.uid() PER-ROW → CACHED (S1)
-- ============================================================================
-- Wrap auth.uid() in (select auth.uid()) so the planner caches it per query.

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = (select auth.uid()));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using      (id = (select auth.uid()))
              with check (id = (select auth.uid()));

drop policy if exists subscriptions_self_read on public.subscriptions;
create policy subscriptions_self_read on public.subscriptions
  for select using (user_id = (select auth.uid()));

drop policy if exists shops_owner_read on public.shops;
create policy shops_owner_read on public.shops
  for select using (owner_user_id = (select auth.uid()));

drop policy if exists shops_owner_update on public.shops;
create policy shops_owner_update on public.shops
  for update using      (owner_user_id = (select auth.uid()))
              with check (owner_user_id = (select auth.uid()));

-- ============================================================================
-- F. SET search_path ON NON-SECURITY-DEFINER HELPERS (S1)
-- ============================================================================
-- Hardening hygiene against schema-hijack risk.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin new.updated_at := now(); return new; end;
$$;

create or replace function public.normalize_product_text(s text)
returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    when s is null then null
    else trim(regexp_replace(s, '\s+', ' ', 'g'))
  end;
$$;

create or replace function public.products_normalize_trigger()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.name := public.normalize_product_text(new.name);
  new.type := public.normalize_product_text(new.type);
  if new.description is not null then
    new.description := trim(new.description);
    if new.description = '' then new.description := null; end if;
  end if;
  return new;
end;
$$;

create or replace function public.ledger_entries_immutable()
returns trigger
language plpgsql
set search_path = public, pg_catalog
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

revoke execute on function public.touch_updated_at()              from public, anon, authenticated;
revoke execute on function public.normalize_product_text(text)    from public, anon, authenticated;
revoke execute on function public.products_normalize_trigger()    from public, anon, authenticated;
revoke execute on function public.ledger_entries_immutable()      from public, anon, authenticated;

-- ============================================================================
-- G. MISSING CHECK CONSTRAINTS (S1)
-- ============================================================================
-- All seven additions verified: zero violating rows in current data.
-- Idempotent via DO blocks (ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS).

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'customers_outstanding_non_negative') then
    alter table public.customers
      add constraint customers_outstanding_non_negative check (outstanding_balance >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sale_items_price_non_negative') then
    alter table public.sale_items
      add constraint sale_items_price_non_negative check (price_at_sale >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sale_items_cost_non_negative') then
    alter table public.sale_items
      add constraint sale_items_cost_non_negative check (cost_at_sale >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'purchase_items_cost_non_negative') then
    alter table public.purchase_items
      add constraint purchase_items_cost_non_negative check (cost_at_purchase >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subscriptions_payment_amount_non_negative') then
    alter table public.subscriptions
      add constraint subscriptions_payment_amount_non_negative
      check (last_payment_amount is null or last_payment_amount >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subscriptions_trial_window_valid') then
    alter table public.subscriptions
      add constraint subscriptions_trial_window_valid
      check (trial_started_at is null or trial_ends_at is null or trial_ends_at > trial_started_at);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'monthly_targets_sale_non_negative') then
    alter table public.monthly_targets
      add constraint monthly_targets_sale_non_negative check (target_sale >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'monthly_targets_gross_non_negative') then
    alter table public.monthly_targets
      add constraint monthly_targets_gross_non_negative check (target_gross_profit >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'monthly_targets_net_non_negative') then
    alter table public.monthly_targets
      add constraint monthly_targets_net_non_negative check (target_net_profit >= 0);
  end if;

  -- K. customers.phone non-empty (S3)
  if not exists (select 1 from pg_constraint where conname = 'customers_phone_not_blank') then
    alter table public.customers
      add constraint customers_phone_not_blank check (length(trim(phone)) > 0);
  end if;
end $$;

-- ============================================================================
-- H. MOVE pg_trgm OUT OF public (S2)
-- ============================================================================
-- Operator class moves with the extension; existing trigram indexes auto-rebind
-- to the new schema. Functions that use the % operator, similarity(), and
-- set_limit() need `extensions` in their search_path.

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

do $$ begin
  if exists (select 1 from pg_extension e
              join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'pg_trgm' and n.nspname = 'public') then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end $$;

alter function public.search_products(text, integer, integer, boolean)
  set search_path = public, extensions, pg_catalog;
alter function public.search_products_count(text, boolean)
  set search_path = public, extensions, pg_catalog;
alter function public.search_khata_customers(text, text, integer, integer)
  set search_path = public, extensions, pg_catalog;
alter function public.search_khata_customers_count(text, text)
  set search_path = public, extensions, pg_catalog;

-- ============================================================================
-- I. reverse_ledger_entry FOR UPDATE on original entry (S2)
-- ============================================================================
-- Race today is caught by uq_ledger_entries_reverses (one of two parallel
-- reversals fails on the unique constraint). FOR UPDATE makes the error path
-- predictable as 'entry_already_reversed' instead of a unique violation.

create or replace function public.reverse_ledger_entry(p_entry_id uuid, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_orig record;
  v_new_id uuid;
  v_new_type text;
  v_new_invoice_id uuid;
  v_already_reversed uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select * into v_orig
    from public.ledger_entries
   where id = p_entry_id and shop_id = v_shop_id
   for update;
  if not found then
    raise exception 'entry_not_in_shop' using errcode = 'P0001';
  end if;

  if v_orig.reverses_entry_id is not null then
    raise exception 'cannot_reverse_a_reversal' using errcode = 'P0001';
  end if;

  select id into v_already_reversed
    from public.ledger_entries
   where reverses_entry_id = p_entry_id;
  if v_already_reversed is not null then
    raise exception 'entry_already_reversed' using errcode = 'P0001';
  end if;

  v_new_type := case when v_orig.type = 'debit' then 'credit' else 'debit' end;
  v_new_invoice_id := case
    when v_new_type = 'credit' then null
    else v_orig.invoice_id
  end;

  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type,
    occurred_at, paid_at, notes, reverses_entry_id
  ) values (
    v_orig.shop_id,
    v_orig.customer_id,
    v_new_invoice_id,
    v_orig.amount,
    v_new_type,
    now(),
    case when v_new_type = 'credit' then now() else null end,
    coalesce(
      nullif(trim(p_notes), ''),
      'Reversal of entry ' || substr(p_entry_id::text, 1, 8)
    ),
    p_entry_id
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ============================================================================
-- J. CAST COMPUTED NUMERIC SUMS IN VIEWS (S2)
-- ============================================================================
-- Bare numeric outputs in info_schema cause looser TypeScript types than
-- needed. Cast every computed money column to numeric(12,2).
-- (customer_balance_reconciliation already cast in §A.)

drop view if exists public.customer_outstanding;
create view public.customer_outstanding
with (security_invoker = true) as
select c.shop_id,
       c.id    as customer_id,
       c.name,
       c.phone,
       (coalesce(sum(case when le.type = 'debit'  then le.amount else 0::numeric end), 0)
      - coalesce(sum(case when le.type = 'credit' then le.amount else 0::numeric end), 0))::numeric(12,2) as outstanding,
       max(le.created_at) as last_activity_at
  from public.customers c
  left join public.ledger_entries le on le.customer_id = c.id
 group by c.shop_id, c.id, c.name, c.phone;

drop view if exists public.daily_sales_today;
create view public.daily_sales_today
with (security_invoker = true) as
select shop_id,
       count(*) as sales_count,
       coalesce(sum(total), 0)::numeric(12,2) as total_sales,
       coalesce(sum(case when payment_type = 'cash'   then total else 0::numeric end), 0)::numeric(12,2) as cash_sales,
       coalesce(sum(case when payment_type = 'credit' then total else 0::numeric end), 0)::numeric(12,2) as credit_sales
  from public.invoices i
 where (date_trunc('day', (created_at at time zone 'utc'))::date) = current_date
 group by shop_id;

drop view if exists public.monthly_summary;
create view public.monthly_summary
with (security_invoker = true) as
with months as (
  select distinct invoices.shop_id,
         (date_trunc('month', (invoices.created_at at time zone 'utc'))::date) as month
    from public.invoices
  union
  select distinct expenses.shop_id,
         (date_trunc('month', (expenses.expense_date)::timestamp with time zone)::date) as month
    from public.expenses
)
select shop_id,
       month,
       coalesce((select sum(i.total) from public.invoices i
                  where i.shop_id = m.shop_id
                    and (date_trunc('month', (i.created_at at time zone 'utc'))::date) = m.month), 0)::numeric(12,2) as total_sales,
       coalesce((select sum((si.price_at_sale - si.cost_at_sale) * si.qty::numeric)
                   from public.sale_items si
                   join public.invoices i on i.id = si.invoice_id
                  where i.shop_id = m.shop_id
                    and (date_trunc('month', (i.created_at at time zone 'utc'))::date) = m.month), 0)::numeric(12,2) as gross_profit,
       coalesce((select sum(e.amount) from public.expenses e
                  where e.shop_id = m.shop_id
                    and (date_trunc('month', (e.expense_date)::timestamp with time zone)::date) = m.month), 0)::numeric(12,2) as total_expenses
  from months m;

commit;
