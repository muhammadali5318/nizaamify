-- v1.8c — block reversing sale-tied debit ledger entries directly.
--
-- Background: a credit sale produces invoice + sale_items + a debit ledger
-- entry. Reversing that debit alone forgives the customer's debt but leaves
-- the invoice and the stock decrement intact. That's a half-void: legitimate
-- only as a bad-debt write-off, never as "the sale didn't happen". A proper
-- void_sale flow (reverse debit + restock + flag invoice) is a v1.9 ticket.
--
-- For now: block the half-reversal at the DB. reverse_ledger_entry stays
-- usable for non-sale ledger entries (manual adjustments, opening balances,
-- payment-receipt corrections — all of which have invoice_id IS NULL).

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

  -- v1.8c: block sale-tied debit reversals. They forgive debt but leave the
  -- invoice and stock decrement orphaned. Use void_sale (future) for full
  -- reversal of a sale; use receive_payment to record customer payments.
  if v_orig.invoice_id is not null then
    raise exception 'cannot_reverse_invoice_tied_debit'
      using errcode = 'P0001',
            hint = 'Sale-tied debits cannot be reversed directly. Use receive_payment if the customer paid; void_sale (v1.9) for full sale reversal.';
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
