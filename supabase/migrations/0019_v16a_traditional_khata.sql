-- v1.6a: Traditional khata — drop optional invoice→payment linking.
--
-- Rationale: invoice-linked credits + general credits create two divergent
-- sources of truth (invoice-level "remaining" vs customer-level balance).
-- Pakistani/Indian khata is a single running balance per customer; no
-- per-sale payment history. Sales record what was paid AT THE TIME of the
-- sale; subsequent payments only adjust the customer balance.
--
-- New invariant: ledger_entries.invoice_id is meaningful ONLY on type='debit'
-- rows (the sale that created the debt). On credit rows it must be NULL.

-- 1. Backfill: null out invoice_id on all credit rows. The append-only trigger
-- normally blocks UPDATEs; we disable it for this one statement (migration only).
alter table public.ledger_entries disable trigger ledger_entries_no_modify;

update public.ledger_entries
   set invoice_id = null
 where type = 'credit'
   and invoice_id is not null;

alter table public.ledger_entries enable trigger ledger_entries_no_modify;

-- 2. Enforce the invariant going forward.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ledger_entries'::regclass
      and conname = 'ledger_entries_credit_no_invoice'
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_credit_no_invoice
      check (type = 'debit' or invoice_id is null);
  end if;
end$$;

-- 3. Drop the invoice-link helper RPC (no longer needed).
drop function if exists public.customer_open_invoices(uuid);

-- 4. Rewrite receive_payment without p_invoice_id. Drop first because the
-- signature change is incompatible.
drop function if exists public.receive_payment(uuid, numeric, uuid, text);

create or replace function public.receive_payment(
  p_customer_id uuid,
  p_amount numeric(12,2),
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
  if not found then
    raise exception 'customer_not_in_shop' using errcode = 'P0001';
  end if;

  -- Customer-level overpayment guard. There is no invoice-level concept
  -- in the traditional khata model.
  if p_amount > v_outstanding then
    raise exception 'overpayment_customer max=%', v_outstanding using errcode = 'P0001';
  end if;

  insert into public.ledger_entries (
    shop_id, customer_id, invoice_id, amount, type, occurred_at, paid_at, notes
  ) values (
    v_shop_id, p_customer_id, null, p_amount, 'credit',
    now(), now(), nullif(trim(p_notes), '')
  ) returning id into v_entry_id;

  return v_entry_id;
end;
$$;

grant execute on function public.receive_payment(uuid, numeric, text) to authenticated;

-- 5. Update reverse_ledger_entry: credits never carry invoice_id, even when
-- a reversal is producing one from a debit.
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
  v_new_invoice_id uuid;
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

  -- Invariant: credits never carry invoice_id. Debits keep the original's
  -- invoice_id (which is null for credits anyway in this model).
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
