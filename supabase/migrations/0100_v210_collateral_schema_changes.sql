-- =====================================================================
-- 0100_v210_collateral_schema_changes
-- =====================================================================
-- v2.10 — fifth migration in the contacts unification chain.
--
-- Additive collateral changes after the 0099 backfill. NO renames, NO
-- drops, NO view changes (see implementation-plan §1.0 + §2.6). One DML
-- operation — the purchases.amount_paid backfill — runs inside a tight
-- purchases_no_modify disable window; everything else is DDL and fires
-- no row triggers (0098 precedent: ADD COLUMN on these immutable-
-- triggered tables applied cleanly with no trigger disabling).
--
-- Does:
--   - ledger_entries: + direction column (default 'receivable' then
--     dropped); swap NOT NULL onto contact_id; + contact_id and
--     direction-partial indexes
--   - purchases: + amount_paid (backfilled = total_cost for legacy rows
--     inside the disable window); + outstanding (generated); + contact_id
--     index
--   - invoices / inventory_batches: + contact_id index
--   - shops: + salesperson_supplier_payment_cap_pkr (B.0.3)
--   - batch_immutable_fields: gains a contact_id immutability check
--
-- Does NOT touch customer_balance_reconciliation — AQ-12 depends on it.
-- The new contact_balance_reconciliation view lands in 0102; the old
-- view drops in 0104.
--
-- NOTE FOR 0104: batch_immutable_fields will then still reference the
-- legacy supplier_id column; 0104 must drop that check when it drops
-- inventory_batches.supplier_id.
--
-- NOTE ON SEQUENCING: dropping the 'receivable' default on
-- ledger_entries.direction means every ledger-inserting RPC must specify
-- direction explicitly from this migration onward. The RPCs are updated
-- in 0103; between 0100 and 0103 staging has no app traffic, so no
-- ledger writes occur in that window. Intentional ordering.
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   design/2026-05-14-v210-contacts-model-design.md §2
--   design/2026-05-14-v210-contacts-implementation-plan.md §1.0
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. ledger_entries: direction column
--    Existing rows are all customer-side -> 'receivable' via the
--    default; the default is then dropped so new ledger writes must
--    specify direction explicitly.
-- ---------------------------------------------------------------------
ALTER TABLE public.ledger_entries
  ADD COLUMN direction text NOT NULL DEFAULT 'receivable'
  CONSTRAINT ledger_entries_direction_check
    CHECK (direction IN ('receivable','payable'));

ALTER TABLE public.ledger_entries ALTER COLUMN direction DROP DEFAULT;

-- ---------------------------------------------------------------------
-- 2. ledger_entries: swap NOT NULL onto contact_id
--    Pre-check: the 0099 backfill must have populated every row. RAISE
--    with a clear message rather than letting SET NOT NULL fail generic.
-- ---------------------------------------------------------------------
DO $precheck$
DECLARE
  v_nulls bigint;
BEGIN
  SELECT count(*) INTO v_nulls
    FROM public.ledger_entries WHERE contact_id IS NULL;
  IF v_nulls > 0 THEN
    RAISE EXCEPTION '0100: % ledger_entries row(s) have NULL contact_id — the 0099 backfill is incomplete; cannot add the NOT NULL constraint', v_nulls;
  END IF;
END $precheck$;

ALTER TABLE public.ledger_entries ALTER COLUMN contact_id SET NOT NULL;

-- ---------------------------------------------------------------------
-- 3. ledger_entries: contact_id + direction-partial indexes
--    (parallel to the legacy customer_id indexes, which 0104 drops)
-- ---------------------------------------------------------------------
CREATE INDEX idx_ledger_entries_contact_created
  ON public.ledger_entries (contact_id, created_at DESC);
CREATE INDEX idx_ledger_entries_contact_occurred
  ON public.ledger_entries (contact_id, occurred_at DESC);
CREATE INDEX ledger_shop_contact_idx
  ON public.ledger_entries (shop_id, contact_id);
CREATE INDEX idx_ledger_entries_receivable
  ON public.ledger_entries (contact_id, occurred_at DESC)
  WHERE direction = 'receivable';
CREATE INDEX idx_ledger_entries_payable
  ON public.ledger_entries (contact_id, occurred_at DESC)
  WHERE direction = 'payable';

-- ---------------------------------------------------------------------
-- 4. purchases: amount_paid column (DDL — all existing rows get 0)
-- ---------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN amount_paid numeric(12,2) NOT NULL DEFAULT 0
  CONSTRAINT purchases_amount_paid_check CHECK (amount_paid >= 0);

-- ---------------------------------------------------------------------
-- 5. purchases: backfill amount_paid = total_cost for legacy rows.
--    Pre-v2.10 purchases had no amount_paid concept — they are treated
--    as fully paid. This is the ONLY DML in 0100, so it runs inside a
--    tight purchases_no_modify disable window (the trigger blanket-
--    blocks UPDATE). The UPDATE touches only amount_paid.
-- ---------------------------------------------------------------------
ALTER TABLE public.purchases DISABLE TRIGGER purchases_no_modify;
UPDATE public.purchases SET amount_paid = total_cost;
ALTER TABLE public.purchases ENABLE TRIGGER purchases_no_modify;

-- ---------------------------------------------------------------------
-- 6. purchases: outstanding generated column. Added AFTER the backfill
--    so it is born correct (total_cost - total_cost = 0 for legacy rows).
--    GREATEST(0, ...) clamps any future overpayment to 0.
-- ---------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN outstanding numeric(12,2)
  GENERATED ALWAYS AS (GREATEST(0::numeric, total_cost - amount_paid)) STORED;

-- ---------------------------------------------------------------------
-- 7. purchases / invoices / inventory_batches: contact_id indexes
--    (parallel to the legacy supplier_id/customer_id indexes; 0104 drops
--    the legacy ones. inventory_batches.supplier_id never had a covering
--    index — audit §1.6 — so there is no legacy index to parallel there.)
-- ---------------------------------------------------------------------
CREATE INDEX idx_purchases_contact
  ON public.purchases (contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX idx_invoices_contact_created
  ON public.invoices (contact_id, created_at DESC);

CREATE INDEX idx_inventory_batches_contact
  ON public.inventory_batches (contact_id)
  WHERE contact_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 8. shops: non-owner supplier payment cap (B.0.3). Default 0 = non-owners
--    cannot pay suppliers until the owner opts them in.
-- ---------------------------------------------------------------------
ALTER TABLE public.shops
  ADD COLUMN salesperson_supplier_payment_cap_pkr numeric(12,2) NOT NULL DEFAULT 0
  CONSTRAINT shops_salesperson_supplier_payment_cap_pkr_check
    CHECK (salesperson_supplier_payment_cap_pkr >= 0);

-- ---------------------------------------------------------------------
-- 9. batch_immutable_fields: protect contact_id (it is backfilled and
--    final after 0099 — nothing legitimately re-points it). The legacy
--    supplier_id check stays until 0104 drops that column.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.batch_immutable_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if old.id is distinct from new.id then raise exception 'batch_id_immutable'; end if;
  if old.variant_id is distinct from new.variant_id then raise exception 'batch_variant_immutable'; end if;
  if lower(trim(old.batch_no)) is distinct from lower(trim(new.batch_no))
    then raise exception 'batch_no_immutable'; end if;
  if old.qty_received is distinct from new.qty_received then raise exception 'batch_qty_received_immutable'; end if;
  if old.cost_per_unit is distinct from new.cost_per_unit then raise exception 'batch_cost_immutable'; end if;
  if old.manufactured_date is distinct from new.manufactured_date then raise exception 'batch_mfg_date_immutable'; end if;
  if old.expiry_date is distinct from new.expiry_date then raise exception 'batch_expiry_immutable'; end if;
  if old.supplier_warranty_days is distinct from new.supplier_warranty_days then raise exception 'batch_warranty_days_immutable'; end if;
  if old.warranty_expires_at is distinct from new.warranty_expires_at then raise exception 'batch_warranty_date_immutable'; end if;
  if old.received_at is distinct from new.received_at then raise exception 'batch_received_at_immutable'; end if;
  if old.purchase_item_id is not null
     and new.purchase_item_id is distinct from old.purchase_item_id then
    raise exception 'batch_purchase_item_immutable';
  end if;
  if old.supplier_id is distinct from new.supplier_id then raise exception 'batch_supplier_immutable'; end if;
  if old.contact_id is distinct from new.contact_id then raise exception 'batch_contact_immutable'; end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- 10. Verification — RAISE on any drift.
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_dir_col        bigint;
  v_dir_nonrecv    bigint;
  v_contact_nn     boolean;
  v_led_idx        bigint;
  v_amt_col        bigint;
  v_out_col        bigint;
  v_amt_mismatch   bigint;
  v_cap_col        bigint;
  v_batch_guard    bigint;
  v_pur_trig_off   bigint;
  v_cbr_intact     bigint;
BEGIN
  -- ledger_entries.direction exists; all existing rows are 'receivable'
  SELECT count(*) INTO v_dir_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='direction';
  IF v_dir_col <> 1 THEN RAISE EXCEPTION '0100: ledger_entries.direction missing'; END IF;

  SELECT count(*) INTO v_dir_nonrecv FROM public.ledger_entries WHERE direction <> 'receivable';
  IF v_dir_nonrecv > 0 THEN
    RAISE EXCEPTION '0100: % ledger_entries rows are not direction=receivable after backfill', v_dir_nonrecv;
  END IF;

  -- ledger_entries.contact_id is now NOT NULL
  SELECT (is_nullable = 'NO') INTO v_contact_nn FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='contact_id';
  IF NOT v_contact_nn THEN RAISE EXCEPTION '0100: ledger_entries.contact_id is not NOT NULL'; END IF;

  -- the 5 ledger indexes exist
  SELECT count(*) INTO v_led_idx FROM pg_indexes
   WHERE schemaname='public' AND tablename='ledger_entries'
     AND indexname IN ('idx_ledger_entries_contact_created','idx_ledger_entries_contact_occurred',
                       'ledger_shop_contact_idx','idx_ledger_entries_receivable','idx_ledger_entries_payable');
  IF v_led_idx <> 5 THEN RAISE EXCEPTION '0100: expected 5 ledger contact/direction indexes, got %', v_led_idx; END IF;

  -- purchases.amount_paid + outstanding exist; every legacy row backfilled
  SELECT count(*) INTO v_amt_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='purchases' AND column_name='amount_paid';
  SELECT count(*) INTO v_out_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='purchases' AND column_name='outstanding';
  IF v_amt_col <> 1 OR v_out_col <> 1 THEN RAISE EXCEPTION '0100: purchases amount_paid/outstanding missing'; END IF;

  SELECT count(*) INTO v_amt_mismatch FROM public.purchases WHERE amount_paid <> total_cost;
  IF v_amt_mismatch > 0 THEN
    RAISE EXCEPTION '0100: % purchases rows have amount_paid <> total_cost after backfill', v_amt_mismatch;
  END IF;

  -- shops cap column
  SELECT count(*) INTO v_cap_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='shops' AND column_name='salesperson_supplier_payment_cap_pkr';
  IF v_cap_col <> 1 THEN RAISE EXCEPTION '0100: shops.salesperson_supplier_payment_cap_pkr missing'; END IF;

  -- batch_immutable_fields now guards contact_id
  SELECT count(*) INTO v_batch_guard FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='batch_immutable_fields'
     AND pg_get_functiondef(p.oid) LIKE '%batch_contact_immutable%';
  IF v_batch_guard <> 1 THEN RAISE EXCEPTION '0100: batch_immutable_fields does not guard contact_id'; END IF;

  -- guardrail: purchases_no_modify re-enabled
  SELECT count(*) INTO v_pur_trig_off FROM pg_trigger
   WHERE tgname = 'purchases_no_modify' AND tgenabled = 'D';
  IF v_pur_trig_off > 0 THEN RAISE EXCEPTION '0100: purchases_no_modify left DISABLED'; END IF;

  -- customer_balance_reconciliation must still exist (AQ-12 depends on it)
  SELECT count(*) INTO v_cbr_intact FROM pg_views
   WHERE schemaname='public' AND viewname='customer_balance_reconciliation';
  IF v_cbr_intact <> 1 THEN RAISE EXCEPTION '0100: customer_balance_reconciliation was unexpectedly dropped'; END IF;

  RAISE NOTICE '0100 OK: ledger direction + contact_id NOT NULL + 5 indexes; purchases amount_paid/outstanding backfilled; shops cap added; batch_immutable_fields guards contact_id; purchases_no_modify re-enabled.';
END $verify$;

COMMIT;
