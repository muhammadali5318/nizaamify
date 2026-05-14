-- =====================================================================
-- 2026-05-14-v210-staging-collision-fix.sql
-- =====================================================================
-- v2.10 STAGING DATA-FIX — *not* a migration, not part of the migration
-- chain. Apply via execute_sql.
--
-- PURPOSE
--   Resolves the deliberate supplier<->supplier phone collision built
--   into the staging seed fixture: S2 "Karachi Wholesale" and S4
--   "Lahore Imports" both carry contact 03111111111. Migration 0099's
--   pre-flight hard-fails on this (two different businesses, one phone —
--   unresolvable). Re-pointing S4 to a distinct phone clears the
--   pre-flight so 0099 can complete.
--
--   This is the staging equivalent of — and the TEMPLATE for — the
--   cleanup a production owner performs at deploy time for the real
--   ALi / best-on collision (both suppliers on 03121212123 in the
--   production project). Same shape, different ids.
--
-- SEQUENCING
--   Run AFTER migration 0099's first apply hard-fails at the pre-flight,
--   and BEFORE re-applying 0099. See the 0099 checkpoint plan in
--   design/2026-05-14-v210-contacts-implementation-plan.md.
--
-- IDEMPOTENT: re-running sets the same corrected value; harmless.
-- =====================================================================

BEGIN;

-- Re-point S4 "Lahore Imports" to a distinct corrected phone. S2 keeps
-- 03111111111; S4 moves to 03111111112. (public.suppliers carries only
-- a touch trigger — no immutable block — so a plain UPDATE is fine.)
UPDATE public.suppliers
   SET contact = '03111111112'
 WHERE id = '21100000-0000-4000-8000-000000000404';

DO $verify$
DECLARE
  v_s4_contact text;
  v_collisions int;
BEGIN
  SELECT contact INTO v_s4_contact
    FROM public.suppliers
   WHERE id = '21100000-0000-4000-8000-000000000404';

  IF v_s4_contact IS DISTINCT FROM '03111111112' THEN
    RAISE EXCEPTION 'collision-fix: S4 contact expected 03111111112, got %', v_s4_contact;
  END IF;

  -- confirm no shop has >1 supplier on the same usable-phone contact
  -- (the exact condition 0099's pre-flight checks for the supplier side)
  SELECT count(*) INTO v_collisions
  FROM (
    SELECT shop_id, trim(contact)
      FROM public.suppliers
     WHERE contact IS NOT NULL AND trim(contact) ~ '^[0-9+][0-9 +-]*$'
     GROUP BY shop_id, trim(contact)
    HAVING count(*) > 1
  ) x;

  IF v_collisions > 0 THEN
    RAISE EXCEPTION 'collision-fix: % supplier<->supplier phone collision(s) still present', v_collisions;
  END IF;

  RAISE NOTICE 'collision-fix OK: S4 re-pointed to 03111111112; no supplier<->supplier phone collisions remain.';
END $verify$;

COMMIT;
