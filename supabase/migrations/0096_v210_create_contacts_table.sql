-- =====================================================================
-- 0096_v210_create_contacts_table
-- =====================================================================
-- v2.10 — first migration in the contacts unification chain.
--
-- Creates the `contacts` table that unifies customers + suppliers.
-- A contact can have contact_type IN ('customer','supplier','both').
-- Phone is unique within a shop.
--
-- This migration is FOR STAGING ONLY at this point. Production is
-- untouched until v2.10 + v2.11 ship together.
--
-- Source of truth for schema decisions:
--   design/2026-05-14-v210-contacts-model-design.md §1
--   design/2026-05-14-v210-contacts-attack-surface.md §2.1
--
-- Locked decisions referenced:
--   B.0.4 — no credit_limit columns
--   B.1.1 — column list approved
--   B.1.2 — promotion audit NULL on direct creation
--   B.4   — RLS gates per "Strict, folded, owner-conservative" presets
--
-- AQs added by this migration:
--   (none yet — AQ-25..AQ-31 apply once dependent tables migrate too)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. contacts table
-- ---------------------------------------------------------------------
CREATE TABLE public.contacts (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                       uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,

  -- Identity
  name                          text NOT NULL,
  phone                         text NOT NULL,
  address                       text,
  notes                         text,

  -- Type
  contact_type                  text NOT NULL
                                  CHECK (contact_type IN ('customer','supplier','both')),

  -- Customer side
  customer_tier_id              uuid REFERENCES public.customer_tiers(id),
  customer_outstanding_balance  numeric(12,2) NOT NULL DEFAULT 0,

  -- Supplier side
  supplier_outstanding_balance  numeric(12,2) NOT NULL DEFAULT 0,

  -- Lifecycle
  is_active                     boolean NOT NULL DEFAULT true,

  -- Audit (v2.9.1 _by_user_id pattern; nullable to allow DEFINER fallbacks
  -- but writes always populate via auth.uid())
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  created_by_user_id            uuid,
  updated_by_user_id            uuid,
  promoted_to_both_at           timestamptz,
  promoted_to_both_by_user_id   uuid,

  -- Invariants

  -- L1: phone unique per shop
  CONSTRAINT contacts_phone_unique_per_shop UNIQUE (shop_id, phone),

  -- L6: customer_tier only meaningful for customer-touching contacts
  CONSTRAINT customer_tier_only_for_customers CHECK (
    customer_tier_id IS NULL OR contact_type IN ('customer','both')
  ),

  -- B.1.2: promotion audit fields must move together
  CONSTRAINT promotion_audit_paired CHECK (
    (promoted_to_both_at IS NULL    AND promoted_to_both_by_user_id IS NULL)
    OR
    (promoted_to_both_at IS NOT NULL AND promoted_to_both_by_user_id IS NOT NULL)
  )
);

-- ---------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------

-- Type filter chip on /contacts; partial on is_active matches default chip state
CREATE INDEX idx_contacts_shop_type
  ON public.contacts (shop_id, contact_type)
  WHERE is_active;

-- /khata customer-side toggle
CREATE INDEX idx_contacts_shop_outstanding_customer
  ON public.contacts (shop_id)
  WHERE customer_outstanding_balance > 0 AND is_active;

-- /khata supplier-side toggle
CREATE INDEX idx_contacts_shop_outstanding_supplier
  ON public.contacts (shop_id)
  WHERE supplier_outstanding_balance > 0 AND is_active;

-- ---------------------------------------------------------------------
-- 3. touch_updated_at trigger
-- ---------------------------------------------------------------------
CREATE TRIGGER contacts_touch
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS — table enabled in this migration per ADR-0005
-- ---------------------------------------------------------------------
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone with view_contacts in their active shop
CREATE POLICY v210_contacts_read ON public.contacts
  FOR SELECT
  USING (
    shop_id = (SELECT public.current_active_shop_id())
    AND (SELECT public.user_has_permission(shop_id, 'view_contacts'))
  );

-- INSERT: gated at RLS for permission holders (matches v29 supplier write
-- pattern; DEFINER RPCs bypass via SECURITY DEFINER context)
CREATE POLICY v210_contacts_write ON public.contacts
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT public.current_active_shop_id())
    AND (
      (SELECT public.user_has_permission(shop_id, 'create_contact_basic'))
      OR (SELECT public.user_has_permission(shop_id, 'create_contact_full'))
    )
  );

-- UPDATE: edit_contact (promote_contact RPC has separate SECURITY DEFINER context)
CREATE POLICY v210_contacts_update ON public.contacts
  FOR UPDATE
  USING (
    shop_id = (SELECT public.current_active_shop_id())
    AND (SELECT public.user_has_permission(shop_id, 'edit_contact'))
  )
  WITH CHECK (
    shop_id = (SELECT public.current_active_shop_id())
    AND (SELECT public.user_has_permission(shop_id, 'edit_contact'))
  );

-- No DELETE policy: contacts are soft-deleted via archive_contact RPC

-- ---------------------------------------------------------------------
-- 5. Column-grant pattern (v2.9.2 carryover)
-- ---------------------------------------------------------------------
-- Cost-bearing columns (customer_outstanding_balance, supplier_outstanding_balance)
-- excluded from authenticated SELECT. Reads must go through contacts_view
-- which applies conditional projection per permissions.
--
-- v2.9.2 rule applies: any future column added to public.contacts MUST be
-- explicitly added to the GRANT SELECT list below, or it will be invisible
-- to the application.

REVOKE SELECT ON TABLE public.contacts FROM authenticated;
REVOKE SELECT ON TABLE public.contacts FROM anon;

GRANT SELECT (
  id, shop_id, name, phone, address, notes, contact_type,
  customer_tier_id,
  is_active, created_at, updated_at,
  created_by_user_id, updated_by_user_id,
  promoted_to_both_at, promoted_to_both_by_user_id
) ON public.contacts TO authenticated;

-- INSERT and UPDATE grants (all columns) — RLS WITH CHECK enforces permissions
GRANT INSERT, UPDATE ON public.contacts TO authenticated;

-- service_role retains full access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO service_role;

-- ---------------------------------------------------------------------
-- 6. Verification (RAISE on unexpected state)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_col_count int;
BEGIN
  SELECT count(*)
    INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts';

  -- Expected: 16 columns (id, shop_id, name, phone, address, notes,
  -- contact_type, customer_tier_id, customer_outstanding_balance,
  -- supplier_outstanding_balance, is_active, created_at, updated_at,
  -- created_by_user_id, updated_by_user_id, promoted_to_both_at,
  -- promoted_to_both_by_user_id) = 17 actually
  IF v_col_count <> 17 THEN
    RAISE EXCEPTION 'contacts table column count drift: expected 17, got %', v_col_count;
  END IF;

  RAISE NOTICE 'contacts table created: 17 columns, 3 partial indexes, RLS enabled, column-grant applied';
END $$;

COMMIT;
