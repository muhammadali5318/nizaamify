-- =====================================================================
-- 0105_v210_permission_catalog_redesign
-- =====================================================================
-- v2.10 — tenth migration in the contacts unification chain.
--
-- Redesigns permissions_catalog for the contacts model: inserts the 12
-- new keys, migrates non-owner user_shop_permissions rows (Policy 2
-- intersect), retires the 11 legacy customer/supplier keys, and rebinds
-- everything that still pointed at a retired key.
--
-- Design package (reviewed + signed off 2026-05-14):
--   design/2026-05-14-v210-0105-decisions.md      (Part 1 — judgment calls)
--   design/2026-05-14-v210-0105-row-migration.md  (Part 2 — mechanical)
--
-- FOUR RULINGS LOCKED FOR 0105 (D1/D2/FA at the design checkpoint;
-- P3 added at file review, where it surfaced as an unstated policy):
--   D1 = B  reverse_ledger_entry is KEPT as a base gate (not retired).
--           §5 rewrites the function to check it BEFORE the entry fetch;
--           §2 rebinds its requires onto view_contacts.
--   D2 = C  the deactivate_tier dependency on assign_contact_tier is
--           carried by manage_contact_tiers.requires (§1), NOT by an
--           explicit wrapper gate. §3 gives the 4 tier wrappers only the
--           mechanical manage_customer_tiers -> manage_contact_tiers swap.
--   FA = a  receive_payment.requires becomes [view_contacts] (NOT
--           [view_contacts, view_contact_customer_data] as attack-surface
--           §1.2 drafted — that value is incoherent with the locked
--           salesperson preset; see Part 1 Finding A).
--   P3 = B  the 3 net-new keys (view_contact_net_position,
--           promote_contact, pay_supplier — no v2.9 analog) migrate to a
--           FALSE literal for every existing non-owner (§6). The B.4
--           preset default seeds NEW invitations only; a migration
--           preserves what was demonstrably held, it never grants.
--
-- TWO SCOPE CORRECTIONS over implementation-plan §1.0 (see Part 2 §0):
--   C1  Staging has 0 user_shop_permissions rows (one owner seed; owners
--       hold no permission rows). The "24 rows" live on production. §6 is
--       a no-op over an empty set on staging; the §8 verification DERIVES
--       expected counts per access from a pre-migration snapshot
--       (pre_count AND in-scope legacy-key count) — it never hard-codes
--       "24" and never assumes a dense row-per-key shape.
--   C2  v29_ledger_read on the LIVE ledger_entries table gates on
--       view_customer_khata, a key this migration drops. attack-surface
--       §2.2 specified v210_ledger_read but assigned it no migration
--       number and 0096-0104b never built it. §4 carries the swap — it
--       MUST run before §7 drops view_customer_khata.
--   (Plus: record_purchase.requires carries a dangling view_suppliers —
--    rebound in §2. The customers/suppliers RLS policies + the
--    check_customer_tier_change_gate trigger fn keep their dangling key
--    refs — INERT: those objects are frozen-dead post-0104 and dropped at
--    0106. Part 2 §6.)
--
-- Ordering inside the single transaction is load-bearing — consumers
-- deployed since 0096 (contacts RLS, contacts_view, total_outstanding,
-- total_payable, the 0102/0103 RPCs) reference the new keys, and nothing
-- may reference a key being dropped:
--   §0 precondition + pre-migration snapshot
--   §1 INSERT 12 new keys           (activates the already-deployed consumers)
--   §2 rebind 3 dangling requires arrays
--   §3 CREATE OR REPLACE 4 tier wrappers   (key-string swap only)
--   §4 swap v29_ledger_read -> v210_ledger_read
--   §5 CREATE OR REPLACE reverse_ledger_entry  (add the base gate)
--   §6 migrate user_shop_permissions  (INSERT new, DELETE old)
--   §7 DROP the 11 retired keys
--   §8 verification — RAISE EXCEPTION on any mismatch
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
-- Per implementation-plan §0: 0105 is its own authorization checkpoint —
-- committed to git before apply; AQ-01..AQ-33 re-run after apply; halt
-- checkpoint §1.3.3 (catalog row counts) before 0106 is proposed.
--
-- Source of truth:
--   design/2026-05-14-v210-0105-decisions.md
--   design/2026-05-14-v210-0105-row-migration.md
--   design/2026-05-14-v210-contacts-attack-surface.md §1, §2.2
-- =====================================================================

BEGIN;

-- =====================================================================
-- §0 — precondition + pre-migration snapshot
-- =====================================================================
-- The snapshot drives the §8 row-count check (correction C1: never
-- hard-code "24", never assume a dense row-per-key shape). Per access it
-- captures BOTH the total pre-count AND how many of the 11 in-scope
-- legacy keys it actually holds as rows — because §6's DELETE removes
-- exactly that many (the IN-list matches whatever subset exists) and §6's
-- INSERT always adds exactly 12, so check 4 derives
--   expected_post = pre_count - legacy_in_scope_count + 12
-- which is correct whether user_shop_permissions is dense (the verified
-- production shape — both non-owner accesses hold all 11 in-scope rows)
-- or sparse. ON COMMIT DROP — alive for the rest of this txn, gone at
-- COMMIT. Empty on staging.
CREATE TEMP TABLE _0105_pre_counts ON COMMIT DROP AS
  SELECT
    user_shop_access_id,
    count(*)::bigint AS pre_count,
    count(*) FILTER (WHERE permission_key IN (
      'view_customers','view_customer_contact','view_customer_outstanding','view_customer_khata',
      'create_customer_basic','create_customer_full','edit_customer','assign_customer_tier',
      'manage_customer_tiers','view_suppliers','manage_suppliers'))::bigint AS legacy_in_scope_count
  FROM public.user_shop_permissions
  GROUP BY user_shop_access_id;

DO $precheck_0105$
DECLARE
  v_bad_source bigint;
BEGIN
  -- Precondition — every in-scope legacy row is source=preset. §6's
  -- Policy 2 fold/intersect/union logic maps preset-era grants
  -- deterministically; an override row would need an explicit human
  -- decision, so halt rather than guess.
  --
  -- (An earlier draft also carried a "Precondition A" asserting
  -- preset_applied IN (manager, salesperson). It existed solely to guard
  -- a preset-default CASE on the net-new keys in §6. Ruling P3 = B
  -- removed that CASE — net-new keys migrate to a false literal, so §6
  -- never reads preset_applied. Precondition A had no consumer left and
  -- was dropped rather than kept as a stale assertion.)
  SELECT count(*) INTO v_bad_source
  FROM public.user_shop_permissions
  WHERE permission_key IN (
    'view_customers','view_customer_contact','view_customer_outstanding','view_customer_khata',
    'create_customer_basic','create_customer_full','edit_customer','assign_customer_tier',
    'manage_customer_tiers','view_suppliers','manage_suppliers')
    AND source <> 'preset';
  IF v_bad_source <> 0 THEN
    RAISE EXCEPTION '0105 precondition: % in-scope legacy permission row(s) are not source=preset', v_bad_source;
  END IF;

  RAISE NOTICE '0105 precondition OK (% access row(s) pre-counted)',
    (SELECT count(*) FROM _0105_pre_counts);
END $precheck_0105$;

-- =====================================================================
-- §1 — INSERT the 12 new keys (attack-surface §1.2, B.4 "strict, folded,
--      owner-conservative"). Inserting these activates every consumer
--      already deployed by 0096/0102/0104 that gates on them.
-- =====================================================================
-- display_order: the 11 contacts keys take the 30-40 band the retired
-- customers/suppliers keys vacate; pay_supplier slots at the end of the
-- financial band (58) to avoid renumbering the existing financial rows.
-- manage_contact_tiers.requires = [assign_contact_tier] per ruling D2=C.
INSERT INTO public.permissions_catalog
  (key, name, description, category, display_order,
   preset_owner_default, preset_manager_default, preset_salesperson_default,
   requires, is_active)
VALUES
  ('view_contacts', 'View contacts',
   'See the contacts list and contact records.', 'contacts', 30,
   true,  true,  true,  '{}'::text[], true),

  ('view_contact_contact_info', 'View contact info',
   'See a contact''s phone and address.', 'contacts', 31,
   true,  true,  true,  array['view_contacts']::text[], true),

  ('view_contact_customer_data', 'View customer-side data',
   'See a contact''s customer outstanding balance and receivable khata.', 'contacts', 32,
   true,  true,  false, array['view_contacts']::text[], true),

  ('view_contact_supplier_data', 'View supplier-side data',
   'See a contact''s supplier outstanding balance and payable ledger.', 'contacts', 33,
   true,  false, false, array['view_contacts']::text[], true),

  ('view_contact_net_position', 'View contact net position',
   'See the net of customer and supplier balances on a both-type contact.', 'contacts', 34,
   true,  false, false,
   array['view_contact_customer_data','view_contact_supplier_data']::text[], true),

  ('create_contact_basic', 'Create contact (basic)',
   'Create a contact with name, phone, and type.', 'contacts', 35,
   true,  true,  true,  array['view_contacts']::text[], true),

  ('create_contact_full', 'Create contact (full)',
   'Create a contact including address, notes, and tier.', 'contacts', 36,
   true,  true,  false,
   array['create_contact_basic','view_contact_contact_info']::text[], true),

  ('edit_contact', 'Edit contact',
   'Edit a contact''s details and archive a contact.', 'contacts', 37,
   true,  true,  false,
   array['view_contacts','view_contact_contact_info']::text[], true),

  ('promote_contact', 'Promote contact',
   'Promote a single-role contact to customer+supplier.', 'contacts', 38,
   true,  false, false,
   array['view_contacts','view_contact_contact_info']::text[], true),

  ('assign_contact_tier', 'Assign contact tier',
   'Change a contact''s customer tier.', 'contacts', 39,
   true,  true,  false, array['view_contacts']::text[], true),

  -- D2 = C: the deactivate_tier -> assign_contact_tier dependency rides
  -- here (catalog-declared, grant-time-enforced), not on a wrapper gate.
  ('manage_contact_tiers', 'Manage contact tiers',
   'Create / edit / deactivate tier definitions (shop-wide).', 'contacts', 40,
   true,  false, false, array['assign_contact_tier']::text[], true),

  ('pay_supplier', 'Pay supplier',
   'Record a payment against a supplier''s payable balance.', 'financial', 58,
   true,  true,  false,
   array['view_contacts','view_contact_supplier_data']::text[], true);

-- =====================================================================
-- §2 — rebind the 3 surviving keys whose requires array still points at
--      a retired key. (requires is text[], not FK-enforced, so a §7 DROP
--      would leave these dangling silently — Part 2 §0 / §1.)
-- =====================================================================
-- receive_payment — FA = a. v2.9 required [view_customers,
-- view_customer_outstanding]; view_customer_outstanding folds (lossily)
-- into the broader view_contact_customer_data, which the salesperson
-- preset withholds. Binding receive_payment to it would make the locked
-- salesperson preset self-contradictory (S holds receive_payment ✓ but
-- not its requirement). [view_contacts] keeps the catalog coherent and
-- is faithful-or-looser; balance VISIBILITY stays a view-projection
-- concern, not a call-gate one.
UPDATE public.permissions_catalog
   SET requires = array['view_contacts']::text[]
 WHERE key = 'receive_payment';

-- reverse_ledger_entry — D1 = B. v2.9 required [view_customer_khata]
-- (dropped). Reversal spans both directions, so a customer-side key
-- would be wrong; [view_contacts] is the minimal coherent base. The
-- direction-split sub-gate (§5) still pulls in receive_payment /
-- pay_supplier per the reversed entry's direction.
UPDATE public.permissions_catalog
   SET requires = array['view_contacts']::text[]
 WHERE key = 'reverse_ledger_entry';

-- record_purchase — surfaced by the live scan: requires carried
-- view_suppliers. 1:1 successor per attack-surface §1.3. Mechanical.
UPDATE public.permissions_catalog
   SET requires = array_replace(requires, 'view_suppliers', 'view_contact_supplier_data')
 WHERE key = 'record_purchase';

-- =====================================================================
-- §3 — CREATE OR REPLACE the 4 surviving tier wrappers: the ONLY change
--      is the permission-key string manage_customer_tiers ->
--      manage_contact_tiers (D2 = C — no explicit assign_contact_tier
--      gate is added; that dependency rides on the catalog requires set
--      in §1). Bodies are otherwise byte-faithful to their live (0080)
--      definitions. The _v28 inner shims are NOT touched — they carry no
--      permission check; the wrapper owns the gate.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.deactivate_tier(p_tier_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_shop_id uuid := public.current_active_shop_id(); v_int int;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_contact_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_contact_tiers'; end if;
  v_int := public.deactivate_tier_v28(p_tier_id);
  update public.customer_tiers set updated_by_user_id = auth.uid() where id = p_tier_id;
  return v_int;
end; $function$;

CREATE OR REPLACE FUNCTION public.define_tier(p_name text, p_is_default boolean DEFAULT false, p_notes text DEFAULT NULL::text)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_shop_id uuid := public.current_active_shop_id(); v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_contact_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_contact_tiers'; end if;
  v_id := public.define_tier_v28(p_name, p_is_default, p_notes);
  update public.customer_tiers set created_by_user_id = auth.uid(), updated_by_user_id = auth.uid() where id = v_id;
  return v_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.set_default_tier(p_tier_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_contact_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_contact_tiers'; end if;
  perform public.set_default_tier_v28(p_tier_id);
  update public.customer_tiers set updated_by_user_id = auth.uid() where id = p_tier_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.update_tier(p_tier_id uuid, p_name text, p_is_default boolean, p_notes text DEFAULT NULL::text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'manage_contact_tiers') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: manage_contact_tiers'; end if;
  perform public.update_tier_v28(p_tier_id, p_name, p_is_default, p_notes);
  update public.customer_tiers set updated_by_user_id = auth.uid() where id = p_tier_id;
end; $function$;

-- =====================================================================
-- §4 — swap the ledger RLS policy (correction C2). v29_ledger_read on the
--      LIVE ledger_entries table gates on view_customer_khata (dropped in
--      §7). v210_ledger_read is direction-aware per attack-surface §2.2 —
--      it gates the customer side on view_contact_customer_data and the
--      supplier side on view_contact_supplier_data (both inserted in §1).
--      The per-side asymmetry is intended (L7): a holder of only one side
--      sees only that side's ledger rows.
-- =====================================================================
DROP POLICY v29_ledger_read ON public.ledger_entries;

CREATE POLICY v210_ledger_read ON public.ledger_entries
  FOR SELECT
  USING (
    shop_id = (SELECT current_active_shop_id())
    AND (
      (direction = 'receivable'
        AND (SELECT user_has_permission(shop_id, 'view_contact_customer_data')))
      OR
      (direction = 'payable'
        AND (SELECT user_has_permission(shop_id, 'view_contact_supplier_data')))
    )
  );

-- =====================================================================
-- §5 — CREATE OR REPLACE reverse_ledger_entry (D1 = B). Body is faithful
--      to the 0103 definition; the ONLY change is the new P3a base gate
--      inserted BEFORE the entry fetch. Rationale: the v2.9
--      reverse_ledger_entry key is kept as a base gate so (a) salespeople
--      — who hold receive_payment by preset — cannot reverse receivable
--      entries (a capability the dedicated v2.9 key never granted them),
--      and (b) entry_not_in_shop no longer discloses shop membership to a
--      caller holding neither payment permission (authz-before-fetch
--      restored). The C2 direction-split stays as the second gate (P3b).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.reverse_ledger_entry(
  p_entry_id uuid, p_notes text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id          uuid := public.current_active_shop_id();
  v_orig             record;
  v_already_reversed uuid;
  v_new_type         text;
  v_new_id           uuid;
begin
  -- P1/P2.
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;

  -- P3a — base gate (mig 0105, D1 = B). Checked BEFORE the entry fetch:
  -- restores authz-before-fetch ordering (entry_not_in_shop no longer
  -- leaks to a caller without this key) and keeps the v2.9 withhold of
  -- ledger reversal from salespeople intact even though they now hold
  -- receive_payment. The C2 direction-split below (P3b) still applies.
  if not public.user_has_permission(v_shop_id, 'reverse_ledger_entry') then
    raise exception 'insufficient_permissions' using errcode = 'P0001',
      detail = 'Required: reverse_ledger_entry';
  end if;

  -- Fetch + lock the original. Precedes P3b: C2 splits the second gate by
  -- the entry's direction, unknown until the row is read.
  select * into v_orig
    from public.ledger_entries
   where id = p_entry_id and shop_id = v_shop_id
   for update;
  if not found then raise exception 'entry_not_in_shop' using errcode = 'P0001'; end if;

  -- P3b — C2 direction-split permission gate. direction is NOT NULL
  -- post-0100, so this is exhaustive.
  if v_orig.direction = 'receivable' then
    if not public.user_has_permission(v_shop_id, 'receive_payment') then
      raise exception 'insufficient_permissions' using errcode = 'P0001',
        detail = 'Required: receive_payment (to reverse a receivable ledger entry)';
    end if;
  else  -- 'payable'
    if not public.user_has_permission(v_shop_id, 'pay_supplier') then
      raise exception 'insufficient_permissions' using errcode = 'P0001',
        detail = 'Required: pay_supplier (to reverse a payable ledger entry)';
    end if;
  end if;

  -- Reversal-validity guards. The first two are faithful to
  -- reverse_ledger_entry_v28; the third (C4) is its supplier-side mirror.
  if v_orig.reverses_entry_id is not null then
    raise exception 'cannot_reverse_a_reversal' using errcode = 'P0001';
  end if;

  if v_orig.invoice_id is not null then
    raise exception 'cannot_reverse_invoice_tied_debit'
      using errcode = 'P0001',
            hint = 'Sale-tied debits cannot be reversed directly. Use receive_payment if the customer paid; void_sale (v1.9) for full sale reversal.';
  end if;

  -- C4 — Decision A added ledger_entries.purchase_id; record_purchase sets
  -- it on every payable debit it posts. A purchase-tied debit is the
  -- shadow of a purchase — reverse the purchase, not the ledger row.
  if v_orig.purchase_id is not null then
    raise exception 'cannot_reverse_purchase_tied_debit'
      using errcode = 'P0001',
            hint = 'Purchase-tied debits cannot be reversed directly. Use pay_supplier if the supplier was paid; purchase reversal (v2.11) for full reversal.';
  end if;

  select id into v_already_reversed
    from public.ledger_entries
   where reverses_entry_id = p_entry_id;
  if v_already_reversed is not null then
    raise exception 'entry_already_reversed' using errcode = 'P0001';
  end if;

  -- Flip type. v2.9's v_new_invoice_id CASE is removed: it was provably
  -- dead (the invoice_id guard above guarantees v_orig.invoice_id IS NULL
  -- by here), and the compensating row carries invoice_id = purchase_id =
  -- NULL unconditionally.
  v_new_type := case when v_orig.type = 'debit' then 'credit' else 'debit' end;

  -- §B copy-on-reverse: customer_id, contact_id AND direction copied
  -- verbatim. A post-0103 original has customer_id NULL (copy is NULL,
  -- legacy dual-write no-ops); a pre-0103 original carries one (copy
  -- keeps the legacy customers row in lockstep).
  insert into public.ledger_entries (
    shop_id, contact_id, customer_id, invoice_id, purchase_id,
    amount, type, direction,
    occurred_at, paid_at, notes, reverses_entry_id, created_by_user_id
  ) values (
    v_orig.shop_id, v_orig.contact_id, v_orig.customer_id, null, null,
    v_orig.amount, v_new_type, v_orig.direction,
    now(),
    case when v_new_type = 'credit' then now() else null end,
    coalesce(nullif(trim(p_notes), ''), 'Reversal of entry ' || substr(p_entry_id::text, 1, 8)),
    p_entry_id, auth.uid()
  ) returning id into v_new_id;

  return v_new_id;
end;
$function$;

-- =====================================================================
-- §6 — migrate user_shop_permissions (Policy 2 fold/intersect/union +
--      Policy 3-B for the net-new keys — attack-surface §1.3, worked
--      through per-user in Part 2 §3). No-op over an empty set on staging
--      (correction C1). The INSERT must precede the DELETE — it reads the
--      legacy rows.
-- =====================================================================
WITH legacy AS (
  -- one row per access that holds permission rows; the 11 in-scope legacy
  -- grants pivoted to booleans. The owner has no user_shop_permissions
  -- rows -> not present here -> naturally excluded. bool_or over an
  -- absent key sees only `false` inputs (granted is NOT NULL) and returns
  -- `false` — so a sparse access (missing some legacy-key rows) is
  -- handled correctly: an absent row reads as "not granted".
  SELECT
    usp.user_shop_access_id AS access_id,
    bool_or(usp.permission_key = 'view_customers'            AND usp.granted) AS had_view_customers,
    bool_or(usp.permission_key = 'view_customer_contact'     AND usp.granted) AS had_view_customer_contact,
    bool_or(usp.permission_key = 'view_customer_outstanding' AND usp.granted) AS had_view_customer_outstanding,
    bool_or(usp.permission_key = 'view_customer_khata'       AND usp.granted) AS had_view_customer_khata,
    bool_or(usp.permission_key = 'create_customer_basic'     AND usp.granted) AS had_create_customer_basic,
    bool_or(usp.permission_key = 'create_customer_full'      AND usp.granted) AS had_create_customer_full,
    bool_or(usp.permission_key = 'edit_customer'             AND usp.granted) AS had_edit_customer,
    bool_or(usp.permission_key = 'assign_customer_tier'      AND usp.granted) AS had_assign_customer_tier,
    bool_or(usp.permission_key = 'manage_customer_tiers'     AND usp.granted) AS had_manage_customer_tiers,
    bool_or(usp.permission_key = 'view_suppliers'            AND usp.granted) AS had_view_suppliers,
    bool_or(usp.permission_key = 'manage_suppliers'          AND usp.granted) AS had_manage_suppliers
  FROM public.user_shop_permissions usp
  GROUP BY usp.user_shop_access_id
)
INSERT INTO public.user_shop_permissions
  (id, user_shop_access_id, permission_key, granted, granted_by_user_id, granted_at, source)
-- ----- 1:1 maps — granted copied straight from the legacy grant -----
SELECT gen_random_uuid(), access_id, 'view_contacts',
       had_view_customers,            NULL, now(), 'preset' FROM legacy
UNION ALL
SELECT gen_random_uuid(), access_id, 'view_contact_contact_info',
       had_view_customer_contact,     NULL, now(), 'preset' FROM legacy
UNION ALL
-- ----- intersect (Policy 2): granted iff BOTH legacy keys were held -----
SELECT gen_random_uuid(), access_id, 'view_contact_customer_data',
       (had_view_customer_outstanding AND had_view_customer_khata),
                                      NULL, now(), 'preset' FROM legacy
UNION ALL
SELECT gen_random_uuid(), access_id, 'view_contact_supplier_data',
       had_view_suppliers,            NULL, now(), 'preset' FROM legacy
UNION ALL
SELECT gen_random_uuid(), access_id, 'create_contact_basic',
       had_create_customer_basic,     NULL, now(), 'preset' FROM legacy
UNION ALL
SELECT gen_random_uuid(), access_id, 'create_contact_full',
       had_create_customer_full,      NULL, now(), 'preset' FROM legacy
UNION ALL
-- ----- union: edit_customer OR the edit-half of manage_suppliers -----
SELECT gen_random_uuid(), access_id, 'edit_contact',
       (had_edit_customer OR had_manage_suppliers),
                                      NULL, now(), 'preset' FROM legacy
UNION ALL
SELECT gen_random_uuid(), access_id, 'assign_contact_tier',
       had_assign_customer_tier,      NULL, now(), 'preset' FROM legacy
UNION ALL
SELECT gen_random_uuid(), access_id, 'manage_contact_tiers',
       had_manage_customer_tiers,     NULL, now(), 'preset' FROM legacy
UNION ALL
-- ----- net-new keys (no v2.9 analog) — Ruling P3 = B: migrate to a
-- FALSE literal for every existing non-owner. The B.4 new-catalog preset
-- default (view_contact_net_position M✗ S✗, promote_contact M✗ S✗,
-- pay_supplier M✓ S✗) seeds NEW invitations only — it is NOT applied
-- retroactively to migrating users. Same principle as Policy 2 and the
-- §1.3 view_suppliers rule: a migration PRESERVES what was demonstrably
-- held, it never GRANTS. view_contact_net_position and promote_contact
-- would be false under any policy; pay_supplier (M✓) would have been
-- TRUE for every existing manager under a preset-default policy — P3 = B
-- makes it false, so an owner grants it explicitly + audited
-- post-migration to whoever should have it.
SELECT gen_random_uuid(), access_id, 'view_contact_net_position', false, NULL, now(), 'preset' FROM legacy
UNION ALL
SELECT gen_random_uuid(), access_id, 'promote_contact',           false, NULL, now(), 'preset' FROM legacy
UNION ALL
SELECT gen_random_uuid(), access_id, 'pay_supplier',              false, NULL, now(), 'preset' FROM legacy;

-- DELETE the in-scope legacy-key rows: the 11-key IN-list removes
-- whatever subset of the 11 each access actually holds (production is
-- dense -> all 11; §6 and check 4 do not assume it). NOT receive_payment
-- (kept, requires rebound in §2). NOT reverse_ledger_entry (D1 = B — kept).
DELETE FROM public.user_shop_permissions
 WHERE permission_key IN (
   'view_customers','view_customer_contact','view_customer_outstanding','view_customer_khata',
   'create_customer_basic','create_customer_full','edit_customer','assign_customer_tier',
   'manage_customer_tiers','view_suppliers','manage_suppliers');

-- =====================================================================
-- §7 — DROP the 11 retired keys from permissions_catalog. Safe now: no
--      user_shop_permissions row (§6), no live-table RLS policy (§4), no
--      surviving function (§3), no view, and no surviving key's requires
--      array (§2) references them. The customers/suppliers RLS policies
--      and check_customer_tier_change_gate keep dangling refs — INERT,
--      cleaned up at 0106 with the tables (Part 2 §6). 'customers' and
--      'suppliers' categories disappear emergently with their last keys —
--      category is a plain text column, so there is no separate DDL.
-- =====================================================================
DELETE FROM public.permissions_catalog
 WHERE key IN (
   'view_customers','view_customer_contact','view_customer_outstanding','view_customer_khata',
   'create_customer_basic','create_customer_full','edit_customer','assign_customer_tier',
   'manage_customer_tiers','view_suppliers','manage_suppliers');

-- =====================================================================
-- §8 — verification. Structural only; behavioural correctness (the
--      consumers lighting up for non-owners, the base gate, the
--      direction-split) is Phase E synthetic SET ROLE testing. Every
--      check RAISE EXCEPTIONs on mismatch -> whole txn rolls back.
-- =====================================================================
DO $verify_0105$
DECLARE
  v_total         bigint;
  v_contacts_cat  bigint;
  v_legacy_cats   bigint;
  v_new_missing   bigint;
  v_old_present   bigint;
  v_count_drift   bigint;
  v_orphans       bigint;
  v_incoherent    bigint;
  v_live_pol_refs bigint;
  v_live_fn_refs  bigint;
  v_view_refs     bigint;
BEGIN
  -- 1. catalog category totals
  SELECT count(*) INTO v_contacts_cat FROM public.permissions_catalog WHERE category = 'contacts';
  IF v_contacts_cat <> 11 THEN
    RAISE EXCEPTION '0105 verify 1: expected 11 contacts-category keys, found %', v_contacts_cat;
  END IF;
  SELECT count(*) INTO v_legacy_cats FROM public.permissions_catalog WHERE category IN ('customers','suppliers');
  IF v_legacy_cats <> 0 THEN
    RAISE EXCEPTION '0105 verify 1: expected 0 customers/suppliers-category keys, found %', v_legacy_cats;
  END IF;

  -- 2. all 12 new keys present and active
  SELECT count(*) INTO v_new_missing FROM (VALUES
    ('view_contacts'),('view_contact_contact_info'),('view_contact_customer_data'),
    ('view_contact_supplier_data'),('view_contact_net_position'),('create_contact_basic'),
    ('create_contact_full'),('edit_contact'),('promote_contact'),('assign_contact_tier'),
    ('manage_contact_tiers'),('pay_supplier')) AS n(key)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions_catalog pc WHERE pc.key = n.key AND pc.is_active);
  IF v_new_missing <> 0 THEN
    RAISE EXCEPTION '0105 verify 2: % of the 12 new keys missing or inactive', v_new_missing;
  END IF;

  -- 3. all 11 retired keys gone
  SELECT count(*) INTO v_old_present FROM public.permissions_catalog
  WHERE key IN (
    'view_customers','view_customer_contact','view_customer_outstanding','view_customer_khata',
    'create_customer_basic','create_customer_full','edit_customer','assign_customer_tier',
    'manage_customer_tiers','view_suppliers','manage_suppliers');
  IF v_old_present <> 0 THEN
    RAISE EXCEPTION '0105 verify 3: % of the 11 retired keys still present', v_old_present;
  END IF;

  -- 4. user_shop_permissions row-count delta — DERIVED per access from
  --    the §0 snapshot, never hard-coded and not assuming a dense shape.
  --    §6 deletes exactly legacy_in_scope_count rows and inserts exactly
  --    12, so expected_post = pre_count - legacy_in_scope_count + 12.
  --    (On the verified-dense production shape that reduces to pre + 1;
  --    on a sparse access it stays correct — closing the 0104-class
  --    "verification hardcodes a row-shape" trap.) Vacuous on staging.
  SELECT count(*) INTO v_count_drift
  FROM _0105_pre_counts pre
  LEFT JOIN (
    SELECT user_shop_access_id, count(*)::bigint AS post_count
    FROM public.user_shop_permissions GROUP BY user_shop_access_id
  ) post ON post.user_shop_access_id = pre.user_shop_access_id
  WHERE coalesce(post.post_count, 0) <> pre.pre_count - pre.legacy_in_scope_count + 12;
  IF v_count_drift <> 0 THEN
    RAISE EXCEPTION '0105 verify 4: % access row(s) have an unexpected permission count (expected pre_count - legacy_in_scope_count + 12)', v_count_drift;
  END IF;

  -- 5. no orphaned user_shop_permissions rows (FK enforces this too; the
  --    check makes the failure legible).
  SELECT count(*) INTO v_orphans FROM public.user_shop_permissions usp
  WHERE NOT EXISTS (SELECT 1 FROM public.permissions_catalog pc WHERE pc.key = usp.permission_key);
  IF v_orphans <> 0 THEN
    RAISE EXCEPTION '0105 verify 5: % orphaned user_shop_permissions row(s)', v_orphans;
  END IF;

  -- 6. requires-coherence on the 15 keys 0105 touches: no granted row
  --    whose key requires another key the same access does not also hold
  --    granted. This is the check that catches a Finding-A-style
  --    regression. Scoped to 0105's keys (a global sweep is an AQ-suite
  --    concern). Vacuous on staging.
  SELECT count(*) INTO v_incoherent
  FROM public.user_shop_permissions usp
  JOIN public.permissions_catalog pc ON pc.key = usp.permission_key
  WHERE usp.granted
    AND usp.permission_key IN (
      'view_contacts','view_contact_contact_info','view_contact_customer_data',
      'view_contact_supplier_data','view_contact_net_position','create_contact_basic',
      'create_contact_full','edit_contact','promote_contact','assign_contact_tier',
      'manage_contact_tiers','pay_supplier','receive_payment','reverse_ledger_entry',
      'record_purchase')
    AND EXISTS (
      SELECT 1 FROM unnest(pc.requires) req
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_shop_permissions u2
        WHERE u2.user_shop_access_id = usp.user_shop_access_id
          AND u2.permission_key = req AND u2.granted));
  IF v_incoherent <> 0 THEN
    RAISE EXCEPTION '0105 verify 6: % granted permission row(s) violate their requires dependency', v_incoherent;
  END IF;

  -- 7. no LIVE-table RLS policy references a retired key. customers /
  --    suppliers excluded — frozen-dead post-0104, dropped with their
  --    policies at 0106 (Part 2 §6, known inert danglers).
  SELECT count(*) INTO v_live_pol_refs
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename NOT IN ('customers','suppliers')
    AND (coalesce(p.qual,'') || ' ' || coalesce(p.with_check,'')) ~
        '''(view_customers|view_customer_contact|view_customer_outstanding|view_customer_khata|create_customer_basic|create_customer_full|edit_customer|assign_customer_tier|manage_customer_tiers|view_suppliers|manage_suppliers)''';
  IF v_live_pol_refs <> 0 THEN
    RAISE EXCEPTION '0105 verify 7: % live-table RLS policy(ies) still reference a retired key', v_live_pol_refs;
  END IF;

  -- 8. no surviving public function references a retired key.
  --    check_customer_tier_change_gate is excluded — the known inert
  --    dangler (trigger fn on customers, never fires post-0104b per
  --    AQ-33, cannot be DROPped until 0106 drops customers; Part 2 §6).
  --    MATERIALIZED fence: pg_get_functiondef errors on aggregates, so
  --    the public f/p set is filtered first (same pattern as AQ-33).
  WITH public_fns AS MATERIALIZED (
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
  )
  SELECT count(*) INTO v_live_fn_refs FROM public_fns
  WHERE proname <> 'check_customer_tier_change_gate'
    AND pg_get_functiondef(oid) ~
        '''(view_customers|view_customer_contact|view_customer_outstanding|view_customer_khata|create_customer_basic|create_customer_full|edit_customer|assign_customer_tier|manage_customer_tiers|view_suppliers|manage_suppliers)''';
  IF v_live_fn_refs <> 0 THEN
    RAISE EXCEPTION '0105 verify 8: % surviving function(s) still reference a retired key', v_live_fn_refs;
  END IF;

  -- 9. no view definition references a retired key.
  SELECT count(*) INTO v_view_refs
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('v','m')
    AND pg_get_viewdef(c.oid) ~
        '''(view_customers|view_customer_contact|view_customer_outstanding|view_customer_khata|create_customer_basic|create_customer_full|edit_customer|assign_customer_tier|manage_customer_tiers|view_suppliers|manage_suppliers)''';
  IF v_view_refs <> 0 THEN
    RAISE EXCEPTION '0105 verify 9: % view(s) still reference a retired key', v_view_refs;
  END IF;

  SELECT count(*) INTO v_total FROM public.permissions_catalog;
  RAISE NOTICE '0105 OK: catalog now % keys (11 retired, 12 added). contacts category=11, customers/suppliers=0. receive_payment/reverse_ledger_entry/record_purchase requires rebound; reverse_ledger_entry kept as a base gate (P3a); manage_contact_tiers requires assign_contact_tier; 4 tier wrappers swapped to manage_contact_tiers; v210_ledger_read live. % pre-existing access row(s) migrated (each: -legacy_in_scope_count +12).',
    v_total, (SELECT count(*) FROM _0105_pre_counts);
END $verify_0105$;

COMMIT;
