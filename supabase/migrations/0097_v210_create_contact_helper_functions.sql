-- =====================================================================
-- 0097_v210_create_contact_helper_functions
-- =====================================================================
-- v2.10 — second migration in the contacts unification chain.
--
-- Creates the helper + trigger functions that later migrations and the
-- contacts table's own integrity rely on, and wires the two remaining
-- triggers on `contacts` (the touch trigger was created in 0096).
--
-- Functions:
--   is_contact_customer(uuid)            — convenience predicate
--   is_contact_supplier(uuid)            — convenience predicate
--   check_contact_tier_change_gate()     — trigger fn, ported from
--                                          check_customer_tier_change_gate
--   enforce_promotion_audit_populated()  — trigger fn, blocks bare
--                                          contact_type -> 'both' flips
--                                          that skip the promote_contact RPC
--
-- Triggers wired on public.contacts:
--   v210_contacts_tier_change_gate
--   v210_contacts_promotion_audit_required
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   design/2026-05-14-v210-contacts-model-design.md §1.2, §5
--
-- Locked decisions referenced:
--   B.1.2 — promotion audit fields stay NULL on DIRECT creation with
--           'both'; only the promote_contact RPC (an UPDATE path) writes
--           them. enforce_promotion_audit_populated is BEFORE UPDATE only,
--           so direct INSERT with contact_type='both' is intentionally
--           NOT gated here.
--   L6   — customer_tier only meaningful for customer-touching contacts;
--          the CHECK constraint customer_tier_only_for_customers already
--          enforces the structural rule, this trigger only gates the
--          permission to change it.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. is_contact_customer(uuid) — convenience predicate
-- ---------------------------------------------------------------------
-- DEFINER so internal DEFINER RPCs (record_sale validation etc.) can call
-- it regardless of caller RLS context. Internal-only: EXECUTE revoked from
-- public/anon/authenticated. Returns NULL if the contact id does not exist.
CREATE OR REPLACE FUNCTION public.is_contact_customer(p_contact_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT contact_type IN ('customer', 'both')
    FROM public.contacts
   WHERE id = p_contact_id;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_contact_customer(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_contact_customer(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 2. is_contact_supplier(uuid) — convenience predicate
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_contact_supplier(p_contact_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT contact_type IN ('supplier', 'both')
    FROM public.contacts
   WHERE id = p_contact_id;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_contact_supplier(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_contact_supplier(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 3. check_contact_tier_change_gate() — trigger fn
-- ---------------------------------------------------------------------
-- Ported faithfully from check_customer_tier_change_gate (v2.9). Two
-- changes only: column tier_id -> customer_tier_id, permission
-- assign_customer_tier -> assign_contact_tier. The internal
-- IS DISTINCT FROM guard is kept (matches the original) so the function
-- is correct even if re-wired without a WHEN clause.
CREATE OR REPLACE FUNCTION public.check_contact_tier_change_gate()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if OLD.customer_tier_id is distinct from NEW.customer_tier_id then
    if not public.user_has_permission(NEW.shop_id, 'assign_contact_tier') then
      raise exception 'insufficient_permissions'
        using errcode = 'P0001',
              detail = 'customer_tier_id change requires assign_contact_tier permission';
    end if;
  end if;
  return NEW;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_contact_tier_change_gate() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_contact_tier_change_gate() TO service_role;

-- ---------------------------------------------------------------------
-- 4. enforce_promotion_audit_populated() — trigger fn
-- ---------------------------------------------------------------------
-- Blocks any UPDATE that flips contact_type from a single role to 'both'
-- unless the promotion audit fields are populated. The promote_contact
-- RPC (migration 0102) sets promoted_to_both_at + promoted_to_both_by_user_id
-- in the same UPDATE, so it passes; a bare UPDATE that skips the RPC is
-- rejected.
--
-- The trigger's WHEN clause already scopes this to single-role -> 'both'
-- flips, so by the time the body runs the flip is confirmed. The
-- promotion_audit_paired CHECK constraint guarantees the two audit fields
-- move together; checking either one is sufficient, both are checked for
-- clarity. INSERT with contact_type='both' is intentionally not covered
-- (BEFORE UPDATE only) per locked decision B.1.2.
CREATE OR REPLACE FUNCTION public.enforce_promotion_audit_populated()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if NEW.promoted_to_both_at is null
     or NEW.promoted_to_both_by_user_id is null then
    raise exception 'promotion_audit_required'
      using errcode = 'P0001',
            detail = 'flipping contact_type to ''both'' must go through the '
                  || 'promote_contact RPC so the promotion audit fields are populated';
  end if;
  return NEW;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_promotion_audit_populated() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enforce_promotion_audit_populated() TO service_role;

-- ---------------------------------------------------------------------
-- 5. Triggers on public.contacts
-- ---------------------------------------------------------------------

-- Tier-change permission gate. WHEN clause skips the function call
-- entirely when customer_tier_id is unchanged.
CREATE TRIGGER v210_contacts_tier_change_gate
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  WHEN (OLD.customer_tier_id IS DISTINCT FROM NEW.customer_tier_id)
  EXECUTE FUNCTION public.check_contact_tier_change_gate();

-- Promotion audit guard. WHEN clause scopes to single-role -> 'both' flips.
CREATE TRIGGER v210_contacts_promotion_audit_required
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  WHEN (OLD.contact_type <> 'both' AND NEW.contact_type = 'both')
  EXECUTE FUNCTION public.enforce_promotion_audit_populated();

-- ---------------------------------------------------------------------
-- 6. Verification (RAISE on unexpected state)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_fn_count  int;
  v_trg_count int;
BEGIN
  SELECT count(*)
    INTO v_fn_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'is_contact_customer', 'is_contact_supplier',
        'check_contact_tier_change_gate', 'enforce_promotion_audit_populated'
      );

  IF v_fn_count <> 4 THEN
    RAISE EXCEPTION '0097 helper function count drift: expected 4, got %', v_fn_count;
  END IF;

  SELECT count(*)
    INTO v_trg_count
    FROM pg_trigger
    WHERE tgrelid = 'public.contacts'::regclass
      AND NOT tgisinternal
      AND tgname IN (
        'v210_contacts_tier_change_gate',
        'v210_contacts_promotion_audit_required'
      );

  IF v_trg_count <> 2 THEN
    RAISE EXCEPTION '0097 contacts trigger count drift: expected 2, got %', v_trg_count;
  END IF;

  RAISE NOTICE '0097 OK: 4 helper/trigger functions created, 2 triggers wired on public.contacts';
END $$;

COMMIT;
