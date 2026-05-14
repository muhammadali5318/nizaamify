-- =====================================================================
-- 2026-05-14-v210-staging-seed.sql
-- =====================================================================
-- v2.10 STAGING TEST FIXTURE — *not* a migration, not part of the
-- migration chain. Apply via execute_sql (NOT apply_migration) so it is
-- never recorded in supabase_migrations.schema_migrations.
--
-- PURPOSE
--   Seed the empty staging database (project iamqibcdpeovwavgzswq) with
--   representative data so migration 0099 (backfill contact_id) runs
--   against real rows instead of an empty schema. Mirrors production's
--   shape and deliberately forces every collision / edge code path:
--
--     - customer <-> supplier phone collision   -> 0099 merges to 'both'
--     - supplier <-> supplier phone collision    -> 0099 must NOT merge
--                                                   (different businesses)
--     - supplier with messy/non-phone contact    -> 0099 must synthesize
--                                                   a placeholder phone
--     - walk-in invoice (customer_id NULL)        -> 0099 leaves it NULL
--
-- ONE-SHOT + GUARD
--   Re-running errors clearly (the guard RAISEs if the seed shop already
--   exists). To re-seed, reset staging. Whole fixture is one transaction.
--
-- TRIGGER INTERACTIONS ACCOUNTED FOR
--   - auth.users INSERT fires on_auth_user_created -> handle_new_user
--     auto-creates public.profiles + public.subscriptions. Seed supplies
--     only (id, email).
--   - ledger_entries INSERT fires ledger_entries_balance (AFTER INSERT)
--     -> recomputes customers.outstanding_balance. Customers are
--     therefore inserted at balance 0; the ledger rows drive the final
--     balance (C1 -> 15000, C2 -> 0), exactly as production works.
--   - product_variants INSERT fires variants_default_invariant -> each
--     seeded variant is is_default=true (one variant per product).
--   - products INSERT fires products_normalize_trigger -> type is set to
--     the category name so normalization is a no-op.
--
-- FIXED UUIDS
--   Prefix 21100000-...  ("2110" = v2.10). Last segment encodes entity:
--   001 owner · 002 shop · 003 tier · 004 uom · 005 category
--   101/102 products · 201/202 variants
--   301/302/303 customers · 401-404 suppliers
--   05xx invoices · 06xx ledger · 07xx purchases · 08xx batches
--
-- SOURCE OF TRUTH
--   design/2026-05-14-v210-contacts-implementation-plan.md §3 (Phase E)
--   audit/2026-05-14-v210-contacts-pre-design-audit.md §6.2 (collisions)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Guard — refuse to double-seed
-- ---------------------------------------------------------------------
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.shops
             WHERE id = '21100000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'v2.10 staging seed already applied (seed shop exists). Reset staging to re-seed.';
  END IF;
END $guard$;

-- ---------------------------------------------------------------------
-- 1. Owner identity
--    auth.users INSERT -> handle_new_user trigger creates the matching
--    public.profiles row (id, email) + a public.subscriptions row.
-- ---------------------------------------------------------------------
INSERT INTO auth.users (id, email)
VALUES ('21100000-0000-4000-8000-000000000001', 'v210-seed-owner@staging.local');

-- ---------------------------------------------------------------------
-- 2. Shop
-- ---------------------------------------------------------------------
INSERT INTO public.shops (id, owner_user_id, shop_name, shop_address, shop_phone)
VALUES (
  '21100000-0000-4000-8000-000000000002',
  '21100000-0000-4000-8000-000000000001',
  'Seed Traders',
  'Plot 7, Hall Road, Lahore',
  '04299999999'
);

-- ---------------------------------------------------------------------
-- 3. shop_owner_details  (AQ-16: every shop has one)
-- ---------------------------------------------------------------------
INSERT INTO public.shop_owner_details (shop_id, owner_name, owner_phone, owner_address)
VALUES (
  '21100000-0000-4000-8000-000000000002',
  'Seed Owner',
  '03000000000',
  'Plot 7, Hall Road, Lahore'
);

-- ---------------------------------------------------------------------
-- 4. user_shop_access  (AQ-03 / AQ-07: shop has exactly one is_owner row
--    matching shops.owner_user_id). preset_applied left NULL — owner rows
--    carry no preset (AQ-22 only flags non-null preset without an audit
--    row).
-- ---------------------------------------------------------------------
INSERT INTO public.user_shop_access (user_id, shop_id, is_owner)
VALUES (
  '21100000-0000-4000-8000-000000000001',
  '21100000-0000-4000-8000-000000000002',
  true
);

-- ---------------------------------------------------------------------
-- 5. Supporting catalog — tier, unit of measure, category
-- ---------------------------------------------------------------------
INSERT INTO public.customer_tiers (id, shop_id, name)
VALUES (
  '21100000-0000-4000-8000-000000000003',
  '21100000-0000-4000-8000-000000000002',
  'Regular'
);

-- code must satisfy uom_code_format: lowercase, letter-led, [a-z0-9_] only
INSERT INTO public.units_of_measure (id, shop_id, code, name)
VALUES (
  '21100000-0000-4000-8000-000000000004',
  '21100000-0000-4000-8000-000000000002',
  'pc',
  'Piece'
);

INSERT INTO public.product_categories (id, shop_id, name)
VALUES (
  '21100000-0000-4000-8000-000000000005',
  '21100000-0000-4000-8000-000000000002',
  'General'
);

-- ---------------------------------------------------------------------
-- 6. Products + variants
--    products.type = category name ('General') so products_normalize is
--    a no-op. Each product gets exactly one is_default variant.
-- ---------------------------------------------------------------------
INSERT INTO public.products (id, shop_id, name, cost, type, base_unit_id, category_id)
VALUES
  ('21100000-0000-4000-8000-000000000101',
   '21100000-0000-4000-8000-000000000002',
   'Seed Widget', 100.00, 'General',
   '21100000-0000-4000-8000-000000000004',
   '21100000-0000-4000-8000-000000000005'),
  ('21100000-0000-4000-8000-000000000102',
   '21100000-0000-4000-8000-000000000002',
   'Seed Gadget', 250.00, 'General',
   '21100000-0000-4000-8000-000000000004',
   '21100000-0000-4000-8000-000000000005');

INSERT INTO public.product_variants (id, product_id, is_default)
VALUES
  ('21100000-0000-4000-8000-000000000201',
   '21100000-0000-4000-8000-000000000101', true),
  ('21100000-0000-4000-8000-000000000202',
   '21100000-0000-4000-8000-000000000102', true);

-- ---------------------------------------------------------------------
-- 7. Customers (3)
--    Inserted at outstanding_balance = 0 (default). The ledger_entries
--    in §9 drive the final balance via the ledger_entries_balance
--    trigger: C1 -> 15000, C2 -> 0, C3 -> 0 (no entries).
--
--    C1 'Bilal Traders' (phone 03001234567) is the COLLISION CUSTOMER:
--    supplier S1 in §8 shares this phone. 0099 must merge S1 into C1's
--    contact -> contact_type 'both'. C1's name/address/notes/tier must
--    survive the merge (customer data wins) — S1's differ on purpose so
--    the conflict resolution is observable.
-- ---------------------------------------------------------------------
INSERT INTO public.customers
  (id, shop_id, name, phone, address, notes, tier_id, is_active, created_by_user_id)
VALUES
  -- C1: has outstanding balance + the collision customer
  ('21100000-0000-4000-8000-000000000301',
   '21100000-0000-4000-8000-000000000002',
   'Bilal Traders', '03001234567',
   'Shop 12, Hall Road, Lahore',
   'Regular customer since 2024',
   '21100000-0000-4000-8000-000000000003',
   true,
   '21100000-0000-4000-8000-000000000001'),
  -- C2: zero balance
  ('21100000-0000-4000-8000-000000000302',
   '21100000-0000-4000-8000-000000000002',
   'Sana Khan', '03009876543',
   NULL, NULL, NULL, true,
   '21100000-0000-4000-8000-000000000001'),
  -- C3: archived
  ('21100000-0000-4000-8000-000000000303',
   '21100000-0000-4000-8000-000000000002',
   'Old Shop (closed)', '03007777777',
   NULL, NULL, NULL, false,
   '21100000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------
-- 8. Suppliers (4)
--    suppliers.contact is the free-text phone-ish field (there is no
--    suppliers.phone column).
--
--    S1 'Bilal Trading Co' (contact 03001234567) — CUSTOMER<->SUPPLIER
--       collision with C1. Name differs from C1 on purpose: after the
--       0099 merge the contact must still read 'Bilal Traders'.
--    S2 'Karachi Wholesale' (contact 03111111111) — standalone.
--    S3 'Imran Hardware' (contact 'ask for Imran') — MESSY / non-phone
--       contact. 0099 must synthesize a placeholder phone (the NOT NULL
--       contacts.phone constraint cannot accept this as-is).
--    S4 'Lahore Imports' (contact 03111111111) — SUPPLIER<->SUPPLIER
--       collision with S2. Different business, same contact string —
--       0099 must NOT merge them; it needs a disambiguation rule.
-- ---------------------------------------------------------------------
INSERT INTO public.suppliers
  (id, shop_id, name, contact, address, notes, is_active, created_by_user_id)
VALUES
  -- S1: collides with customer C1
  ('21100000-0000-4000-8000-000000000401',
   '21100000-0000-4000-8000-000000000002',
   'Bilal Trading Co', '03001234567',
   'Warehouse 3, Badami Bagh, Lahore',
   'Supplies electronics',
   true,
   '21100000-0000-4000-8000-000000000001'),
  -- S2: standalone
  ('21100000-0000-4000-8000-000000000402',
   '21100000-0000-4000-8000-000000000002',
   'Karachi Wholesale', '03111111111',
   'Sector 7, Karachi', NULL, true,
   '21100000-0000-4000-8000-000000000001'),
  -- S3: messy / non-phone contact
  ('21100000-0000-4000-8000-000000000403',
   '21100000-0000-4000-8000-000000000002',
   'Imran Hardware', 'ask for Imran',
   NULL, 'No fixed number — visit the shop', true,
   '21100000-0000-4000-8000-000000000001'),
  -- S4: collides with supplier S2 (different business, same contact)
  ('21100000-0000-4000-8000-000000000404',
   '21100000-0000-4000-8000-000000000002',
   'Lahore Imports', '03111111111',
   'Brandreth Road, Lahore', NULL, true,
   '21100000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------
-- 9. Invoices (6): 5 reference customers, 1 walk-in (customer_id NULL).
--    cashier_id = seed owner. amount_paid set explicitly per payment_type
--    (cash -> = total, credit -> 0) to satisfy invoices_amount_paid_lte_total.
-- ---------------------------------------------------------------------
INSERT INTO public.invoices
  (id, shop_id, customer_id, total, amount_paid, payment_type, cashier_id)
VALUES
  ('21100000-0000-4000-8000-000000000501',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000301', 5000.00, 5000.00, 'cash',
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000502',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000301', 10000.00, 0.00, 'credit',
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000503',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000302', 3000.00, 3000.00, 'cash',
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000504',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000302', 2000.00, 2000.00, 'cash',
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000505',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000303', 1500.00, 1500.00, 'cash',
   '21100000-0000-4000-8000-000000000001'),
  -- walk-in: customer_id NULL — 0099 must leave contact_id NULL
  ('21100000-0000-4000-8000-000000000506',
   '21100000-0000-4000-8000-000000000002',
   NULL, 800.00, 800.00, 'cash',
   '21100000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------
-- 10. Ledger entries (5). Drive the cached customer balances:
--       C1: debit 10000 (inv 502) + debit 8000 + credit 3000 = 15000
--       C2: debit 500 + credit 500 = 0
--     Balances reconcile -> AQ-12 stays 0. credit rows carry invoice_id
--     NULL (ledger_entries_credit_no_invoice CHECK).
-- ---------------------------------------------------------------------
INSERT INTO public.ledger_entries
  (id, shop_id, customer_id, amount, type, invoice_id)
VALUES
  ('21100000-0000-4000-8000-000000000601',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000301', 10000.00, 'debit',
   '21100000-0000-4000-8000-000000000502'),
  ('21100000-0000-4000-8000-000000000602',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000301', 3000.00, 'credit', NULL),
  ('21100000-0000-4000-8000-000000000603',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000301', 8000.00, 'debit', NULL),
  ('21100000-0000-4000-8000-000000000604',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000302', 500.00, 'debit', NULL),
  ('21100000-0000-4000-8000-000000000605',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000302', 500.00, 'credit', NULL);

-- ---------------------------------------------------------------------
-- 11. Purchases (6): every supplier referenced at least once.
--       S1 x2, S2 x2, S3 x1, S4 x1. cashier_id = seed owner.
-- ---------------------------------------------------------------------
INSERT INTO public.purchases
  (id, shop_id, supplier_id, total_cost, cashier_id)
VALUES
  ('21100000-0000-4000-8000-000000000701',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000401', 20000.00,
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000702',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000401', 15000.00,
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000703',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000402', 30000.00,
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000704',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000402', 12000.00,
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000705',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000403', 5000.00,
   '21100000-0000-4000-8000-000000000001'),
  ('21100000-0000-4000-8000-000000000706',
   '21100000-0000-4000-8000-000000000002',
   '21100000-0000-4000-8000-000000000404', 8000.00,
   '21100000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------
-- 12. Inventory batches (2). batch1 -> variant1 + S1 (collision-merge
--     supplier); batch2 -> variant2 + S3 (messy-contact supplier) — so
--     the batch backfill is exercised against both a merged contact and
--     a placeholder-phone contact. Each batch satisfies
--     batch_must_have_expiry_or_warranty (warranty days OR expiry date).
-- ---------------------------------------------------------------------
INSERT INTO public.inventory_batches
  (id, variant_id, supplier_id, batch_no, qty_received, qty_remaining,
   cost_per_unit, supplier_warranty_days, expiry_date)
VALUES
  ('21100000-0000-4000-8000-000000000801',
   '21100000-0000-4000-8000-000000000201',
   '21100000-0000-4000-8000-000000000401',
   'SEED-B-001', 100, 80, 150.00, 365, NULL),
  ('21100000-0000-4000-8000-000000000802',
   '21100000-0000-4000-8000-000000000202',
   '21100000-0000-4000-8000-000000000403',
   'SEED-B-002', 50, 50, 200.00, NULL, DATE '2027-06-01');

-- ---------------------------------------------------------------------
-- 13. Verification — RAISE on any unexpected count or balance.
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_customers      int;
  v_suppliers      int;
  v_invoices       int;
  v_invoices_named int;
  v_ledger         int;
  v_purchases      int;
  v_batches        int;
  v_c1_balance     numeric;
  v_c2_balance     numeric;
BEGIN
  SELECT count(*) INTO v_customers FROM public.customers
    WHERE shop_id = '21100000-0000-4000-8000-000000000002';
  SELECT count(*) INTO v_suppliers FROM public.suppliers
    WHERE shop_id = '21100000-0000-4000-8000-000000000002';
  SELECT count(*) INTO v_invoices FROM public.invoices
    WHERE shop_id = '21100000-0000-4000-8000-000000000002';
  SELECT count(*) INTO v_invoices_named FROM public.invoices
    WHERE shop_id = '21100000-0000-4000-8000-000000000002'
      AND customer_id IS NOT NULL;
  SELECT count(*) INTO v_ledger FROM public.ledger_entries
    WHERE shop_id = '21100000-0000-4000-8000-000000000002';
  SELECT count(*) INTO v_purchases FROM public.purchases
    WHERE shop_id = '21100000-0000-4000-8000-000000000002';
  SELECT count(*) INTO v_batches FROM public.inventory_batches
    WHERE variant_id IN ('21100000-0000-4000-8000-000000000201',
                         '21100000-0000-4000-8000-000000000202');
  SELECT outstanding_balance INTO v_c1_balance FROM public.customers
    WHERE id = '21100000-0000-4000-8000-000000000301';
  SELECT outstanding_balance INTO v_c2_balance FROM public.customers
    WHERE id = '21100000-0000-4000-8000-000000000302';

  IF v_customers <> 3 THEN
    RAISE EXCEPTION 'seed: expected 3 customers, got %', v_customers;
  END IF;
  IF v_suppliers <> 4 THEN
    RAISE EXCEPTION 'seed: expected 4 suppliers, got %', v_suppliers;
  END IF;
  IF v_invoices <> 6 THEN
    RAISE EXCEPTION 'seed: expected 6 invoices, got %', v_invoices;
  END IF;
  IF v_invoices_named <> 5 THEN
    RAISE EXCEPTION 'seed: expected 5 customer-named invoices (1 walk-in), got %', v_invoices_named;
  END IF;
  IF v_ledger <> 5 THEN
    RAISE EXCEPTION 'seed: expected 5 ledger entries, got %', v_ledger;
  END IF;
  IF v_purchases <> 6 THEN
    RAISE EXCEPTION 'seed: expected 6 purchases, got %', v_purchases;
  END IF;
  IF v_batches <> 2 THEN
    RAISE EXCEPTION 'seed: expected 2 inventory batches, got %', v_batches;
  END IF;
  IF v_c1_balance <> 15000.00 THEN
    RAISE EXCEPTION 'seed: C1 balance expected 15000 (ledger-driven), got %', v_c1_balance;
  END IF;
  IF v_c2_balance <> 0.00 THEN
    RAISE EXCEPTION 'seed: C2 balance expected 0 (ledger-driven), got %', v_c2_balance;
  END IF;

  RAISE NOTICE 'v2.10 staging seed OK: 3 customers, 4 suppliers, 6 invoices (5 named + 1 walk-in), 5 ledger entries, 6 purchases, 2 batches. C1 balance 15000, C2 balance 0 (ledger-driven).';
  RAISE NOTICE 'Collision pairs ready for 0099: C1<->S1 (customer/supplier merge), S2<->S4 (supplier/supplier), S3 messy contact.';
END $verify$;

COMMIT;
