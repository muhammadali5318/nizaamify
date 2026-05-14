-- =====================================================================
-- 0103_v210_modify_existing_rpcs
-- =====================================================================
-- v2.10 — eighth migration in the contacts unification chain.
--
-- Rewrites the 10 transaction / list / search RPCs for contact_id, adds
-- the supplier-side ledger->purchase link (Decision A), extends
-- purchases_view, and retires the first 6 of v2.10's 13 _v28 shims.
-- Reviewed in three rounds at the 0103 design checkpoint:
--
--   ROUND 1 — locked decisions:
--     Decision A  ledger_entries.purchase_id (nullable FK -> purchases) +
--                 2 CHECKs + partial index. record_purchase populates it
--                 on every payable debit; reverse_ledger_entry guards on it.
--     Decision B  no standalone customer_outstanding/supplier_outstanding
--                 views — list_contacts reads contacts.* cached columns.
--     Decision C  6 _v28 shims retire here, 7 in 0104.
--     §B finding  "frozen legacy world + copy-on-reverse" — the CREATE
--                 RPCs write the legacy customer_id/supplier_id columns
--                 NULL; reverse_ledger_entry copies customer_id from the
--                 reversed entry so a pre-0103 entry's legacy customers
--                 row stays in lockstep, and the 0101 dual-write's legacy
--                 branch (guarded on customer_id IS NOT NULL) cleanly
--                 no-ops for new entries. Supersedes the 0101 header's
--                 "RPCs populate both" sequencing note (infeasible
--                 post-0099, and unnecessary).
--
--   ROUND 2 — heavy RPCs:
--     2a  record_sale, record_purchase (DROP+CREATE — first-param rename
--         p_customer_id/p_supplier_id -> p_contact_id; record_purchase
--         gains p_amount_paid). record_sale's contact requirement +
--         validation are consolidated into one block before the invoice
--         insert (Bug 2 fix). record_sale_v28 did NOT lock the customer
--         row; the rewrite is faithful — no FOR UPDATE on the contact
--         (record_sale only appends; no read-decide-write race).
--     2b  receive_payment (DROP+CREATE — C1 cap-ordering fix: validate
--         contact -> cap -> overpayment -> insert; F-R2-3 cap sum scoped
--         to direction='receivable'), reverse_ledger_entry (CREATE OR
--         REPLACE — C2 direction-split permission gate, C4
--         cannot_reverse_purchase_tied_debit guard, §B copy-on-reverse).
--
--   ROUND 3 — list/search RPCs:
--     Class A (collapse-in-place, DROP+CREATE, shims retired here):
--       search_purchases, search_purchases_count
--     Class B (fresh-create, renamed; v2.9 originals + shims retire 0104):
--       list_contacts, recent_contacts, search_khata_contacts,
--       search_khata_contacts_count
--     Plus the §3.4 purchases_view extension (contact_id, contact_name,
--     amount_paid, outstanding appended; supplier_id retained for the
--     0103->0104 window).
--
-- 6 _v28 shims retired (Decision C): record_sale_v28, record_purchase_v28,
-- receive_payment_v28, reverse_ledger_entry_v28, search_purchases_v28,
-- search_purchases_count_v28. The remaining 7 (list_customers /
-- recent_customers / search_khata_customers / search_khata_customers_count
-- + create_supplier_inline / recent_suppliers / search_suppliers) retire
-- in 0104.
--
-- Permission keys referenced by the new functions (view_contacts,
-- view_contact_*, etc.) do not exist in permissions_catalog until 0105 —
-- CREATE succeeds regardless, user_has_permission never errors on an
-- unknown key (owner true, non-owner false). Staging has no non-owner
-- traffic in the 0103->0105 window.
--
-- ORDERING: Decision A's schema (§1) runs FIRST — record_purchase (§2)
-- and reverse_ledger_entry (§3) both reference ledger_entries.purchase_id.
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   design/2026-05-14-v210-contacts-model-design.md §2.1, §3.4, §4.2
--   design/2026-05-14-v210-contacts-attack-surface.md §1.2, §4.2
--   design/2026-05-14-v210-contacts-implementation-plan.md §1
--   decisions/2026-05-14-v210-contact-id-add-not-rename.md
-- =====================================================================

BEGIN;

-- =====================================================================
-- §1 — Decision A: ledger_entries.purchase_id (the supplier-side
--      ledger->transaction link, mirror of invoice_id). MUST be first.
-- =====================================================================

ALTER TABLE public.ledger_entries
  ADD COLUMN purchase_id uuid REFERENCES public.purchases(id);

-- A purchase-tied entry is the accounting shadow of a credit purchase:
-- it can only ever be a payable debit. Existing rows all have
-- purchase_id NULL, so this CHECK validates trivially.
ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_purchase_id_requires_payable_debit
  CHECK (purchase_id IS NULL OR (type = 'debit' AND direction = 'payable'));

-- An entry is the shadow of a sale XOR a purchase, never both.
ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_entry_not_both_invoice_and_purchase
  CHECK (NOT (invoice_id IS NOT NULL AND purchase_id IS NOT NULL));

CREATE INDEX idx_ledger_entries_purchase_id
  ON public.ledger_entries (purchase_id)
  WHERE purchase_id IS NOT NULL;

-- =====================================================================
-- §2 — Round 2 Part 2a: record_sale + record_purchase
-- DROP+CREATE — the first parameter renames (p_customer_id /
-- p_supplier_id -> p_contact_id), which CREATE OR REPLACE cannot do.
-- =====================================================================

-- ---------------------------------------------------------------------
-- record_sale — inlines the v2.9 wrapper (discount-cap enforcement) +
-- record_sale_v28 (the transaction), adapted for contact_id / direction.
-- The FEFO batch-picking + expired-sale-policy block is verbatim from
-- record_sale_v28. The contact requirement + the consolidated strict
-- contact lookup are one block immediately before the invoice insert
-- (Bug 2 fix): v_credit needs the loop+money-math, so the block cannot
-- move earlier, and record_sale_v28 also did its strict customer check
-- here. No FOR UPDATE on the contact — record_sale only appends a ledger
-- entry (the 0101 trigger's += is commutative); there is no
-- read-decide-write race, unlike receive_payment / pay_supplier.
-- ---------------------------------------------------------------------
DROP FUNCTION public.record_sale(uuid, numeric, numeric, text, jsonb, text, numeric, boolean);

CREATE FUNCTION public.record_sale(
  p_contact_id uuid DEFAULT NULL,
  p_amount_paid numeric DEFAULT 0,
  p_service_charge numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_sale_discount_type text DEFAULT NULL,
  p_sale_discount_value numeric DEFAULT NULL,
  p_confirm_expired_sale boolean DEFAULT false
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_user_id uuid := auth.uid();
  -- Phase 1 (discount-cap enforcement, from the v2.9 record_sale wrapper)
  v_is_owner boolean;
  v_limits jsonb;
  v_line_max_pct numeric; v_invoice_max_pct numeric;
  v_line_max_pkr numeric; v_invoice_max_pkr numeric;
  v_line_disc_amt numeric; v_line_disc_pct numeric;
  v_implicit_disc_pct numeric;
  v_variant_id uuid; v_variant_price numeric;
  v_invoice_disc_amt numeric := 0; v_invoice_disc_pct numeric;
  -- shared across phases
  v_item jsonb;
  v_qty int;
  v_price numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_items_subtotal numeric(12,2) := 0;
  -- Phase 2 (the transaction, from record_sale_v28, adapted)
  v_contact_type text;
  v_customer_tier_id uuid;
  v_invoice_id uuid;
  v_sale_discount_percent_snapshot numeric(5,2);
  v_sale_discount_amount numeric(12,2) := 0;
  v_total numeric(12,2);
  v_credit numeric(12,2);
  v_payment_type text;
  v_service numeric(12,2);
  v_line_discount_type text;
  v_line_discount_value numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_variant record;
  v_resolved_variant_id uuid;
  v_override_batch_id uuid;
  v_batch record;
  v_remaining_qty int;
  v_chunk_qty int;
  v_chunk_idx int;
  v_chunk_count int;
  v_qty_arr int[];
  v_batch_id_arr uuid[];
  v_cost_arr numeric(12,2)[];
  v_sold_expired_arr boolean[];
  v_discount_alloc numeric(12,2)[];
  v_alloc_sum numeric(12,2);
  v_max_qty_idx int;
  v_effective_policy public.expired_sale_policy;
  v_batch_expired boolean;
begin
  -- ===== P1/P2/P3 =====
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_sale') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_sale';
  end if;

  -- ===================================================================
  -- PHASE 1 — discount-cap enforcement (from the v2.9 record_sale wrapper)
  -- ===================================================================
  select usa.is_owner, usa.discount_limits into v_is_owner, v_limits
    from public.user_shop_access usa
   where usa.user_id = v_user_id and usa.shop_id = v_shop_id;
  if v_is_owner is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  v_line_max_pct    := nullif(v_limits ->> 'per_line_max_pct', '')::numeric;
  v_invoice_max_pct := nullif(v_limits ->> 'per_invoice_max_pct', '')::numeric;
  v_line_max_pkr    := nullif(v_limits ->> 'per_line_max_pkr', '')::numeric;
  v_invoice_max_pkr := nullif(v_limits ->> 'per_invoice_max_pkr', '')::numeric;

  -- v_items_subtotal here is the RAW subtotal (qty*price, no line discounts)
  -- — used only for the invoice-level cap check below. Phase 2 resets it.
  if jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_qty := (v_item->>'qty')::int; v_price := (v_item->>'price_at_sale')::numeric;
      if v_qty is null or v_price is null or v_qty <= 0 then continue; end if;
      v_line_subtotal := v_qty * v_price;
      v_items_subtotal := v_items_subtotal + v_line_subtotal;
      if v_item->>'line_discount_type' = 'percent' then
        v_line_disc_pct := (v_item->>'line_discount_value')::numeric;
        v_line_disc_amt := round(v_line_subtotal * v_line_disc_pct / 100, 2);
      elsif v_item->>'line_discount_type' = 'fixed' then
        v_line_disc_amt := (v_item->>'line_discount_value')::numeric;
        v_line_disc_pct := case when v_line_subtotal > 0 then (v_line_disc_amt / v_line_subtotal * 100) else 0 end;
      else v_line_disc_amt := 0; v_line_disc_pct := 0; end if;
      if not v_is_owner then
        if v_line_max_pct is not null and v_line_disc_pct > v_line_max_pct + 0.001 then
          raise exception 'discount_exceeds_line_pct_limit' using errcode = 'P0001', detail = format('line %s%% > cap %s%%', v_line_disc_pct, v_line_max_pct); end if;
        if v_line_max_pkr is not null and v_line_disc_amt > v_line_max_pkr + 0.001 then
          raise exception 'discount_exceeds_line_pkr_limit' using errcode = 'P0001', detail = format('line %s PKR > cap %s PKR', v_line_disc_amt, v_line_max_pkr); end if;
      end if;
      v_variant_id := null;
      if v_item ? 'variant_id' and nullif(v_item->>'variant_id','') is not null then
        v_variant_id := (v_item->>'variant_id')::uuid;
      elsif v_item ? 'product_id' and nullif(v_item->>'product_id','') is not null then
        select id into v_variant_id from public.product_variants
         where product_id = (v_item->>'product_id')::uuid and is_default and is_active;
      end if;
      if v_variant_id is not null then
        select price into v_variant_price from public.product_variants where id = v_variant_id;
        if v_variant_price is not null and v_variant_price > 0 then
          v_implicit_disc_pct := (1 - (v_price / v_variant_price)) * 100;
          if not v_is_owner and v_line_max_pct is not null and v_implicit_disc_pct > v_line_max_pct + 0.001 then
            raise exception 'implicit_discount_exceeds_line_pct_limit' using errcode = 'P0001',
              detail = format('implicit %s%% (price %s vs %s) > cap %s%%', round(v_implicit_disc_pct,2), v_price, v_variant_price, v_line_max_pct); end if;
        end if;
      end if;
    end loop;
  end if;
  if p_sale_discount_type = 'percent' then
    v_invoice_disc_pct := p_sale_discount_value;
    v_invoice_disc_amt := round(v_items_subtotal * p_sale_discount_value / 100, 2);
  elsif p_sale_discount_type = 'fixed' then
    v_invoice_disc_amt := p_sale_discount_value;
    v_invoice_disc_pct := case when v_items_subtotal > 0 then (p_sale_discount_value / v_items_subtotal * 100) else 0 end;
  else v_invoice_disc_pct := 0; v_invoice_disc_amt := 0; end if;
  if not v_is_owner then
    if v_invoice_max_pct is not null and v_invoice_disc_pct > v_invoice_max_pct + 0.001 then
      raise exception 'discount_exceeds_invoice_pct_limit' using errcode = 'P0001', detail = format('invoice %s%% > cap %s%%', v_invoice_disc_pct, v_invoice_max_pct); end if;
    if v_invoice_max_pkr is not null and v_invoice_disc_amt > v_invoice_max_pkr + 0.001 then
      raise exception 'discount_exceeds_invoice_pkr_limit' using errcode = 'P0001', detail = format('invoice %s PKR > cap %s PKR', v_invoice_disc_amt, v_invoice_max_pkr); end if;
  end if;
  if coalesce(p_confirm_expired_sale, false) = true
     and not public.user_has_permission(v_shop_id, 'confirm_expired_sale_at_pos') then
    raise exception 'insufficient_permissions' using errcode = 'P0001',
      detail = 'Required: confirm_expired_sale_at_pos';
  end if;

  -- ===================================================================
  -- PHASE 2 — the transaction (from record_sale_v28, adapted for
  -- contact_id / direction). v_items_subtotal is RESET here: Phase 1
  -- used it raw for cap checks; Phase 2 recomputes it post-line-discount
  -- for the invoice money math.
  -- ===================================================================
  v_items_subtotal := 0;
  v_service := coalesce(p_service_charge, 0);
  if p_amount_paid is null or p_amount_paid < 0 then raise exception 'amount_paid_negative' using errcode = 'P0001'; end if;
  if v_service < 0 then raise exception 'service_charge_negative' using errcode = 'P0001'; end if;

  if jsonb_typeof(p_items) is null then p_items := '[]'::jsonb; end if;
  if jsonb_array_length(p_items) = 0 and v_service = 0 then
    raise exception 'empty_sale' using errcode = 'P0001';
  end if;

  if (p_sale_discount_type is null) <> (p_sale_discount_value is null) then
    raise exception 'sale_discount_type_and_value_must_both_be_set_or_neither' using errcode = 'P0001';
  end if;
  if p_sale_discount_type is not null and p_sale_discount_type not in ('percent','fixed') then
    raise exception 'invalid_sale_discount_type' using errcode = 'P0001';
  end if;
  if p_sale_discount_type = 'percent' and (p_sale_discount_value < 0 or p_sale_discount_value > 100) then
    raise exception 'sale_discount_percent_out_of_range' using errcode = 'P0001';
  end if;
  if p_sale_discount_type = 'fixed' and p_sale_discount_value < 0 then
    raise exception 'sale_discount_fixed_negative' using errcode = 'P0001';
  end if;

  -- first pass: compute v_items_subtotal (pure in-memory arithmetic — no DB)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    if v_qty is null or v_qty <= 0 then raise exception 'qty_must_be_positive' using errcode = 'P0001'; end if;
    if v_price is null or v_price < 0 then raise exception 'price_must_be_non_negative' using errcode = 'P0001'; end if;
    v_line_subtotal := v_qty * v_price;

    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    if v_item->>'line_discount_value' is null then
      v_line_discount_value := null;
    else
      v_line_discount_value := (v_item->>'line_discount_value')::numeric(12,2);
    end if;

    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      if v_line_discount_value is null or v_line_discount_value < 0 or v_line_discount_value > 100 then
        raise exception 'line_discount_percent_out_of_range' using errcode = 'P0001';
      end if;
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    elsif v_line_discount_type = 'fixed' then
      if v_line_discount_value is null or v_line_discount_value < 0 then
        raise exception 'line_discount_fixed_negative' using errcode = 'P0001';
      end if;
      if v_line_discount_value > v_line_subtotal then
        raise exception 'line_discount_exceeds_line_subtotal' using errcode = 'P0001';
      end if;
      v_line_discount_amount := v_line_discount_value;
    else
      raise exception 'invalid_line_discount_type' using errcode = 'P0001';
    end if;

    v_line_total := v_line_subtotal - v_line_discount_amount;
    v_items_subtotal := v_items_subtotal + v_line_total;
  end loop;

  if p_sale_discount_type = 'percent' then
    v_sale_discount_percent_snapshot := p_sale_discount_value;
    v_sale_discount_amount := round(v_items_subtotal * p_sale_discount_value / 100, 2);
  elsif p_sale_discount_type = 'fixed' then
    v_sale_discount_percent_snapshot := null;
    if p_sale_discount_value > v_items_subtotal then
      raise exception 'sale_discount_fixed_exceeds_items_subtotal' using errcode = 'P0001';
    end if;
    v_sale_discount_amount := p_sale_discount_value;
  else
    v_sale_discount_percent_snapshot := null;
    v_sale_discount_amount := 0;
  end if;

  v_total := (v_items_subtotal - v_sale_discount_amount) + v_service;

  if p_amount_paid > v_total then raise exception 'amount_paid_exceeds_total' using errcode = 'P0001'; end if;
  v_credit := v_total - p_amount_paid;
  v_payment_type := case
    when v_credit = 0 then 'cash'
    when p_amount_paid = 0 then 'credit'
    else 'partial'
  end;

  -- ----- CONSOLIDATED contact block (Bug 2 fix) -----
  -- Both contact concerns adjacent, after the money math (v_credit known),
  -- immediately before the invoice insert. record_sale_v28 did its strict
  -- customer check here too; this is closer to v2.9's structure, not
  -- further. ONE strict lookup replaces v2.9's lenient-tier-lookup +
  -- strict-existence-check pair.
  --   requirement: a credit sale needs a customer-side contact to carry
  --                the receivable; a cash/walk-in sale may have none.
  --   validation:  if a contact was given it must exist in this shop and
  --                be customer-side.
  if v_credit > 0 and p_contact_id is null then
    raise exception 'contact_required_for_credit' using errcode = 'P0001';
  end if;
  if p_contact_id is not null then
    select contact_type, customer_tier_id
      into v_contact_type, v_customer_tier_id
      from public.contacts
     where id = p_contact_id and shop_id = v_shop_id;
    if not found then raise exception 'contact_not_in_shop' using errcode = 'P0001'; end if;
    if v_contact_type not in ('customer','both') then
      raise exception 'contact_not_a_customer' using errcode = 'P0001';
    end if;
  end if;

  -- contact_id only — invoices.customer_id left NULL (frozen-legacy-world,
  -- §B; the legacy column + the views projecting it are dropped in 0104)
  insert into public.invoices (
    shop_id, contact_id, total, service_charge, payment_type,
    amount_paid, notes, cashier_id, tier_id,
    sale_discount_type, sale_discount_value,
    sale_discount_percent_snapshot, sale_discount_amount
  ) values (
    v_shop_id, p_contact_id, v_total, v_service, v_payment_type,
    p_amount_paid, nullif(p_notes, ''), v_user_id, v_customer_tier_id,
    p_sale_discount_type, p_sale_discount_value,
    v_sale_discount_percent_snapshot, v_sale_discount_amount
  ) returning id into v_invoice_id;

  -- ----- per-item: variant resolve + FEFO batch picking + sale_items -----
  -- (verbatim from record_sale_v28 — touches no customer/supplier state)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    v_price := (v_item->>'price_at_sale')::numeric(12,2);
    v_line_subtotal := v_qty * v_price;

    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_resolved_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select id into v_resolved_variant_id
        from public.product_variants
       where product_id = (v_item->>'product_id')::uuid
         and is_default and is_active;
      if v_resolved_variant_id is null then raise exception 'product_has_no_default_variant' using errcode = 'P0001'; end if;
    else
      raise exception 'item_missing_variant_or_product_id' using errcode = 'P0001';
    end if;

    select v.id, v.stock, v.avg_cost, v.price as variant_price, p.shop_id, p.id as product_id, p.has_batches,
           p.expired_sale_policy as product_policy
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_resolved_variant_id and v.is_active
     for update;

    if not found then raise exception 'variant_not_found_or_inactive' using errcode = 'P0001'; end if;
    if v_variant.shop_id <> v_shop_id then raise exception 'variant_not_in_shop' using errcode = 'P0001'; end if;
    if v_variant.variant_price is null then raise exception 'variant_not_sellable' using errcode = 'P0001'; end if;
    if v_variant.stock < v_qty then raise exception 'insufficient_stock' using errcode = 'P0001', detail = format('variant %s', v_variant.id); end if;

    v_line_discount_type := nullif(v_item->>'line_discount_type', '');
    if v_item->>'line_discount_value' is null then
      v_line_discount_value := null;
    else
      v_line_discount_value := (v_item->>'line_discount_value')::numeric(12,2);
    end if;
    if v_line_discount_type is null then
      v_line_discount_amount := 0;
    elsif v_line_discount_type = 'percent' then
      v_line_discount_amount := round(v_line_subtotal * v_line_discount_value / 100, 2);
    else
      v_line_discount_amount := v_line_discount_value;
    end if;

    if not v_variant.has_batches then
      insert into public.sale_items (
        invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
        line_discount_type, line_discount_value, line_discount_amount,
        batch_id, sold_expired
      ) values (
        v_invoice_id, v_variant.id, v_qty, v_price, v_variant.avg_cost,
        v_line_discount_type, v_line_discount_value, v_line_discount_amount,
        null, false
      );
    else
      v_override_batch_id := nullif(v_item->>'batch_id', '')::uuid;

      select coalesce(
        v_variant.product_policy,
        (select default_expired_sale_policy from public.shops where id = v_shop_id),
        'warn'::public.expired_sale_policy
      ) into v_effective_policy;

      v_qty_arr := array[]::int[];
      v_batch_id_arr := array[]::uuid[];
      v_cost_arr := array[]::numeric(12,2)[];
      v_sold_expired_arr := array[]::boolean[];

      if v_override_batch_id is not null then
        select b.id, b.qty_remaining, b.cost_per_unit, b.expiry_date
          into v_batch
          from public.inventory_batches b
         where b.id = v_override_batch_id
           and b.variant_id = v_variant.id
           and b.is_active
           for update;
        if not found then raise exception 'batch_not_in_variant_or_inactive' using errcode = 'P0001'; end if;
        if v_batch.qty_remaining < v_qty then raise exception 'selected_batch_insufficient' using errcode = 'P0001'; end if;

        v_batch_expired := (v_batch.expiry_date is not null and v_batch.expiry_date < current_date);

        if v_batch_expired then
          if v_effective_policy = 'block' then raise exception 'expired_stock_blocked' using errcode = 'P0001';
          elsif v_effective_policy = 'warn' and not coalesce(p_confirm_expired_sale, false) then
            raise exception 'expired_stock_needs_confirmation' using errcode = 'P0001';
          end if;
        end if;

        v_qty_arr := array[v_qty];
        v_batch_id_arr := array[v_batch.id];
        v_cost_arr := array[v_batch.cost_per_unit];
        v_sold_expired_arr := array[v_batch_expired];
      else
        v_remaining_qty := v_qty;

        if v_effective_policy = 'allow' then
          for v_batch in
            select id, qty_remaining, cost_per_unit, expiry_date
              from public.inventory_batches
             where variant_id = v_variant.id
               and is_active and qty_remaining > 0
             order by expiry_date nulls last, received_at asc, id asc
             for update
          loop
            exit when v_remaining_qty <= 0;
            v_chunk_qty := least(v_batch.qty_remaining, v_remaining_qty);
            v_qty_arr := v_qty_arr || v_chunk_qty;
            v_batch_id_arr := v_batch_id_arr || v_batch.id;
            v_cost_arr := v_cost_arr || v_batch.cost_per_unit;
            v_sold_expired_arr := v_sold_expired_arr || (
              v_batch.expiry_date is not null and v_batch.expiry_date < current_date
            );
            v_remaining_qty := v_remaining_qty - v_chunk_qty;
          end loop;
        else
          for v_batch in
            select id, qty_remaining, cost_per_unit, expiry_date
              from public.inventory_batches
             where variant_id = v_variant.id
               and is_active and qty_remaining > 0
               and (expiry_date is null or expiry_date >= current_date)
             order by expiry_date nulls last, received_at asc, id asc
             for update
          loop
            exit when v_remaining_qty <= 0;
            v_chunk_qty := least(v_batch.qty_remaining, v_remaining_qty);
            v_qty_arr := v_qty_arr || v_chunk_qty;
            v_batch_id_arr := v_batch_id_arr || v_batch.id;
            v_cost_arr := v_cost_arr || v_batch.cost_per_unit;
            v_sold_expired_arr := v_sold_expired_arr || false;
            v_remaining_qty := v_remaining_qty - v_chunk_qty;
          end loop;

          if v_remaining_qty > 0 then
            if v_effective_policy = 'block' then
              raise exception 'insufficient_non_expired_stock' using errcode = 'P0001', detail = format('variant %s', v_variant.id);
            elsif not coalesce(p_confirm_expired_sale, false) then
              raise exception 'expired_stock_needs_confirmation' using errcode = 'P0001';
            end if;

            for v_batch in
              select id, qty_remaining, cost_per_unit, expiry_date
                from public.inventory_batches
               where variant_id = v_variant.id
                 and is_active and qty_remaining > 0
                 and expiry_date is not null
                 and expiry_date < current_date
               order by expiry_date desc, received_at asc, id asc
               for update
            loop
              exit when v_remaining_qty <= 0;
              v_chunk_qty := least(v_batch.qty_remaining, v_remaining_qty);
              v_qty_arr := v_qty_arr || v_chunk_qty;
              v_batch_id_arr := v_batch_id_arr || v_batch.id;
              v_cost_arr := v_cost_arr || v_batch.cost_per_unit;
              v_sold_expired_arr := v_sold_expired_arr || true;
              v_remaining_qty := v_remaining_qty - v_chunk_qty;
            end loop;
          end if;
        end if;

        if v_remaining_qty > 0 then
          raise exception 'no_batch_stock_available' using errcode = 'P0001', detail = format('variant %s', v_variant.id);
        end if;
      end if;

      v_chunk_count := array_length(v_qty_arr, 1);
      v_discount_alloc := array[]::numeric(12,2)[];
      v_alloc_sum := 0;
      v_max_qty_idx := 1;
      for v_chunk_idx in 1..v_chunk_count loop
        v_discount_alloc := v_discount_alloc || round(
          v_line_discount_amount * v_qty_arr[v_chunk_idx] / v_qty, 2
        );
        v_alloc_sum := v_alloc_sum + v_discount_alloc[v_chunk_idx];
        if v_qty_arr[v_chunk_idx] > v_qty_arr[v_max_qty_idx] then
          v_max_qty_idx := v_chunk_idx;
        end if;
      end loop;
      if v_alloc_sum <> v_line_discount_amount then
        v_discount_alloc[v_max_qty_idx] :=
          v_discount_alloc[v_max_qty_idx] + (v_line_discount_amount - v_alloc_sum);
      end if;

      for v_chunk_idx in 1..v_chunk_count loop
        insert into public.sale_items (
          invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
          line_discount_type, line_discount_value, line_discount_amount,
          batch_id, sold_expired
        ) values (
          v_invoice_id, v_variant.id, v_qty_arr[v_chunk_idx], v_price,
          v_cost_arr[v_chunk_idx],
          v_line_discount_type, v_line_discount_value,
          v_discount_alloc[v_chunk_idx],
          v_batch_id_arr[v_chunk_idx],
          v_sold_expired_arr[v_chunk_idx]
        );
        update public.inventory_batches
           set qty_remaining = qty_remaining - v_qty_arr[v_chunk_idx],
               updated_at = now()
         where id = v_batch_id_arr[v_chunk_idx];
      end loop;
    end if;

    update public.product_variants set stock = stock - v_qty, updated_at = now()
     where id = v_variant.id;
  end loop;

  -- ----- credit -> receivable ledger debit -----
  -- direction='receivable'; contact_id set; customer_id LEFT NULL
  -- (frozen-legacy-world, §B). The 0101 trigger updates
  -- contacts.customer_outstanding_balance; its legacy customers branch
  -- is correctly skipped (customer_id IS NULL guard).
  if v_credit > 0 then
    insert into public.ledger_entries (
      shop_id, contact_id, customer_id, invoice_id, amount, type, direction, created_by_user_id
    ) values (
      v_shop_id, p_contact_id, null, v_invoice_id, v_credit, 'debit', 'receivable', v_user_id
    );
  end if;

  return v_invoice_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- record_purchase — record_purchase_v28's body inlined, adapted for
-- contact_id, plus the new p_amount_paid param + the payable ledger
-- entry. The largest-remainder overhead allocation + per-item
-- pack/cost/avg-cost/batch logic is verbatim except
-- inventory_batches.supplier_id -> contact_id. p_amount_paid is appended
-- last; NULL => fully paid (legacy behavior). Three C3 edge cases:
-- opening stock forces fully-paid; NULL p_amount_paid => total_cost;
-- a partial/unpaid purchase with no contact raises.
-- ---------------------------------------------------------------------
DROP FUNCTION public.record_purchase(uuid, date, text, jsonb, jsonb, boolean);

CREATE FUNCTION public.record_purchase(
  p_contact_id uuid DEFAULT NULL,
  p_purchase_date date DEFAULT CURRENT_DATE,
  p_note text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_overhead_items jsonb DEFAULT '[]'::jsonb,
  p_is_opening boolean DEFAULT false,
  p_amount_paid numeric DEFAULT NULL          -- B.0.2: NULL => fully paid (legacy behavior)
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_items_subtotal numeric(12,2) := 0;
  v_overhead_subtotal numeric(12,2) := 0;
  v_total_cost numeric(12,2);
  v_amount_paid numeric(12,2);
  v_item jsonb;
  v_overhead jsonb;
  v_variant record;
  v_pack record;
  v_idx int := 0;
  v_qty int;
  v_pack_qty int;
  v_pack_id uuid;
  v_pack_base_qty_snapshot int;
  v_qty_in_base int;
  v_cost numeric(12,2);
  v_line_value numeric(12,2);
  v_per_base_unit_cost numeric(12,2);
  v_line_overhead numeric(12,2);
  v_overhead_per_base_unit numeric(12,2);
  v_effective_per_base_cost numeric(12,2);
  v_contact_name text;
  v_contact_type text;
  v_source text;
  v_shares numeric(12,2)[];
  v_resolved_variant_id uuid;
  v_purchase_item_id uuid;
  v_batch jsonb;
  v_batch_id uuid;
  v_batch_no text;
  v_warranty_days int;
  v_warranty_expires date;
  v_expiry_date date;
  v_mfg_date date;
begin
  -- ===== P1/P2/P3 =====
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'record_purchase') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: record_purchase';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_purchase' using errcode = 'P0001';
  end if;

  -- contact lookup (was suppliers); must be supplier-side
  if p_contact_id is not null then
    select name, contact_type into v_contact_name, v_contact_type
      from public.contacts
     where id = p_contact_id and shop_id = v_shop_id and is_active = true;
    if not found then raise exception 'contact_not_in_shop' using errcode = 'P0001'; end if;
    if v_contact_type not in ('supplier','both') then
      raise exception 'contact_not_a_supplier' using errcode = 'P0001';
    end if;
  end if;

  -- ----- first pass: subtotals -----
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);
    if v_cost is null or v_cost < 0 then raise exception 'cost_must_be_non_negative' using errcode = 'P0001'; end if;
    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_qty := (v_item->>'pack_qty')::int;
      if v_pack_qty is null or v_pack_qty <= 0 then raise exception 'pack_qty_must_be_positive' using errcode = 'P0001'; end if;
      v_items_subtotal := v_items_subtotal + (v_pack_qty * v_cost);
    else
      v_qty := (v_item->>'qty')::int;
      if v_qty is null or v_qty <= 0 then raise exception 'qty_must_be_positive' using errcode = 'P0001'; end if;
      v_items_subtotal := v_items_subtotal + (v_qty * v_cost);
    end if;
  end loop;

  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      if (v_overhead->>'category') not in ('delivery','labor','customs','packaging','other') then
        raise exception 'invalid_overhead_category' using errcode = 'P0001';
      end if;
      if ((v_overhead->>'amount')::numeric(12,2)) <= 0 then
        raise exception 'overhead_amount_must_be_positive' using errcode = 'P0001';
      end if;
      v_overhead_subtotal := v_overhead_subtotal + (v_overhead->>'amount')::numeric(12,2);
    end loop;
  end if;

  -- largest-remainder overhead allocation (verbatim)
  if v_overhead_subtotal > 0 and v_items_subtotal > 0 then
    with input_lines as (
      select elem.idx::int as idx,
        case
          when (elem.row->>'pack_id') is not null
            then (elem.row->>'pack_qty')::int * (elem.row->>'cost_at_purchase')::numeric
          else (elem.row->>'qty')::int * (elem.row->>'cost_at_purchase')::numeric
        end as line_value
      from jsonb_array_elements(p_items) with ordinality as elem(row, idx)
    ),
    raw_shares as (
      select idx, line_value,
             round(v_overhead_subtotal * line_value / v_items_subtotal, 2) as raw,
             row_number() over (order by line_value desc, idx) as rk
        from input_lines
    ),
    delta as (
      select v_overhead_subtotal - coalesce(sum(raw), 0) as d from raw_shares
    )
    select array_agg(case when rs.rk = 1 then rs.raw + d.d else rs.raw end order by rs.idx)
      into v_shares from raw_shares rs cross join delta d;
  end if;

  -- ----- resolve amount_paid (B.0.2 + Round 2 C3) -----
  v_total_cost := v_items_subtotal + v_overhead_subtotal;
  if p_is_opening then
    -- opening stock is not a debt — always fully paid, no payable entry (C3b)
    v_amount_paid := v_total_cost;
  elsif p_amount_paid is null then
    -- default: fully paid, preserves legacy record_purchase behavior (C3c)
    v_amount_paid := v_total_cost;
  else
    v_amount_paid := p_amount_paid;
    if v_amount_paid < 0 or v_amount_paid > v_total_cost then
      raise exception 'invalid_amount_paid' using errcode = 'P0001',
        detail = format('amount_paid %s must be between 0 and total_cost %s', v_amount_paid, v_total_cost);
    end if;
  end if;
  -- can't owe money to nobody (C3a)
  if v_amount_paid < v_total_cost and p_contact_id is null then
    raise exception 'unpaid_purchase_requires_supplier' using errcode = 'P0001';
  end if;

  v_source := case
    when p_is_opening then 'Opening Stock'
    when p_contact_id is not null then v_contact_name
    else 'Direct purchase'
  end;
  -- contact_id set; supplier_id LEFT NULL (frozen-legacy-world, §B/C5)
  insert into public.purchases (
    shop_id, contact_id, total_cost, items_subtotal, overhead_subtotal,
    amount_paid, source, note, purchase_date, cashier_id, is_opening
  ) values (
    v_shop_id, p_contact_id,
    v_total_cost, v_items_subtotal, v_overhead_subtotal,
    v_amount_paid, v_source, nullif(trim(coalesce(p_note,'')),''),
    coalesce(p_purchase_date, current_date),
    v_user_id, coalesce(p_is_opening, false)
  ) returning id into v_purchase_id;

  if jsonb_typeof(p_overhead_items) = 'array' then
    for v_overhead in select * from jsonb_array_elements(p_overhead_items) loop
      insert into public.purchase_overhead_items (purchase_id, category, amount, description)
      values (v_purchase_id, v_overhead->>'category',
        (v_overhead->>'amount')::numeric(12,2),
        nullif(trim(coalesce(v_overhead->>'description','')),''));
    end loop;
  end if;

  -- ----- second pass: per-item variant/pack/cost/batch (verbatim except
  -- inventory_batches.supplier_id -> contact_id) -----
  v_idx := 0;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    v_cost := (v_item->>'cost_at_purchase')::numeric(12,2);

    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_resolved_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select id into v_resolved_variant_id
        from public.product_variants
       where product_id = (v_item->>'product_id')::uuid and is_default and is_active;
      if v_resolved_variant_id is null then raise exception 'product_has_no_default_variant' using errcode = 'P0001'; end if;
    else
      raise exception 'item_missing_variant_or_product_id' using errcode = 'P0001';
    end if;

    select v.id, v.product_id, v.stock, v.avg_cost, p.shop_id, p.has_batches
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_resolved_variant_id and v.is_active
     for update;

    if not found then raise exception 'variant_not_found_or_inactive' using errcode = 'P0001'; end if;
    if v_variant.shop_id <> v_shop_id then raise exception 'variant_not_in_shop' using errcode = 'P0001'; end if;

    if v_item ? 'pack_id' and (v_item->>'pack_id') is not null then
      v_pack_id := (v_item->>'pack_id')::uuid;
      v_pack_qty := (v_item->>'pack_qty')::int;
      select id, base_qty into v_pack
        from public.product_packs
       where id = v_pack_id and variant_id = v_variant.id and is_active;
      if not found then raise exception 'pack_not_found_or_inactive' using errcode = 'P0001'; end if;
      v_pack_base_qty_snapshot := v_pack.base_qty;
      v_qty_in_base := v_pack_qty * v_pack_base_qty_snapshot;
      v_line_value := v_pack_qty * v_cost;
    else
      v_pack_id := null;
      v_pack_qty := null;
      v_pack_base_qty_snapshot := null;
      v_qty_in_base := (v_item->>'qty')::int;
      v_line_value := v_qty_in_base * v_cost;
    end if;

    v_per_base_unit_cost := round(v_line_value / v_qty_in_base, 2);
    v_line_overhead := coalesce(v_shares[v_idx], 0);
    v_overhead_per_base_unit := case when v_qty_in_base > 0 then round(v_line_overhead / v_qty_in_base, 2) else 0 end;
    v_effective_per_base_cost := round(v_per_base_unit_cost + (v_line_overhead / nullif(v_qty_in_base, 0)::numeric), 2);

    v_batch_id := null;
    if v_variant.has_batches then
      v_batch := v_item -> 'batch';
      if v_batch is null or jsonb_typeof(v_batch) <> 'object' then
        raise exception 'batch_info_required_for_batched_product' using errcode = 'P0001';
      end if;
      v_batch_no := nullif(trim(coalesce(v_batch->>'batch_no', '')), '');
      if v_batch_no is null then raise exception 'batch_no_required' using errcode = 'P0001'; end if;
      v_mfg_date := nullif(v_batch->>'manufactured_date', '')::date;
      v_expiry_date := nullif(v_batch->>'expiry_date', '')::date;
      v_warranty_days := nullif(v_batch->>'supplier_warranty_days', '')::int;
      if v_warranty_days is not null and v_warranty_days > 0 then
        v_warranty_expires := coalesce(p_purchase_date, current_date) + v_warranty_days;
      else
        v_warranty_expires := null;
      end if;
      begin
        insert into public.inventory_batches (
          variant_id, batch_no, contact_id,
          qty_received, qty_remaining, cost_per_unit,
          manufactured_date, expiry_date,
          supplier_warranty_days, warranty_expires_at,
          received_at
        ) values (
          v_variant.id, v_batch_no, p_contact_id,
          v_qty_in_base, v_qty_in_base, v_effective_per_base_cost,
          v_mfg_date, v_expiry_date,
          v_warranty_days, v_warranty_expires,
          coalesce(p_purchase_date, current_date)
        ) returning id into v_batch_id;
      exception
        when unique_violation then raise exception 'duplicate_batch_no' using errcode = 'P0001';
      end;
    end if;

    insert into public.purchase_items (
      purchase_id, variant_id, qty, qty_in_base,
      cost_at_purchase,
      line_overhead_amount, overhead_per_unit,
      pack_id, pack_qty, pack_base_qty_snapshot,
      avg_cost_before, avg_cost_after,
      batch_id
    ) values (
      v_purchase_id, v_variant.id, v_qty_in_base, v_qty_in_base,
      v_cost,
      v_line_overhead, v_overhead_per_base_unit,
      v_pack_id, v_pack_qty, v_pack_base_qty_snapshot,
      v_variant.avg_cost,
      case
        when v_variant.stock + v_qty_in_base = 0 then v_variant.avg_cost
        when v_variant.stock <= 0                then v_effective_per_base_cost
        else round((v_variant.stock * v_variant.avg_cost + v_qty_in_base * v_effective_per_base_cost)
                   / (v_variant.stock + v_qty_in_base), 2)
      end,
      v_batch_id
    ) returning id into v_purchase_item_id;

    if v_batch_id is not null then
      update public.inventory_batches
         set purchase_item_id = v_purchase_item_id
       where id = v_batch_id;
    end if;

    update public.product_variants
       set stock = stock + v_qty_in_base,
           avg_cost = case
             when stock + v_qty_in_base = 0 then avg_cost
             when stock <= 0                then v_effective_per_base_cost
             else round((stock * avg_cost + v_qty_in_base * v_effective_per_base_cost)
                        / (stock + v_qty_in_base), 2)
           end,
           last_purchase_cost = v_cost,
           cost = case when stock <= 0 then v_cost else cost end,
           updated_at = now()
     where id = v_variant.id;
  end loop;

  -- ----- unpaid balance -> payable ledger debit -----
  -- direction='payable'; contact_id set (guaranteed non-null here — the
  -- unpaid+null-contact case raised above); customer_id NULL; purchase_id
  -- set (Decision A). The 0101 trigger increments
  -- contacts.supplier_outstanding_balance.
  if v_amount_paid < v_total_cost then
    insert into public.ledger_entries (
      shop_id, contact_id, customer_id, invoice_id, amount, type, direction,
      purchase_id, created_by_user_id
    ) values (
      v_shop_id, p_contact_id, null, null, v_total_cost - v_amount_paid, 'debit', 'payable',
      v_purchase_id, v_user_id
    );
  end if;

  return v_purchase_id;
end;
$function$;

-- =====================================================================
-- §3 — Round 2 Part 2b: receive_payment + reverse_ledger_entry
-- =====================================================================

-- ---------------------------------------------------------------------
-- receive_payment — DROP+CREATE (p_customer_id -> p_contact_id). C1:
-- validate contact -> cap -> overpayment -> insert (matches pay_supplier;
-- the v2.9 wrapper validated cap-before-customer). F-R2-3: the cap sum is
-- scoped to direction='receivable'. FOR UPDATE on the contact is KEPT —
-- the overpayment guard is a read-decide-write race the lock serializes.
-- §B/C5: customer_id left NULL on the new receivable credit.
-- ---------------------------------------------------------------------
DROP FUNCTION public.receive_payment(uuid, numeric, text);

CREATE FUNCTION public.receive_payment(
  p_contact_id uuid, p_amount numeric, p_notes text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id      uuid := public.current_active_shop_id();
  v_is_owner     boolean;
  v_cap          numeric;
  v_today_total  numeric;
  v_contact_shop uuid;
  v_contact_type text;
  v_outstanding  numeric(12,2);
  v_id           uuid;
begin
  -- P1/P2/P3 + amount
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'receive_payment') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: receive_payment';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive' using errcode = 'P0001'; end if;

  -- (1) Validate the contact FIRST (C1) — lock it, read the receivable
  -- balance. FOR UPDATE is load-bearing: step (3) reads v_outstanding,
  -- decides overpayment, then inserts — a read-decide-write race.
  select shop_id, contact_type, customer_outstanding_balance
    into v_contact_shop, v_contact_type, v_outstanding
    from public.contacts where id = p_contact_id for update;
  if not found then raise exception 'contact_not_found' using errcode = 'P0001'; end if;
  if v_contact_shop <> v_shop_id then raise exception 'contact_not_in_shop' using errcode = 'P0001'; end if;
  if v_contact_type not in ('customer','both') then
    raise exception 'contact_not_a_customer' using errcode = 'P0001';
  end if;

  -- (2) Non-owner daily cap. Salt is the v2.9 unsalted form — already
  -- distinct from pay_supplier's '...pay_supplier' salt. Cap sum scoped to
  -- direction='receivable' (F-R2-3) so pay_supplier activity does not eat
  -- into the receive_payment cap.
  select is_owner into v_is_owner from public.user_shop_access
   where user_id = auth.uid() and shop_id = v_shop_id;
  if v_is_owner is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not v_is_owner then
    perform pg_advisory_xact_lock(hashtextextended(
      v_shop_id::text || auth.uid()::text || current_date::text, 0));
    select salesperson_payment_cap_pkr into v_cap from public.shops where id = v_shop_id;
    select coalesce(sum(amount), 0) into v_today_total
      from public.ledger_entries
     where created_by_user_id = auth.uid() and shop_id = v_shop_id
       and type = 'credit' and direction = 'receivable'
       and created_at::date = current_date;
    if v_today_total + p_amount > v_cap + 0.001 then
      raise exception 'salesperson_payment_cap_exceeded' using errcode = 'P0001',
        detail = format('today total %s + this %s > cap %s', v_today_total, p_amount, v_cap);
    end if;
  end if;

  -- (3) Overpayment guard (v_outstanding read under the FOR UPDATE lock).
  -- Message format kept byte-identical to v2.9's receive_payment_v28.
  if p_amount > v_outstanding then
    raise exception 'overpayment_customer max=%', v_outstanding using errcode = 'P0001';
  end if;

  -- (4) Receivable credit. §B/C5: customer_id left NULL. The 0101 trigger
  -- decrements contacts.customer_outstanding_balance; the legacy
  -- customers dual-write no-ops on the NULL.
  insert into public.ledger_entries (
    shop_id, contact_id, customer_id, invoice_id, amount, type, direction,
    occurred_at, paid_at, notes, created_by_user_id
  ) values (
    v_shop_id, p_contact_id, null, null, p_amount, 'credit', 'receivable',
    now(), now(), nullif(trim(p_notes), ''), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- reverse_ledger_entry — CREATE OR REPLACE (signature is stable). C2:
-- the permission gate splits by the reversed entry's direction
-- (receivable -> receive_payment, payable -> pay_supplier), so the gate
-- moves AFTER the entry fetch (direction is unknown until the row is
-- read). C4: cannot_reverse_purchase_tied_debit — the symmetric mirror
-- of cannot_reverse_invoice_tied_debit. §B: customer_id, contact_id AND
-- direction are copied verbatim from the original — this is the one RPC
-- that can still propagate a non-null customer_id (for a pre-0103 entry),
-- keeping the legacy customers row in lockstep on reversal.
-- ---------------------------------------------------------------------
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
  -- P1/P2. The P3 permission gate is direction-dependent (C2) and so
  -- moves AFTER the entry fetch. AQ-23's LIKE check is order-independent:
  -- not_authenticated / no_shop_for_user / user_has_permission all appear.
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;

  -- Fetch + lock the original. Must precede the permission gate: C2 splits
  -- the gate by the entry's direction, unknown until the row is read.
  select * into v_orig
    from public.ledger_entries
   where id = p_entry_id and shop_id = v_shop_id
   for update;
  if not found then raise exception 'entry_not_in_shop' using errcode = 'P0001'; end if;

  -- P3 — C2 direction-split permission gate. direction is NOT NULL
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
-- §4 — Round 3: list/search RPCs
-- Class A (collapse-in-place, DROP+CREATE): search_purchases, _count.
-- Class B (fresh-create, renamed): list_contacts, recent_contacts,
-- search_khata_contacts, search_khata_contacts_count.
-- =====================================================================

-- ----- Class A: search_purchases — p_supplier_id -> p_contact_id;
-- return cols supplier_id/supplier_name -> contact_id/contact_name -----
DROP FUNCTION public.search_purchases(date, date, uuid, boolean, integer, integer);

CREATE FUNCTION public.search_purchases(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_contact_id uuid DEFAULT NULL, p_include_opening boolean DEFAULT false,
  p_limit integer DEFAULT 10, p_offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid, purchase_date date, contact_id uuid, contact_name text,
  source text, note text, items_count bigint,
  items_subtotal numeric, overhead_subtotal numeric, total_cost numeric, is_opening boolean
)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_purchases') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_purchases';
  end if;
  return query
    select p.id,
           p.purchase_date,
           p.contact_id,
           c.name as contact_name,
           p.source,
           p.note,
           (select count(distinct pi.product_id)
              from public.purchase_items pi
             where pi.purchase_id = p.id) as items_count,
           p.items_subtotal,
           p.overhead_subtotal,
           p.total_cost,
           p.is_opening
      from public.purchases p
      left join public.contacts c on c.id = p.contact_id
     where p.shop_id = v_shop_id
       and (p_from is null or p.purchase_date >= p_from)
       and (p_to   is null or p.purchase_date <= p_to)
       and (p_contact_id is null or p.contact_id = p_contact_id)
       and (p_include_opening or p.is_opening = false)
     order by p.purchase_date desc, p.created_at desc
     limit greatest(p_limit, 1)
     offset greatest(p_offset, 0);
end;
$function$;

-- ----- Class A: search_purchases_count — p_supplier_id -> p_contact_id -----
DROP FUNCTION public.search_purchases_count(date, date, uuid, boolean);

CREATE FUNCTION public.search_purchases_count(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_contact_id uuid DEFAULT NULL, p_include_opening boolean DEFAULT false
) RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_purchases') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_purchases';
  end if;
  return (
    select count(*)::bigint
      from public.purchases p
     where p.shop_id = v_shop_id
       and (p_from is null or p.purchase_date >= p_from)
       and (p_to   is null or p.purchase_date <= p_to)
       and (p_contact_id is null or p.contact_id = p_contact_id)
       and (p_include_opening or p.is_opening = false)
  );
end;
$function$;

-- ----- Class B: list_contacts — replaces list_customers. Lists ALL
-- contacts; "touching" type filter; both balance columns per-side
-- CASE-gated (R3-5b — they are cost-bearing, never raw-projected);
-- returns is_active + contact_type (D.2 needs both); last_activity_at
-- spans invoices + ledger + purchases. No hard is_active filter. -----
CREATE OR REPLACE FUNCTION public.list_contacts(
  p_query text DEFAULT '', p_contact_type text DEFAULT NULL,
  p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid, name text, contact_type text, phone text, address text,
  customer_outstanding_balance numeric, supplier_outstanding_balance numeric,
  is_active boolean, invoice_count bigint, last_activity_at timestamptz, total_count bigint
)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_can_contact_info  boolean;
  v_can_customer_data boolean;
  v_can_supplier_data boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_contacts') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_contacts';
  end if;
  if p_contact_type is not null and p_contact_type not in ('customer','supplier','both') then
    raise exception 'invalid_contact_type' using errcode = 'P0001';
  end if;

  v_can_contact_info  := public.user_has_permission(v_shop_id, 'view_contact_contact_info');
  v_can_customer_data := public.user_has_permission(v_shop_id, 'view_contact_customer_data');
  v_can_supplier_data := public.user_has_permission(v_shop_id, 'view_contact_supplier_data');

  return query
  with filtered as (
    select c.id, c.name, c.contact_type, c.phone, c.address,
           c.customer_outstanding_balance, c.supplier_outstanding_balance,
           c.is_active, c.created_at
      from public.contacts c
     where c.shop_id = v_shop_id
       and (    -- "touching" semantics: 'customer'->customer+both, 'supplier'->supplier+both, 'both'->both only
         p_contact_type is null
         or c.contact_type = p_contact_type
         or (p_contact_type in ('customer','supplier') and c.contact_type = 'both')
       )
       and (
         coalesce(p_query, '') = ''
         or c.name  ilike '%' || p_query || '%'
         or c.phone ilike '%' || p_query || '%'
       )
  ),
  agg as (
    select f.*,
           coalesce((select count(*) from public.invoices i where i.contact_id = f.id), 0) as invoice_count,
           greatest(
             coalesce((select max(i.created_at)  from public.invoices i       where i.contact_id = f.id), 'epoch'),
             coalesce((select max(le.created_at) from public.ledger_entries le where le.contact_id = f.id), 'epoch'),
             coalesce((select max(p.created_at)  from public.purchases p      where p.contact_id = f.id), 'epoch'),
             f.created_at
           ) as last_activity_at
    from filtered f
  )
  select
    a.id, a.name, a.contact_type,
    case when v_can_contact_info  then a.phone   else null end,
    case when v_can_contact_info  then a.address else null end,
    case when v_can_customer_data then a.customer_outstanding_balance else null end,
    case when v_can_supplier_data then a.supplier_outstanding_balance else null end,
    a.is_active,
    a.invoice_count,
    a.last_activity_at,
    (select count(*) from filtered) as total_count
  from agg a
  order by a.last_activity_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$function$;

-- ----- Class B: recent_contacts — subsumes recent_customers +
-- recent_suppliers. "Touching" type filter; hard is_active=true filter
-- (a picker must not surface archived contacts); pure-recency ordering. -----
CREATE OR REPLACE FUNCTION public.recent_contacts(
  p_limit integer DEFAULT 10, p_contact_type text DEFAULT NULL
) RETURNS TABLE(
  id uuid, name text, contact_type text, phone text, address text,
  last_activity_at timestamptz
)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_can_contact_info boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, 'view_contacts') then
    raise exception 'insufficient_permissions' using errcode = 'P0001', detail = 'Required: view_contacts';
  end if;
  if p_contact_type is not null and p_contact_type not in ('customer','supplier','both') then
    raise exception 'invalid_contact_type' using errcode = 'P0001';
  end if;

  v_can_contact_info := public.user_has_permission(v_shop_id, 'view_contact_contact_info');

  return query
    select
      c.id, c.name, c.contact_type,
      case when v_can_contact_info then c.phone   else null end,
      case when v_can_contact_info then c.address else null end,
      greatest(
        coalesce((select max(i.created_at)  from public.invoices i       where i.contact_id = c.id), 'epoch'),
        coalesce((select max(le.created_at) from public.ledger_entries le where le.contact_id = c.id), 'epoch'),
        coalesce((select max(p.created_at)  from public.purchases p      where p.contact_id = c.id), 'epoch'),
        c.created_at
      ) as last_activity_at
    from public.contacts c
   where c.shop_id = v_shop_id
     and c.is_active = true
     and (
       p_contact_type is null
       or c.contact_type = p_contact_type
       or (p_contact_type in ('customer','supplier') and c.contact_type = 'both')
     )
   order by last_activity_at desc
   limit greatest(p_limit, 1);
end;
$function$;

-- ----- Class B: search_khata_contacts — replaces search_khata_customers.
-- p_direction ('receivable'/'payable') drives a C2 direction-split
-- permission gate AND the side it reads. Single-direction per call, so
-- the function-level gate IS the cost-column gate. -----
CREATE OR REPLACE FUNCTION public.search_khata_contacts(
  p_query text DEFAULT NULL, p_status text DEFAULT 'open',
  p_direction text DEFAULT 'receivable',
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid, name text, phone text, address text,
  outstanding_balance numeric, last_activity_at timestamptz, entry_count bigint
)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_query text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  -- C2 direction-split permission gate
  if p_direction = 'receivable' then
    if not public.user_has_permission(v_shop_id, 'view_contact_customer_data') then
      raise exception 'insufficient_permissions' using errcode = 'P0001',
        detail = 'Required: view_contact_customer_data (receivable khata)';
    end if;
  elsif p_direction = 'payable' then
    if not public.user_has_permission(v_shop_id, 'view_contact_supplier_data') then
      raise exception 'insufficient_permissions' using errcode = 'P0001',
        detail = 'Required: view_contact_supplier_data (payable khata)';
    end if;
  else
    raise exception 'invalid_direction' using errcode = 'P0001', hint = 'Use receivable or payable';
  end if;
  if p_status not in ('open','closed','all') then
    raise exception 'invalid_status' using errcode = 'P0001', hint = 'Use open, closed, or all';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  return query
  with scoped as (
    select
      c.id, c.name, c.phone, c.address,
      case when p_direction = 'receivable'
           then c.customer_outstanding_balance
           else c.supplier_outstanding_balance end as outstanding_balance,
      (select max(le.occurred_at) from public.ledger_entries le
        where le.contact_id = c.id and le.direction = p_direction) as last_activity_at,
      (select count(*) from public.ledger_entries le
        where le.contact_id = c.id and le.direction = p_direction) as entry_count
    from public.contacts c
    where c.shop_id = v_shop_id
      and (
        (p_direction = 'receivable' and c.contact_type in ('customer','both'))
        or (p_direction = 'payable'  and c.contact_type in ('supplier','both'))
      )
  ),
  filtered as (
    select * from scoped s
    where
      case
        when p_status = 'open'   then s.outstanding_balance > 0
        when p_status = 'closed' then s.outstanding_balance = 0 and s.entry_count > 0
        when p_status = 'all'    then s.entry_count > 0
        else false
      end
      and (
        v_query is null
        or s.name  ilike '%' || v_query || '%'
        or s.phone ilike '%' || v_query || '%'
        or s.name  % v_query
        or s.phone % v_query
      )
  )
  select
    f.id, f.name, f.phone, f.address,
    f.outstanding_balance, f.last_activity_at, f.entry_count
  from filtered f
  order by
    case when v_query is null then 0 else 1 end,
    case when v_query is not null
      then greatest(similarity(f.name, v_query), similarity(coalesce(f.phone,''), v_query))
      else 0
    end desc,
    f.outstanding_balance desc,
    f.last_activity_at desc nulls last
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$function$;

-- ----- Class B: search_khata_contacts_count — pagination companion;
-- identical gate + filter logic. -----
CREATE OR REPLACE FUNCTION public.search_khata_contacts_count(
  p_query text DEFAULT NULL, p_status text DEFAULT 'open',
  p_direction text DEFAULT 'receivable'
) RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
declare
  v_shop_id uuid := public.current_active_shop_id();
  v_query text;
  v_count bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if p_direction = 'receivable' then
    if not public.user_has_permission(v_shop_id, 'view_contact_customer_data') then
      raise exception 'insufficient_permissions' using errcode = 'P0001',
        detail = 'Required: view_contact_customer_data (receivable khata)';
    end if;
  elsif p_direction = 'payable' then
    if not public.user_has_permission(v_shop_id, 'view_contact_supplier_data') then
      raise exception 'insufficient_permissions' using errcode = 'P0001',
        detail = 'Required: view_contact_supplier_data (payable khata)';
    end if;
  else
    raise exception 'invalid_direction' using errcode = 'P0001', hint = 'Use receivable or payable';
  end if;
  if p_status not in ('open','closed','all') then
    raise exception 'invalid_status' using errcode = 'P0001', hint = 'Use open, closed, or all';
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  perform set_limit(0.2);

  with scoped as (
    select
      c.name, c.phone,
      case when p_direction = 'receivable'
           then c.customer_outstanding_balance
           else c.supplier_outstanding_balance end as outstanding_balance,
      (select count(*) from public.ledger_entries le
        where le.contact_id = c.id and le.direction = p_direction) as entry_count
    from public.contacts c
    where c.shop_id = v_shop_id
      and (
        (p_direction = 'receivable' and c.contact_type in ('customer','both'))
        or (p_direction = 'payable'  and c.contact_type in ('supplier','both'))
      )
  )
  select count(*) into v_count
  from scoped s
  where
    case
      when p_status = 'open'   then s.outstanding_balance > 0
      when p_status = 'closed' then s.outstanding_balance = 0 and s.entry_count > 0
      when p_status = 'all'    then s.entry_count > 0
      else false
    end
    and (
      v_query is null
      or s.name  ilike '%' || v_query || '%'
      or s.phone ilike '%' || v_query || '%'
      or s.name  % v_query
      or s.phone % v_query
    );

  return coalesce(v_count, 0);
end;
$function$;

-- =====================================================================
-- §5 — §3.4 purchases_view extension (CREATE OR REPLACE VIEW —
-- append-only: the existing 12 columns are unchanged in order/name/type,
-- the 4 v2.10 columns append at the end. supplier_id is retained for the
-- 0103->0104 window; its removal pairs with the 0104 supplier_id column
-- drop. amount_paid / outstanding are purchase-level money (same class as
-- total_cost) — row-gated by view_purchases, no per-column CASE.
-- =====================================================================
CREATE OR REPLACE VIEW public.purchases_view
  WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT (SELECT public.current_active_shop_id()) AS active_shop_id,
         (SELECT public.user_has_permission((SELECT public.current_active_shop_id()),
           'view_purchases')) AS can_view
)
SELECT
  p.id,
  p.shop_id,
  p.total_cost,
  p.source,
  p.note,
  p.purchase_date,
  p.cashier_id,
  p.is_opening,
  p.supplier_id,
  p.items_subtotal,
  p.overhead_subtotal,
  p.created_at,
  p.contact_id,
  c.name AS contact_name,
  p.amount_paid,
  p.outstanding
FROM public.purchases p
LEFT JOIN public.contacts c ON c.id = p.contact_id
CROSS JOIN caller_perms cp
WHERE p.shop_id = cp.active_shop_id AND cp.can_view;

-- =====================================================================
-- §6 — retire the 6 _v28 shims (Decision C — completes 0103's six).
-- After §2/§3/§4 the rewritten/collapsed wrappers are self-contained;
-- the shims are orphaned. The Round 1 call-site query confirmed each
-- _v28 is referenced ONLY by its same-named wrapper.
-- =====================================================================
DROP FUNCTION public.record_sale_v28(uuid, numeric, numeric, text, jsonb, text, numeric, boolean);
DROP FUNCTION public.record_purchase_v28(uuid, date, text, jsonb, jsonb, boolean);
DROP FUNCTION public.receive_payment_v28(uuid, numeric, text);
DROP FUNCTION public.reverse_ledger_entry_v28(uuid, text);
DROP FUNCTION public.search_purchases_v28(date, date, uuid, boolean, integer, integer);
DROP FUNCTION public.search_purchases_count_v28(date, date, uuid, boolean);

-- =====================================================================
-- §7 — Grants (ADR-0015 pattern: revoke from public + anon; grant to
-- authenticated + service_role). Re-applied to ALL 10 functions — the
-- DROP+CREATE ones lost their grants; the CREATE OR REPLACE ones are
-- re-applied explicitly (the 0102b lesson: never assume a grant). The
-- purchases_view REVOKE is idempotent (anon already has no SELECT).
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.record_sale(uuid,numeric,numeric,text,jsonb,text,numeric,boolean)   FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.record_purchase(uuid,date,text,jsonb,jsonb,boolean,numeric)         FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.receive_payment(uuid,numeric,text)                                  FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.reverse_ledger_entry(uuid,text)                                     FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.search_purchases(date,date,uuid,boolean,integer,integer)            FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.search_purchases_count(date,date,uuid,boolean)                      FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.list_contacts(text,text,integer,integer)                            FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.recent_contacts(integer,text)                                       FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.search_khata_contacts(text,text,text,integer,integer)               FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.search_khata_contacts_count(text,text,text)                         FROM public, anon;
REVOKE SELECT  ON public.purchases_view                                                               FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.record_sale(uuid,numeric,numeric,text,jsonb,text,numeric,boolean)    TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.record_purchase(uuid,date,text,jsonb,jsonb,boolean,numeric)          TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.receive_payment(uuid,numeric,text)                                   TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.reverse_ledger_entry(uuid,text)                                      TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.search_purchases(date,date,uuid,boolean,integer,integer)             TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.search_purchases_count(date,date,uuid,boolean)                       TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.list_contacts(text,text,integer,integer)                             TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.recent_contacts(integer,text)                                        TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.search_khata_contacts(text,text,text,integer,integer)                TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.search_khata_contacts_count(text,text,text)                          TO authenticated, service_role;
GRANT  SELECT  ON public.purchases_view                                                                TO authenticated, service_role;

-- =====================================================================
-- §8 — consolidated verification block. Structural only; behavior
-- (FEFO, discount caps, cap-ordering, copy-on-reverse, projection /
-- gating / "touching"-filter / direction-split) is proven by Phase E
-- synthetic SET ROLE tests, not here.
-- =====================================================================
DO $verify_0103$
DECLARE
  v_purchase_id_col bigint;
  v_checks          bigint;
  v_pidx            bigint;
  v_shims_left      bigint;
  v_shims_ref       bigint;
  v_rpcs            bigint;
  v_definer         bigint;
  v_ppattern        bigint;
  v_legacy_shopid   bigint;
  v_contact_param   bigint;
  v_legacy_param    bigint;
  v_amount_paid     bigint;
  v_c4_guard        bigint;
  v_pv_cols         bigint;
  v_pv_definer      bigint;
  v_anon_fn         bigint;
  v_anon_pv         bigint;
BEGIN
  -- ----- §1 Decision A -----
  SELECT count(*) INTO v_purchase_id_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='purchase_id';
  IF v_purchase_id_col <> 1 THEN RAISE EXCEPTION '0103: ledger_entries.purchase_id missing'; END IF;

  SELECT count(*) INTO v_checks FROM pg_constraint
   WHERE conrelid='public.ledger_entries'::regclass AND contype='c'
     AND conname IN ('ledger_purchase_id_requires_payable_debit',
                     'ledger_entry_not_both_invoice_and_purchase');
  IF v_checks <> 2 THEN RAISE EXCEPTION '0103: expected 2 Decision-A CHECK constraints, got %', v_checks; END IF;

  SELECT count(*) INTO v_pidx FROM pg_indexes
   WHERE schemaname='public' AND tablename='ledger_entries' AND indexname='idx_ledger_entries_purchase_id';
  IF v_pidx <> 1 THEN RAISE EXCEPTION '0103: idx_ledger_entries_purchase_id missing'; END IF;

  -- ----- §6 the 6 _v28 shims are gone -----
  SELECT count(*) INTO v_shims_left FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('record_sale_v28','record_purchase_v28','receive_payment_v28','reverse_ledger_entry_v28',
      'search_purchases_v28','search_purchases_count_v28');
  IF v_shims_left <> 0 THEN RAISE EXCEPTION '0103: % _v28 shim(s) still present', v_shims_left; END IF;

  -- drop-safety: no surviving function references any of the 6 dropped shims
  SELECT count(*) INTO v_shims_ref FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND (pg_get_functiondef(p.oid) LIKE '%record_sale_v28%'
       OR pg_get_functiondef(p.oid) LIKE '%record_purchase_v28%'
       OR pg_get_functiondef(p.oid) LIKE '%receive_payment_v28%'
       OR pg_get_functiondef(p.oid) LIKE '%reverse_ledger_entry_v28%'
       OR pg_get_functiondef(p.oid) LIKE '%search_purchases_v28%'
       OR pg_get_functiondef(p.oid) LIKE '%search_purchases_count_v28%');
  IF v_shims_ref <> 0 THEN
    RAISE EXCEPTION '0103: % function(s) still reference a dropped _v28 shim', v_shims_ref;
  END IF;

  -- ----- §2/§3/§4 the 10 RPCs exist, DEFINER, carry the P-pattern -----
  SELECT count(*) INTO v_rpcs FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('record_sale','record_purchase','receive_payment','reverse_ledger_entry',
      'search_purchases','search_purchases_count','list_contacts','recent_contacts',
      'search_khata_contacts','search_khata_contacts_count');
  IF v_rpcs <> 10 THEN RAISE EXCEPTION '0103: expected 10 RPCs, got %', v_rpcs; END IF;

  SELECT count(*) INTO v_definer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef = true AND p.proname IN
     ('record_sale','record_purchase','receive_payment','reverse_ledger_entry',
      'search_purchases','search_purchases_count','list_contacts','recent_contacts',
      'search_khata_contacts','search_khata_contacts_count');
  IF v_definer <> 10 THEN RAISE EXCEPTION '0103: expected 10 DEFINER RPCs, got %', v_definer; END IF;

  SELECT count(*) INTO v_ppattern FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('record_sale','record_purchase','receive_payment','reverse_ledger_entry',
      'search_purchases','search_purchases_count','list_contacts','recent_contacts',
      'search_khata_contacts','search_khata_contacts_count')
     AND pg_get_functiondef(p.oid) LIKE '%not_authenticated%'
     AND pg_get_functiondef(p.oid) LIKE '%no_shop_for_user%'
     AND pg_get_functiondef(p.oid) LIKE '%user_has_permission%';
  IF v_ppattern <> 10 THEN
    RAISE EXCEPTION '0103: % of 10 RPCs carry the P1/P2/P3 substrings', v_ppattern;
  END IF;

  -- AQ-24: none of the 10 use the legacy current_shop_id()
  SELECT count(*) INTO v_legacy_shopid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('record_sale','record_purchase','receive_payment','reverse_ledger_entry',
      'search_purchases','search_purchases_count','list_contacts','recent_contacts',
      'search_khata_contacts','search_khata_contacts_count')
     AND pg_get_functiondef(p.oid) ~ '\mcurrent_shop_id\M';
  IF v_legacy_shopid <> 0 THEN
    RAISE EXCEPTION '0103: % RPC(s) still call legacy current_shop_id()', v_legacy_shopid;
  END IF;

  -- param renames: the 5 contact-id'd RPCs carry p_contact_id, none carry the legacy names
  SELECT count(*) INTO v_contact_param FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('record_sale','record_purchase','receive_payment','search_purchases','search_purchases_count')
     AND pg_get_function_arguments(p.oid) LIKE '%p_contact_id%';
  IF v_contact_param <> 5 THEN
    RAISE EXCEPTION '0103: % of 5 RPCs carry p_contact_id', v_contact_param;
  END IF;

  SELECT count(*) INTO v_legacy_param FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('record_sale','record_purchase','receive_payment','search_purchases','search_purchases_count')
     AND (pg_get_function_arguments(p.oid) LIKE '%p_customer_id%'
       OR pg_get_function_arguments(p.oid) LIKE '%p_supplier_id%');
  IF v_legacy_param <> 0 THEN
    RAISE EXCEPTION '0103: % RPC(s) still carry a legacy p_customer_id/p_supplier_id param', v_legacy_param;
  END IF;

  -- record_purchase gained p_amount_paid
  SELECT count(*) INTO v_amount_paid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='record_purchase'
     AND pg_get_function_arguments(p.oid) LIKE '%p_amount_paid%';
  IF v_amount_paid <> 1 THEN RAISE EXCEPTION '0103: record_purchase missing p_amount_paid param'; END IF;

  -- reverse_ledger_entry carries the C4 guard
  SELECT count(*) INTO v_c4_guard FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='reverse_ledger_entry'
     AND pg_get_functiondef(p.oid) LIKE '%cannot_reverse_purchase_tied_debit%';
  IF v_c4_guard <> 1 THEN RAISE EXCEPTION '0103: reverse_ledger_entry missing the C4 guard'; END IF;

  -- ----- §5 purchases_view extended (4 new cols), still DEFINER -----
  SELECT count(*) INTO v_pv_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='purchases_view'
     AND column_name IN ('contact_id','contact_name','amount_paid','outstanding');
  IF v_pv_cols <> 4 THEN RAISE EXCEPTION '0103: purchases_view missing v2.10 columns (got % of 4)', v_pv_cols; END IF;

  SELECT count(*) INTO v_pv_definer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='purchases_view'
     AND (c.reloptions IS NULL OR NOT ('security_invoker=true' = ANY(c.reloptions)));
  IF v_pv_definer <> 1 THEN RAISE EXCEPTION '0103: purchases_view is not DEFINER'; END IF;

  -- ----- §7 anon revoked across all -----
  SELECT count(*) INTO v_anon_fn FROM information_schema.role_routine_grants
   WHERE routine_schema='public' AND grantee='anon' AND privilege_type='EXECUTE'
     AND routine_name IN
     ('record_sale','record_purchase','receive_payment','reverse_ledger_entry',
      'search_purchases','search_purchases_count','list_contacts','recent_contacts',
      'search_khata_contacts','search_khata_contacts_count');
  IF v_anon_fn <> 0 THEN RAISE EXCEPTION '0103: % anon EXECUTE grant(s) on the 10 RPCs', v_anon_fn; END IF;

  SELECT count(*) INTO v_anon_pv FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='purchases_view'
     AND privilege_type='SELECT' AND lower(grantee) IN ('anon','public');
  IF v_anon_pv <> 0 THEN RAISE EXCEPTION '0103: purchases_view has an anon/public SELECT grant'; END IF;

  RAISE NOTICE '0103 OK: Decision A schema (purchase_id col + 2 CHECKs + index); 10 RPCs rewritten/collapsed/fresh (DEFINER, P-pattern, no legacy current_shop_id, p_contact_id renames, record_purchase.p_amount_paid, reverse_ledger_entry C4 guard); purchases_view extended (4 cols, DEFINER); 6 _v28 shims dropped + unreferenced; anon revoked across all 10 RPCs + purchases_view. BEHAVIOR is proven by Phase E synthetic SET ROLE tests, not this structural block.';
END $verify_0103$;

COMMIT;
