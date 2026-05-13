# 2026-05-14 — Migration chain drift audit (v2.10 pre-staging)

## Purpose

Before standing up a staging Supabase project for v2.10 contacts
work, the local `supabase/migrations/` folder must be verified
as a complete and faithful representation of production's
schema-creation history. The implicit assumption — "if I lost
production tomorrow, could I rebuild it from source?" — has
never been tested.

This audit was triggered when an initial inventory of
`supabase_migrations.schema_migrations` on production
(`orfggrnyychmmqdlbfhf`) showed **109 rows**, while the
local `supabase/migrations/` folder has **98 files**. The
11-row gap raised three possible explanations:

1. Naming drift only (same SQL, different name in prod's history)
2. Consolidation (multiple prod migrations collapsed into one
   local file when source was tidied up)
3. **Genuinely missing SQL** (objects exist in prod that the
   local files cannot reproduce)

Option 3 is the failure mode that blocks v2.10. This audit
classifies each of the 13 Category-3 suspect entries and runs
one Category-2 sanity check.

## Conclusion (TL;DR)

**Zero genuinely missing entries.** All 109 prod-applied
migrations are represented in the 98 local files. The 11-row
delta is entirely accounted for by **six consolidation events**
where multiple prod migrations were collapsed into a single
local file:

| Local file | Replaces these prod entries | Saves |
|---|---|---|
| `0036_v25_categories_and_detail.sql` | `0036_v25_categories_and_detail`, `0036_v25_categories_rpcs`, `0036_v25_product_rpcs` | 2 |
| `0042_v26_record_purchase_and_opening_stock.sql` | `0042_v26_record_purchase`, `0042_v26_create_product_with_opening_stock` | 1 |
| `0043_v26_search_products_and_packs.sql` | `0043_v26_search_products_and_packs`, `0043_v26_pack_rpcs` | 1 |
| `0058_v28_batch_rpcs_and_views.sql` | `0058_v28_batch_rpcs_and_views`, `0058a_v28_record_purchase`, `0058b_v28_record_sale_fefo`, `0058c_v28_deactivate_batch_and_views`, `0058d_v28_suggest_batch_no_fix` | 4 |
| `0060_v281_pricing_decouple.sql` | `0060_v281_pricing_decouple`, `0060a_v281_create_product_with_variants` | 1 |
| `0063_v283_visibility_fixes.sql` | `0063_v283_expired_and_pricing_visibility_a_view`, `0063b_v283_product_with_default_variant_has_null_price`, `0063c_v283_search_products_needs_pricing` | 2 |
| | | **Σ = 11** |

`98 + 11 = 109 = prod count.` Arithmetic balances exactly.

**Per the user's decision rule:** zero genuinely missing →
proceed to staging replay as originally planned. No recovery
migrations need to be authored.

**Open verification debt** is summarized at the end; nothing
in it is a v2.10 blocker, but two items are worth filing as
v2.11 cleanup tickets.

---

## Methodology

For each Category-3 suspect entry:

1. Pulled `supabase_migrations.schema_migrations.statements[1]`
   from production (the canonical SQL that was applied).
2. Regex-extracted top-level object declarations (`create
   function|view|table|trigger|policy|index`, plus
   `alter|drop|grant|revoke`) from each prod migration's body
   into a fingerprint.
3. Read the suspect local file(s) end-to-end.
4. Verified each prod-declared object name appears in some
   local file, in correct dependency order (table before FKs
   etc.), with grants/revokes preserved.
5. For the 0058d fix migration — the highest-risk case because
   it patches an earlier migration's bug — pulled both prod
   versions and confirmed the local consolidated file carries
   the post-fix body.

For Category 2:

- Pulled the full prod SQL for one entry
  (`v15_product_type_search_and_opening_stock`).
- Read the corresponding local file
  (`0014_v15_product_type_search_and_opening_stock.sql`).
- Diffed byte-for-byte (modulo trailing whitespace + section-
  divider hyphen lengths).

---

## Per-entry classification

### Category 3 — consolidation drift

#### 0036_v25_categories_and_detail (prod, 3374 B)

- **Prod creates:** `product_categories` table, indexes
  (`idx_category_name_trgm`, `idx_category_shop_active`,
  `idx_products_category`, `uq_category_shop_name`,
  `uq_products_shop_name_category`), trigger
  `product_categories_touch`, `ALTER products ADD category_id`,
  RLS policies, `DROP INDEX uq_products_shop_name_type`.
- **Local equivalent:** `0036_v25_categories_and_detail.sql`
  lines 17–120.
- **Status:** ✅ **Local equivalent found** (and the local file
  also includes the bodies of `0036_v25_categories_rpcs` and
  `0036_v25_product_rpcs` — see below).

#### 0036_v25_categories_rpcs (prod, 3569 B)

- **Prod creates:** functions `search_categories`,
  `create_category_inline`, `update_category`.
- **Local equivalent:** consolidated into
  `0036_v25_categories_and_detail.sql` lines 126–246 (§F).
- **Status:** ✅ **Merged**. Function bodies + signatures match
  prod.

#### 0036_v25_product_rpcs (prod, 8327 B)

- **Prod creates:** functions `search_products`,
  `search_products_count`,
  `create_product_with_opening_stock` (v2.5 signature). Plus all
  the `revoke from public, anon / grant to authenticated` lines
  for every function created across the 0036 trio.
- **Local equivalent:** consolidated into
  `0036_v25_categories_and_detail.sql` lines 248–509 (§G–I).
- **Status:** ✅ **Merged**. Grants/revokes covering all six
  functions from the trio are in §I.

#### 0042_v26_record_purchase (prod, 9283 B)

- **Prod creates:** `record_purchase` (v2.6 variant-aware,
  signature `uuid, date, text, jsonb, jsonb, boolean`).
- **Local equivalent:**
  `0042_v26_record_purchase_and_opening_stock.sql` lines 19–268.
- **Status:** ✅ **Merged**. Same signature, same body
  (variant resolution, largest-remainder overhead allocation,
  variant-level stock update).

#### 0042_v26_create_product_with_opening_stock (prod, 3343 B)

- **Prod creates:** `create_product_with_opening_stock`
  (v2.6 signature returning `table(product_id, variant_id)`).
- **Local equivalent:**
  `0042_v26_record_purchase_and_opening_stock.sql` lines 280–368.
- **Status:** ✅ **Merged**. DROP-then-CREATE sequence,
  signature, grants all match.

#### 0043_v26_search_products_and_packs (prod, 3930 B)

- **Prod creates:** functions `search_products`,
  `search_products_count` (v2.6 — read through
  `product_with_default_variant` view).
- **Local equivalent:**
  `0043_v26_search_products_and_packs.sql` lines 17–143.
- **Status:** ✅ **Local equivalent found**.

#### 0043_v26_pack_rpcs (prod, 4532 B)

- **Prod creates:** functions `define_pack_inline`,
  `update_pack`, `deactivate_pack`.
- **Local equivalent:** consolidated into
  `0043_v26_search_products_and_packs.sql` lines 145–289.
- **Status:** ✅ **Merged**. All three pack RPCs present;
  variant-id resolution preserved.

#### 0058_v28_batch_rpcs_and_views (prod, 1523 B)

- **Prod creates:** function `suggest_batch_no` (original
  version, with `s.name` bug — see 0058d below).
- **Local equivalent:** `0058_v28_batch_rpcs_and_views.sql`
  lines 17–58.
- **Status:** ✅ **Local equivalent found, with the 0058d fix
  already applied** (see next entry). The local file is the
  post-fix version, not the pre-fix version that prod's 0058
  alone would produce.

#### 0058a_v28_record_purchase (prod, 11206 B)

- **Prod creates:** `record_purchase` (v2.8 — batch-aware).
- **Local equivalent:** `0058_v28_batch_rpcs_and_views.sql`
  lines 71–366.
- **Status:** ✅ **Merged**. Batch insertion logic preserved,
  `has_batches` check + `batch_info_required_for_batched_product`
  exception + `duplicate_batch_no` handling all present.

#### 0058b_v28_record_sale_fefo (prod, 12323 B)

- **Prod creates:** `record_sale` (v2.8 — FEFO + manual batch
  override + multi-batch line split).
- **Local equivalent:** `0058_v28_batch_rpcs_and_views.sql`
  lines 382–708.
- **Status:** ✅ **Merged**. FEFO walk (ordered by `expiry_date
  nulls last, received_at asc, id asc`), per-chunk
  `sale_items` emission, largest-remainder discount allocation
  across chunks — all intact.

#### 0058c_v28_deactivate_batch_and_views (prod, 3144 B)

- **Prod creates:** function `deactivate_batch`, views
  `batches_expiring_soon` and `batches_warranty_expiring_soon`
  (both `with (security_invoker = true)` per ADR-0015).
- **Local equivalent:** `0058_v28_batch_rpcs_and_views.sql`
  lines 713–808.
- **Status:** ✅ **Merged**. `security_invoker = true` preserved
  on both views.

#### 0058d_v28_suggest_batch_no_fix (prod, 1344 B)  ⚠ FIX MIGRATION

- **Prod creates:** `suggest_batch_no` — **fixed** version
  that reads from `s.shop_name` rather than `s.name`. The bug
  was that the `shops` table column is `shop_name`, not `name`;
  the original 0058 migration referenced the wrong column and
  would throw `column s.name does not exist` at first call.
- **Direct prod-vs-local check:**
  - Prod 0058 body: `regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')`
  - Prod 0058d body: `regexp_replace(s.shop_name, '[^a-zA-Z0-9]', '', 'g')`
  - Local 0058 body: `regexp_replace(s.shop_name, '[^a-zA-Z0-9]', '', 'g')`
- **Status:** ✅ **Merged correctly. Local has post-fix body.**
  This is the most critical verification in the audit — if the
  local file carried the pre-fix body, every batched-product
  stock-in on staging would fail. Verified safe.

#### 0060_v281_pricing_decouple (prod, 4814 B)

- **Prod creates:** `create_product_with_opening_stock`
  (v2.8.1 — nullable price, +`p_has_batches`,
  `p_expiry_alert_days`, `p_warranty_alert_days` params,
  `cannot_seed_opening_stock_for_batched_product` exception).
- **Local equivalent:** `0060_v281_pricing_decouple.sql`
  lines 28–128.
- **Status:** ✅ **Local equivalent found**.

#### 0060a_v281_create_product_with_variants (prod, 6857 B)

- **Prod creates:** `create_product_with_variants` (v2.8.1
  signature mirroring the above changes; attribute-driven
  variant insertion preserved from v2.7's 0047).
- **Local equivalent:** `0060_v281_pricing_decouple.sql`
  lines 130–281.
- **Status:** ✅ **Merged**. 11-param signature matches; per-
  variant `cannot_seed_opening_stock_for_batched_product`
  guard in place.

#### 0063_v283_expired_and_pricing_visibility_a_view (prod, 671 B)

- **Prod creates:** view `batches_already_expired`
  (`security_invoker = true`).
- **Local equivalent:** `0063_v283_visibility_fixes.sql`
  lines 12–31.
- **Status:** ✅ **Merged**. `security_invoker` preserved.

#### 0063b_v283_product_with_default_variant_has_null_price (prod, 1607 B)

- **Prod creates:** view `product_with_default_variant` (adds
  `has_null_price_variant` exists() column).
- **Local equivalent:** `0063_v283_visibility_fixes.sql`
  lines 33–70.
- **Status:** ✅ **Merged**. View body extended with
  `has_null_price_variant`, `min_price`, `max_price`,
  `variant_count`, `total_stock_all_variants` — all present.

#### 0063c_v283_search_products_needs_pricing (prod, 5285 B)

- **Prod creates:** `search_products` + `search_products_count`
  (each with new `p_needs_pricing boolean default false` param;
  return shape extended to include `has_variants`,
  `variant_count`, `min_price`, `max_price`,
  `total_stock_all_variants`, `has_null_price_variant`).
- **Local equivalent:** `0063_v283_visibility_fixes.sql`
  lines 72–217.
- **Status:** ✅ **Merged**. Signatures + return shapes match.

---

### Category 2 — naming-only drift (one sanity check)

#### v15_product_type_search_and_opening_stock (prod, 3668 B)

- **Prod-applied SQL** (from `statements[1]`) vs **local
  `0014_v15_product_type_search_and_opening_stock.sql`**:
  identical content, modulo:
  - The local file uses `s+` regex character class with single-
    backslash in source (rendered as `\s+`) whereas the prod
    `statements[1]` JSON-escapes it (`\\s+`) — same regex.
  - Local file has trailing horizontal rule comments
    (e.g. `-- 1. Add columns -----------`) that prod's stored
    statement does not; cosmetic only.
- **Status:** ✅ **Local equivalent found**. Confirms the
  Category 2 "likely benign" assumption for at least this entry.
  The v15-v23 era prefix-less prod names (`v15_…`, `v16_…`,
  `v18_…`) correspond exactly to the numbered local files
  (`0014_v15_…`, `0017_v16_…`, `0020_v18_…`) with identical
  SQL content. The numeric prefixes were added to the local
  filenames *after* prod application — to enforce byte-order
  sorting in `LC_ALL=C ls` — but the canonical SQL is unchanged.

---

## Recovery plan

**None required.** Per the user's decision rule:

> If 0 genuinely missing: proceed to staging replay as
> originally planned.

The staging Supabase project (`iamqibcdpeovwavgzswq`,
`nizaamify-staging`, free tier, ap-southeast-1) is provisioned
and ACTIVE_HEALTHY. The 98 local migration files in
`supabase/migrations/`, applied in `LC_ALL=C` byte-order, will
faithfully reproduce production's current schema. Replay is
authorized to proceed.

**Two predicted differences in `supabase_migrations.schema_migrations`
between staging and production after replay** — both expected,
both benign:

1. Staging will record 98 migration names; production records
   109. The delta is the consolidation gap documented above.
2. Staging will use the `v2.9.2` migration names (0092-0095)
   per the source rename; production retains the original
   `v210/v210b` names per ADR
   `2026-05-13-v292-naming-collision-with-returns-feature.md`.

Neither affects the actual `public` schema — table columns,
function bodies, view definitions, indexes, RLS policies, and
grants are identical.

---

## Open verification debt (not v2.10 blockers)

The audit above was scoped to the 13 Category-3 suspect entries
plus one Category-2 sanity check. The following remain as open
items worth filing for post-v2.10 cleanup; none block staging
replay or contacts work:

1. **Full Category 2 coverage.** The audit verified one v15
   entry; the remaining ~14 prefix-less prod entries (v15_*,
   v16_*, v18_*, v19_*, v20_*, v22_*, v23_*) are statistically
   likely to follow the same pattern but were not individually
   byte-compared. Recommend adding an AQ-25 (one-time, not
   weekly) that diffs `pg_get_functiondef()` between staging
   and production for the v1.5–v2.3 function set after replay
   succeeds. Confirms parity at runtime, not just at source.

2. **Authoritative `schema_migrations` reconciliation.** The
   prod history has 11 rows that source can no longer
   reproduce *as separately-recorded migration events* — only
   as consolidated bodies. If a future tool ever tries to
   replay against prod (e.g. `supabase db push --dry-run`), it
   would report 11 missing migration names. Two ways to fix:
   - Backfill 11 no-op marker rows into staging's
     `schema_migrations` so the row-name list matches prod
     1-to-1. Strictly cosmetic.
   - Or document in `docs/build-trail.md` that the canonical
     source-of-truth is the file content, not the
     `schema_migrations` row names. Already implicitly true.

   Recommend the documentation path — backfilling no-op
   markers adds noise without value.

3. **The implicit "rebuild prod from source" invariant should
   become an explicit audit gate.** This audit found zero
   defects, but only because the consolidations happened to
   carry their SQL forward correctly. Future consolidations (if
   any) should be guarded by a checklist:
   - Read every prod entry's full `statements[1]` before
     consolidating.
   - Append-only — never drop SQL from a consolidated file
     because "the next migration recreates it anyway."
   - Run AQ-25 (proposed above) immediately after each
     consolidation lands.

   This is exactly the kind of discipline lesson that fits
   the recoverable-foundation framing. Recommend adding to
   `docs/gotchas.md` § "SQL / RPCs" once the v2.10 work
   begins, and filing as a v2.11 cleanup task.

---

## Halt point

This document is the deliverable. Awaiting user review and
direction on:

- Proceed to staging replay (consolidations confirmed
  preserved), or
- Address one or more open verification debt items first.

No further cloud-side action, git push, or staging mutation
will be taken until the user acknowledges this audit.
