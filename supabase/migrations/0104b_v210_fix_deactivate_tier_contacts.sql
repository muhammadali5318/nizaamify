-- =====================================================================
-- 0104b_v210_fix_deactivate_tier_contacts
-- =====================================================================
-- v2.10 — corrective migration to 0104.
--
-- 0104's post-migration verification (check 6) caught deactivate_tier_v28
-- still doing `update public.customers set tier_id = ...` — F1 (signed
-- off at the 0103 design checkpoint) classified the 4 tier-side _v28
-- shims as "not contact-touching", and 0104's audit inherited that
-- classification instead of re-scanning. The defect: a classification
-- was trusted twice rather than verified once.
--
-- deactivate_tier_v28 IS contact-touching — when a customer tier is
-- deactivated it re-points everyone on that tier to the default tier,
-- and v2.9 did that by writing the customer table's tier_id. In v2.10
-- tier assignments live on contacts.customer_tier_id. Left unfixed:
-- post-0104 deactivate_tier wrote the frozen-dead customers table and
-- missed the real contacts rows; post-0106 (customers dropped) it would
-- be a hard runtime error. So 0104b is a HARD PREREQUISITE for 0106.
--
-- This migration:
--   §1  CREATE OR REPLACE deactivate_tier_v28 — the bulk re-point moves
--       from `update public.customers set tier_id` to `update
--       public.contacts set customer_tier_id`. SAME logic, right table.
--       Signature unchanged (uuid -> integer) so CREATE OR REPLACE is
--       valid; grants preserved (and moot — the shim is not granted to
--       authenticated, only its wrapper deactivate_tier is). Nothing
--       else in the body changes — current_shop_id() stays (a _v28 shim
--       is AQ-24-allowlisted; swapping it would be scope creep).
--   §2  verification block — confirms the rewrite + runs AQ-33.
--
-- Per-shim scan (shown evidence, not inherited assertion): the other 3
-- tier-side shims — define_tier_v28 / update_tier_v28 / set_default_tier_v28
-- — were read in full and touch ONLY customer_tiers (which v2.10 keeps);
-- zero references to customers / suppliers / contacts. F1 was right on 3
-- of 4, wrong on deactivate_tier_v28. Corroborated by the independent
-- broader scan post-0104 (every surviving fn/view referencing
-- public.customers/suppliers returned deactivate_tier_v28 and nothing
-- else). AQ-33 (added to the attack-surface doc, run by §2 here) makes
-- this a permanent guard so the class can never again be silently
-- mis-classified — and 0106 inherits it.
--
-- TRIGGER INTERACTION: the rewritten `update public.contacts set
-- customer_tier_id` fires v210_contacts_tier_change_gate
-- (check_contact_tier_change_gate — unconditional assign_contact_tier
-- requirement) and contacts_touch (sets updated_at); it does NOT fire
-- v210_contacts_promotion_audit_required (contact_type unchanged). This
-- is FAITHFUL to v2.9: v2.9's deactivate_tier_v28 did `update customers
-- set tier_id`, which fired v29_customers_tier_change_gate — and v2.9's
-- check_customer_tier_change_gate is byte-for-byte the same unconditional
-- shape (verified). v2.9's deactivate_tier was already transitively gated
-- on assign_customer_tier; the v2.10 gate is a faithful port, not
-- stricter. NO `DISABLE TRIGGER` bypass is added — that would change
-- behaviour (succeed for callers v2.9 blocked) and a corrective
-- migration corrects the defect, it does not smuggle in a behaviour
-- change. (Whether deactivate_tier's wrapper gate should ALSO require
-- assign_contact_tier — making the dependency explicit instead of
-- transitive-via-trigger — is a permission-model question routed to the
-- 0105 design agenda.)
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   audit finding: 0104 post-migration verification, check 6
--   design/2026-05-14-v210-contacts-attack-surface.md §6 (AQ-33)
--   design/2026-05-14-v210-contacts-model-design.md §4.3 (F1 correction)
-- =====================================================================

BEGIN;

-- =====================================================================
-- §1 — rewrite deactivate_tier_v28 onto contacts.customer_tier_id
-- =====================================================================
CREATE OR REPLACE FUNCTION public.deactivate_tier_v28(p_tier_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
declare
  v_shop_id uuid := public.current_shop_id();
  v_tier record;
  v_default_id uuid;
  v_reassigned int := 0;
begin
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;

  select id, is_default, is_active into v_tier
    from public.customer_tiers
   where id = p_tier_id and shop_id = v_shop_id;
  if not found then raise exception 'tier_not_in_shop'; end if;
  if not v_tier.is_active then return 0; end if;
  if v_tier.is_default then
    raise exception 'cannot_archive_default_tier'
      using hint = 'Set another tier as default first.';
  end if;

  select id into v_default_id
    from public.customer_tiers
   where shop_id = v_shop_id and is_default and is_active;

  -- v2.10 corrective (mig 0104b): re-point onto contacts.customer_tier_id,
  -- not the customers table (frozen post-0104, dropped at 0106). SAME bulk
  -- re-point logic, right table. customer_tier_id is only ever set on
  -- customer-touching contacts (the contacts CHECK enforces it), so the
  -- predicate needs no contact_type filter. This UPDATE fires
  -- v210_contacts_tier_change_gate exactly as the v2.9 customers UPDATE
  -- fired v29_customers_tier_change_gate — faithful behaviour, no bypass
  -- (see the migration header).
  update public.contacts
     set customer_tier_id = v_default_id,
         updated_at = now()
   where shop_id = v_shop_id and customer_tier_id = p_tier_id;
  get diagnostics v_reassigned = row_count;

  update public.customer_tiers
     set is_active = false, is_default = false, updated_at = now()
   where id = p_tier_id;

  return v_reassigned;
end;
$function$;

-- =====================================================================
-- §2 — verification block (confirms the rewrite + runs AQ-33).
-- Structural only; behavioural correctness (the bulk re-point + the
-- transitive assign_contact_tier gating) is Phase E synthetic SET ROLE
-- testing.
-- =====================================================================
DO $verify_0104b$
DECLARE
  v_dt_fixed      bigint;
  v_writes_legacy bigint;
BEGIN
  -- deactivate_tier_v28 rewritten: no longer writes public.customers,
  -- now re-points public.contacts.customer_tier_id
  SELECT count(*) INTO v_dt_fixed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='deactivate_tier_v28'
     AND pg_get_functiondef(p.oid) !~* 'public\.customers\M'
     AND pg_get_functiondef(p.oid) ~  'update public\.contacts'
     AND pg_get_functiondef(p.oid) ~  '\mcustomer_tier_id\M';
  IF v_dt_fixed <> 1 THEN
    RAISE EXCEPTION '0104b: deactivate_tier_v28 not rewritten onto contacts.customer_tier_id';
  END IF;

  -- AQ-33 (new standing guard, run here at apply time): no surviving
  -- function writes the legacy customers / suppliers tables. The public
  -- function/procedure set is filtered + MATERIALIZED *before*
  -- pg_get_functiondef runs: pg_get_functiondef errors on aggregate
  -- functions, and a plain `WHERE n.nspname='public' AND
  -- pg_get_functiondef(p.oid) ~* ...` lets the planner push
  -- pg_get_functiondef (a pg_proc-only filter) below the pg_namespace
  -- join, onto pg_catalog aggregates like array_agg. The MATERIALIZED
  -- CTE is an optimization fence — pg_get_functiondef only ever runs on
  -- the already-filtered (public, prokind in f/p) set. The \M word
  -- boundary keeps public.customer_tiers (legitimately written by the
  -- tier shims/wrappers) from being false-matched.
  WITH public_fns AS MATERIALIZED (
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
  )
  SELECT count(*) INTO v_writes_legacy FROM public_fns
   WHERE pg_get_functiondef(oid) ~* '(insert\s+into\s+|update\s+|delete\s+from\s+)public\.(customers|suppliers)\M';
  IF v_writes_legacy <> 0 THEN
    RAISE EXCEPTION '0104b: AQ-33 — % function(s) still write public.customers/suppliers', v_writes_legacy;
  END IF;

  RAISE NOTICE '0104b OK: deactivate_tier_v28 rewritten onto contacts.customer_tier_id (same bulk re-point logic, right table, no DISABLE TRIGGER bypass); AQ-33 promoted to a standing guard — 0 functions write the legacy customers/suppliers tables.';
END $verify_0104b$;

COMMIT;
