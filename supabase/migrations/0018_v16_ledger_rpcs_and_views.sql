-- v1.6 backend: rewrite receive_payment, add reverse_ledger_entry,
-- search_khata_customers (+ count), customer_open_invoices, ledger_entries_view.

-- 1. Drop old receive_payment (signature changes incompatibly) -------------
drop function if exists public.receive_payment(uuid, numeric, text);

-- 2. New receive_payment ---------------------------------------------------
create or replace function public.receive_payment(
  p_customer_id uuid,
  p_amount numeric(12,2),
  p_invoice_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_outstanding numeric(12,2);
  v_invoice_remaining numeric(12,2);
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_must_be_positive' using errcode = 'P0001';
  end if;

  -- Lock the customer row to serialize concurrent receive_payment calls.
  select outstanding_balance into v_outstanding
    from public.customers
   where id = p_customer_id and shop_id = v_shop_id
   for update;
  if not found then raise exception 'customer_not_in_shop' using errcode = 'P0001'; end if;

  -- Customer-level overpayment guard
  if p_amount > v_outstanding then
    raise exception 'overpayment_customer max=%', v_outstanding using errcode = 'P0001';
  end if;

  -- Optional invoice link → invoice-level overpayment guard
  if p_invoice_id is not null then
    -- Invoice must belong to this customer in this shop
    perform 1 from public.invoices i
      where i.id = p_invoice_id
        and i.shop_id = v_shop_id
        and i.customer_id = p_customer_id;
    if not found then
      raise exception 'invoice_not_for_customer' using errcode = 'P0001';
    end if;

    select i.total - i.amount_paid - coalesce(
      (select sum(le.amount) from public.ledger_entries le
        where le.invoice_id = i.id and le.type = 'credit'),
      0
    ) + coalesce(
      -- Add back any reversed credits so they don't artificially lower the remaining
      (select sum(le.amount) from public.ledger_entries le
        join public.ledger_entries r on r.reverses_entry_id = le.id
        where le.invoice_id = i.id and le.type = 'credit'),
      0
    )
    into v_invoice_remaining
    from public.invoices i
    where i.id = p_invoice_id;

    if v_invoice_remaining <= 0 then
      raise exception 'invoice_already_settled' using errcode = 'P0001';
    end if;

    if p_amount > v_invoice_remaining then
      raise exception 'overpayment_invoice max=%', v_invoice_remaining using errcode = 'P0001';
    end if;
  end if;

  -- Insert credit; balance trigger updates customer.outstanding_balance.
  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type, occurred_at, paid_at, notes
  ) values (
    v_shop_id, p_customer_id, p_invoice_id, p_amount, 'credit',
    now(), now(), nullif(trim(p_notes), '')
  ) returning id into v_entry_id;

  return v_entry_id;
end;
$$;

-- 3. reverse_ledger_entry --------------------------------------------------
create or replace function public.reverse_ledger_entry(
  p_entry_id uuid,
  p_notes text default null
) returns uuid
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
  v_already_reversed uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select * into v_orig
    from public.ledger_entries
   where id = p_entry_id and shop_id = v_shop_id;
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

  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type,
    occurred_at, paid_at, notes, reverses_entry_id
  ) values (
    v_orig.shop_id,
    v_orig.customer_id,
    v_orig.invoice_id,
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

-- 4. search_khata_customers + count ----------------------------------------
create or replace function public.search_khata_customers(
  p_query text default null,
  p_status text default 'open',
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id uuid,
  name text,
  phone text,
  address text,
  outstanding_balance numeric(12,2),
  last_activity_at timestamptz,
  entry_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_status not in ('open', 'closed', 'all') then
    raise exception 'invalid_status' using hint = 'Use open, closed, or all';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  return query
  with shop_customers as (
    select c.*,
           (select max(le.occurred_at) from public.ledger_entries le where le.customer_id = c.id) as last_activity_at,
           (select count(*) from public.ledger_entries le where le.customer_id = c.id) as entry_count
    from public.customers c
    where c.shop_id = v_shop_id
  ),
  filtered as (
    select * from shop_customers c
    where
      case
        when p_status = 'open'   then c.outstanding_balance > 0
        when p_status = 'closed' then c.outstanding_balance = 0 and c.entry_count > 0
        when p_status = 'all'    then c.entry_count > 0
        else false
      end
      and (
        v_query is null
        or c.name  ilike '%' || v_query || '%'
        or c.phone ilike '%' || v_query || '%'
        or c.name  % v_query
        or c.phone % v_query
      )
  )
  select
    f.id, f.name, f.phone, f.address,
    f.outstanding_balance, f.last_activity_at, f.entry_count
  from filtered f
  order by
    case when v_query is null then 0 else 1 end,
    case when v_query is not null
      then greatest(similarity(f.name, v_query), similarity(f.phone, v_query))
      else 0
    end desc,
    f.outstanding_balance desc,
    f.last_activity_at desc nulls last
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

create or replace function public.search_khata_customers_count(
  p_query text default null,
  p_status text default 'open'
) returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_query text;
  v_count bigint;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_status not in ('open', 'closed', 'all') then
    raise exception 'invalid_status' using hint = 'Use open, closed, or all';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  with shop_customers as (
    select c.outstanding_balance, c.name, c.phone,
           (select count(*) from public.ledger_entries le where le.customer_id = c.id) as entry_count
    from public.customers c
    where c.shop_id = v_shop_id
  )
  select count(*) into v_count
  from shop_customers c
  where
    case
      when p_status = 'open'   then c.outstanding_balance > 0
      when p_status = 'closed' then c.outstanding_balance = 0 and c.entry_count > 0
      when p_status = 'all'    then c.entry_count > 0
      else false
    end
    and (
      v_query is null
      or c.name  ilike '%' || v_query || '%'
      or c.phone ilike '%' || v_query || '%'
      or c.name  % v_query
      or c.phone % v_query
    );

  return coalesce(v_count, 0);
end;
$$;

-- 5. customer_open_invoices ------------------------------------------------
create or replace function public.customer_open_invoices(p_customer_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  total numeric(12,2),
  amount_paid numeric(12,2),
  credits_applied numeric(12,2),
  remaining numeric(12,2),
  payment_type text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  with credit_sums as (
    select
      le.invoice_id,
      sum(le.amount) filter (where le.type = 'credit' and le.reverses_entry_id is null
        and not exists (select 1 from public.ledger_entries r where r.reverses_entry_id = le.id)
      ) as net_credits
    from public.ledger_entries le
    where le.invoice_id is not null
    group by le.invoice_id
  )
  select
    i.id, i.created_at, i.total::numeric(12,2), i.amount_paid::numeric(12,2),
    coalesce(cs.net_credits, 0)::numeric(12,2) as credits_applied,
    (i.total - i.amount_paid - coalesce(cs.net_credits, 0))::numeric(12,2) as remaining,
    i.payment_type, i.notes
  from public.invoices i
  left join credit_sums cs on cs.invoice_id = i.id
  where i.shop_id = public.current_shop_id()
    and i.customer_id = p_customer_id
    and i.payment_type in ('credit', 'partial')
    and (i.total - i.amount_paid - coalesce(cs.net_credits, 0)) > 0
  order by i.created_at asc;
$$;

-- 6. ledger_entries_view ---------------------------------------------------
-- Display projection used by the khata UI so the frontend doesn't have to
-- join four tables. RLS is inherited from the underlying tables.
create or replace view public.ledger_entries_view as
select
  le.id,
  le.shop_id,
  le.customer_id,
  le.invoice_id,
  le.amount,
  le.type,
  le.occurred_at,
  le.created_at,
  le.notes,
  le.reverses_entry_id,
  (select r.id from public.ledger_entries r where r.reverses_entry_id = le.id) as reversed_by_entry_id,
  (select r.occurred_at from public.ledger_entries r where r.reverses_entry_id = le.id) as reversed_at,
  i.notes as invoice_notes,
  i.total as invoice_total,
  i.amount_paid as invoice_amount_paid,
  i.payment_type as invoice_payment_type,
  (
    select case
      when count(*) = 0 then null
      when count(*) <= 2 then string_agg(p.name, ', ' order by si.id)
      else (
        select string_agg(p2.name, ', ')
        from (
          select p3.name from public.sale_items si3
          join public.products p3 on p3.id = si3.product_id
          where si3.invoice_id = le.invoice_id
          order by si3.id
          limit 2
        ) p2
      ) || ' + ' || (count(*) - 2)::text || ' more'
    end
    from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.invoice_id = le.invoice_id
  ) as products_summary,
  (
    select count(*) from public.sale_items si where si.invoice_id = le.invoice_id
  ) as items_count
from public.ledger_entries le
left join public.invoices i on i.id = le.invoice_id;

-- 7. Grants -----------------------------------------------------------------
grant execute on function public.receive_payment(uuid, numeric, uuid, text) to authenticated;
grant execute on function public.reverse_ledger_entry(uuid, text) to authenticated;
grant execute on function public.search_khata_customers(text, text, int, int) to authenticated;
grant execute on function public.search_khata_customers_count(text, text) to authenticated;
grant execute on function public.customer_open_invoices(uuid) to authenticated;
grant select on public.ledger_entries_view to authenticated;
grant select on public.customer_balance_reconciliation to authenticated;
