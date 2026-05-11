-- v2.8.2 — partial write-off RPC + auto-deactivate trigger.
--
-- Two gaps in v2.8 closed:
--   1. record_partial_writeoff(batch_id, qty, reason) supports partial
--      RTV / damage / loss without rewriting the whole batch.
--   2. batch_auto_deactivate_when_empty fires once when qty_remaining
--      transitions from > 0 to 0, flipping is_active=false. Empty
--      batches stop cluttering the active list automatically.
--
-- Both behaviors compose: a partial write-off that brings qty to 0
-- triggers the auto-deactivate in the same UPDATE. The full
-- "deactivate_batch" RPC is kept for back-compat but the new UI flow
-- always uses record_partial_writeoff.

-- §A. record_partial_writeoff — partial RTV / damage / loss workflow
create or replace function public.record_partial_writeoff(
  p_batch_id uuid,
  p_qty integer,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_qty_remaining int;
  v_variant_id uuid;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty_must_be_positive'; end if;

  select b.qty_remaining, b.variant_id
    into v_qty_remaining, v_variant_id
    from public.inventory_batches b
    join public.product_variants v on v.id = b.variant_id
    join public.products p on p.id = v.product_id
   where b.id = p_batch_id and p.shop_id = v_shop_id and b.is_active
   for update;

  if not found then raise exception 'batch_not_in_shop_or_inactive'; end if;
  if p_qty > v_qty_remaining then raise exception 'qty_exceeds_remaining'; end if;

  -- Decrement variant.stock first. v2.10 will replace this with an
  -- inventory_adjustments ledger row; the RPC surface stays the same.
  update public.product_variants
     set stock = stock - p_qty, updated_at = now()
   where id = v_variant_id;

  -- Decrement batch qty_remaining + append a dated note. The
  -- batch_auto_deactivate_when_empty trigger flips is_active=false in
  -- the same UPDATE if this brings qty_remaining to 0.
  update public.inventory_batches
     set qty_remaining = qty_remaining - p_qty,
         notes = case
           when p_reason is null and notes is null then
             to_char(current_date, 'YYYY-MM-DD') ||
             ' — Wrote off ' || p_qty || ' unit(s)'
           when p_reason is null then
             notes || E'\n' || to_char(current_date, 'YYYY-MM-DD') ||
             ' — Wrote off ' || p_qty || ' unit(s)'
           when notes is null then
             to_char(current_date, 'YYYY-MM-DD') ||
             ' — Wrote off ' || p_qty || ' unit(s): ' || p_reason
           else
             notes || E'\n' || to_char(current_date, 'YYYY-MM-DD') ||
             ' — Wrote off ' || p_qty || ' unit(s): ' || p_reason
         end
   where id = p_batch_id;
end;
$$;

revoke all on function public.record_partial_writeoff(uuid, integer, text) from public, anon;
grant execute on function public.record_partial_writeoff(uuid, integer, text) to authenticated;

-- §B. Auto-deactivate trigger.
-- Postgres fires BEFORE row-level triggers in name order:
--   1. inventory_batches_auto_deactivate (this one — flips is_active)
--   2. inventory_batches_immutable        (validates frozen fields)
--   3. inventory_batches_touch            (sets updated_at)
-- is_active is in the immutability trigger's allowed-mutations list
-- so the flip is permitted.
create or replace function public.batch_auto_deactivate_when_empty() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.qty_remaining = 0
     and new.is_active
     and old.qty_remaining > 0 then
    new.is_active := false;
  end if;
  return new;
end;
$$;

revoke all on function public.batch_auto_deactivate_when_empty() from public, anon;

drop trigger if exists inventory_batches_auto_deactivate on public.inventory_batches;
create trigger inventory_batches_auto_deactivate
  before update on public.inventory_batches
  for each row execute function public.batch_auto_deactivate_when_empty();
