-- =====================================================================
-- 0101_v210_unified_ledger_trigger
-- =====================================================================
-- v2.10 — sixth migration in the contacts unification chain.
--
-- Rebuilds ledger_entries_update_balance to be direction-aware with a
-- dual-write on the receivable side, and completes the NOT NULL "swap"
-- that 0100 only half-did (drops NOT NULL from the legacy customer_id).
--
-- Does:
--   - ledger_entries: ALTER COLUMN customer_id DROP NOT NULL
--     (required before payable entries — which have no customer — can
--      be created in 0102/0103; 0100's "swap onto contact_id" only
--      added NOT NULL to contact_id, it did not drop it from customer_id)
--   - CREATE OR REPLACE ledger_entries_update_balance:
--       direction='receivable' -> updates contacts.customer_outstanding_balance
--                                 AND dual-writes customers.outstanding_balance
--                                 (keeps customer_balance_reconciliation /
--                                  AQ-12 green through the 0101->0104 window)
--       direction='payable'    -> updates only contacts.supplier_outstanding_balance
--                                 (suppliers never had an outstanding_balance
--                                  column — no legacy dual-write target)
--
-- Does NOT touch ledger_entries_immutable: it is a blanket UPDATE/DELETE
-- block (no column inspection), so the direction column added by 0100 is
-- already immutable. (Contrast batch_immutable_fields, which is
-- column-by-column and did need the explicit contact_id line in 0100.)
--
-- No DML. The DROP NOT NULL is catalog-only DDL; the function rebuild
-- only affects FUTURE inserts (the trigger is AFTER INSERT and is not
-- re-run on existing rows). So 0101 changes no row data — the
-- verification block confirms the PRE-EXISTING balances on both the
-- legacy and new targets reconcile against the ledger, which is the
-- precondition for the dual-write to stay correct going forward.
--
-- SEQUENCING (corrected 2026-05-14, 0103 Round 2 §B finding): an earlier
-- draft of this note said receivable ledger inserts after 0101 must
-- populate BOTH customer_id and contact_id. That is infeasible (post-0099
-- there is no contact->customer reverse map) and unnecessary. Corrected
-- mechanism — "frozen legacy world + copy-on-reverse": the 0103 CREATE
-- RPCs (record_sale / receive_payment) write customer_id = NULL on new
-- receivable entries; the dual-write's legacy customers branch is guarded
-- on NEW.customer_id IS NOT NULL, so it cleanly no-ops for them. AQ-12
-- stays green because the legacy customers rows AND the customer_id-keyed
-- ledger sum are both frozen as of 0103 — they stay mutually consistent.
-- reverse_ledger_entry is the one exception: it COPIES customer_id from
-- the reversed entry, so reversing a pre-0103 entry keeps the legacy
-- customers row in lockstep. Between 0101 and 0103 staging has no app
-- traffic, so no ledger inserts occur in that window regardless.
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   design/2026-05-14-v210-contacts-model-design.md §2.1
--   design/2026-05-14-v210-contacts-implementation-plan.md §1
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Complete the NOT NULL swap: customer_id becomes nullable so future
--    'payable' ledger entries (supplier-side, no customer) are legal.
--    Catalog-only DDL — no table scan, no trigger fire.
-- ---------------------------------------------------------------------
ALTER TABLE public.ledger_entries ALTER COLUMN customer_id DROP NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Rebuild ledger_entries_update_balance — direction-aware dual-write.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ledger_entries_update_balance()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
declare
  v_delta numeric(12,2);
begin
  if TG_OP = 'INSERT' then
    -- Same sign convention on both sides: debit raises the owed amount,
    -- credit lowers it.
    --   receivable: debit = customer owes us more; credit = they paid us
    --   payable:    debit = we owe the supplier more; credit = we paid them
    v_delta := case when new.type = 'debit' then new.amount else -new.amount end;

    if new.direction = 'receivable' then
      -- new contacts target (contact_id is NOT NULL post-0100)
      update public.contacts
         set customer_outstanding_balance = customer_outstanding_balance + v_delta
       where id = new.contact_id;

      -- legacy dual-write: keep customers.outstanding_balance in lockstep
      -- so customer_balance_reconciliation (AQ-12) stays green through the
      -- 0101->0104 window. Guarded: receivable rows still carry customer_id
      -- (the RPCs populate it until 0104 drops the column), but a NULL is
      -- a clean no-op rather than an error.
      if new.customer_id is not null then
        update public.customers
           set outstanding_balance = outstanding_balance + v_delta,
               updated_at = now()
         where id = new.customer_id;
      end if;

    else  -- new.direction = 'payable' (supplier side)
      -- No legacy target: suppliers never had an outstanding_balance
      -- column. Single-target update only.
      update public.contacts
         set supplier_outstanding_balance = supplier_outstanding_balance + v_delta
       where id = new.contact_id;
    end if;

    return new;
  end if;
  return null;
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. Verification — structural + three-way reconciliation. RAISE on drift.
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_cid_nullable   boolean;
  v_fn_directional bigint;
  v_immut_blanket  bigint;
  v_cust_drift     bigint;
  v_recv_drift     bigint;
  v_pay_drift      bigint;
BEGIN
  -- customer_id is now nullable
  SELECT (is_nullable = 'YES') INTO v_cid_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='customer_id';
  IF NOT v_cid_nullable THEN
    RAISE EXCEPTION '0101: ledger_entries.customer_id is still NOT NULL';
  END IF;

  -- the rebuilt function is direction-aware and dual-writes
  SELECT count(*) INTO v_fn_directional FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='ledger_entries_update_balance'
     AND pg_get_functiondef(p.oid) LIKE '%direction%'
     AND pg_get_functiondef(p.oid) LIKE '%customer_outstanding_balance%'
     AND pg_get_functiondef(p.oid) LIKE '%supplier_outstanding_balance%'
     AND pg_get_functiondef(p.oid) LIKE '%public.customers%';
  IF v_fn_directional <> 1 THEN
    RAISE EXCEPTION '0101: ledger_entries_update_balance not rebuilt as direction-aware dual-write';
  END IF;

  -- ledger_entries_immutable untouched — still the blanket append-only block
  SELECT count(*) INTO v_immut_blanket FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='ledger_entries_immutable'
     AND pg_get_functiondef(p.oid) LIKE '%append-only%';
  IF v_immut_blanket <> 1 THEN
    RAISE EXCEPTION '0101: ledger_entries_immutable unexpectedly altered';
  END IF;

  -- Reconciliation 1 (legacy): customers.outstanding_balance == sum over
  -- ledger keyed by customer_id. This is exactly what AQ-12 checks.
  SELECT count(*) INTO v_cust_drift FROM (
    SELECT c.id FROM public.customers c
    WHERE c.outstanding_balance <> COALESCE((
      SELECT sum(CASE WHEN le.type='debit' THEN le.amount ELSE -le.amount END)
        FROM public.ledger_entries le
       WHERE le.customer_id = c.id), 0)
  ) x;
  IF v_cust_drift > 0 THEN
    RAISE EXCEPTION '0101: % customers whose outstanding_balance does not reconcile against the ledger', v_cust_drift;
  END IF;

  -- Reconciliation 2 (new, receivable): contacts.customer_outstanding_balance
  -- == sum over ledger keyed by contact_id where direction='receivable'.
  SELECT count(*) INTO v_recv_drift FROM (
    SELECT ct.id FROM public.contacts ct
    WHERE ct.customer_outstanding_balance <> COALESCE((
      SELECT sum(CASE WHEN le.type='debit' THEN le.amount ELSE -le.amount END)
        FROM public.ledger_entries le
       WHERE le.contact_id = ct.id AND le.direction = 'receivable'), 0)
  ) x;
  IF v_recv_drift > 0 THEN
    RAISE EXCEPTION '0101: % contacts whose customer_outstanding_balance does not reconcile against the receivable ledger', v_recv_drift;
  END IF;

  -- Reconciliation 3 (new, payable): contacts.supplier_outstanding_balance
  -- == sum over ledger keyed by contact_id where direction='payable'.
  -- (No payable entries exist yet; every contact should be 0 vs 0.)
  SELECT count(*) INTO v_pay_drift FROM (
    SELECT ct.id FROM public.contacts ct
    WHERE ct.supplier_outstanding_balance <> COALESCE((
      SELECT sum(CASE WHEN le.type='debit' THEN le.amount ELSE -le.amount END)
        FROM public.ledger_entries le
       WHERE le.contact_id = ct.id AND le.direction = 'payable'), 0)
  ) x;
  IF v_pay_drift > 0 THEN
    RAISE EXCEPTION '0101: % contacts whose supplier_outstanding_balance does not reconcile against the payable ledger', v_pay_drift;
  END IF;

  RAISE NOTICE '0101 OK: customer_id nullable; ledger_entries_update_balance rebuilt (direction-aware dual-write); ledger_entries_immutable untouched; legacy + receivable + payable balances all reconcile.';
END $verify$;

COMMIT;
