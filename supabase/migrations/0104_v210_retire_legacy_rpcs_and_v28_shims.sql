-- =====================================================================
-- 0104_v210_retire_legacy_rpcs_and_v28_shims
-- =====================================================================
-- v2.10 — ninth migration in the contacts unification chain. The legacy
-- teardown: retires the customer/supplier-world RPCs, views and columns
-- now that the contact-world replacements (0102/0103) are live.
--
-- Reviewed in two parts at the 0104 design checkpoint:
--
--   PART A — teardown core:
--     - 2 trigger-fn rewrites (batch_immutable_fields drops its
--       supplier_id line; ledger_entries_update_balance drops its legacy
--       customers dual-write branch) — both reference a column 0104
--       drops; DROP COLUMN does not analyse plpgsql bodies, so an
--       un-rewritten trigger is a silent runtime time bomb.
--     - total_outstanding rebuilt to read contacts directly (Decision B:
--       no customer_outstanding view) — also breaks the only dependency
--       on customer_outstanding, so it drops with no CASCADE.
--     - total_payable — new supplier-side aggregate (D-2; mirror of
--       total_outstanding for the D.8 "We owe suppliers" widget).
--     - DROP 3 retired views, 19 retired functions (7 wrappers + 7 _v28
--       shims + 5 standalone RPCs — all audited unreferenced), 4 legacy
--       id columns (+ their FKs + indexes, auto-cascaded by DROP COLUMN).
--     - AQ-12 repointed to contact_balance_reconciliation (doc patch;
--       the verification block runs the repointed query and asserts 0).
--
--   PART B — the 7 view renames (customer_id/supplier_id -> contact_id):
--     invoices_view, invoice_financials, invoice_with_discount_detail,
--     inventory_batches_view, batches_warranty_expiring_soon,
--     ledger_entries_view, purchases_view. All DROP+CREATE (output column
--     rename / removal). invoice_financials drags 2 dependents
--     (daily_sales_7, monthly_summary) — neither references customer_id,
--     so both are recreated VERBATIM as a fan sub-sequence. Cost-gating
--     where it exists (invoice_financials / invoices_view /
--     inventory_batches_view) is preserved byte-for-byte; no view needs
--     new gating. Every recreated view (all 9) gets the ADR-0015 grant
--     block — DROP discards grants and a bare CREATE re-acquires the
--     Supabase anon SELECT auto-grant, so re-granting anon would be 0104
--     itself introducing the leak. 6 of the 9 leave the AQ-32 frozen
--     baseline -> their allowlist entries go stale-harmless (zero
--     allowlist edits — the rewritten dynamic AQ-32 absorbs it).
--
-- SEQUENCING (constraint-driven — see §1..§7 below):
--   §1 trigger-fn rewrites  ->  §2 total_outstanding rebuild + total_payable
--   ->  §3 the 9 view recreates + grants  ->  §4 drop 3 retired views
--   ->  §5 drop 19 functions  ->  §6 drop 4 legacy columns  ->  §7 verify.
--   §3-before-§6: a view referencing a legacy column must be rewritten
--   off it before the column drops. §2-before-§4: total_outstanding must
--   stop depending on customer_outstanding before it can be dropped.
--
-- DDL only — no DML. DDL does not fire DML triggers (0098 precedent), so
-- no DISABLE/ENABLE dance. customers/suppliers TABLES are not dropped
-- here (0106); after 0104 customers is a fully frozen dead table — no
-- trigger writes it and no FK points at it from the 4 dependent tables.
--
-- STAGING ONLY. Production untouched until v2.10 + v2.11 ship together.
--
-- Source of truth:
--   design/2026-05-14-v210-contacts-model-design.md §2.1, §2.5, §3.1-§3.7
--   design/2026-05-14-v210-contacts-implementation-plan.md §1
--   design/2026-05-13-rbac-attack-surface.md §C.3 (AQ-12 repoint)
-- =====================================================================

BEGIN;

-- =====================================================================
-- §1 — Part A: trigger-function rewrites (must precede the column drops
--      in §6 — DROP COLUMN does not analyse plpgsql bodies).
-- =====================================================================

-- batch_immutable_fields — the legacy supplier_id immutability line is
-- removed (inventory_batches.supplier_id drops in §6). Every other
-- immutability check is intact; the contact_id line (added 0100) stays.
CREATE OR REPLACE FUNCTION public.batch_immutable_fields()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if old.id is distinct from new.id then raise exception 'batch_id_immutable'; end if;
  if old.variant_id is distinct from new.variant_id then raise exception 'batch_variant_immutable'; end if;
  if lower(trim(old.batch_no)) is distinct from lower(trim(new.batch_no))
    then raise exception 'batch_no_immutable'; end if;
  if old.qty_received is distinct from new.qty_received then raise exception 'batch_qty_received_immutable'; end if;
  if old.cost_per_unit is distinct from new.cost_per_unit then raise exception 'batch_cost_immutable'; end if;
  if old.manufactured_date is distinct from new.manufactured_date then raise exception 'batch_mfg_date_immutable'; end if;
  if old.expiry_date is distinct from new.expiry_date then raise exception 'batch_expiry_immutable'; end if;
  if old.supplier_warranty_days is distinct from new.supplier_warranty_days then raise exception 'batch_warranty_days_immutable'; end if;
  if old.warranty_expires_at is distinct from new.warranty_expires_at then raise exception 'batch_warranty_date_immutable'; end if;
  if old.received_at is distinct from new.received_at then raise exception 'batch_received_at_immutable'; end if;
  if old.purchase_item_id is not null
     and new.purchase_item_id is distinct from old.purchase_item_id then
    raise exception 'batch_purchase_item_immutable';
  end if;
  -- legacy supplier_id line removed — column dropped by 0104
  if old.contact_id is distinct from new.contact_id then raise exception 'batch_contact_immutable'; end if;
  return new;
end;
$function$;

-- ledger_entries_update_balance — the legacy customers dual-write branch
-- is removed (ledger_entries.customer_id drops in §6). Purely
-- contacts-side now; customers becomes a fully frozen dead table.
CREATE OR REPLACE FUNCTION public.ledger_entries_update_balance()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_delta numeric(12,2);
begin
  if TG_OP = 'INSERT' then
    v_delta := case when new.type = 'debit' then new.amount else -new.amount end;
    if new.direction = 'receivable' then
      update public.contacts
         set customer_outstanding_balance = customer_outstanding_balance + v_delta
       where id = new.contact_id;
    else  -- new.direction = 'payable'
      update public.contacts
         set supplier_outstanding_balance = supplier_outstanding_balance + v_delta
       where id = new.contact_id;
    end if;
    return new;
  end if;
  return null;
end;
$function$;

-- =====================================================================
-- §2 — Part A: total_outstanding rebuilt off contacts (breaks the
--      dependency on customer_outstanding) + total_payable (new, D-2).
-- =====================================================================

-- total_outstanding — rebuilt to read contacts directly. Same output
-- columns (total, customer_count) so CREATE OR REPLACE is valid; this
-- breaks the only dependency on customer_outstanding, so §4 can drop
-- customer_outstanding with no CASCADE. DEFINER (reads the
-- column-grant-excluded balance column); gated view_contact_customer_data.
CREATE OR REPLACE VIEW public.total_outstanding
  WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT (SELECT public.current_active_shop_id()) AS active_shop_id,
         (SELECT public.user_has_permission((SELECT public.current_active_shop_id()),
           'view_contact_customer_data')) AS can_see
)
SELECT
  COALESCE(SUM(c.customer_outstanding_balance) FILTER (WHERE cp.can_see), 0)::numeric(12,2) AS total,
  COUNT(*) FILTER (WHERE cp.can_see AND c.customer_outstanding_balance > 0)::integer AS customer_count
FROM public.contacts c
CROSS JOIN caller_perms cp
WHERE c.shop_id = cp.active_shop_id
  AND c.contact_type IN ('customer','both');

-- total_payable — new supplier-side mirror (D-2). NEW view -> needs the
-- ADR-0015 grant explicitly (the rewritten AQ-32 catches it otherwise).
CREATE OR REPLACE VIEW public.total_payable
  WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT (SELECT public.current_active_shop_id()) AS active_shop_id,
         (SELECT public.user_has_permission((SELECT public.current_active_shop_id()),
           'view_contact_supplier_data')) AS can_see
)
SELECT
  COALESCE(SUM(c.supplier_outstanding_balance) FILTER (WHERE cp.can_see), 0)::numeric(12,2) AS total,
  COUNT(*) FILTER (WHERE cp.can_see AND c.supplier_outstanding_balance > 0)::integer AS supplier_count
FROM public.contacts c
CROSS JOIN caller_perms cp
WHERE c.shop_id = cp.active_shop_id
  AND c.contact_type IN ('supplier','both');

REVOKE SELECT ON public.total_payable FROM public, anon;
GRANT  SELECT ON public.total_payable TO authenticated, service_role;

-- =====================================================================
-- §3 — Part B: the 9 view recreates. §3a invoice_financials chain,
--      §3b the 6 plain renames, §3c the ADR-0015 grants for all 9.
--      All of §3 must precede §6 (column drops).
-- =====================================================================

-- ----- §3a — the invoice_financials chain -----
-- Drop the 2 dependents, rebuild the parent with contact_id, recreate
-- the 2 dependents VERBATIM (neither references customer_id — pure
-- structural dependents).
DROP VIEW public.daily_sales_7;
DROP VIEW public.monthly_summary;
DROP VIEW public.invoice_financials;

CREATE VIEW public.invoice_financials
  WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT
    (SELECT public.current_active_shop_id()) AS active_shop_id,
    (SELECT auth.uid()) AS caller_id,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_all_sales'))     AS can_see_all,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_sale_cost'))      AS can_see_cost,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_profit_margin'))  AS can_see_margin
)
SELECT
  i.id AS invoice_id,
  i.shop_id,
  i.contact_id,
  i.created_at,
  i.payment_type,
  i.amount_paid,
  i.total AS stored_total,
  COALESCE(sum(sif.line_value), 0)::numeric(12,2)            AS items_subtotal,
  COALESCE(i.sale_discount_amount, 0)::numeric(12,2)         AS sale_discount_amount,
  COALESCE(sum(sif.line_revenue), 0)::numeric(12,2)          AS post_discount_items,
  COALESCE(i.service_charge, 0)::numeric(12,2)               AS service_charge,
  (COALESCE(sum(sif.line_revenue), 0) + COALESCE(i.service_charge, 0))::numeric(12,2) AS revenue,
  CASE WHEN cp.can_see_cost
       THEN COALESCE(sum(sif.line_cost), 0)::numeric(12,2)
       ELSE NULL::numeric END AS total_cost,
  CASE WHEN cp.can_see_cost
       THEN (COALESCE(sum(sif.line_revenue), 0) + COALESCE(i.service_charge, 0) - COALESCE(sum(sif.line_cost), 0))::numeric(12,2)
       ELSE NULL::numeric END AS gross_profit,
  CASE WHEN cp.can_see_margin
        AND (COALESCE(sum(sif.line_revenue), 0) + COALESCE(i.service_charge, 0)) > 0
       THEN round((COALESCE(sum(sif.line_revenue), 0) + COALESCE(i.service_charge, 0) - COALESCE(sum(sif.line_cost), 0))
                  / (COALESCE(sum(sif.line_revenue), 0) + COALESCE(i.service_charge, 0)) * 100, 2)
       ELSE NULL::numeric END AS gross_margin_percent,
  GREATEST(0, i.total - COALESCE(i.amount_paid, 0))::numeric(12,2) AS outstanding
FROM public.invoices i
LEFT JOIN public.sale_item_financials sif ON sif.invoice_id = i.id
CROSS JOIN caller_perms cp
WHERE i.shop_id = cp.active_shop_id AND (cp.can_see_all OR i.cashier_id = cp.caller_id)
GROUP BY i.id, i.shop_id, i.contact_id, i.created_at, i.payment_type, i.amount_paid,
         i.total, i.sale_discount_amount, i.service_charge, cp.can_see_cost, cp.can_see_margin;

-- monthly_summary — recreated VERBATIM (structural dependent, no customer_id ref).
-- gross_profit = sum(invoice_financials.gross_profit) inherits the gate transitively.
CREATE VIEW public.monthly_summary
  WITH (security_invoker = true) AS
WITH months AS (
  SELECT DISTINCT invoices.shop_id,
         date_trunc('month', (invoices.created_at AT TIME ZONE 'utc'))::date AS month
  FROM public.invoices
  UNION
  SELECT DISTINCT expenses.shop_id,
         date_trunc('month', expenses.expense_date::timestamp with time zone)::date AS date_trunc
  FROM public.expenses
)
SELECT
  shop_id,
  month,
  COALESCE((SELECT sum(if2.revenue) FROM public.invoice_financials if2
            WHERE if2.shop_id = m.shop_id
              AND date_trunc('month', (if2.created_at AT TIME ZONE 'utc'))::date = m.month), 0)::numeric(12,2) AS total_sales,
  COALESCE((SELECT sum(if2.gross_profit) FROM public.invoice_financials if2
            WHERE if2.shop_id = m.shop_id
              AND date_trunc('month', (if2.created_at AT TIME ZONE 'utc'))::date = m.month), 0)::numeric(12,2) AS gross_profit,
  COALESCE((SELECT sum(e.amount) FROM public.expenses e
            WHERE e.shop_id = m.shop_id
              AND date_trunc('month', e.expense_date::timestamp with time zone)::date = m.month), 0)::numeric(12,2) AS total_expenses
FROM months m;

-- daily_sales_7 — recreated VERBATIM (structural dependent; keeps
-- current_shop_id() — stays AQ-24-allowlisted; v2.9.3 backlog owns the swap).
CREATE VIEW public.daily_sales_7
  WITH (security_invoker = true) AS
WITH days AS (
  SELECT generate_series(CURRENT_DATE - '6 days'::interval, CURRENT_DATE::timestamp without time zone, '1 day'::interval)::date AS day
)
SELECT
  d.day,
  COALESCE((SELECT sum(if2.revenue) FROM public.invoice_financials if2
            WHERE if2.shop_id = public.current_shop_id()
              AND (if2.created_at AT TIME ZONE 'utc')::date = d.day), 0)::numeric(12,2) AS total_sales
FROM days d;

-- ----- §3b — the 6 plain renames -----

-- invoices_view — customer_id -> contact_id (SELECT col 3). Cost-gating verbatim.
DROP VIEW public.invoices_view;
CREATE VIEW public.invoices_view
  WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT
    (SELECT public.current_active_shop_id()) AS active_shop_id,
    (SELECT auth.uid()) AS caller_id,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_all_sales'))     AS can_see_all,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_sale_cost'))      AS can_see_cost,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_profit_margin'))  AS can_see_margin
), sale_rollup AS (
  SELECT si.invoice_id,
         sum(si.price_at_sale * si.qty::numeric - COALESCE(si.line_discount_amount, 0))::numeric(12,2) AS items_post_line,
         sum(si.cost_at_sale * si.qty::numeric)::numeric(12,2) AS total_cost
  FROM public.sale_items si
  GROUP BY si.invoice_id
)
SELECT
  i.id, i.shop_id, i.contact_id, i.total, i.service_charge, i.payment_type,
  i.cashier_id, i.amount_paid, i.notes, i.tier_id, i.sale_discount_type,
  i.sale_discount_value, i.sale_discount_percent_snapshot, i.sale_discount_amount,
  i.outstanding, i.created_at,
  CASE WHEN cp.can_see_cost
       THEN (i.total - COALESCE(sr.total_cost, 0))::numeric(12,2)
       ELSE NULL::numeric END AS gross_profit,
  CASE WHEN cp.can_see_margin AND i.total > 0
       THEN round((i.total - COALESCE(sr.total_cost, 0)) / i.total * 100, 2)
       ELSE NULL::numeric END AS gross_margin_percent
FROM public.invoices i
LEFT JOIN sale_rollup sr ON sr.invoice_id = i.id
CROSS JOIN caller_perms cp
WHERE i.shop_id = cp.active_shop_id AND (cp.can_see_all OR i.cashier_id = cp.caller_id);

-- invoice_with_discount_detail — customer_id -> contact_id (SELECT col 3). INVOKER, no cost columns.
DROP VIEW public.invoice_with_discount_detail;
CREATE VIEW public.invoice_with_discount_detail
  WITH (security_invoker = true) AS
SELECT
  i.id, i.shop_id, i.contact_id, i.total, i.service_charge, i.payment_type,
  i.cashier_id, i.created_at, i.amount_paid, i.notes, i.tier_id,
  i.sale_discount_percent_snapshot, i.sale_discount_amount, i.sale_discount_type,
  i.sale_discount_value,
  t.name AS tier_name,
  i.total + i.sale_discount_amount - i.service_charge AS items_subtotal_post_line_discounts,
  CASE
    WHEN i.sale_discount_type = 'percent' THEN 'sale_discount_percent'
    WHEN i.sale_discount_type = 'fixed'   THEN 'sale_discount_fixed'
    ELSE 'no_discount'
  END AS discount_source
FROM public.invoices i
LEFT JOIN public.customer_tiers t ON t.id = i.tier_id;

-- inventory_batches_view — supplier_id -> contact_id (SELECT col 5). Cost-gating verbatim.
DROP VIEW public.inventory_batches_view;
CREATE VIEW public.inventory_batches_view
  WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT
    (SELECT public.current_active_shop_id()) AS active_shop_id,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_inventory_batches')) AS can_view,
    (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_batch_cost'))        AS can_see_cost
)
SELECT
  b.id, b.variant_id, b.batch_no, b.purchase_item_id, b.contact_id,
  b.qty_received, b.qty_remaining,
  CASE WHEN cp.can_see_cost THEN b.cost_per_unit ELSE NULL::numeric END AS cost_per_unit,
  b.manufactured_date, b.expiry_date, b.supplier_warranty_days,
  b.warranty_expires_at, b.received_at, b.is_active, b.notes, b.created_at, b.updated_at
FROM public.inventory_batches b
JOIN public.product_variants v ON v.id = b.variant_id
JOIN public.products p ON p.id = v.product_id
CROSS JOIN caller_perms cp
WHERE p.shop_id = cp.active_shop_id AND cp.can_view;

-- batches_warranty_expiring_soon — supplier_id -> contact_id, supplier_name
-- -> contact_name, JOIN suppliers -> contacts. INVOKER, no cost columns.
DROP VIEW public.batches_warranty_expiring_soon;
CREATE VIEW public.batches_warranty_expiring_soon
  WITH (security_invoker = true) AS
SELECT
  b.id AS batch_id,
  b.batch_no,
  b.qty_remaining,
  b.warranty_expires_at,
  b.warranty_expires_at - CURRENT_DATE AS days_until_warranty_expires,
  b.contact_id,
  ct.name AS contact_name,
  v.id AS variant_id,
  p.id AS product_id,
  p.name AS product_name,
  p.shop_id,
  COALESCE(p.warranty_alert_days, sh.default_warranty_alert_days) AS alert_window_days
FROM public.inventory_batches b
JOIN public.product_variants v ON v.id = b.variant_id
JOIN public.products p ON p.id = v.product_id
JOIN public.shops sh ON sh.id = p.shop_id
LEFT JOIN public.contacts ct ON ct.id = b.contact_id
WHERE b.is_active AND b.qty_remaining > 0
  AND b.warranty_expires_at IS NOT NULL
  AND (b.warranty_expires_at - CURRENT_DATE) <= COALESCE(p.warranty_alert_days, sh.default_warranty_alert_days)
  AND b.warranty_expires_at >= CURRENT_DATE;

-- ledger_entries_view — customer_id -> contact_id (SELECT col 3). Pure id
-- rename; does NOT add the `direction` column (Phase-D enhancement, not a
-- teardown concern). products_summary subquery is verbatim.
DROP VIEW public.ledger_entries_view;
CREATE VIEW public.ledger_entries_view
  WITH (security_invoker = true) AS
SELECT
  le.id, le.shop_id, le.contact_id, le.invoice_id, le.amount, le.type,
  le.occurred_at, le.created_at, le.notes, le.reverses_entry_id,
  (SELECT r.id FROM public.ledger_entries r WHERE r.reverses_entry_id = le.id) AS reversed_by_entry_id,
  (SELECT r.occurred_at FROM public.ledger_entries r WHERE r.reverses_entry_id = le.id) AS reversed_at,
  i.notes AS invoice_notes,
  i.total AS invoice_total,
  i.amount_paid AS invoice_amount_paid,
  i.payment_type AS invoice_payment_type,
  (SELECT
     CASE
       WHEN count(*) = 0 THEN NULL::text
       WHEN count(*) <= 2 THEN string_agg(p.name, ', ' ORDER BY si.id)
       ELSE ((((SELECT string_agg(p2.name, ', ')
                FROM (SELECT p3.name FROM public.sale_items si3
                        JOIN public.products p3 ON p3.id = si3.product_id
                       WHERE si3.invoice_id = le.invoice_id
                       ORDER BY si3.id LIMIT 2) p2)) || ' + ') || ((count(*) - 2)::text)) || ' more'
     END
   FROM public.sale_items si
   JOIN public.products p ON p.id = si.product_id
   WHERE si.invoice_id = le.invoice_id) AS products_summary,
  (SELECT count(*) FROM public.sale_items si WHERE si.invoice_id = le.invoice_id) AS items_count
FROM public.ledger_entries le
LEFT JOIN public.invoices i ON i.id = le.invoice_id;

-- purchases_view — remove the supplier_id projection (R3-6). 15 cols, was 16.
DROP VIEW public.purchases_view;
CREATE VIEW public.purchases_view
  WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT (SELECT public.current_active_shop_id()) AS active_shop_id,
         (SELECT public.user_has_permission((SELECT public.current_active_shop_id()), 'view_purchases')) AS can_view
)
SELECT
  p.id, p.shop_id, p.total_cost, p.source, p.note, p.purchase_date,
  p.cashier_id, p.is_opening, p.items_subtotal, p.overhead_subtotal, p.created_at,
  p.contact_id, c.name AS contact_name, p.amount_paid, p.outstanding
FROM public.purchases p
LEFT JOIN public.contacts c ON c.id = p.contact_id
CROSS JOIN caller_perms cp
WHERE p.shop_id = cp.active_shop_id AND cp.can_view;

-- ----- §3c — ADR-0015 grants for all 9 recreated views -----
-- DROP discards grants; a bare CREATE re-acquires the Supabase anon
-- SELECT auto-grant. Re-granting anon would be 0104 introducing the leak,
-- so every recreated view gets revoke-anon. 6 of the 9 thereby leave the
-- AQ-32 frozen baseline -> their allowlist entries go stale-harmless.
REVOKE SELECT ON public.invoice_financials             FROM public, anon;
REVOKE SELECT ON public.monthly_summary                FROM public, anon;
REVOKE SELECT ON public.daily_sales_7                  FROM public, anon;
REVOKE SELECT ON public.invoices_view                  FROM public, anon;
REVOKE SELECT ON public.invoice_with_discount_detail   FROM public, anon;
REVOKE SELECT ON public.inventory_batches_view         FROM public, anon;
REVOKE SELECT ON public.batches_warranty_expiring_soon FROM public, anon;
REVOKE SELECT ON public.ledger_entries_view            FROM public, anon;
REVOKE SELECT ON public.purchases_view                 FROM public, anon;
GRANT  SELECT ON public.invoice_financials             TO authenticated, service_role;
GRANT  SELECT ON public.monthly_summary                TO authenticated, service_role;
GRANT  SELECT ON public.daily_sales_7                  TO authenticated, service_role;
GRANT  SELECT ON public.invoices_view                  TO authenticated, service_role;
GRANT  SELECT ON public.invoice_with_discount_detail   TO authenticated, service_role;
GRANT  SELECT ON public.inventory_batches_view         TO authenticated, service_role;
GRANT  SELECT ON public.batches_warranty_expiring_soon TO authenticated, service_role;
GRANT  SELECT ON public.ledger_entries_view            TO authenticated, service_role;
GRANT  SELECT ON public.purchases_view                 TO authenticated, service_role;

-- =====================================================================
-- §4 — Part A: drop the 3 retired views. customer_outstanding now has
--      zero dependents (§2 rebuilt total_outstanding off contacts).
-- =====================================================================
DROP VIEW public.customer_outstanding;
DROP VIEW public.customers_view;
DROP VIEW public.customer_balance_reconciliation;

-- =====================================================================
-- §5 — Part A: drop the 19 retired functions. All audited unreferenced
--      by any other DB function (7 wrappers + 7 _v28 shims + 5 standalone
--      RPCs with no shim). Frontend call sites cut over in Phase D.
-- =====================================================================
DROP FUNCTION public.list_customers(text, integer, integer);
DROP FUNCTION public.list_customers_v28(text, integer, integer);
DROP FUNCTION public.recent_customers(integer);
DROP FUNCTION public.recent_customers_v28(integer);
DROP FUNCTION public.search_khata_customers(text, text, integer, integer);
DROP FUNCTION public.search_khata_customers_v28(text, text, integer, integer);
DROP FUNCTION public.search_khata_customers_count(text, text);
DROP FUNCTION public.search_khata_customers_count_v28(text, text);
DROP FUNCTION public.create_supplier_inline(text, text, text, text);
DROP FUNCTION public.create_supplier_inline_v28(text, text, text, text);
DROP FUNCTION public.recent_suppliers(integer);
DROP FUNCTION public.recent_suppliers_v28(integer);
DROP FUNCTION public.search_suppliers(text, integer, integer);
DROP FUNCTION public.search_suppliers_v28(text, integer, integer);
DROP FUNCTION public.create_customer_basic(text, text);
DROP FUNCTION public.create_customer_full(text, text, text, text, uuid);
DROP FUNCTION public.update_customer(uuid, text, text, text, text, uuid);
DROP FUNCTION public.update_supplier(uuid, text, text, text, text);
DROP FUNCTION public.archive_supplier(uuid);

-- =====================================================================
-- §6 — Part A: drop the 4 legacy id columns. By here every dependent
--      VIEW (§3 rewrites + §4 drops) and trigger fn (§1) is off these
--      columns, so DROP COLUMN cascades cleanly to each column's FK and
--      indexes (no CASCADE keyword needed).
-- =====================================================================
ALTER TABLE public.invoices          DROP COLUMN customer_id;  -- + invoices_customer_id_fkey, idx_invoices_customer_created
ALTER TABLE public.ledger_entries    DROP COLUMN customer_id;  -- + ledger_entries_customer_id_fkey + idx_*_customer_created/_occurred + ledger_shop_customer_idx
ALTER TABLE public.purchases         DROP COLUMN supplier_id;  -- + purchases_supplier_id_fkey, idx_purchases_supplier
ALTER TABLE public.inventory_batches DROP COLUMN supplier_id;  -- + inventory_batches_supplier_id_fkey

-- =====================================================================
-- §7 — consolidated verification block (Part A §7 + Part B §5 checks).
-- Structural only; behavioral correctness (trigger arithmetic, view
-- projection per role) is Phase E synthetic SET ROLE tests.
-- =====================================================================
DO $verify_0104$
DECLARE
  v_fns_left   bigint;
  v_views_left bigint;
  v_cols_left  bigint;
  v_bif_clean  bigint;
  v_leb_clean  bigint;
  v_to_ok      bigint;
  v_tp_ok      bigint;
  v_tp_anon    bigint;
  v_aq12       bigint;
  v_pay_drift  bigint;
  v_b_exist    bigint;
  v_b_legacy   bigint;
  v_b_definer  bigint;
  v_b_invoker  bigint;
  v_b_gated    bigint;
  v_b_anon     bigint;
BEGIN
  -- ===== Part A =====
  -- the 19 retired functions are gone
  SELECT count(*) INTO v_fns_left FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('list_customers','list_customers_v28','recent_customers','recent_customers_v28',
      'search_khata_customers','search_khata_customers_v28','search_khata_customers_count',
      'search_khata_customers_count_v28','create_supplier_inline','create_supplier_inline_v28',
      'recent_suppliers','recent_suppliers_v28','search_suppliers','search_suppliers_v28',
      'create_customer_basic','create_customer_full','update_customer','update_supplier','archive_supplier');
  IF v_fns_left <> 0 THEN RAISE EXCEPTION '0104: % retired function(s) still present', v_fns_left; END IF;

  -- the 3 retired views are gone
  SELECT count(*) INTO v_views_left FROM pg_views
   WHERE schemaname='public' AND viewname IN
     ('customer_outstanding','customers_view','customer_balance_reconciliation');
  IF v_views_left <> 0 THEN RAISE EXCEPTION '0104: % retired view(s) still present', v_views_left; END IF;

  -- the 4 legacy columns are gone
  SELECT count(*) INTO v_cols_left FROM information_schema.columns
   WHERE table_schema='public'
     AND ((table_name IN ('invoices','ledger_entries') AND column_name='customer_id')
       OR (table_name IN ('purchases','inventory_batches') AND column_name='supplier_id'));
  IF v_cols_left <> 0 THEN RAISE EXCEPTION '0104: % legacy id column(s) still present', v_cols_left; END IF;

  -- batch_immutable_fields no longer references supplier_id
  SELECT count(*) INTO v_bif_clean FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='batch_immutable_fields'
     AND pg_get_functiondef(p.oid) !~ '\msupplier_id\M';
  IF v_bif_clean <> 1 THEN RAISE EXCEPTION '0104: batch_immutable_fields still references supplier_id'; END IF;

  -- ledger_entries_update_balance no longer references customer_id / customers
  SELECT count(*) INTO v_leb_clean FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='ledger_entries_update_balance'
     AND pg_get_functiondef(p.oid) !~ '\mcustomer_id\M'
     AND pg_get_functiondef(p.oid) NOT LIKE '%public.customers%';
  IF v_leb_clean <> 1 THEN RAISE EXCEPTION '0104: ledger_entries_update_balance still references customer_id/customers'; END IF;

  -- total_outstanding rebuilt: reads contacts, no longer reads customer_outstanding
  SELECT count(*) INTO v_to_ok FROM pg_views
   WHERE schemaname='public' AND viewname='total_outstanding'
     AND definition LIKE '%contacts%' AND definition NOT LIKE '%customer_outstanding%';
  IF v_to_ok <> 1 THEN RAISE EXCEPTION '0104: total_outstanding not rebuilt off contacts'; END IF;

  -- total_payable exists, is DEFINER, carries no anon SELECT
  SELECT count(*) INTO v_tp_ok FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='total_payable' AND c.relkind='v'
     AND (c.reloptions IS NULL OR NOT ('security_invoker=true' = ANY(c.reloptions)));
  IF v_tp_ok <> 1 THEN RAISE EXCEPTION '0104: total_payable missing or not DEFINER'; END IF;
  SELECT count(*) INTO v_tp_anon FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='total_payable'
     AND privilege_type='SELECT' AND lower(grantee) IN ('anon','public');
  IF v_tp_anon <> 0 THEN RAISE EXCEPTION '0104: total_payable carries an anon/public SELECT grant'; END IF;

  -- AQ-12 (repointed) runs and reconciles; and the supplier side too —
  -- proves the teardown corrupted no row data (the AQ-31 invariant).
  SELECT count(*) INTO v_aq12 FROM public.contact_balance_reconciliation
   WHERE abs(customer_drift) > 0.01;
  IF v_aq12 <> 0 THEN RAISE EXCEPTION '0104: AQ-12 (repointed) — % customer-balance drift rows', v_aq12; END IF;
  SELECT count(*) INTO v_pay_drift FROM public.contact_balance_reconciliation
   WHERE abs(supplier_drift) > 0.01;
  IF v_pay_drift <> 0 THEN RAISE EXCEPTION '0104: post-teardown supplier-balance drift — % rows', v_pay_drift; END IF;

  -- ===== Part B =====
  -- all 9 recreated views exist
  SELECT count(*) INTO v_b_exist FROM pg_views WHERE schemaname='public' AND viewname IN
    ('invoice_financials','monthly_summary','daily_sales_7','invoices_view',
     'invoice_with_discount_detail','inventory_batches_view','batches_warranty_expiring_soon',
     'ledger_entries_view','purchases_view');
  IF v_b_exist <> 9 THEN RAISE EXCEPTION '0104B: expected 9 recreated views, got %', v_b_exist; END IF;

  -- none of the 9 references a legacy customer_id / supplier_id column
  SELECT count(*) INTO v_b_legacy FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='v' AND c.relname IN
     ('invoice_financials','monthly_summary','daily_sales_7','invoices_view',
      'invoice_with_discount_detail','inventory_batches_view','batches_warranty_expiring_soon',
      'ledger_entries_view','purchases_view')
     AND (pg_get_viewdef(c.oid) ~ '\mcustomer_id\M' OR pg_get_viewdef(c.oid) ~ '\msupplier_id\M');
  IF v_b_legacy <> 0 THEN RAISE EXCEPTION '0104B: % view(s) still reference customer_id/supplier_id', v_b_legacy; END IF;

  -- security mode preserved: 4 DEFINER, 5 INVOKER
  SELECT count(*) INTO v_b_definer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN ('invoice_financials','invoices_view','inventory_batches_view','purchases_view')
     AND (c.reloptions IS NULL OR NOT ('security_invoker=true' = ANY(c.reloptions)));
  IF v_b_definer <> 4 THEN RAISE EXCEPTION '0104B: expected 4 DEFINER views, got %', v_b_definer; END IF;

  SELECT count(*) INTO v_b_invoker FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN
     ('monthly_summary','daily_sales_7','invoice_with_discount_detail','batches_warranty_expiring_soon','ledger_entries_view')
     AND 'security_invoker=true' = ANY(c.reloptions);
  IF v_b_invoker <> 5 THEN RAISE EXCEPTION '0104B: expected 5 INVOKER views, got %', v_b_invoker; END IF;

  -- the 3 conditional-projection views kept their CASE-gating
  SELECT count(*) INTO v_b_gated FROM pg_views WHERE schemaname='public'
   AND ((viewname IN ('invoice_financials','invoices_view') AND definition LIKE '%can_see_cost%' AND definition LIKE '%can_see_margin%')
     OR (viewname='inventory_batches_view' AND definition LIKE '%can_see_cost%'));
  IF v_b_gated <> 3 THEN RAISE EXCEPTION '0104B: a conditional-projection view lost its CASE-gating (% of 3)', v_b_gated; END IF;

  -- none of the 9 carries an anon/public SELECT grant
  SELECT count(*) INTO v_b_anon FROM information_schema.role_table_grants
   WHERE table_schema='public' AND privilege_type='SELECT' AND lower(grantee) IN ('anon','public')
     AND table_name IN ('invoice_financials','monthly_summary','daily_sales_7','invoices_view',
       'invoice_with_discount_detail','inventory_batches_view','batches_warranty_expiring_soon',
       'ledger_entries_view','purchases_view');
  IF v_b_anon <> 0 THEN RAISE EXCEPTION '0104B: % recreated view(s) carry an anon/public SELECT grant', v_b_anon; END IF;

  RAISE NOTICE '0104 OK: 19 functions + 3 views + 4 legacy columns dropped; batch_immutable_fields + ledger_entries_update_balance rewritten off the dropped columns; total_outstanding rebuilt off contacts + total_payable created (DEFINER, anon-revoked); AQ-12 repointed reconciles, no balance drift; 9 views recreated (4 DEFINER / 5 INVOKER, 3 kept CASE-gating, anon revoked across all 9). BEHAVIOR proven by Phase E synthetic SET ROLE tests.';
END $verify_0104$;

COMMIT;
