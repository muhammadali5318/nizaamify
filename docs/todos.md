# Open ToDos / Known gaps

Tracking pad for deferred work. Move items to a real issue tracker when one exists.

## Infra / launch blockers

- Supabase free tier: no PITR backups; move to Pro before any real customer goes live (hard requirement before launch)
- Toggle leaked-password-protection + email-confirmation in Supabase auth dashboard (Pro tier required for HIBP)
- Weekly `pg_dump` GitHub Action — recommended in v1.8 post-mortem; still pending

## Shipped

- **Role-based access (cashier / technician / accountant)** — ORIGINALLY listed in PRD §18 as "Earliest target v2." **Shipped in v2.9 as permission-based RBAC** (not role-based; permissions are more granular per customer demand). Server-side complete; frontend in v2.9.1.
- **v2.9 cleanup migration `0081_v29_cleanup_permissive_policies`** — consolidated the two overlapping permissive SELECT policies on `profiles` and split `units_of_measure`'s legacy `FOR ALL` policy into per-verb policies. Eliminated 10 `multiple_permissive_policies` advisor lints. ADR `decisions/2026-05-13-v29-cleanup-permissive-policies.md` (ADR #23). Verified: all 23 audit queries (incl. new AQ-23) return 0 post-migration.
- **AQ-23 — DEFINER-wrapper shape-drift detector** — added to the audit suite (`design/2026-05-13-rbac-attack-surface.md` §C.3). Baseline scan covers all 65 wrappers (not just 16/65 sample). Result: 11 exempt + 54 conforming + 0 deviations. Halt criterion not triggered.
- **v2.9.1 RBAC frontend** — shipped 2026-05-13 in 8 D.11 clusters. Migrations 0087 (11 new RPCs + customers.updated_by_user_id schema additive), 0088 (`get_invitation_for_acceptance` pre-shop helper), 0089 (`update_product` extended with is_scan_only/has_batches guards/products.type sync per ADR-0019; archive vs edit semantic separation). 26 routes gated; 7 hooks migrated to RPCs for `_by_user_id` audit; 11 UI gates per B.2 hybrid (POS HIDE / CRUD GREY-OUT / settings HIDDEN); 2 new pages (`/settings/team`, `/invite/accept/:invitation_id`); TopBar `ShopSwitcher`. AQ-23 exempt list grows 11→14; AQ-24 (new) catches legacy `current_shop_id()` callers. 14 v2.9.1 ADRs filed plus 4 from Phase C. Phase E coverage matrix at `audit/2026-05-13-v291-phase-e-coverage-matrix.md`. `RBAC_TEAM_UI_ENABLED` env flag flips per-shop manually for pilot per ADR `2026-05-13-v291-b9-feature-flag-per-shop-manual`.

## Deferred features

- `void_sale` RPC for full sale reversal (reverse debit + restock + voided flag) — deferred from v1.8
- Advance payments (customer credit balance) — deferred from v1.4
- Returns / refunds — deferred since v1.2
- `purchase_overhead_items` append-only enforcement is in v1.9; per-supplier comparison reports UI is a future ticket

## v2.9.1 polish / pilot-period work

- **Pilot observation — fine-grained column hide UX (task #24)** — after first non-owner login at pilot shop, observe whether NULL column renders (Cost: --, empty contact cells, NULL outstanding numerics) bother the user. If yes → pull v2.9.2 column-hide polish forward. If no → defer as planned. Trigger: any non-owner staff session at a pilot shop, especially first 24h.
- **Per-page audit-trail display (cluster 3 follow-up)** — sale-detail / customer-detail / purchase-detail pages currently surface only the global audit log at `/settings/team/audit`. Per-row inline display ("Recorded by Ahmed on 13 May 2026") is deferred to v2.9.2 polish per ADR `2026-05-13-v291-b7-audit-trail-inline-line`. The inline pattern was chosen but not wired during Phase D because the audit-data join requires either widening detail-page queries or a small dedicated read RPC.
- **Programmatic password-set during accept** (v2.10 candidate) — current `/invite/accept` flow requires the invitee to sign up at `/signup` first per ADR `2026-05-13-v291-invite-accept-deferred-features`. Single-page accept+signup needs a Supabase Edge Function with admin API + email-verification skip. Worth the half-day when bandwidth allows.
- **`permissions` and `team_audit` i18n namespaces** — registered as future-use per B.10; the strings currently live in the `team` namespace. Split when their corresponding feature surfaces grow large enough to warrant separation.
- **Custom permission overrides in InviteUserDialog** — `create_invitation` accepts a permissions JSONB override but the dialog (cluster 3) exposes preset selection only. Custom-override UI is v2.9.2 polish.
- **`_v28` inner-body cleanup** — the rename-and-wrap pattern leaves 41 `<name>_v28` inner functions side-by-side with their wrappers. A future migration could inline the bodies and drop `_v28`. Not blocking; document if you do so.
- **`edit_sale_notes` permission + RPC** — `invoices.notes` is currently immutable via `financial_records_immutable` trigger. Adding an edit path would require a column-allowlist trigger refactor. Permission key reserved but not in catalog.
- **`void_sale` permission + RPC** — see above. When `void_sale` ships, add the `void_sale` permission to the catalog.
- **Manager-override-at-POS for discount caps** (`apply_discount_above_limit`) — deferred per Phase B B.2.4. Salesperson hits cap, manager enters override token, transaction proceeds.
- **Real-time permission updates via Supabase Realtime** (option a from ADR `2026-05-13-rbac-client-cache-staleness-bounded`) — current state is 60s bounded staleness + revalidate-on-focus. Upgrade if SMB feedback demands tighter posture.
- **Remote JWT invalidation for revoked users** — Supabase Auth default JWT TTL is 1h. A revoked user retains access until their JWT expires. Closing this requires a Supabase Auth feature we don't have on Free tier; document as known limitation.
- **Ownership transfer** (`transfer_ownership` RPC) — `shops.unique(owner_user_id)` constraint means one founding shop per user. Multi-shop ownership + transfer flows are v2.10+.
- **Rename `shops.salesperson_payment_cap_pkr` → `non_owner_payment_cap_pkr`** (F-PD-05) — cap actually applies to all non-owners, not just salesperson preset. Cosmetic; deferred.
- **Separation-of-duties for purchase reviewer** — currently a manager with `view_purchases + view_product_cost + view_batch_cost` can derive sale profit by joining purchase data with sale data. Custom presets that split "purchase entry" from "purchase review" would close this; ADR `2026-05-13-rbac-leaky-purchase-cost-acknowledgment` documents the trade-off.
- **Audit `_by_user_id` reconstruction UI** — sale-detail / customer-detail / etc. can show "recorded by Asad on 2026-05-13" via `cashier_id` + `created_by_user_id` joins to `profiles.email`. UI in v2.9.1.
- **Email notification to owner on permission grants by non-owner actors** (F-PD-10) — defends against social-engineering chains where the owner grants `modify_user_permissions` to a malicious user. Audit log captures the chain; near-real-time notification would surface it faster. Edge function ticket.

## Legacy column / parameter cleanups

- Drop legacy `products.cost` column (deferred from v1.5; `avg_cost` and `last_purchase_cost` are the source of truth)
- Drop legacy `ledger_entries.paid_at` (deferred from v1.6)
- v2.3 cleanup: drop legacy `purchase_items.overhead_per_unit` once all reads/writes have been switched to `line_overhead_amount` (UI already prefers the new column with a fallback)
- v2.5 cleanup: drop legacy `products.type` column once every read path is audited; `create_product_with_opening_stock` snapshots category name into `type` to keep legacy readers working. Also retire the `p_type` fallback parameter on that RPC.
- v2.6 deferred drops (target v2.8+): `products.{stock, price, cost, avg_cost, last_purchase_cost}` are deprecated (variant is source of truth); `sale_items.product_id`, `purchase_items.product_id`, `product_packs.product_id` are kept-in-sync denormalized columns. Drop after v2.7 stabilizes. Also retire the `product_id` fallback path in `record_sale` / `record_purchase` then.
- v2.6 deferred work: SKU uniqueness on `product_variants` (spec §2.1's index used a subquery; deferred to v2.7 when the UI starts generating SKUs).
- v2.7 SKU uniqueness deferred from v2.6 §2.1 is *still* deferred — the v2.7 matrix builder auto-suggests SKUs but writes them as-is. A future migration will add a row trigger enforcing (shop_id, lower(trim(sku))) uniqueness when sku is non-null.
- **v2.9.1 AQ-24 cleanup (target v2.10):** rewrite the 2 pre-v2.9 views `daily_sales_7` and `expenses_by_category_mtd` to use `current_active_shop_id()` directly instead of the legacy `current_shop_id()` alias from migration 0078. AQ-24 currently allowlists these 2 views as baseline (see `design/2026-05-13-rbac-attack-surface.md` §C.3). After rewriting, drop them from the AQ-24 allowlist. (The 38 `_v28` inner functions stay allowlisted permanently per the wrap-and-rename ADR.)
- **v2.10a follow-ups:** (1) AQ baseline update for the 2 new `security_definer_view` advisor entries (`sale_item_financials`, `invoice_financials`); (2) drop migration 0091's permissive policies (`v29_invoices_row_read`, `v29_sale_items_row_read`) after 30-day stable observation — they're harmlessly superseded by the DEFINER-view path; (3) document the maintenance contract in CLAUDE.md (new columns on `public.sale_items` must explicitly `grant select` per mig 0093 header).
- **v2.10b: extend column-grant pattern beyond `sale_items.cost_at_sale`.** v2.10a (migs 0092 + 0093) closed the cost-leak on `sale_items` via (a) DEFINER-ize `sale_item_financials` / `invoice_financials` with conditional projection + row-filter, (b) drop table-level SELECT and re-grant per-column for everything except `cost_at_sale`. v2.10b should extend the same pattern to: (1) `customers.outstanding_balance` — UI gated, raw-API still reads; (2) `inventory_batches.cost_per_unit` — same; (3) `products.{cost, avg_cost, last_purchase_cost}` + `product_variants.{cost, avg_cost, last_purchase_cost}` — deprecated columns but still raw-API readable; (4) `purchase_items.{cost_at_purchase, overhead_per_unit, line_overhead_amount, avg_cost_before, avg_cost_after}`. Each base table needs the same revoke + re-grant pattern plus a column-list maintenance contract in the migration header. Migration 0091's permissive row-read policies can be dropped after observation (now superseded by the DEFINER-view path; harmless to keep).

## Polish / UX gaps

- v2.1 polish: per-supplier comparison reports UI; mobile cart pack-edit sheet (currently only desktop has the inline pack chip)
- v2.2 polish: edit-line bottom sheet on mobile (per-line discount UI is desktop-inline only); `khata` list does not surface tier (only customer detail does)
- v2.4 polish: dashboard stat tiles could carry a delta indicator (matches design-inspiration screenshots) once the dashboard summary RPC starts returning a previous-period comparison; auth/onboarding hero illustrations could use a dedicated dark-mode SVG variant
- v2.5 polish: bulk re-categorize action (no UI exists; admin re-categorizes one at a time via the edit modal). Category hierarchy and per-category pricing rules are out of scope for this MVP — both are v3 conversations.
- v2.8 polish: ProductFormPage's create flow doesn't expose `has_batches` yet — the user creates the product first then flips the toggle via the edit dialog (which enforces variant.stock = 0 before flipping ON). Polish ticket should add the toggle to the create form and gate `opening_stock > 0` so the chicken-and-egg "stock exists with no batch" never happens. Multi-variant batched products: the batches table currently renders for single-variant + has_batches only; multi-variant + has_batches displays nothing batch-related on the detail page. Both spec'd in v2.8 §5 but deferred. (POS cart "Pick batch" picker shipped in v2.8.5.)

## Future versions

- v2.7 deferred items (spec §14): full stock-in matrix grid UX (only the expanding-line fallback shipped — ADR-0028); per-cell unit selector for variants-with-packs ("tape rolls" case); 3-attribute matrix with tabbed third dimension; per-variant packs (the single-variant pack flow stays unchanged, multi-variant products hide the Packs section on the detail page); variant images; variant-level barcodes; bulk variant import (CSV); variant-level reorder points; backorder behaviour (multi-variant POS picker currently disables out-of-stock variants outright).
- v2.8 deferred items (spec §12): serial tracking (v2.9), inventory_adjustments + RTV (v2.10), customer-facing warranty, bulk batch import, batch-level reorder points, email/SMS expiry notifications, mutual-exclusion DB CHECK with `has_serials` (lands with v2.9). (Already-expired stock visibility now shipped in v2.8.3.)
- `batches_warranty_expired` view (analog of `batches_already_expired` for the warranty case) is still deferred to v2.10 as part of the RTV workflow. When supplier warranty lapses, the shop owner needs an RTV-window-closing flow, not a passive alert.

## v2.8.4 deferred items

- Pharmacy-mode shop profile abstraction (block default + always-on receipt disclaimer + extra audit) — deferred until a pharmacy customer materializes. Until then, pharmacies override the shop default to `block` and turn on the receipt-disclaimer toggle.
- Bulk policy update across products. A shop with 500 SKUs that wants per-product overrides edits one at a time. The shop default + per-product override pattern handles most cases (set the default, override the exceptions); a bulk UI is on the list only when a customer asks.

## Scheduled / time-anchored

- **Re-run Supabase advisor 30 days post-pilot-launch.** Trigger: 30 days after `RBAC_TEAM_UI_ENABLED` flips on AND the first non-owner pilot shop is onboarded — **not** 30 days from today. `pg_stat_user_indexes.idx_scan` only increments when queries fire; pre-pilot the project has zero non-owner traffic. Drop criteria: any index with `idx_scan = 0` AND size > 1MB. Skip trigram + RBAC plumbing indexes if their feature was not yet exercised in pilot. Also re-evaluate the `*_by_user_id` unindexed-FK lints that were not added during v2.9.1's feature-paired index pack. Cross-ref: `audit/2026-05-13-pre-frontend-advisor-review.md` §5.4.
- **Automate the AQ-01..AQ-23 audit suite (v2.10+).** Today the 23 queries live in `design/2026-05-13-rbac-attack-surface.md` §C.3 and are run by hand via `mcp__supabase__execute_sql` when explicitly triggered. The v2.9 implementation plan calls for a "daily run during stabilization" — but no scheduler exists. Build either: (a) a pg_cron job that writes results to an `audit_suite_runs` table + an Edge Function that posts non-zero results to Slack/email; or (b) a GitHub Action that runs the suite on a daily schedule and opens an issue on any non-zero. AQ-23 inherits this gap from the original 22 — promoting AQ-23 to "automated" requires automating the full suite. Cross-ref: gotcha "The audit query suite (AQ-01..AQ-23) is run by hand, not by cron" in `docs/gotchas.md`.

## Verification debt

- v2.6 deferred verification: full re-run of v1.3–v2.5 manual test matrices per §11 of the v2.6 spec. Code-level checks (lint, type, build, tests) are green; live-data smoke tests (POS sale, stock-in with overhead, pack-based stock-in, partial payments) need a human to walk through.
- v2.7 deferred verification: §13 manual smoke matrix (tracksuit, yoga mat, masking tape, iPhone, single-variant regression, cross-shop isolation). Code-level checks (lint, type, build, tests) are green.
- v2.8 deferred verification: full §10 manual smoke matrix (cosmetics shop FEFO, multi-batch line split, override, supplier warranty alerts, write-off, cross-shop). Code-level checks (lint, type, build, audits 1–12) are green; live-data flows need a human to walk through.
- v2.8.4 deferred verification: spec §6 manual smoke matrix (cases 6.1–6.19 — default policy resolution, block/warn/allow paths, manual-batch override, mixed cart, receipt disclaimer on/off, sale-detail badge persistence, dashboard widget rollup, cross-shop RLS, non-batched regression, batched-no-expired regression). Code-level checks (lint, type, build) are green; live-data flows need a human to walk through.
