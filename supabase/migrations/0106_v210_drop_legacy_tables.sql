-- =====================================================================
-- 0106_v210_drop_legacy_tables
-- =====================================================================
-- v2.10 — eleventh and FINAL migration in the contacts unification
-- chain. Removes the now-empty legacy husk: the customers and suppliers
-- tables, unified into contacts across 0096–0105.
--
-- *** POINT OF NO RETURN ***
-- There is NO down-migration (implementation-plan §1.2 — v2.10 is
-- forward-only on the contacts unification). Once this COMMITs, the
-- customers and suppliers tables and ALL ROWS in them are gone; the only
-- recovery is a PITR / snapshot restore of the database. Applied only
-- after explicit owner re-confirmation per implementation-plan §1.1.
--
-- Design package (reviewed + signed off 2026-05-14):
--   design/2026-05-14-v210-0106-drop-legacy-tables.md
-- The §1 dependency-closure analysis there proves, with a query behind
-- every claim, that DROP ... CASCADE's blast radius is fully enumerated
-- and fully expected:
--   - CASCADE removes ONLY the legacy tables' own machinery — 2 TOAST
--     tables, 2 rowtypes, 7 indexes, 9 column defaults, 13 constraints,
--     3 triggers, 5 RLS policies. (pg_depend closure, design §1.1.)
--   - 0 inbound FKs (re-proven at 0106, not inherited from 0104 — §1.2).
--   - 0 views reference either table (no pg_rewrite dep + text scan — §1.4).
--   - 0 functions reference either table as a table; the one body that
--     mentions "customers" — deactivate_tier_v28 — does so only in a
--     comment, full body pulled and confirmed (§1.6). AQ-33 (write scan)
--     is 0.
--   - 0 defaults / generated columns on other tables reference them (§1.7).
-- The ONLY thing CASCADE does not clean is check_customer_tier_change_gate()
-- — a trigger function (not table-owned) behind the v29_customers_tier_
-- change_gate trigger; used by no other trigger (§1.5). 0106 drops it
-- explicitly in §2.
--
-- Pre-flight: the full migration (these DROPs + the §3 checks in
-- SELECT-returning form) was dry-run against staging via execute_sql
-- ending in ROLLBACK — returned 0,0,0,0,0,4 exactly; net-zero confirmed
-- by a post-ROLLBACK sanity query. This file is the RAISE-EXCEPTION form
-- of that same proven logic.
--
-- STAGING ONLY. Production customers/suppliers are dropped only at the
-- combined v2.10+v2.11 production-deploy moment (implementation-plan
-- §4.4 — its own authorization, its own Finding-1 data-wipe confirmation).
--
-- Halt checkpoint after apply (implementation-plan §1.3.4): verify
-- customers and suppliers no longer exist in pg_class; run AQ-01..AQ-33.
-- =====================================================================

BEGIN;

-- =====================================================================
-- §1 — drop the legacy tables. CASCADE removes ONLY their own machinery:
-- TOAST + rowtype, 7 indexes, 9 column defaults, 13 constraints, 3
-- triggers, 5 RLS policies — the full, enumerated closure from design
-- §1. No view, no inbound FK, no other-table column, and no function
-- depends on either table (design §1.1 / §1.2 / §1.4 / §1.6 / §1.7), so
-- CASCADE takes nothing else. No IF EXISTS — the objects are proven to
-- exist; on the irreversible migration a bare DROP that errors on a
-- missing object is better than IF EXISTS silently masking a surprise.
-- =====================================================================
DROP TABLE public.customers CASCADE;
DROP TABLE public.suppliers CASCADE;

-- =====================================================================
-- §2 — drop the orphaned trigger function. check_customer_tier_change_gate()
-- is the trigger fn behind v29_customers_tier_change_gate (just dropped
-- with public.customers in §1). It is a function, not table-owned, so
-- CASCADE does NOT remove it; design §1.5 proved it is used by no other
-- trigger. Left behind it is a dead, never-invoked orphan — 0106 removes
-- it explicitly. Ordering: this MUST follow §1 — while the trigger still
-- exists, DROP FUNCTION would fail with a dependency error.
-- =====================================================================
DROP FUNCTION public.check_customer_tier_change_gate();

-- =====================================================================
-- §3 — verification. The same six checks the dry-run ran (there in
-- SELECT-returning form, which returned 0,0,0,0,0,4); here in
-- RAISE-EXCEPTION form — any mismatch aborts the whole transaction.
-- Five "the teardown happened" checks + one "the things that MUST
-- survive did" check (defense-in-depth for an irreversible op).
-- =====================================================================
DO $verify_0106$
DECLARE
  v_tables_left   bigint;
  v_orphan_fn     bigint;
  v_v29_policies  bigint;
  v_fn_as_table   bigint;
  v_fn_writes     bigint;
  v_survivors     bigint;
BEGIN
  -- 1. customers + suppliers no longer exist as tables (impl-plan §1.3.4)
  SELECT count(*) INTO v_tables_left
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('customers','suppliers') AND c.relkind='r';
  IF v_tables_left <> 0 THEN
    RAISE EXCEPTION '0106 verify 1: % legacy table(s) still present', v_tables_left;
  END IF;

  -- 2. the orphaned trigger fn check_customer_tier_change_gate is gone
  SELECT count(*) INTO v_orphan_fn
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='check_customer_tier_change_gate';
  IF v_orphan_fn <> 0 THEN
    RAISE EXCEPTION '0106 verify 2: check_customer_tier_change_gate still present';
  END IF;

  -- 3. the 5 v29 customers/suppliers RLS policies went with their tables
  SELECT count(*) INTO v_v29_policies
  FROM pg_policies
  WHERE schemaname='public' AND policyname IN
    ('v29_customers_read','v29_customers_update',
     'v29_suppliers_read','v29_suppliers_update','v29_suppliers_write');
  IF v_v29_policies <> 0 THEN
    RAISE EXCEPTION '0106 verify 3: % legacy RLS policy(ies) still present', v_v29_policies;
  END IF;

  -- 4. no surviving function references customers/suppliers AS A TABLE
  --    (FROM/JOIN/INTO/UPDATE/DELETE). A bare-word scan would still flag
  --    deactivate_tier_v28's comment, so this checks table-reference
  --    SHAPE. MATERIALIZED fence per the AQ-33 / 0104b pattern.
  WITH public_fns AS MATERIALIZED (
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind IN ('f','p'))
  SELECT count(*) INTO v_fn_as_table FROM public_fns
  WHERE pg_get_functiondef(oid) ~*
    '(\mfrom\s+|\mjoin\s+|\minto\s+|\mupdate\s+|\mdelete\s+from\s+)(public\.)?(customers|suppliers)\M';
  IF v_fn_as_table <> 0 THEN
    RAISE EXCEPTION '0106 verify 4: % function(s) reference customers/suppliers as a table', v_fn_as_table;
  END IF;

  -- 5. AQ-33 standing guard: no function writes the legacy tables.
  WITH public_fns AS MATERIALIZED (
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind IN ('f','p'))
  SELECT count(*) INTO v_fn_writes FROM public_fns
  WHERE pg_get_functiondef(oid) ~*
    '(insert\s+into\s+|update\s+|delete\s+from\s+)public\.(customers|suppliers)\M';
  IF v_fn_writes <> 0 THEN
    RAISE EXCEPTION '0106 verify 5 (AQ-33): % function(s) write the legacy tables', v_fn_writes;
  END IF;

  -- 6. defense-in-depth for an irreversible op — the objects that MUST
  --    survive did (CASCADE did not over-reach). Design §1 proved
  --    nothing outside the legacy tables depends on them; this confirms
  --    it from the other side. Expect all 4 present.
  SELECT count(*) INTO v_survivors
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relname IN ('contacts','contacts_view','ledger_entries','customer_tiers');
  IF v_survivors <> 4 THEN
    RAISE EXCEPTION '0106 verify 6: expected 4 key survivors (contacts, contacts_view, ledger_entries, customer_tiers), found %', v_survivors;
  END IF;

  RAISE NOTICE '0106 OK: customers + suppliers dropped (tables, TOAST, rowtypes, 7 indexes, 9 defaults, 13 constraints, 3 triggers, 5 RLS policies — full enumerated closure); check_customer_tier_change_gate orphan dropped; 0 functions reference the legacy tables as a table; AQ-33 green; contacts / contacts_view / ledger_entries / customer_tiers intact. v2.10 Phase C schema teardown complete.';
END $verify_0106$;

COMMIT;
