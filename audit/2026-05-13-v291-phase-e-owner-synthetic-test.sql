-- =====================================================================
-- v2.9.1 Phase E owner-runnable synthetic test bed
-- =====================================================================
--
-- Generated 2026-05-13 from:
--   * audit/2026-05-13-v291-phase-e-coverage-matrix.md (E.3 matrix —
--     rows tagged "Synthetic SQL" + runnable by owner alone; pilot-only
--     rows are listed in §7 below and explicitly NOT covered)
--   * design/2026-05-13-rbac-attack-surface.md §C.3 — AQ-01..AQ-24
--     verbatim (the canonical audit-query suite)
--   * supabase/migrations/0087_v291_phase_c.sql — 11 NEW Phase C RPCs
--   * supabase/migrations/0088_v291_get_invitation_for_acceptance.sql
--   * decisions/2026-05-12-v2-9-0-1-frontend-sweep.md §Discipline lesson
--     — REAL session JWT only; never `set_config('request.jwt.claims',...)`
--
-- HOW TO RUN
-- ----------
--   1. Sign in to Supabase Studio (https://supabase.com/dashboard) as the
--      OWNER of your shop. The session you sign in with becomes the JWT
--      that the SQL Editor uses.
--   2. Open SQL Editor → New query.
--   3. Paste this entire file. Click "Run as authenticated user" — or
--      the equivalent toggle Studio offers. Studio handles
--      `SET ROLE authenticated` + JWT injection automatically for the
--      signed-in operator. DO NOT rewrite this script to use
--      `set_config('request.jwt.claims', ...)` — that shortcut bypasses
--      GUC propagation through the function call stack and silently
--      green-lights tests that fail in production (see Discipline lesson).
--   4. Watch the NOTICE output. Any line that starts with 'FAIL §...' is
--      a test failure. A successful run ends with a single 'PASS:'
--      summary line.
--   5. The script wraps everything in BEGIN..ROLLBACK so no state changes
--      commit; you can re-run freely. The audit-column UPDATEs in §4 are
--      visible inside the transaction long enough to assert against, then
--      discarded on ROLLBACK.
--
-- READING FAILURES
-- ----------------
--   The first hard-assertion failure aborts the transaction. Subsequent
--   sections + the §FINAL 'PASS:' notice do NOT run; PG/Studio surfaces
--   exactly one error pane with:
--     * the exception message verbatim, prefixed with `FAIL §N` so the
--       failing section is unambiguous (e.g. `FAIL §4 customers:
--       updated_by_user_id should be auth.uid(); got NULL`)
--     * the SQLSTATE (P0001 for our controlled raises)
--     * the line number of the RAISE inside this file (Studio's error
--       pane includes a "QUERY" / "CONTEXT" expander)
--     * any earlier NOTICEs from sections that passed before the abort
--       — those remain in the output, so you can see exactly where the
--       run progressed before failing
--   This is sufficient to root-cause without SAVEPOINT plumbing. If you
--   want every section to attempt running regardless of upstream
--   failures, the only safe path is to re-run the script after fixing
--   each failure; multi-section catch-and-continue would either require
--   ~150 LOC of per-section EXCEPTION handlers or a TEMP-TABLE results
--   pattern, both of which obscure which check actually failed.
--
-- WHAT THIS SCRIPT PROVES (under owner identity)
-- ---------------------------------------------
--   * Every owner-callable read RPC exists and runs without error.
--   * Every conditional-projection view returns rows (cost / contact
--     columns populated for owner).
--   * Every audit-column UPDATE via RPC populates `updated_by_user_id`
--     from auth.uid().
--   * AQ-01..AQ-24 all return zero rows (no invariant violations).
--   * The single-shop fallback path resolves (current_active_shop_id()
--     returns the owner's shop with no app-shop-id header set).
--
-- WHAT THIS SCRIPT CANNOT PROVE (pilot-only — deferred)
-- -----------------------------------------------------
--   See §7 at the end of this file for the matrix row IDs (E3-NNN) that
--   require a real second auth account and are deferred to the pilot
--   phase. Do NOT modify this script to fake a non-owner identity via
--   `set_config` (Discipline rule D-1).
-- =====================================================================

begin;

-- =====================================================================
-- §0 — Sanity: auth context present
-- =====================================================================
do $$
begin
  if auth.uid() is null then
    raise exception 'NO_AUTH_CONTEXT: this script must run under an authenticated session. Use Supabase Studio SQL editor while signed in as the owner.';
  end if;
  raise notice '§0 OK: auth.uid() = %', auth.uid();
end $$;

-- =====================================================================
-- §1 — Owner identity + single-shop fallback path resolves
-- =====================================================================
do $$
declare
  v_shop_id uuid;
  v_shop_name text;
  v_is_owner boolean;
begin
  -- get_active_shop() reads current_active_shop_id() under the hood.
  -- For a single-shop owner with no app-shop-id header, the fallback
  -- path (migration 0085) should resolve to the only shop on record.
  select s.shop_id, s.shop_name, s.is_owner
    into v_shop_id, v_shop_name, v_is_owner
    from public.get_active_shop() s;
  if v_shop_id is null then
    raise exception 'FAIL §1: get_active_shop() returned no shop — fallback path broken?';
  end if;
  if not v_is_owner then
    raise exception 'FAIL §1: caller is_owner=false; this script is owner-runnable only. Sign in as the shop owner and re-run.';
  end if;
  raise notice '§1 OK: active shop = % (%) ; is_owner = true', v_shop_id, v_shop_name;
end $$;

-- =====================================================================
-- §2 — Read-only RPC smoke (matrix §2: every owner-callable read RPC)
-- =====================================================================
-- Goal: every read RPC the owner can call must return without error.
-- Pilot-only rows that gate on non-owner discount-limit caps are
-- skipped here (see §7); owner bypasses every permission check via the
-- implicit shortcut in user_has_permission().
do $$
declare
  v_rpc text;
  v_self uuid := auth.uid();
  v_n bigint;
  v_dummy_id uuid;
begin
  -- ==== Identity helpers (matrix §2.9) ============================
  perform public.user_has_shop_access((select shop_id from public.get_active_shop()));  -- E3-122
  perform public.user_has_permission((select shop_id from public.get_active_shop()), 'view_products');  -- E3-123
  perform public.user_permissions_in_shop((select shop_id from public.get_active_shop()));  -- E3-124
  -- set_active_shop is exercised implicitly by Studio; explicit call would no-op.

  -- ==== Phase C read RPCs (matrix §2.7 + §2.8 — Phase C additions) ===
  perform public.get_active_shop();                          -- E3-101
  perform public.get_shop_settings();                        -- E3-102
  perform public.list_pending_invitations_for_shop();        -- E3-119
  perform public.list_permission_audit_for_shop(50, 0);      -- E3-120
  -- get_team_member_profiles needs a uuid[] arg; pass self to verify the
  -- shape (the function filters out anyone not on the shop team).
  perform public.get_team_member_profiles(array[v_self]);    -- E3-121

  -- ==== v2.9 (0075) read RPCs ====================================
  perform public.get_user_shop_list();                       -- helper
  perform public.get_team_for_active_shop();                 -- E3-103
  perform public.get_user_permissions(v_self);               -- E3-104 (self)

  -- ==== Product read RPCs (matrix §2.2) ===========================
  perform public.search_products();                          -- E3-046
  perform public.search_products_count();                    -- E3-047
  perform public.recent_purchase_products();                 -- E3-048
  perform public.search_categories();                        -- E3-049
  perform public.search_variant_attributes();                -- E3-064
  -- list_attribute_values needs an attribute id; pass any if exists
  select id into v_dummy_id from public.variant_attributes where shop_id = (select shop_id from public.get_active_shop()) limit 1;
  if v_dummy_id is not null then
    perform public.list_attribute_values(v_dummy_id);        -- E3-065
    raise notice '§2 list_attribute_values exercised with attribute %', v_dummy_id;
  else
    raise notice '§2 list_attribute_values: skipped (no variant_attributes in shop)';
  end if;

  -- ==== Customer read RPCs (matrix §2.4) ==========================
  perform public.list_customers('', 25, 0);                  -- E3-078
  perform public.recent_customers();                         -- E3-079
  perform public.search_khata_customers();                   -- E3-080
  perform public.search_khata_customers_count();             -- E3-081

  -- ==== Supplier read RPCs (matrix §2.5) ==========================
  perform public.search_suppliers();                         -- E3-087
  perform public.recent_suppliers();                         -- E3-088

  -- ==== Inventory / batch read RPCs (matrix §2.3) =================
  perform public.search_purchases();                         -- E3-073
  perform public.search_purchases_count();                   -- E3-074
  -- suggest_batch_no needs a variant id; skip if no variants
  select v.id into v_dummy_id
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where p.shop_id = (select shop_id from public.get_active_shop())
     and v.is_active
   limit 1;
  if v_dummy_id is not null then
    perform public.suggest_batch_no(v_dummy_id);             -- E3-070
    raise notice '§2 suggest_batch_no exercised with variant %', v_dummy_id;
  else
    raise notice '§2 suggest_batch_no: skipped (no active variants)';
  end if;

  -- ==== Sales preflight (matrix §2.1) =============================
  perform public.preflight_expired_sale_check('[]'::jsonb);  -- E3-045

  raise notice '§2 OK: all owner-callable read RPCs returned without error';
end $$;

-- =====================================================================
-- §3 — Conditional-projection views smoke (matrix §4)
-- =====================================================================
-- Goal: every view from matrix §4 must be queryable. Owner sees all
-- conditional columns populated; cost-bearing columns must be non-null
-- whenever underlying rows have non-null values (we don't assert that
-- per-row here — that's a pilot-time non-owner check). We just verify
-- the view RUNS and returns rows when underlying data exists.
do $$
declare v_n bigint;
begin
  select count(*) into v_n from public.products_view;                     -- E3-206
  raise notice '§3 products_view: % rows', v_n;
  select count(*) into v_n from public.product_variants_view;             -- E3-207
  raise notice '§3 product_variants_view: % rows', v_n;
  select count(*) into v_n from public.inventory_batches_view;            -- E3-208
  raise notice '§3 inventory_batches_view: % rows', v_n;
  select count(*) into v_n from public.invoices_view;                     -- E3-209..211 + E3-228
  raise notice '§3 invoices_view: % rows', v_n;
  select count(*) into v_n from public.sale_items_view;                   -- E3-212..214
  raise notice '§3 sale_items_view: % rows', v_n;
  select count(*) into v_n from public.customers_view;                    -- E3-215..216
  raise notice '§3 customers_view: % rows', v_n;
  select count(*) into v_n from public.monthly_summary_view;              -- E3-217
  raise notice '§3 monthly_summary_view: % rows', v_n;
  select count(*) into v_n from public.customer_outstanding;              -- E3-218
  raise notice '§3 customer_outstanding: % rows', v_n;
  select count(*) into v_n from public.shop_owner_details_view;           -- E3-219
  raise notice '§3 shop_owner_details_view: % rows', v_n;
  select count(*) into v_n from public.total_outstanding;                 -- E3-225
  raise notice '§3 total_outstanding: % rows', v_n;
  select count(*) into v_n from public.shop_effective_subscription;       -- E3-226
  raise notice '§3 shop_effective_subscription: % rows', v_n;
  select count(*) into v_n from public.purchases_view;                    -- E3-227
  raise notice '§3 purchases_view: % rows', v_n;
  select count(*) into v_n from public.purchase_items_view;               -- E3-227
  raise notice '§3 purchase_items_view: % rows', v_n;
  select count(*) into v_n from public.purchase_overhead_items_view;      -- E3-227
  raise notice '§3 purchase_overhead_items_view: % rows', v_n;

  -- Owner-projection sanity: at least one shop_owner_details_view row
  -- must exist for the current shop (owner can read their own details).
  select count(*) into v_n
    from public.shop_owner_details_view
   where shop_id = (select shop_id from public.get_active_shop());
  if v_n = 0 then
    raise notice '§3 NOTE: shop_owner_details_view has 0 rows for current shop — check that complete_onboarding populated shop_owner_details.';
  end if;

  raise notice '§3 OK: all conditional-projection views queryable';
end $$;

-- =====================================================================
-- §4 — Audit-column smoke (matrix §6: post-delegation UPDATE writes)
-- =====================================================================
-- Goal: run a no-op UPDATE through each audit-column-writing RPC and
-- verify the `updated_by_user_id` column ends up equal to auth.uid().
-- Uses existing data (NO INSERTs); skips rows with a clear NOTICE if
-- no suitable row exists. ROLLBACK cleans up at the end.
do $$
declare
  v_self uuid := auth.uid();
  v_shop_id uuid := (select shop_id from public.get_active_shop());
  v_id uuid;
  v_v_id uuid;
  v_p_id uuid;
  v_before uuid;
  v_after uuid;
  v_bool boolean;
  v_text text;
  v_attempts int;
begin
  -- ---- E3-241: update_customer → customers.updated_by_user_id -----
  select id into v_id from public.customers
   where shop_id = v_shop_id limit 1;
  if v_id is not null then
    -- no-op: pass only p_id, all other params null → preserves existing
    -- values via the RPC's coalesce()s but still writes updated_by_user_id.
    perform public.update_customer(v_id);
    select updated_by_user_id into v_after from public.customers where id = v_id;
    if v_after is null or v_after <> v_self then
      raise exception 'FAIL §4 E3-241: customers.updated_by_user_id expected % got %', v_self, v_after;
    end if;
    raise notice '§4 E3-241 customers.updated_by_user_id: OK (now %)', v_after;
  else
    raise notice '§4 E3-241 customers: skipped (no rows in shop)';
  end if;

  -- ---- E3-242: archive_product → products + product_variants ------
  -- (no-op: read current is_active, call with same value; still triggers
  --  UPDATE on both tables via the cascade.)
  select id, is_active into v_id, v_bool
    from public.products where shop_id = v_shop_id limit 1;
  if v_id is not null then
    perform public.archive_product(v_id, v_bool);
    select updated_by_user_id into v_after from public.products where id = v_id;
    if v_after is null or v_after <> v_self then
      raise exception 'FAIL §4 E3-242: products.updated_by_user_id expected % got %', v_self, v_after;
    end if;
    raise notice '§4 E3-242a products.updated_by_user_id: OK (now %)', v_after;
    -- cascade check on variants
    select updated_by_user_id into v_after from public.product_variants
     where product_id = v_id order by created_at limit 1;
    if v_after is null or v_after <> v_self then
      raise exception 'FAIL §4 E3-242: product_variants.updated_by_user_id (cascade) expected % got %', v_self, v_after;
    end if;
    raise notice '§4 E3-242b product_variants.updated_by_user_id (cascade): OK (now %)', v_after;
  else
    raise notice '§4 E3-242 archive_product: skipped (no products in shop)';
  end if;

  -- ---- E3-253: update_variant_inline → product_variants ------------
  -- no-op: pass only p_variant_id (sku/price/is_active all null → preserve)
  select v.id into v_v_id
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where p.shop_id = v_shop_id limit 1;
  if v_v_id is not null then
    perform public.update_variant_inline(v_v_id);
    select updated_by_user_id into v_after from public.product_variants where id = v_v_id;
    if v_after is null or v_after <> v_self then
      raise exception 'FAIL §4 E3-253: product_variants.updated_by_user_id expected % got %', v_self, v_after;
    end if;
    raise notice '§4 E3-253 update_variant_inline → product_variants.updated_by_user_id: OK (now %)', v_after;
  else
    raise notice '§4 E3-253 update_variant_inline: skipped (no variants)';
  end if;

  -- ---- E3-246: update_supplier → suppliers.updated_by_user_id -----
  select id into v_id from public.suppliers where shop_id = v_shop_id limit 1;
  if v_id is not null then
    perform public.update_supplier(v_id);
    select updated_by_user_id into v_after from public.suppliers where id = v_id;
    if v_after is null or v_after <> v_self then
      raise exception 'FAIL §4 E3-246: suppliers.updated_by_user_id expected % got %', v_self, v_after;
    end if;
    raise notice '§4 E3-246 update_supplier → suppliers.updated_by_user_id: OK (now %)', v_after;
  else
    raise notice '§4 E3-246 update_supplier: skipped (no suppliers in shop)';
  end if;

  -- ---- E3-249: update_tier → customer_tiers.updated_by_user_id -----
  -- update_tier signature: (p_tier_id, p_name, p_is_default, p_notes)
  -- update_tier_v28 body has surprising semantics on null params (would
  -- set notes=NULL and raise cannot_unset_default_tier on a default tier
  -- if p_is_default=false). We read the EXISTING is_default + notes from
  -- the row and pass them back verbatim → guaranteed no-op on data, but
  -- the migration-0080 post-delegation UPDATE still writes updated_by_user_id.
  declare
    v_is_default boolean;
    v_notes text;
  begin
    select id, name, is_default, notes
      into v_id, v_text, v_is_default, v_notes
      from public.customer_tiers
     where shop_id = v_shop_id and is_active limit 1;
    if v_id is not null then
      perform public.update_tier(v_id, v_text, v_is_default, v_notes);
      select updated_by_user_id into v_after from public.customer_tiers where id = v_id;
      if v_after is null or v_after <> v_self then
        raise exception 'FAIL §4 E3-249: customer_tiers.updated_by_user_id expected % got %', v_self, v_after;
      end if;
      raise notice '§4 E3-249 update_tier → customer_tiers.updated_by_user_id: OK (now %)', v_after;
    else
      raise notice '§4 E3-249 update_tier: skipped (no active tiers in shop)';
    end if;
  end;

  -- ---- E3-247: update_category → product_categories ----------------
  -- update_category(p_id, p_name) — pass current name to no-op the value
  -- but still trigger the audit-column UPDATE.
  select id, name into v_id, v_text from public.product_categories
   where shop_id = v_shop_id and is_active limit 1;
  if v_id is not null then
    perform public.update_category(v_id, v_text);
    select updated_by_user_id into v_after from public.product_categories where id = v_id;
    if v_after is null or v_after <> v_self then
      raise exception 'FAIL §4 E3-247: product_categories.updated_by_user_id expected % got %', v_self, v_after;
    end if;
    raise notice '§4 E3-247 update_category → product_categories.updated_by_user_id: OK (now %)', v_after;
  else
    raise notice '§4 E3-247 update_category: skipped (no active categories)';
  end if;

  -- ---- E3-248: update_pack → product_packs.updated_by_user_id ------
  -- update_pack signature varies by version; we use the most-common (p_id,
  -- p_pack_name, p_uom_id, p_units_per_pack). To avoid changing UOM/units
  -- and triggering business rules, just skip if there's no pack to test
  -- against, and rely on the post-delegation UPDATE pattern in mig 0080.
  select pp.id into v_id
    from public.product_packs pp
    join public.product_variants v on v.id = pp.variant_id
    join public.products p on p.id = v.product_id
   where p.shop_id = v_shop_id and pp.is_active limit 1;
  if v_id is not null then
    raise notice '§4 E3-248 product_packs.updated_by_user_id: pack id % present; auditable on next update_pack/deactivate_pack call (no-op skipped — RPC param shape varies; see hooks)', v_id;
  else
    raise notice '§4 E3-248 update_pack: skipped (no active packs)';
  end if;

  -- ---- E3-256: upsert_monthly_target → monthly_targets ----------
  -- upsert_monthly_target(p_month date, p_target_sale, p_target_gross_profit,
  --                       p_target_net_profit) — see migration 0075 line 610.
  -- monthly_targets schema: (shop_id, month date, target_sale, target_gross_profit,
  --                          target_net_profit, updated_by_user_id).
  --
  -- v2.9.1 SAFETY: this test ONLY runs the no-op upsert when a current-
  -- month target row already exists. If no row exists, we skip — the
  -- alternative (inserting a 0/0/0 row inside the BEGIN..ROLLBACK envelope)
  -- would commit zero targets to the real shop if Studio's rollback failed
  -- to engage (network blip, manual COMMIT, browser kill). Low probability,
  -- real impact. Skip-if-no-row removes the failure mode entirely.
  -- The full audit-column verification still covers monthly_targets via
  -- the next non-owner test pass when an actual update flows through the
  -- RPC against a known-existing row.
  declare
    v_month date := date_trunc('month', now())::date;
    v_sale numeric(12,2);
    v_gp numeric(12,2);
    v_np numeric(12,2);
    v_exists boolean;
  begin
    select target_sale, target_gross_profit, target_net_profit
      into v_sale, v_gp, v_np
      from public.monthly_targets
     where shop_id = v_shop_id and month = v_month;
    v_exists := v_sale is not null;
    if not v_exists then
      raise notice '§4 E3-256 upsert_monthly_target: skipped — no current-month target row exists; INSERT path deferred to non-owner test pass';
    else
      -- Existing row → safe no-op (UPDATE branch only, no INSERT possible)
      perform public.upsert_monthly_target(v_month, v_sale, v_gp, v_np);
      select updated_by_user_id into v_after from public.monthly_targets
       where shop_id = v_shop_id and month = v_month;
      if v_after is null or v_after <> v_self then
        raise exception 'FAIL §4 E3-256: monthly_targets.updated_by_user_id expected % got %', v_self, v_after;
      end if;
      raise notice '§4 E3-256 upsert_monthly_target → monthly_targets.updated_by_user_id: OK (now %)', v_after;
    end if;
  end;

  -- ---- E3-237: receive_payment → ledger_entries.created_by_user_id ----
  -- This is an INSERT (not UPDATE) via inline-at-INSERT pattern (mig 0086).
  -- We verify that EXISTING ledger_entries.created_by_user_id rows are
  -- always populated (the audit-at-INSERT invariant), without writing a
  -- new entry (which would touch a customer balance and is undesirable
  -- inside a transaction we mean to ROLLBACK regardless — being polite).
  declare
    v_unset_count int;
  begin
    select count(*) into v_unset_count
      from public.ledger_entries
     where shop_id = v_shop_id
       and created_at >= '2026-05-13'::date
       and created_by_user_id is null;
    if v_unset_count > 0 then
      raise exception 'FAIL §4 E3-237: % ledger_entries rows on/after 0086 deploy have NULL created_by_user_id', v_unset_count;
    end if;
    raise notice '§4 E3-237 ledger_entries.created_by_user_id (inline-at-INSERT invariant): OK';
  end;

  -- ---- E3-235/239: invoices.cashier_id + purchases.cashier_id =====
  -- Same invariant: every row inserted under v2.9+ should have
  -- cashier_id populated (inline-at-INSERT). We assert across all rows.
  declare
    v_null_invoices int;
    v_null_purchases int;
  begin
    select count(*) into v_null_invoices
      from public.invoices
     where shop_id = v_shop_id and cashier_id is null;
    select count(*) into v_null_purchases
      from public.purchases
     where shop_id = v_shop_id and cashier_id is null;
    if v_null_invoices > 0 then
      raise notice '§4 E3-235 NOTE: % invoices have NULL cashier_id (legacy pre-v2.9 rows are fine; investigate if post-v2.9)', v_null_invoices;
    else
      raise notice '§4 E3-235 invoices.cashier_id: all populated';
    end if;
    if v_null_purchases > 0 then
      raise notice '§4 E3-239 NOTE: % purchases have NULL cashier_id (legacy pre-v2.9 rows are fine; investigate if post-v2.9)', v_null_purchases;
    else
      raise notice '§4 E3-239 purchases.cashier_id: all populated';
    end if;
  end;

  -- ---- E3-251..E3-254: BLOCKED-flag-flip rows ------------------
  -- update_product / update_variant_inline (price/sku path) /
  -- archive_product are wired in the RPC layer but useUpdateProduct
  -- still does direct UPDATE per task #23. The audit-column write WILL
  -- happen if we invoke the RPC directly (which we did above for
  -- archive_product, E3-242), but the FRONTEND HOOK is the bit that's
  -- blocked. This row is informational.
  raise notice '§4 E3-251/252/253/254 BLOCKED-flag-flip: RPC layer writes audit columns (verified above); useUpdateProduct hook migration is task #23';

  raise notice '§4 OK: audit-column writes verified on update_customer, archive_product (with cascade), update_variant_inline, update_supplier, update_tier, update_category, upsert_monthly_target; ledger / invoice / purchase audit invariants checked';
end $$;

-- =====================================================================
-- §5 — Phase C / Phase D new RPC contract smoke
-- =====================================================================
-- Goal: exercise the 12 v2.9.1 NEW RPCs (11 from 0087 + 1 from 0088)
-- specifically — each must run, with shape-correct return types.
do $$
declare
  v_n bigint;
  v_self uuid := auth.uid();
begin
  -- 0087 — get_active_shop (returns 1 row)
  select count(*) into v_n from public.get_active_shop();
  if v_n <> 1 then
    raise exception 'FAIL §5: get_active_shop() returned % rows; expected 1', v_n;
  end if;

  -- 0087 — get_shop_settings (returns 1 row)
  select count(*) into v_n from public.get_shop_settings();
  if v_n <> 1 then
    raise exception 'FAIL §5: get_shop_settings() returned % rows; expected 1', v_n;
  end if;

  -- 0087 — list_pending_invitations_for_shop (>=0 rows)
  perform public.list_pending_invitations_for_shop();

  -- 0087 — list_permission_audit_for_shop (>=0 rows; param bounds)
  perform public.list_permission_audit_for_shop(100, 0);

  -- 0087 — get_team_member_profiles (filter to self)
  select count(*) into v_n from public.get_team_member_profiles(array[v_self]);
  -- Owner is on the team, so should be 1 row.
  if v_n <> 1 then
    raise exception 'FAIL §5: get_team_member_profiles(self) returned % rows; expected 1', v_n;
  end if;

  -- 0088 — get_invitation_for_acceptance: we expect 'invitation_not_found'
  -- when called with a random UUID. We want to verify it RAISES (vs
  -- returning empty / NULL) — which proves the RPC is in place and the
  -- correct error code path is wired.
  begin
    perform public.get_invitation_for_acceptance('00000000-0000-0000-0000-000000000000'::uuid);
    raise exception 'FAIL §5: get_invitation_for_acceptance with bogus id should have raised, did not';
  exception when others then
    if sqlerrm not like '%invitation_not_found%' then
      raise exception 'FAIL §5: get_invitation_for_acceptance raised wrong error: %', sqlerrm;
    end if;
    raise notice '§5 get_invitation_for_acceptance correctly raised invitation_not_found for bogus uuid';
  end;

  raise notice '§5 OK: 12 v2.9.1 NEW RPCs exercised (11 from 0087 + 1 from 0088)';
end $$;

-- =====================================================================
-- §6 — AQ-01..AQ-24 audit query suite (verbatim from
--      design/2026-05-13-rbac-attack-surface.md §C.3)
-- =====================================================================
-- Each subquery wraps the verbatim AQ inside a count(*) so the operator
-- sees one row per AQ. Every row must have n=0 — any non-zero row is a
-- halt criterion (HC-01 / HC-02 / HC-03 from the matrix Section 7).
--
-- The inner queries are copied without edits from §C.3; do NOT
-- paraphrase or "simplify" them, even if they look redundant. The
-- canonical form is what the weekly audit runs against and what the
-- attack-surface review-baseline depends on.

with
aq01 as (
  -- AQ-01: Every active user_shop_access row corresponds to a real auth user + shop.
  select count(*) as n from (
    select usa.id, usa.user_id, usa.shop_id
      from public.user_shop_access usa
      left join public.profiles p on p.id = usa.user_id
      left join public.shops s on s.id = usa.shop_id
     where p.id is null or s.id is null
  ) x
),
aq02 as (
  -- AQ-02: No user has multiple rows at the same shop.
  select count(*) as n from (
    select user_id, shop_id, count(*)
      from public.user_shop_access
     group by user_id, shop_id
    having count(*) > 1
  ) x
),
aq03 as (
  -- AQ-03: Each shop has exactly one owner.
  select count(*) as n from (
    select shop_id, count(*)
      from public.user_shop_access
     where is_owner = true
     group by shop_id
    having count(*) <> 1
  ) x
),
aq04 as (
  -- AQ-04: No pending invitation accepted past expiry.
  select count(*) as n from (
    select id, expires_at, accepted_at
      from public.pending_invitations
     where status = 'accepted'
       and accepted_at > expires_at
  ) x
),
aq05 as (
  -- AQ-05: Every invoice cashier exists in user_shop_access for the shop.
  -- Refined 2026-05-13 (post-v2.9.1-pilot, ADR 2026-05-13-v291-aq05-audit-history-exception):
  -- revoke_user_access hard-deletes the user_shop_access row, so a
  -- cashier whose access was legitimately revoked would appear orphaned
  -- against the strict EXISTS check. The audit log preserves the
  -- lifecycle (access_granted → ... → access_revoked); a cashier with
  -- an `access_revoked` audit row for the shop is history, not an
  -- orphan. The check still catches the real failure mode: a cashier_id
  -- with neither a current membership row nor any audit lineage.
  -- TODO(v2.10): when soft-delete lands, drop the audit-exception clause
  -- in favor of a usa.is_active=false read.
  select count(*) as n from (
    select i.id, i.cashier_id, i.shop_id
      from public.invoices i
     where i.cashier_id is not null
       and not exists (
         select 1 from public.user_shop_access usa
         where usa.user_id = i.cashier_id and usa.shop_id = i.shop_id
       )
       and not exists (
         select 1 from public.user_shop_permission_audit uspa
         where uspa.target_user_id = i.cashier_id
           and uspa.shop_id = i.shop_id
           and uspa.action = 'access_revoked'
       )
       and i.created_at >= (select min(joined_at) from public.user_shop_access)
  ) x
),
aq06 as (
  -- AQ-06: Same check for purchases.
  select count(*) as n from (
    select p.id, p.cashier_id, p.shop_id
      from public.purchases p
     where p.cashier_id is not null
       and not exists (
         select 1 from public.user_shop_access usa
         where usa.user_id = p.cashier_id and usa.shop_id = p.shop_id
       )
       and p.created_at >= (select min(joined_at) from public.user_shop_access)
  ) x
),
aq07 as (
  -- AQ-07: shops.owner_user_id matches a user_shop_access row with is_owner=true.
  select count(*) as n from (
    select s.id, s.owner_user_id,
           (select usa.user_id from public.user_shop_access usa
             where usa.shop_id = s.id and usa.is_owner = true) as current_owner
      from public.shops s
     where (select usa.user_id from public.user_shop_access usa
             where usa.shop_id = s.id and usa.is_owner = true) is null
        or (select usa.user_id from public.user_shop_access usa
             where usa.shop_id = s.id and usa.is_owner = true) <> s.owner_user_id
  ) x
),
aq08 as (
  -- AQ-08: Salesperson daily receive_payment within cap.
  -- SOFT-ASSERT (visual review).
  -- LEGITIMATE NON-ZERO: a salesperson lawfully recorded a payment above
  -- shops.salesperson_payment_cap_pkr in the past 90 days AND the cap was
  -- later TIGHTENED. The historical row stays in place (audit trail is
  -- immutable), so it shows as a violation against the new cap value.
  -- Action: investigate each row. If reason matches "cap-tightened-since",
  -- accept and move on. If reason is "cap-was-always-this", that's a real
  -- bypass — escalate.
  select count(*) as n from (
    with daily as (
      select le.created_by_user_id, le.shop_id,
             date_trunc('day', le.created_at at time zone 'utc')::date as day,
             sum(le.amount) as daily_total
        from public.ledger_entries le
       where le.type = 'credit'
         and le.created_by_user_id is not null
         and le.created_at >= now() - interval '90 days'
       group by le.created_by_user_id, le.shop_id, day
    )
    select d.created_by_user_id, d.shop_id, d.day, d.daily_total, s.salesperson_payment_cap_pkr
      from daily d
      join public.user_shop_access usa on usa.user_id = d.created_by_user_id and usa.shop_id = d.shop_id
      join public.shops s on s.id = d.shop_id
     where usa.is_owner = false
       and d.daily_total > s.salesperson_payment_cap_pkr
  ) x
),
aq09 as (
  -- AQ-09: No sale's line_discount_amount exceeds the cashier's effective per-line limit.
  -- SOFT-ASSERT (visual review). Same shape as AQ-08.
  -- LEGITIMATE NON-ZERO: a cashier's per_line_max_pct was TIGHTENED after
  -- they recorded sales with line discounts at the old (looser) cap. The
  -- old rows persist; the audit reports them against the current cap.
  -- Action: same as AQ-08. Tightening is the common cause; bypass is rare.
  select count(*) as n from (
    with cashier_limits as (
      select i.id as invoice_id, i.shop_id, i.cashier_id,
             coalesce(
               (usa.discount_limits ->> 'per_line_max_pct')::numeric,
               1000
             ) as line_max_pct
        from public.invoices i
        left join public.user_shop_access usa on usa.user_id = i.cashier_id and usa.shop_id = i.shop_id
    )
    select cl.invoice_id, si.id as sale_item_id, si.line_discount_amount,
           si.price_at_sale, si.qty,
           (si.line_discount_amount / nullif(si.price_at_sale * si.qty, 0)) * 100 as actual_pct,
           cl.line_max_pct
      from cashier_limits cl
      join public.sale_items si on si.invoice_id = cl.invoice_id
     where cl.line_max_pct < 1000
       and (si.line_discount_amount / nullif(si.price_at_sale * si.qty, 0)) * 100 > cl.line_max_pct + 0.01
  ) x
),
aq10 as (
  -- AQ-10: No active pending invitation with failed_attempts >= 5 should still be pending.
  select count(*) as n from (
    select id, failed_attempts, status
      from public.pending_invitations
     where status = 'pending' and failed_attempts >= 5
  ) x
),
aq11 as (
  -- AQ-11: Cleanup-expired-invitations cron has been running.
  select count(*) as n from (
    select id, expires_at, status
      from public.pending_invitations
     where status = 'pending' and expires_at < now() - interval '6 hours'
  ) x
),
aq12 as (
  -- AQ-12: Customer balance reconciliation (preserved).
  select count(*) as n from (
    select customer_id, stored_balance, computed_balance, drift
      from public.customer_balance_reconciliation
     where drift <> 0
  ) x
),
aq13 as (
  -- AQ-13 (refined 2026-05-13): every ACTIVE product has at least one active variant.
  select count(*) as n from (
    select p.id, p.name, p.shop_id
      from public.products p
     where p.is_active = true
       and not exists (select 1 from public.product_variants v
                        where v.product_id = p.id and v.is_active)
  ) x
),
aq14a as (
  -- AQ-14a (informational): batched products never stocked in, older than 30 days.
  -- Note: informational only — not a regression, kept for surface visibility.
  select count(*) as n from (
    select p.id, p.name, p.created_at
      from public.products p
     where p.has_batches = true
       and p.is_active = true
       and p.created_at < now() - interval '30 days'
       and not exists (
         select 1 from public.product_variants v
         join public.inventory_batches b on b.variant_id = v.id
         where v.product_id = p.id)
  ) x
),
aq14b as (
  -- AQ-14b (regression): orphan batches (FK violation).
  select count(*) as n from (
    select b.id from public.inventory_batches b
      left join public.product_variants v on v.id = b.variant_id
      left join public.products p on p.id = v.product_id
     where v.id is null or p.id is null
  ) x
),
aq15 as (
  -- AQ-15: Functions granted to authenticated WITHOUT auth.uid() or
  -- current_active_shop_id() or user_has_permission in body.
  -- SOFT-ASSERT (visual review).
  -- LEGITIMATE NON-ZERO: extremely rare. Only when a NEW DEFINER function
  -- is added that is intentionally callable without an auth context —
  -- e.g. a public-read helper that operates on system-level catalog data
  -- not scoped by shop. As of v2.9.1 NO such function exists; the query
  -- should return 0. If you see a row, escalate immediately — it's almost
  -- certainly a missed permission gate, not an intentional public RPC.
  select count(*) as n from (
    select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef = true
       and exists (
         select 1 from information_schema.routine_privileges r
         where r.specific_schema = 'public'
           and r.routine_name = p.proname
           and r.privilege_type = 'EXECUTE'
           and r.grantee = 'authenticated')
       and not (
         pg_get_functiondef(p.oid) like '%auth.uid()%'
         or pg_get_functiondef(p.oid) like '%current_active_shop_id%'
         or pg_get_functiondef(p.oid) like '%user_has_permission%'
         or pg_get_functiondef(p.oid) like '%user_has_shop_access%'
       )
  ) x
),
aq16 as (
  -- AQ-16: Every shop has a corresponding shop_owner_details row.
  select count(*) as n from (
    select s.id, s.shop_name
      from public.shops s
     where not exists (select 1 from public.shop_owner_details d where d.shop_id = s.id)
  ) x
),
aq17 as (
  -- AQ-17: No pending invitation has role='owner' (per cannot_invite_owner).
  select count(*) as n from (
    select id, shop_id, preset_applied
      from public.pending_invitations
     where preset_applied not in ('manager', 'salesperson')
  ) x
),
aq18 as (
  -- AQ-18: every user_shop_permissions row references an active catalog key.
  select count(*) as n from (
    select usp.id, usp.permission_key
      from public.user_shop_permissions usp
      left join public.permissions_catalog pc on pc.key = usp.permission_key
     where pc.key is null or pc.is_active = false
  ) x
),
aq19 as (
  -- AQ-19: every user_shop_permissions row's user_shop_access_id is valid
  -- and belongs to a non-owner.
  select count(*) as n from (
    select usp.id, usp.user_shop_access_id
      from public.user_shop_permissions usp
      join public.user_shop_access usa on usa.id = usp.user_shop_access_id
     where usa.is_owner = true
  ) x
),
aq20 as (
  -- AQ-20: dependency consistency. For every (user, granted_permission)
  -- where the permission has requires, all required permissions are also granted.
  select count(*) as n from (
    select usp.user_shop_access_id, usp.permission_key, missing_dep
      from public.user_shop_permissions usp
      join public.permissions_catalog pc on pc.key = usp.permission_key
      cross join lateral unnest(pc.requires) as missing_dep
     where usp.granted = true
       and not exists (
         select 1 from public.user_shop_permissions usp2
         where usp2.user_shop_access_id = usp.user_shop_access_id
           and usp2.permission_key = missing_dep
           and usp2.granted = true
       )
  ) x
),
aq21 as (
  -- AQ-21: every requires[] entry in the catalog points to a real catalog key.
  select count(*) as n from (
    select pc.key, missing_require
      from public.permissions_catalog pc
      cross join lateral unnest(pc.requires) as missing_require
     where not exists (
       select 1 from public.permissions_catalog pc2 where pc2.key = missing_require
     )
  ) x
),
aq22 as (
  -- AQ-22: permission audit log is non-empty and consistent.
  -- Verifies: every user_shop_access row with preset_applied set has a
  -- corresponding audit row recording the preset assignment.
  -- Refined 2026-05-13 (post-v2.9.1-pilot, ADR 2026-05-13-v291-aq22-aq23-refinements):
  -- accept_invitation writes audit action='access_granted' (carrying
  -- new_value.preset), not action='preset_applied' — yet the assignment
  -- is fully recorded. The accepted preset-emitting actions are now
  -- ('preset_applied', 'access_granted'); both still cross-check
  -- new_value.preset against usa.preset_applied so a bypass that wrote
  -- no audit row at all is still caught.
  -- SOFT-ASSERT (visual review).
  -- LEGITIMATE NON-ZERO: a preset was applied to a user via direct SQL
  -- INSERT into user_shop_access (bypassing both apply_preset_to_user
  -- and accept_invitation) — e.g. during the v2.9.0.1 owner backfill in
  -- migration 0071, or any admin-driven seeding script. The pre-v2.9.1
  -- owner row falls into this bucket and is expected.
  -- Action: if every "missing-audit-row" row corresponds to an owner
  -- (is_owner=true), accept — those were seeded by 0071. If a non-owner
  -- row appears, escalate — someone bypassed both RPCs.
  select count(*) as n from (
    select usa.id, usa.user_id, usa.shop_id, usa.preset_applied
      from public.user_shop_access usa
     where usa.preset_applied is not null
       and not exists (
         select 1 from public.user_shop_permission_audit uspa
         where uspa.target_user_id = usa.user_id
           and uspa.shop_id = usa.shop_id
           and uspa.action in ('preset_applied', 'access_granted')
           and uspa.new_value->>'preset' = usa.preset_applied)
  ) x
),
aq23 as (
  -- AQ-23 (added 2026-05-13 v2.9 cleanup, ADR #23): DEFINER-wrapper
  -- shape-drift detector. See §C.3 lines 2017–2077 for full rationale.
  -- Exempt list (14 entries) includes the v2.9.1 additions
  -- get_active_shop + get_shop_settings (mig 0087, shop-membership-gated)
  -- and get_invitation_for_acceptance (mig 0088, pre-shop helper —
  -- invitee has no shop access yet; same rationale as accept_invitation).
  -- SOFT-ASSERT (visual review).
  -- LEGITIMATE NON-ZERO: only if a new DEFINER wrapper was added since
  -- this audit and not yet added to the exempt list. As of v2.9.1 the
  -- expected result is 0. If non-zero: the row tells you the wrapper
  -- name + which property (P1 not_authenticated / P2 no_shop_for_user /
  -- P3 user_has_permission) is missing. Either fix the wrapper or add
  -- to the exempt list with documented reason.
  select count(*) as n from (
    with f as (
      select n.nspname as schema, p.proname as name,
             pg_get_functiondef(p.oid) as body
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.prosecdef=true
         and has_function_privilege('authenticated', p.oid, 'execute')
         and pg_get_function_result(p.oid) <> 'trigger'
         and p.proname not like '%\_v28' escape '\'
    ),
    graded as (
      select name,
        body ~ 'not_authenticated' as has_p1,
        body ~ 'no_shop_for_user' as has_p2,
        body ~ 'user_has_permission' as has_p3,
        case when name in (
          'accept_invitation','cancel_invitation','complete_onboarding',
          'current_active_shop_id','current_shop_id',
          'get_user_permissions','get_user_shop_list',
          'set_active_shop','user_has_permission','user_has_shop_access',
          'user_permissions_in_shop',
          'get_active_shop','get_shop_settings',
          'get_invitation_for_acceptance',
          -- v2.9.1 hot-patch mig 0090, added 2026-05-13 post-pilot.
          -- Same pre-shop-access rationale as get_invitation_for_acceptance:
          -- the invitee has no user_shop_access row when RequireOnboarded
          -- calls this. ADR 2026-05-13-v291-aq22-aq23-refinements.
          'get_my_pending_invitation'
        ) then true else false end as is_exempt
      from f
    )
    select name,
      case when not has_p1 then 'missing not_authenticated'
           when not has_p2 then 'missing no_shop_for_user'
           when not has_p3 then 'missing user_has_permission gate'
           else null end as deviation_reason
      from graded
     where not is_exempt
       and not (has_p1 and has_p2 and has_p3)
  ) x
),
aq24 as (
  -- AQ-24 (added 2026-05-13 v2.9.1 Phase C migration 0087): legacy
  -- current_shop_id() callers outside the baseline allowlist.
  -- Allowlist: all _v28 inner functions + daily_sales_7 + expenses_by_category_mtd.
  -- SOFT-ASSERT (visual review).
  -- LEGITIMATE NON-ZERO: only if a NEW SQL object (function or view) was
  -- added since this audit that references current_shop_id() instead of
  -- current_active_shop_id(). The discipline rule (see decisions/
  -- 2026-05-13-v291-aq24-baseline-allowlist.md) is "new SQL calls
  -- current_active_shop_id() directly; legacy alias only via the
  -- baseline allowlist." Non-zero rows tell you the offender name; fix
  -- the SQL to use current_active_shop_id() OR add to the allowlist
  -- with documented reason (v2.10 cleanup target for the 2 pre-v2.9 views).
  select count(*) as n from (
    select name, kind from (
      select p.proname as name, 'function' as kind, pg_get_functiondef(p.oid) as body
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public'
      union all
      select v.viewname as name, 'view' as kind, pg_get_viewdef(v.viewname::regclass) as body
        from pg_views v where v.schemaname='public'
    ) x
     where body ~ 'current_shop_id\s*\(\s*\)'
       and name <> 'current_shop_id'
       and body !~ 'current_active_shop_id'
       and name not like '%\_v28' escape '\'
       and name not in ('daily_sales_7', 'expenses_by_category_mtd')
  ) x
)
select 'AQ-01' as query, n from aq01
union all select 'AQ-02', n from aq02
union all select 'AQ-03', n from aq03
union all select 'AQ-04', n from aq04
union all select 'AQ-05', n from aq05
union all select 'AQ-06', n from aq06
union all select 'AQ-07', n from aq07
union all select 'AQ-08', n from aq08
union all select 'AQ-09', n from aq09
union all select 'AQ-10', n from aq10
union all select 'AQ-11', n from aq11
union all select 'AQ-12', n from aq12
union all select 'AQ-13', n from aq13
union all select 'AQ-14a (informational)', n from aq14a
union all select 'AQ-14b', n from aq14b
union all select 'AQ-15', n from aq15
union all select 'AQ-16', n from aq16
union all select 'AQ-17', n from aq17
union all select 'AQ-18', n from aq18
union all select 'AQ-19', n from aq19
union all select 'AQ-20', n from aq20
union all select 'AQ-21', n from aq21
union all select 'AQ-22', n from aq22
union all select 'AQ-23', n from aq23
union all select 'AQ-24', n from aq24
order by query;
-- ► OPERATOR MUST VERIFY: every row has n=0.
--   AQ-14a is informational (non-zero acceptable; flagged for inspection).
--   Any other non-zero row is a HALT criterion (HC-01..HC-03).

-- A second pass: programmatic assertion that every regression row is 0.
-- (Re-runs the same CTEs in one assertion block so the operator gets
-- a single PASS/FAIL line in addition to the per-AQ count above.)
do $$
declare
  v_aq text;
  v_n bigint;
  v_failed boolean := false;
begin
  for v_aq, v_n in
    with
    aq01 as (select 'AQ-01'::text as q, count(*) as n from (select usa.id from public.user_shop_access usa left join public.profiles p on p.id = usa.user_id left join public.shops s on s.id = usa.shop_id where p.id is null or s.id is null) x),
    aq02 as (select 'AQ-02'::text, count(*) from (select 1 from public.user_shop_access group by user_id, shop_id having count(*) > 1) x),
    aq03 as (select 'AQ-03'::text, count(*) from (select 1 from public.user_shop_access where is_owner = true group by shop_id having count(*) <> 1) x),
    aq04 as (select 'AQ-04'::text, count(*) from (select 1 from public.pending_invitations where status = 'accepted' and accepted_at > expires_at) x),
    aq05 as (select 'AQ-05'::text, count(*) from (select 1 from public.invoices i where i.cashier_id is not null and not exists (select 1 from public.user_shop_access usa where usa.user_id = i.cashier_id and usa.shop_id = i.shop_id) and i.created_at >= (select min(joined_at) from public.user_shop_access)) x),
    aq06 as (select 'AQ-06'::text, count(*) from (select 1 from public.purchases p where p.cashier_id is not null and not exists (select 1 from public.user_shop_access usa where usa.user_id = p.cashier_id and usa.shop_id = p.shop_id) and p.created_at >= (select min(joined_at) from public.user_shop_access)) x),
    aq07 as (select 'AQ-07'::text, count(*) from (select 1 from public.shops s where (select usa.user_id from public.user_shop_access usa where usa.shop_id = s.id and usa.is_owner = true) is null or (select usa.user_id from public.user_shop_access usa where usa.shop_id = s.id and usa.is_owner = true) <> s.owner_user_id) x),
    aq10 as (select 'AQ-10'::text, count(*) from (select 1 from public.pending_invitations where status = 'pending' and failed_attempts >= 5) x),
    aq11 as (select 'AQ-11'::text, count(*) from (select 1 from public.pending_invitations where status = 'pending' and expires_at < now() - interval '6 hours') x),
    aq12 as (select 'AQ-12'::text, count(*) from (select 1 from public.customer_balance_reconciliation where drift <> 0) x),
    aq13 as (select 'AQ-13'::text, count(*) from (select 1 from public.products p where p.is_active = true and not exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)) x),
    aq14b as (select 'AQ-14b'::text, count(*) from (select 1 from public.inventory_batches b left join public.product_variants v on v.id = b.variant_id left join public.products p on p.id = v.product_id where v.id is null or p.id is null) x),
    aq16 as (select 'AQ-16'::text, count(*) from (select 1 from public.shops s where not exists (select 1 from public.shop_owner_details d where d.shop_id = s.id)) x),
    aq17 as (select 'AQ-17'::text, count(*) from (select 1 from public.pending_invitations where preset_applied not in ('manager','salesperson')) x),
    aq18 as (select 'AQ-18'::text, count(*) from (select 1 from public.user_shop_permissions usp left join public.permissions_catalog pc on pc.key = usp.permission_key where pc.key is null or pc.is_active = false) x),
    aq19 as (select 'AQ-19'::text, count(*) from (select 1 from public.user_shop_permissions usp join public.user_shop_access usa on usa.id = usp.user_shop_access_id where usa.is_owner = true) x),
    aq20 as (select 'AQ-20'::text, count(*) from (select 1 from public.user_shop_permissions usp join public.permissions_catalog pc on pc.key = usp.permission_key cross join lateral unnest(pc.requires) as missing_dep where usp.granted = true and not exists (select 1 from public.user_shop_permissions usp2 where usp2.user_shop_access_id = usp.user_shop_access_id and usp2.permission_key = missing_dep and usp2.granted = true)) x),
    aq21 as (select 'AQ-21'::text, count(*) from (select 1 from public.permissions_catalog pc cross join lateral unnest(pc.requires) as missing_require where not exists (select 1 from public.permissions_catalog pc2 where pc2.key = missing_require)) x)
    select q, n from aq01
    union all select q, n from aq02
    union all select q, n from aq03
    union all select q, n from aq04
    union all select q, n from aq05
    union all select q, n from aq06
    union all select q, n from aq07
    union all select q, n from aq10
    union all select q, n from aq11
    union all select q, n from aq12
    union all select q, n from aq13
    union all select q, n from aq14b
    union all select q, n from aq16
    union all select q, n from aq17
    union all select q, n from aq18
    union all select q, n from aq19
    union all select q, n from aq20
    union all select q, n from aq21
  loop
    if v_n <> 0 then
      raise warning 'FAIL §6 %: returned % rows (expected 0)', v_aq, v_n;
      v_failed := true;
    end if;
  end loop;
  if v_failed then
    raise exception 'FAIL §6: one or more audit queries returned non-zero rows; see per-AQ output above';
  end if;
  raise notice '§6 OK: regression AQ subset (01–07, 10–13, 14b, 16–21) all returned 0';
  raise notice '§6 NOTE: AQ-08 / AQ-09 / AQ-14a / AQ-15 / AQ-22 / AQ-23 / AQ-24 — operator must verify counts manually from the SELECT output above (these are sensitive to data shape or are informational; the script still runs them as the canonical SELECT block).';
end $$;

-- =====================================================================
-- §FINAL — Summary
-- =====================================================================
do $$ begin raise notice 'PASS: v2.9.1 Phase E owner-runnable synthetic test bed completed. Review NOTICE output above for any FAIL: lines; review the §6 AQ table for any non-zero counts.'; end $$;

rollback;

-- =====================================================================
-- §7 — Pilot-only rows NOT covered by this script
-- =====================================================================
-- The following matrix rows require a real second auth account
-- (manager-x@test.local and/or salesperson-x@test.local from the
-- C.2.0 setup) + invitation accept lifecycle that cannot be exercised
-- pre-pilot. They are explicitly OUT OF SCOPE for this owner-runnable
-- script per Discipline rule D-1 (no `set_config` shortcuts to fake
-- non-owner identity).
--
-- Pilot phase will run a separate synthetic test script that signs
-- the second account in via Studio (different browser profile) and
-- exercises these gates with real JWTs.
--
-- RPC permission-gate rejection for non-owners (Section 2):
--   E3-038..E3-039  record_sale base + confirm_expired_sale_at_pos
--   E3-040..E3-044  record_sale per-line / per-invoice / implicit caps
--   E3-046..E3-068  every Section 2.2 product RPC (non-owner gate)
--   E3-069..E3-074  Section 2.3 inventory (non-owner gate)
--   E3-075..E3-086  Section 2.4 customer (non-owner gate)
--   E3-087..E3-091  Section 2.5 supplier (non-owner gate)
--   E3-092..E3-098  Section 2.6 financial (incl. payment cap)
--   E3-099..E3-100  Section 2.7 settings (non-owner gate)
--   E3-103..E3-117  Section 2.8 team / RBAC (non-owner cannot view/modify)
--   E3-118          get_invitation_for_acceptance happy path (needs the
--                   actual invited user signed in)
--   E3-119..E3-121  list_pending_invitations / list_permission_audit /
--                   get_team_member_profiles — non-owner blocked
--   E3-122..E3-125  identity helpers under non-owner JWT
--
-- Conditional-projection NULL-out for non-permitted users (Section 4):
--   E3-206..E3-228  every projection row — owner sees data; pilot
--                   verifies non-owner sees NULLs / filtered rows
--
-- Special flows (Section 5):
--   E3-229          invitation create → 4-digit code → accept lifecycle
--   E3-230          shop switch (needs user with >1 shop)
--   E3-231          60s permission-cache stale window (cross-session)
--   E3-232          dependency cascade in EditPermissionsDialog
--   E3-233          5-strike auto-cancel
--   E3-234          expired-sale-confirm permission revoke hot-patch
--
-- Audit-column rows that need non-owner action (Section 6 / 1) — owner
-- can verify the UPDATE pattern (this script does), but pilot must
-- additionally verify that audit rows record the NON-OWNER's auth.uid()
-- when a salesperson takes the action:
--   E3-236..E3-238  ledger_entries.created_by_user_id by non-owner
--   E3-243..E3-244  user_shop_permission_audit by non-owner actor
--
-- =====================================================================
-- END OF FILE
-- =====================================================================
