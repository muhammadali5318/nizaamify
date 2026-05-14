-- =====================================================================
-- 0102_v210_create_contact_rpcs
-- =====================================================================
-- v2.10 — seventh migration in the contacts unification chain.
--
-- Two parts (reviewed in two rounds, shipped as one migration / one
-- schema_migrations row):
--
--   PART 1 — 2 views:
--     contacts_view                  DEFINER  — unified conditional-
--                                               projection list/detail view
--     contact_balance_reconciliation INVOKER  — audit-only drift detector
--                                               (moved here from 0100 per B.2)
--
--   PART 2 — 7 RPCs:
--     create_contact_basic, create_contact_full, update_contact,
--     archive_contact, promote_contact, pay_supplier,
--     get_contact_unified_history
--
-- NOT in 0102 (deferred): customer_outstanding rebuild + supplier_outstanding
-- (rebuilding customer_outstanding needs DROP ... CASCADE — total_outstanding
-- depends on it — which is legacy-teardown work; placement decided at 0103).
-- customer_balance_reconciliation (legacy) is left intact so AQ-12 stays
-- green; it drops in 0104.
--
-- The new views/RPCs reference permission keys (view_contacts,
-- view_contact_*, create_contact_*, edit_contact, promote_contact,
-- pay_supplier) that do not exist in permissions_catalog until 0105.
-- CREATE succeeds regardless (Postgres does not validate the string arg);
-- user_has_permission never errors on an unknown key — owner gets true
-- (implicit shortcut), non-owner gets false. Between 0102 and 0105 the
-- owner sees everything, non-owners see nothing; staging has no
-- non-owner traffic in that window. Permission behavior is verified in
-- Phase E after 0105 seeds the keys.
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   design/2026-05-14-v210-contacts-model-design.md §2.6, §3
--   design/2026-05-14-v210-contacts-attack-surface.md
--   design/2026-05-14-v210-contacts-implementation-plan.md §1
-- =====================================================================

BEGIN;

-- =====================================================================
-- PART 1 — VIEWS
-- =====================================================================

-- ---------------------------------------------------------------------
-- contacts_view — unified conditional-projection view (DEFINER).
-- Replaces customers_view; first projection view for the supplier side
-- (suppliers_view never existed in v2.9). DEFINER is required: it must
-- read contacts.{customer,supplier}_outstanding_balance, which 0096
-- excluded from authenticated's table-level SELECT (the v2.9.2 column-
-- grant). The three cost-bearing values AND the two has_* existence
-- booleans are each CASE-gated on the caller's permission.
-- ---------------------------------------------------------------------
CREATE VIEW public.contacts_view
  WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT
    (SELECT public.current_active_shop_id()) AS active_shop_id,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()),
      'view_contacts'))              AS can_view,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()),
      'view_contact_contact_info'))  AS can_see_contact_info,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()),
      'view_contact_customer_data')) AS can_see_customer_data,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()),
      'view_contact_supplier_data')) AS can_see_supplier_data,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()),
      'view_contact_net_position'))  AS can_see_net
)
SELECT
  c.id,
  c.shop_id,
  c.name,
  c.contact_type,
  CASE WHEN cp.can_see_contact_info THEN c.phone   ELSE NULL END AS phone,
  CASE WHEN cp.can_see_contact_info THEN c.address ELSE NULL END AS address,
  c.customer_tier_id,
  -- customer side (cost-bearing value + existence boolean — both gated)
  CASE WHEN cp.can_see_customer_data
       THEN c.customer_outstanding_balance ELSE NULL END AS customer_outstanding_balance,
  CASE WHEN cp.can_see_customer_data
       THEN (c.customer_outstanding_balance > 0) ELSE NULL END AS has_customer_khata,
  -- supplier side (cost-bearing value + existence boolean — both gated)
  CASE WHEN cp.can_see_supplier_data
       THEN c.supplier_outstanding_balance ELSE NULL END AS supplier_outstanding_balance,
  CASE WHEN cp.can_see_supplier_data
       THEN (c.supplier_outstanding_balance > 0) ELSE NULL END AS has_supplier_payable,
  -- net position (cost-bearing — gated; B.4 makes view_contact_net_position
  -- depend on both data perms)
  CASE WHEN cp.can_see_net
       THEN (c.customer_outstanding_balance - c.supplier_outstanding_balance)::numeric(12,2)
       ELSE NULL END AS net_outstanding,
  c.is_active,
  c.notes,
  c.created_at,
  c.updated_at,
  c.created_by_user_id,
  c.promoted_to_both_at,
  c.promoted_to_both_by_user_id
FROM public.contacts c
CROSS JOIN caller_perms cp
WHERE c.shop_id = cp.active_shop_id
  AND cp.can_view;

GRANT SELECT ON public.contacts_view TO authenticated;

-- ---------------------------------------------------------------------
-- contact_balance_reconciliation — audit-only drift detector (INVOKER).
-- Mirrors customer_balance_reconciliation. Not user-facing — it projects
-- the raw cost-bearing balances unmasked, so as INVOKER only roles with
-- direct SELECT on those columns (postgres / service_role) can query it.
-- Backs AQ-31.
-- ---------------------------------------------------------------------
CREATE VIEW public.contact_balance_reconciliation
  WITH (security_invoker = true) AS
SELECT
  c.id      AS contact_id,
  c.shop_id,
  c.customer_outstanding_balance AS stored_customer_balance,
  c.supplier_outstanding_balance AS stored_supplier_balance,
  recv.computed AS computed_customer_balance,
  pay.computed  AS computed_supplier_balance,
  (c.customer_outstanding_balance - recv.computed)::numeric(12,2) AS customer_drift,
  (c.supplier_outstanding_balance - pay.computed)::numeric(12,2)  AS supplier_drift
FROM public.contacts c
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(CASE WHEN le.type='debit' THEN le.amount ELSE -le.amount END), 0)::numeric(12,2) AS computed
  FROM public.ledger_entries le
  WHERE le.contact_id = c.id AND le.direction = 'receivable'
) recv
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(CASE WHEN le.type='debit' THEN le.amount ELSE -le.amount END), 0)::numeric(12,2) AS computed
  FROM public.ledger_entries le
  WHERE le.contact_id = c.id AND le.direction = 'payable'
) pay;

GRANT SELECT ON public.contact_balance_reconciliation TO service_role;

-- =====================================================================
-- PART 2 — RPCs
-- All DEFINER, search_path pinned, P1/P2/P3 gate pattern (matches the
-- v2.9 wrappers — AQ-23 conformant). Fresh functions, no _v28 shims
-- (per B.6). unique_violation on phone -> contact_phone_exists.
-- =====================================================================

-- ---------------------------------------------------------------------
-- create_contact_basic
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_contact_basic(
  p_name text, p_phone text, p_contact_type text
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_tier_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode='P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_contact_basic') then
    raise exception 'insufficient_permissions' using errcode='P0001', detail='Required: create_contact_basic';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required' using errcode='P0001'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone_required' using errcode='P0001'; end if;
  if p_contact_type is null or p_contact_type not in ('customer','supplier','both') then
    raise exception 'invalid_contact_type' using errcode='P0001';
  end if;
  -- default tier only for customer-touching contacts (CHECK forbids it on supplier-only)
  if p_contact_type in ('customer','both') then
    select id into v_tier_id from public.customer_tiers
     where shop_id = v_shop_id and is_default and is_active limit 1;
  end if;
  begin
    insert into public.contacts (shop_id, name, phone, contact_type, customer_tier_id, created_by_user_id)
    values (v_shop_id, trim(p_name), trim(p_phone), p_contact_type, v_tier_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'contact_phone_exists' using errcode='P0001',
      detail='A contact with this phone already exists in this shop';
  end;
  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- create_contact_full
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_contact_full(
  p_name text, p_phone text, p_contact_type text,
  p_address text DEFAULT NULL, p_notes text DEFAULT NULL, p_customer_tier_id uuid DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode='P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'create_contact_full') then
    raise exception 'insufficient_permissions' using errcode='P0001', detail='Required: create_contact_full';
  end if;
  if p_customer_tier_id is not null and not public.user_has_permission(v_shop_id, 'assign_contact_tier') then
    raise exception 'insufficient_permissions' using errcode='P0001', detail='Required: assign_contact_tier (to set tier)';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required' using errcode='P0001'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone_required' using errcode='P0001'; end if;
  if p_contact_type is null or p_contact_type not in ('customer','supplier','both') then
    raise exception 'invalid_contact_type' using errcode='P0001';
  end if;
  if p_customer_tier_id is not null and p_contact_type = 'supplier' then
    raise exception 'tier_only_for_customer_contacts' using errcode='P0001';
  end if;
  if p_customer_tier_id is not null and not exists (
    select 1 from public.customer_tiers where id = p_customer_tier_id and shop_id = v_shop_id and is_active
  ) then raise exception 'tier_not_in_shop' using errcode='P0001'; end if;
  begin
    insert into public.contacts (shop_id, name, phone, contact_type, address, notes,
                                 customer_tier_id, created_by_user_id)
    values (v_shop_id, trim(p_name), trim(p_phone), p_contact_type,
            nullif(trim(coalesce(p_address,'')),''), nullif(trim(coalesce(p_notes,'')),''),
            p_customer_tier_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'contact_phone_exists' using errcode='P0001',
      detail='A contact with this phone already exists in this shop';
  end;
  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- update_contact — does NOT change contact_type (that is promote_contact)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_contact(
  p_id uuid, p_name text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL, p_notes text DEFAULT NULL, p_customer_tier_id uuid DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_contact_shop uuid;
  v_contact_type text;
  v_current_tier uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode='P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'edit_contact') then
    raise exception 'insufficient_permissions' using errcode='P0001', detail='Required: edit_contact';
  end if;
  select shop_id, contact_type, customer_tier_id
    into v_contact_shop, v_contact_type, v_current_tier
    from public.contacts where id = p_id for update;
  if not found then raise exception 'contact_not_found' using errcode='P0001'; end if;
  if v_contact_shop <> v_shop_id then raise exception 'contact_not_in_shop' using errcode='P0001'; end if;
  if p_customer_tier_id is not null and p_customer_tier_id is distinct from v_current_tier then
    if v_contact_type = 'supplier' then
      raise exception 'tier_only_for_customer_contacts' using errcode='P0001';
    end if;
    if not public.user_has_permission(v_shop_id, 'assign_contact_tier') then
      raise exception 'insufficient_permissions' using errcode='P0001',
        detail='Required: assign_contact_tier (to change tier)';
    end if;
    if not exists (select 1 from public.customer_tiers
                    where id = p_customer_tier_id and shop_id = v_shop_id and is_active) then
      raise exception 'tier_not_in_shop' using errcode='P0001';
    end if;
  end if;
  if p_name is not null and coalesce(trim(p_name),'') = '' then raise exception 'name_required' using errcode='P0001'; end if;
  if p_phone is not null and coalesce(trim(p_phone),'') = '' then raise exception 'phone_required' using errcode='P0001'; end if;
  begin
    update public.contacts set
      name             = coalesce(nullif(trim(p_name),''), name),
      phone            = coalesce(nullif(trim(p_phone),''), phone),
      address          = case when p_address is not null then nullif(trim(p_address),'') else address end,
      notes            = case when p_notes   is not null then nullif(trim(p_notes),'')   else notes   end,
      customer_tier_id = coalesce(p_customer_tier_id, customer_tier_id),
      updated_by_user_id = auth.uid()
     where id = p_id;
  exception when unique_violation then
    raise exception 'contact_phone_exists' using errcode='P0001',
      detail='A contact with this phone already exists in this shop';
  end;
end;
$function$;

-- ---------------------------------------------------------------------
-- archive_contact — soft delete (mirrors archive_supplier)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_contact(p_id uuid)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_contact_shop uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode='P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'edit_contact') then
    raise exception 'insufficient_permissions' using errcode='P0001', detail='Required: edit_contact';
  end if;
  select shop_id into v_contact_shop from public.contacts where id = p_id for update;
  if not found then raise exception 'contact_not_found' using errcode='P0001'; end if;
  if v_contact_shop <> v_shop_id then raise exception 'contact_not_in_shop' using errcode='P0001'; end if;
  update public.contacts
     set is_active = false, updated_by_user_id = auth.uid()
   where id = p_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- promote_contact — flip single-role -> 'both'. The UPDATE sets the
-- promotion audit fields in the SAME statement the 0097
-- v210_contacts_promotion_audit_required trigger checks — trigger passes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_contact(p_id uuid, p_target_type text DEFAULT 'both')
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_contact_shop uuid;
  v_contact_type text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode='P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'promote_contact') then
    raise exception 'insufficient_permissions' using errcode='P0001', detail='Required: promote_contact';
  end if;
  if p_target_type is distinct from 'both' then
    raise exception 'invalid_promotion_target' using errcode='P0001',
      detail='promote_contact currently supports target_type=both only';
  end if;
  select shop_id, contact_type into v_contact_shop, v_contact_type
    from public.contacts where id = p_id for update;
  if not found then raise exception 'contact_not_found' using errcode='P0001'; end if;
  if v_contact_shop <> v_shop_id then raise exception 'contact_not_in_shop' using errcode='P0001'; end if;
  if v_contact_type = 'both' then raise exception 'contact_already_both' using errcode='P0001'; end if;
  update public.contacts
     set contact_type                = 'both',
         promoted_to_both_at         = now(),
         promoted_to_both_by_user_id = auth.uid(),
         updated_by_user_id          = auth.uid()
   where id = p_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- pay_supplier — fresh function (no _v28 shim, per B.6). Mirrors
-- receive_payment's cap mechanics, but with the CORRECT check order:
-- validate the contact FIRST (cheap, side-effect-free), THEN the
-- non-owner cap check (which takes the advisory lock), THEN the
-- overpayment guard, then insert. receive_payment validates cap-first /
-- customer-second (an inherited v2.9.x quirk — logged in docs/todos.md);
-- pay_supplier deliberately does NOT mirror that ordering.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_supplier(
  p_contact_id uuid, p_amount numeric, p_notes text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_is_owner boolean;
  v_cap numeric;
  v_today_total numeric;
  v_contact_shop uuid;
  v_contact_type text;
  v_outstanding numeric(12,2);
  v_id uuid;
begin
  -- P1/P2/P3 + amount
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode='P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'pay_supplier') then
    raise exception 'insufficient_permissions' using errcode='P0001', detail='Required: pay_supplier';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive' using errcode='P0001'; end if;

  -- (1) Validate the contact FIRST — cheap, side-effect-free. Lock it and
  -- read its payable balance. Done before the cap check so a bad
  -- p_contact_id fails with the right error (contact_not_found /
  -- _not_in_shop / _not_a_supplier) instead of a misleading
  -- supplier_payment_cap_exceeded — and we don't take the advisory lock
  -- on a call that was never going to succeed.
  select shop_id, contact_type, supplier_outstanding_balance
    into v_contact_shop, v_contact_type, v_outstanding
    from public.contacts where id = p_contact_id for update;
  if not found then raise exception 'contact_not_found' using errcode='P0001'; end if;
  if v_contact_shop <> v_shop_id then raise exception 'contact_not_in_shop' using errcode='P0001'; end if;
  if v_contact_type not in ('supplier','both') then
    raise exception 'contact_not_a_supplier' using errcode='P0001';
  end if;

  -- (2) Non-owner daily cap. Distinct lock-salt from receive_payment so the
  -- customer-receive and supplier-pay caps don't contend.
  select is_owner into v_is_owner from public.user_shop_access
   where user_id = auth.uid() and shop_id = v_shop_id;
  if v_is_owner is null then raise exception 'no_shop_for_user' using errcode='P0001'; end if;
  if not v_is_owner then
    perform pg_advisory_xact_lock(hashtextextended(
      v_shop_id::text || auth.uid()::text || current_date::text || 'pay_supplier', 0));
    select salesperson_supplier_payment_cap_pkr into v_cap from public.shops where id = v_shop_id;
    select coalesce(sum(amount), 0) into v_today_total
      from public.ledger_entries
     where created_by_user_id = auth.uid() and shop_id = v_shop_id
       and type = 'credit' and direction = 'payable'
       and created_at::date = current_date;
    if v_today_total + p_amount > v_cap + 0.001 then
      raise exception 'supplier_payment_cap_exceeded' using errcode='P0001',
        detail = format('today total %s + this %s > cap %s', v_today_total, p_amount, v_cap);
    end if;
  end if;

  -- (3) Overpayment guard (v_outstanding read under the contact's FOR UPDATE lock)
  if p_amount > v_outstanding then
    raise exception 'overpayment_supplier' using errcode='P0001',
      detail = format('max payable = %s', v_outstanding);
  end if;

  -- (4) Payable credit: the 0101 ledger_entries_update_balance trigger
  -- decrements contacts.supplier_outstanding_balance.
  insert into public.ledger_entries (
    shop_id, contact_id, customer_id, invoice_id, amount, type, direction,
    occurred_at, paid_at, notes, created_by_user_id
  ) values (
    v_shop_id, p_contact_id, null, null, p_amount, 'credit', 'payable',
    now(), now(), nullif(trim(p_notes), ''), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- get_contact_unified_history — interleaved sales / purchases / payments
-- for a contact, per-side gated. Debit ledger entries are excluded: in
-- v2.10's transaction model every debit is the accounting shadow of an
-- invoice (receivable) or a purchase (payable), already represented by
-- the 'sale'/'purchase' row. (If a future manual-adjustment feature
-- creates standalone debit entries, this RPC needs a 5th branch.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contact_unified_history(
  p_contact_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_filter text DEFAULT 'all'
) RETURNS TABLE(entry_type text, entry_id uuid, occurred_at timestamptz, amount numeric, notes text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_contact_shop uuid;
  v_can_customer boolean;
  v_can_supplier boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode='P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_contacts') then
    raise exception 'insufficient_permissions' using errcode='P0001', detail='Required: view_contacts';
  end if;
  if p_filter is null or p_filter not in ('all','sales','purchases','payments') then
    raise exception 'invalid_history_filter' using errcode='P0001';
  end if;
  select shop_id into v_contact_shop from public.contacts where id = p_contact_id;
  if not found then raise exception 'contact_not_found' using errcode='P0001'; end if;
  if v_contact_shop <> v_shop_id then raise exception 'contact_not_in_shop' using errcode='P0001'; end if;

  -- per-side filtering: a caller with view_contacts but neither data
  -- permission gets an empty history (intended per L7 / B.4)
  v_can_customer := public.user_has_permission(v_shop_id, 'view_contact_customer_data');
  v_can_supplier := public.user_has_permission(v_shop_id, 'view_contact_supplier_data');

  return query
    select 'sale'::text, i.id, i.created_at, i.total, i.notes
      from public.invoices i
     where i.contact_id = p_contact_id
       and v_can_customer and p_filter in ('all','sales')
       and (p_from is null or i.created_at::date >= p_from)
       and (p_to   is null or i.created_at::date <= p_to)
    union all
    select 'purchase'::text, p.id, p.created_at, p.total_cost, p.note
      from public.purchases p
     where p.contact_id = p_contact_id
       and v_can_supplier and p_filter in ('all','purchases')
       and (p_from is null or p.purchase_date >= p_from)
       and (p_to   is null or p.purchase_date <= p_to)
    union all
    select 'payment_received'::text, le.id, le.occurred_at, le.amount, le.notes
      from public.ledger_entries le
     where le.contact_id = p_contact_id and le.direction='receivable' and le.type='credit'
       and v_can_customer and p_filter in ('all','payments')
       and (p_from is null or le.occurred_at::date >= p_from)
       and (p_to   is null or le.occurred_at::date <= p_to)
    union all
    select 'payment_made'::text, le.id, le.occurred_at, le.amount, le.notes
      from public.ledger_entries le
     where le.contact_id = p_contact_id and le.direction='payable' and le.type='credit'
       and v_can_supplier and p_filter in ('all','payments')
       and (p_from is null or le.occurred_at::date >= p_from)
       and (p_to   is null or le.occurred_at::date <= p_to)
    order by 3 desc;
end;
$function$;

-- ---------------------------------------------------------------------
-- Grants (ADR-0015 pattern: revoke from public + anon, grant to
-- authenticated + service_role)
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_contact_basic(text,text,text)                FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.create_contact_full(text,text,text,text,text,uuid)   FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.update_contact(uuid,text,text,text,text,uuid)        FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.archive_contact(uuid)                                FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.promote_contact(uuid,text)                           FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.pay_supplier(uuid,numeric,text)                      FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_contact_unified_history(uuid,date,date,text)     FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_contact_basic(text,text,text)                 TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.create_contact_full(text,text,text,text,text,uuid)   TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.update_contact(uuid,text,text,text,text,uuid)        TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.archive_contact(uuid)                                TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.promote_contact(uuid,text)                           TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.pay_supplier(uuid,numeric,text)                      TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.get_contact_unified_history(uuid,date,date,text)     TO authenticated, service_role;

-- =====================================================================
-- VERIFICATION
-- =====================================================================

-- Part 1 — views (structure only; see NOTICE)
DO $verify_views$
DECLARE
  v_cv_exists   bigint;
  v_cv_definer  bigint;
  v_cv_gated    bigint;
  v_cbr_exists  bigint;
  v_cbr_invoker bigint;
  v_cbr_intact  bigint;
BEGIN
  SELECT count(*) INTO v_cv_exists FROM pg_views
   WHERE schemaname='public' AND viewname='contacts_view';
  IF v_cv_exists <> 1 THEN RAISE EXCEPTION '0102: contacts_view missing'; END IF;

  SELECT count(*) INTO v_cv_definer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='contacts_view'
     AND (c.reloptions IS NULL OR NOT ('security_invoker=true' = ANY(c.reloptions)));
  IF v_cv_definer <> 1 THEN RAISE EXCEPTION '0102: contacts_view is not DEFINER'; END IF;

  -- smoke test of the gate structure (NOT a proof of projection — see NOTICE)
  SELECT count(*) INTO v_cv_gated FROM pg_views
   WHERE schemaname='public' AND viewname='contacts_view'
     AND definition LIKE '%can_see_customer_data%customer_outstanding_balance%'
     AND definition LIKE '%can_see_supplier_data%supplier_outstanding_balance%'
     AND definition LIKE '%can_see_net%';
  IF v_cv_gated <> 1 THEN
    RAISE EXCEPTION '0102: contacts_view does not gate all cost-bearing columns';
  END IF;

  SELECT count(*) INTO v_cbr_exists FROM pg_views
   WHERE schemaname='public' AND viewname='contact_balance_reconciliation';
  IF v_cbr_exists <> 1 THEN RAISE EXCEPTION '0102: contact_balance_reconciliation missing'; END IF;

  SELECT count(*) INTO v_cbr_invoker FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='contact_balance_reconciliation'
     AND 'security_invoker=true' = ANY(c.reloptions);
  IF v_cbr_invoker <> 1 THEN
    RAISE EXCEPTION '0102: contact_balance_reconciliation is not INVOKER';
  END IF;

  SELECT count(*) INTO v_cbr_intact FROM pg_views
   WHERE schemaname='public' AND viewname='customer_balance_reconciliation';
  IF v_cbr_intact <> 1 THEN
    RAISE EXCEPTION '0102: customer_balance_reconciliation was unexpectedly dropped';
  END IF;

  RAISE NOTICE '0102 (views) OK: contacts_view DEFINER + all cost columns gated (LIKE smoke-test only); contact_balance_reconciliation INVOKER; legacy customer_balance_reconciliation intact. PROJECTION CORRECTNESS IS PROVEN BY PHASE E SYNTHETIC SET-ROLE TESTS, NOT BY THIS BLOCK — current_active_shop_id() is NULL under execute_sql so the views return zero rows here.';
END $verify_views$;

-- Part 2 — RPCs (structure only; see NOTICE)
DO $verify_rpcs$
DECLARE
  v_fn_count   bigint;
  v_definer    bigint;
  v_p_pattern  bigint;
  v_anon_grant bigint;
BEGIN
  SELECT count(*) INTO v_fn_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('create_contact_basic','create_contact_full','update_contact','archive_contact',
      'promote_contact','pay_supplier','get_contact_unified_history');
  IF v_fn_count <> 7 THEN RAISE EXCEPTION '0102 RPCs: expected 7 functions, got %', v_fn_count; END IF;

  SELECT count(*) INTO v_definer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef = true AND p.proname IN
     ('create_contact_basic','create_contact_full','update_contact','archive_contact',
      'promote_contact','pay_supplier','get_contact_unified_history');
  IF v_definer <> 7 THEN RAISE EXCEPTION '0102 RPCs: expected 7 DEFINER, got %', v_definer; END IF;

  SELECT count(*) INTO v_p_pattern FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('create_contact_basic','create_contact_full','update_contact','archive_contact',
      'promote_contact','pay_supplier','get_contact_unified_history')
     AND pg_get_functiondef(p.oid) LIKE '%not_authenticated%'
     AND pg_get_functiondef(p.oid) LIKE '%no_shop_for_user%'
     AND pg_get_functiondef(p.oid) LIKE '%user_has_permission%';
  IF v_p_pattern <> 7 THEN
    RAISE EXCEPTION '0102 RPCs: % of 7 carry the full P1/P2/P3 pattern', v_p_pattern;
  END IF;

  SELECT count(*) INTO v_anon_grant FROM information_schema.role_routine_grants
   WHERE routine_schema='public' AND grantee='anon' AND privilege_type='EXECUTE'
     AND routine_name IN
     ('create_contact_basic','create_contact_full','update_contact','archive_contact',
      'promote_contact','pay_supplier','get_contact_unified_history');
  IF v_anon_grant <> 0 THEN
    RAISE EXCEPTION '0102 RPCs: % still granted to anon', v_anon_grant;
  END IF;

  RAISE NOTICE '0102 (RPCs) OK: 7 DEFINER functions, P1/P2/P3 pattern present, anon revoked. HAPPY-PATH BEHAVIOR (gates enforcing, cap math, promotion trigger firing, per-side history filtering) IS PROVEN BY PHASE E SYNTHETIC SET-ROLE TESTS, NOT BY THIS STRUCTURAL BLOCK.';
END $verify_rpcs$;

COMMIT;
