-- =====================================================================
-- 0099_v210_backfill_contact_id
-- =====================================================================
-- v2.10 — fourth migration in the contacts unification chain. HIGH RISK.
--
-- Creates contacts rows from customers + suppliers (merging a supplier
-- into an existing customer's contact on phone collision), then backfills
-- contact_id on the four dependent tables.
--
-- PRE-FLIGHT HARD-FAIL: aborts before any write if any phone within a
-- shop maps to >1 customer or >1 usable-phone supplier (unresolvable
-- collision). Lists every conflict. Owner resolves, then re-runs. A
-- failed apply rolls back fully — no schema_migrations trace.
--
-- TRIGGER WINDOWS: invoices / purchases / ledger_entries each carry a
-- BEFORE UPDATE immutable trigger (financial_records_immutable /
-- ledger_entries_immutable) that blanket-blocks UPDATE. Each backfill
-- runs inside a tight DISABLE TRIGGER -> UPDATE (contact_id only) ->
-- ENABLE TRIGGER window, re-enabled before COMMIT. inventory_batches
-- needs no window: batch_immutable_fields does not gate contact_id,
-- auto_deactivate no-ops on unchanged qty, touch bumping updated_at is
-- benign.
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
-- On the seeded staging DB this migration is EXPECTED to hard-fail on
-- first apply (deliberate S2<->S4 collision in the seed fixture); resolve
-- via supabase/fixtures/2026-05-14-v210-staging-collision-fix.sql, then
-- re-apply. See the 0099 checkpoint plan in the implementation plan.
--
-- Source of truth:
--   design/2026-05-14-v210-contacts-model-design.md §2
--   design/2026-05-14-v210-contacts-implementation-plan.md §1.0
--   decisions/2026-05-14-v210-contact-id-add-not-rename.md
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Pre-flight: hard-fail on unresolvable phone collisions
--    A phone P in shop S is resolvable iff it maps to <=1 customer AND
--    <=1 usable-phone supplier (covers standalone customer, standalone
--    supplier, and the 1+1 customer<->supplier merge). Anything else —
--    customer<->customer, supplier<->supplier, or compound — is an
--    unresolvable data-quality defect the owner must fix deliberately.
-- ---------------------------------------------------------------------
DO $preflight$
DECLARE
  v_lines text;
BEGIN
  SELECT string_agg(line, E'\n' ORDER BY line) INTO v_lines
  FROM (
    SELECT format(
             '  shop %s / phone %s — %s customer(s): [%s], %s supplier(s): [%s]',
             g.shop_id, g.ph,
             g.cust_n, COALESCE(g.cust_list, ''),
             g.supp_n, COALESCE(g.supp_list, ''))  AS line
    FROM (
      SELECT shop_id, ph,
        count(*) FILTER (WHERE kind = 'customer') AS cust_n,
        count(*) FILTER (WHERE kind = 'supplier') AS supp_n,
        string_agg(name || ' (' || src_id || ')', ', ')
          FILTER (WHERE kind = 'customer') AS cust_list,
        string_agg(name || ' (' || src_id || ')', ', ')
          FILTER (WHERE kind = 'supplier') AS supp_list
      FROM (
        SELECT shop_id, phone AS ph, 'customer' AS kind,
               id::text AS src_id, name
          FROM public.customers
        UNION ALL
        SELECT shop_id, trim(contact) AS ph, 'supplier' AS kind,
               id::text AS src_id, name
          FROM public.suppliers
         WHERE contact IS NOT NULL
           AND trim(contact) ~ '^[0-9+][0-9 +-]*$'
      ) src
      GROUP BY shop_id, ph
      HAVING count(*) FILTER (WHERE kind = 'customer') > 1
          OR count(*) FILTER (WHERE kind = 'supplier') > 1
    ) g
  ) lines;

  IF v_lines IS NOT NULL THEN
    RAISE EXCEPTION E'phone_collision_unresolvable: one or more phones map to multiple contacts and cannot be auto-merged.\n%\nFix: each phone may belong to at most one customer and one supplier per shop. Re-point a phone, merge true duplicates, or correct the typo, then re-run migration 0099.', v_lines
      USING errcode = 'P0001';
  END IF;
END $preflight$;

-- ---------------------------------------------------------------------
-- 2. Mapping tables (regular tables, dropped at end; rollback-safe)
-- ---------------------------------------------------------------------
CREATE TABLE public._v210_customer_contact_map (
  customer_id uuid PRIMARY KEY,
  contact_id  uuid NOT NULL
);
CREATE TABLE public._v210_supplier_contact_map (
  supplier_id uuid PRIMARY KEY,
  contact_id  uuid NOT NULL
);

-- ---------------------------------------------------------------------
-- 3. Customer -> contact (one contact per customer, type 'customer')
-- ---------------------------------------------------------------------
INSERT INTO public.contacts (
  id, shop_id, name, phone, address, notes, contact_type,
  customer_tier_id, customer_outstanding_balance, supplier_outstanding_balance,
  is_active, created_at, created_by_user_id
)
SELECT
  gen_random_uuid(), c.shop_id, c.name, c.phone, c.address, c.notes, 'customer',
  c.tier_id, c.outstanding_balance, 0,
  c.is_active, c.created_at, c.created_by_user_id
FROM public.customers c;

-- map back by (shop_id, phone): at this point every contact is a
-- customer-contact and the pre-flight guaranteed <=1 customer per phone,
-- so the join is exact 1:1.
INSERT INTO public._v210_customer_contact_map (customer_id, contact_id)
SELECT c.id, ct.id
FROM public.customers c
JOIN public.contacts ct
  ON ct.shop_id = c.shop_id
 AND ct.phone   = c.phone
 AND ct.contact_type = 'customer';

-- ---------------------------------------------------------------------
-- 4. Supplier -> contact: merge into a customer-contact on phone match,
--    else create a standalone supplier-contact. now() is transaction-
--    stable, so every migration-time merge gets the IDENTICAL
--    promoted_to_both_at — that synchronized timestamp is the signal
--    that these are migration merges, not user-initiated promotions.
-- ---------------------------------------------------------------------
DO $suppliers$
DECLARE
  sup                 public.suppliers%ROWTYPE;
  v_resolved_phone    text;
  v_existing_contact  uuid;
  v_new_contact       uuid;
  v_owner             uuid;
BEGIN
  FOR sup IN SELECT * FROM public.suppliers LOOP
    -- usable phone vs synthesized placeholder
    IF sup.contact IS NOT NULL
       AND trim(sup.contact) ~ '^[0-9+][0-9 +-]*$' THEN
      v_resolved_phone := trim(sup.contact);
    ELSE
      v_resolved_phone := 'NOPHONE-' || sup.id::text;
    END IF;

    -- a customer-contact on this phone in this shop? (pre-flight => <=1)
    SELECT id INTO v_existing_contact
      FROM public.contacts
     WHERE shop_id = sup.shop_id
       AND phone   = v_resolved_phone
       AND contact_type = 'customer';

    IF FOUND THEN
      -- MERGE: customer-contact becomes 'both'. Customer identity fields
      -- are preserved untouched (L3); the supplier contributes nothing
      -- but its transactions (linked below) and the type flip. This
      -- UPDATE deliberately exercises the 0097
      -- v210_contacts_promotion_audit_required trigger.
      SELECT owner_user_id INTO v_owner
        FROM public.shops WHERE id = sup.shop_id;

      UPDATE public.contacts
         SET contact_type                = 'both',
             promoted_to_both_at         = now(),
             promoted_to_both_by_user_id = v_owner
       WHERE id = v_existing_contact;

      INSERT INTO public._v210_supplier_contact_map (supplier_id, contact_id)
      VALUES (sup.id, v_existing_contact);
    ELSE
      -- standalone supplier-contact
      INSERT INTO public.contacts (
        id, shop_id, name, phone, address, notes, contact_type,
        customer_tier_id, customer_outstanding_balance,
        supplier_outstanding_balance,
        is_active, created_at, created_by_user_id
      )
      VALUES (
        gen_random_uuid(), sup.shop_id, sup.name, v_resolved_phone,
        sup.address, sup.notes, 'supplier',
        NULL, 0, 0,
        sup.is_active, sup.created_at, sup.created_by_user_id
      )
      RETURNING id INTO v_new_contact;

      INSERT INTO public._v210_supplier_contact_map (supplier_id, contact_id)
      VALUES (sup.id, v_new_contact);
    END IF;
  END LOOP;
END $suppliers$;

-- ---------------------------------------------------------------------
-- 5. Backfill dependent tables. invoices / purchases / ledger_entries
--    each: DISABLE the immutable trigger -> UPDATE contact_id only ->
--    ENABLE (tight per-table window, re-enabled immediately).
-- ---------------------------------------------------------------------

-- invoices (customer_id nullable: walk-in rows stay contact_id NULL)
ALTER TABLE public.invoices DISABLE TRIGGER invoices_no_modify;
UPDATE public.invoices i
   SET contact_id = m.contact_id
  FROM public._v210_customer_contact_map m
 WHERE i.customer_id = m.customer_id;
ALTER TABLE public.invoices ENABLE TRIGGER invoices_no_modify;

-- ledger_entries (customer_id NOT NULL: every row gets a contact_id)
ALTER TABLE public.ledger_entries DISABLE TRIGGER ledger_entries_no_modify;
UPDATE public.ledger_entries le
   SET contact_id = m.contact_id
  FROM public._v210_customer_contact_map m
 WHERE le.customer_id = m.customer_id;
ALTER TABLE public.ledger_entries ENABLE TRIGGER ledger_entries_no_modify;

-- purchases (supplier_id nullable: any supplier-less purchase stays NULL)
ALTER TABLE public.purchases DISABLE TRIGGER purchases_no_modify;
UPDATE public.purchases p
   SET contact_id = m.contact_id
  FROM public._v210_supplier_contact_map m
 WHERE p.supplier_id = m.supplier_id;
ALTER TABLE public.purchases ENABLE TRIGGER purchases_no_modify;

-- inventory_batches: no trigger window needed (see header). supplier_id
-- nullable: any supplier-less batch stays NULL.
UPDATE public.inventory_batches b
   SET contact_id = m.contact_id
  FROM public._v210_supplier_contact_map m
 WHERE b.supplier_id = m.supplier_id;

-- ---------------------------------------------------------------------
-- 6. Verification — data-agnostic invariants. RAISE on any drift.
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_cust_n        bigint;
  v_cust_mapped   bigint;
  v_supp_n        bigint;
  v_supp_mapped   bigint;
  v_inv_gap       bigint;
  v_led_gap       bigint;
  v_pur_gap       bigint;
  v_bat_gap       bigint;
  v_inv_walkin    bigint;
  v_pur_orphan    bigint;
  v_bat_orphan    bigint;
  v_triggers_off  bigint;
BEGIN
  SELECT count(*) INTO v_cust_n      FROM public.customers;
  SELECT count(*) INTO v_cust_mapped FROM public._v210_customer_contact_map;
  SELECT count(*) INTO v_supp_n      FROM public.suppliers;
  SELECT count(*) INTO v_supp_mapped FROM public._v210_supplier_contact_map;

  IF v_cust_n <> v_cust_mapped THEN
    RAISE EXCEPTION '0099: % customers but % mapped', v_cust_n, v_cust_mapped;
  END IF;
  IF v_supp_n <> v_supp_mapped THEN
    RAISE EXCEPTION '0099: % suppliers but % mapped', v_supp_n, v_supp_mapped;
  END IF;

  -- every row with a legacy id must now have a contact_id
  SELECT count(*) INTO v_inv_gap FROM public.invoices
    WHERE customer_id IS NOT NULL AND contact_id IS NULL;
  SELECT count(*) INTO v_led_gap FROM public.ledger_entries
    WHERE contact_id IS NULL;                       -- customer_id is NOT NULL
  SELECT count(*) INTO v_pur_gap FROM public.purchases
    WHERE supplier_id IS NOT NULL AND contact_id IS NULL;
  SELECT count(*) INTO v_bat_gap FROM public.inventory_batches
    WHERE supplier_id IS NOT NULL AND contact_id IS NULL;

  IF v_inv_gap > 0 THEN RAISE EXCEPTION '0099: % invoices with customer_id but no contact_id', v_inv_gap; END IF;
  IF v_led_gap > 0 THEN RAISE EXCEPTION '0099: % ledger_entries with no contact_id', v_led_gap; END IF;
  IF v_pur_gap > 0 THEN RAISE EXCEPTION '0099: % purchases with supplier_id but no contact_id', v_pur_gap; END IF;
  IF v_bat_gap > 0 THEN RAISE EXCEPTION '0099: % inventory_batches with supplier_id but no contact_id', v_bat_gap; END IF;

  -- rows with NO legacy id must still have NO contact_id (no spurious backfill)
  SELECT count(*) INTO v_inv_walkin FROM public.invoices
    WHERE customer_id IS NULL AND contact_id IS NOT NULL;
  SELECT count(*) INTO v_pur_orphan FROM public.purchases
    WHERE supplier_id IS NULL AND contact_id IS NOT NULL;
  SELECT count(*) INTO v_bat_orphan FROM public.inventory_batches
    WHERE supplier_id IS NULL AND contact_id IS NOT NULL;

  IF v_inv_walkin > 0 THEN RAISE EXCEPTION '0099: % walk-in invoices wrongly got a contact_id', v_inv_walkin; END IF;
  IF v_pur_orphan > 0 THEN RAISE EXCEPTION '0099: % supplier-less purchases wrongly got a contact_id', v_pur_orphan; END IF;
  IF v_bat_orphan > 0 THEN RAISE EXCEPTION '0099: % supplier-less batches wrongly got a contact_id', v_bat_orphan; END IF;

  -- guardrail: the three immutable triggers must be back ENABLED
  SELECT count(*) INTO v_triggers_off
  FROM pg_trigger
  WHERE tgname IN ('invoices_no_modify','purchases_no_modify','ledger_entries_no_modify')
    AND tgenabled = 'D';

  IF v_triggers_off > 0 THEN
    RAISE EXCEPTION '0099: % immutable trigger(s) left DISABLED after backfill', v_triggers_off;
  END IF;

  RAISE NOTICE '0099 OK: % customers + % suppliers -> contacts; dependent tables backfilled; 3 immutable triggers re-enabled.', v_cust_n, v_supp_n;
END $verify$;

-- ---------------------------------------------------------------------
-- 7. Drop mapping tables (rollback also removes them if the migration
--    aborted earlier)
-- ---------------------------------------------------------------------
DROP TABLE public._v210_customer_contact_map;
DROP TABLE public._v210_supplier_contact_map;

COMMIT;
