-- =====================================================================
-- 0102b_v210_revoke_anon_from_contact_views
-- =====================================================================
-- v2.10 — corrective migration to 0102's grant discipline.
--
-- 0102 created contacts_view + contact_balance_reconciliation and did
-- GRANT SELECT ... TO authenticated / service_role, but never REVOKEd
-- the Supabase auto-grant from anon (and, on the audit view,
-- authenticated). That violates ADR-0015 ("revoke from public + anon;
-- grant to authenticated") and the CLAUDE.md gotcha that `revoke from
-- public` alone is a no-op for the named anon/authenticated roles.
--
-- Not a functional leak — contacts_view is DEFINER and every caller_perms
-- check returns false for anon (no auth.uid()) so anon gets zero rows;
-- contact_balance_reconciliation is INVOKER and anon has no SELECT on the
-- contacts table at all (0096 revoked it) so anon gets permission-denied.
-- But defense-in-depth means the grant should not be there.
--
-- This migration:
--   - contacts_view: REVOKE SELECT FROM public, anon
--     (keeps the explicit authenticated grant from 0102)
--   - contact_balance_reconciliation: REVOKE SELECT FROM public, anon,
--     authenticated — it ends service_role-only, as intended for an
--     audit-internal view (the AQ suite reads it as postgres)
--
-- The legacy customer_balance_reconciliation carries the same anon grant
-- but is NOT touched here — it (and the customers table it reads) are
-- dropped in 0104, so fixing its grant now is churn 0104 erases. AQ-32
-- explicitly allowlists it; see docs/todos.md.
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   decisions/0015-v18-database-hardening.md (ADR-0015 grant pattern)
--   design/2026-05-14-v210-contacts-attack-surface.md §6 (AQ-32)
-- =====================================================================

BEGIN;

REVOKE SELECT ON public.contacts_view                  FROM public, anon;
REVOKE SELECT ON public.contact_balance_reconciliation FROM public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Verification — assert anon is gone and the intended grants remain.
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_cv_anon  bigint;
  v_cv_auth  bigint;
  v_cbr_open bigint;
  v_cbr_sr   bigint;
BEGIN
  -- contacts_view: no anon/public SELECT; authenticated retained
  SELECT count(*) INTO v_cv_anon FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='contacts_view'
     AND privilege_type='SELECT' AND lower(grantee) IN ('anon','public');
  IF v_cv_anon > 0 THEN
    RAISE EXCEPTION '0102b: contacts_view still has an anon/public SELECT grant';
  END IF;

  SELECT count(*) INTO v_cv_auth FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='contacts_view'
     AND privilege_type='SELECT' AND grantee='authenticated';
  IF v_cv_auth <> 1 THEN
    RAISE EXCEPTION '0102b: contacts_view lost its authenticated SELECT grant';
  END IF;

  -- contact_balance_reconciliation: no anon/public/authenticated SELECT;
  -- service_role retained
  SELECT count(*) INTO v_cbr_open FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='contact_balance_reconciliation'
     AND privilege_type='SELECT' AND lower(grantee) IN ('anon','public','authenticated');
  IF v_cbr_open > 0 THEN
    RAISE EXCEPTION '0102b: contact_balance_reconciliation still has an anon/public/authenticated SELECT grant';
  END IF;

  SELECT count(*) INTO v_cbr_sr FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='contact_balance_reconciliation'
     AND privilege_type='SELECT' AND grantee='service_role';
  IF v_cbr_sr <> 1 THEN
    RAISE EXCEPTION '0102b: contact_balance_reconciliation lost its service_role SELECT grant';
  END IF;

  RAISE NOTICE '0102b OK: contacts_view = authenticated-only SELECT; contact_balance_reconciliation = service_role-only SELECT; anon/public revoked from both.';
END $verify$;

COMMIT;
