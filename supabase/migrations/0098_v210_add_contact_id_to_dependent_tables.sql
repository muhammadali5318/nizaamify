-- =====================================================================
-- 0098_v210_add_contact_id_to_dependent_tables
-- =====================================================================
-- v2.10 — third migration in the contacts unification chain.
--
-- Adds a NEW nullable `contact_id` column (FK -> public.contacts) to the
-- four tables that currently reference customers.id or suppliers.id:
--   invoices, ledger_entries, purchases, inventory_batches
--
-- This migration is ADDITIVE ONLY:
--   - no column renames
--   - no column drops
--   - no index changes
--   - the old customer_id / supplier_id columns + their FKs are left
--     fully intact and functional
--
-- The new contact_id columns are nullable and empty after this migration.
-- Migration 0099 backfills them by resolving each old customer_id /
-- supplier_id to its unified contact (including the supplier->'both'
-- merge case). Migrations 0104/0106 drop the legacy columns + FKs.
--
-- WHY A NEW COLUMN, NOT A RENAME:
--   The 0099 backfill creates `contacts` rows with fresh ids and merges
--   a supplier into an existing customer's contact row when their phone
--   collides (the migration-time form of the L3 promotion flow). The old
--   customer_id / supplier_id UUIDs therefore do NOT equal the resolved
--   contacts.id in the merge case, so an in-place RENAME is incorrect.
--   contact_id must be a distinct column, explicitly backfilled.
--
-- ON DELETE behavior is matched per-table to the legacy FK it shadows:
--   invoices / ledger_entries / inventory_batches -> NO ACTION (default)
--   purchases                                     -> RESTRICT
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   design/2026-05-14-v210-contacts-implementation-plan.md §1
--   design/2026-05-14-v210-contacts-model-design.md §2
--   (model-design §2 is being patched post-0098 to drop the inaccurate
--    RENAME framing; see the 0098 checkpoint report.)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. invoices.contact_id  (shadows customer_id; NO ACTION on delete)
-- ---------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN contact_id uuid;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id);

-- ---------------------------------------------------------------------
-- 2. ledger_entries.contact_id  (shadows customer_id; NO ACTION)
-- ---------------------------------------------------------------------
-- Stays nullable in this migration even though the legacy customer_id is
-- NOT NULL. 0099 backfills; 0100 swaps the NOT NULL constraint over to
-- contact_id once every row is populated.
ALTER TABLE public.ledger_entries
  ADD COLUMN contact_id uuid;

ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_entries_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id);

-- ---------------------------------------------------------------------
-- 3. purchases.contact_id  (shadows supplier_id; RESTRICT on delete)
-- ---------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN contact_id uuid;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id)
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- 4. inventory_batches.contact_id  (shadows supplier_id; NO ACTION)
-- ---------------------------------------------------------------------
ALTER TABLE public.inventory_batches
  ADD COLUMN contact_id uuid;

ALTER TABLE public.inventory_batches
  ADD CONSTRAINT inventory_batches_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id);

-- ---------------------------------------------------------------------
-- 5. Verification (RAISE on unexpected state)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_col_count int;
  v_fk_count  int;
BEGIN
  -- 4 new contact_id columns, all nullable
  SELECT count(*)
    INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('invoices','ledger_entries','purchases','inventory_batches')
      AND column_name = 'contact_id'
      AND is_nullable = 'YES';

  IF v_col_count <> 4 THEN
    RAISE EXCEPTION '0098 contact_id column count drift: expected 4 nullable, got %', v_col_count;
  END IF;

  -- 4 new FK constraints to public.contacts
  SELECT count(*)
    INTO v_fk_count
    FROM pg_constraint
    WHERE contype = 'f'
      AND conname IN (
        'invoices_contact_id_fkey',
        'ledger_entries_contact_id_fkey',
        'purchases_contact_id_fkey',
        'inventory_batches_contact_id_fkey'
      )
      AND confrelid = 'public.contacts'::regclass;

  IF v_fk_count <> 4 THEN
    RAISE EXCEPTION '0098 contact_id FK count drift: expected 4 -> contacts, got %', v_fk_count;
  END IF;

  RAISE NOTICE '0098 OK: contact_id added (nullable, FK -> contacts) on invoices, ledger_entries, purchases, inventory_batches. Legacy customer_id/supplier_id columns untouched.';
END $$;

COMMIT;
