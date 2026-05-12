# Open ToDos / Known gaps

Tracking pad for deferred work. Move items to a real issue tracker when one exists.

## Infra / launch blockers

- Supabase free tier: no PITR backups; move to Pro before any real customer goes live (hard requirement before launch)
- Toggle leaked-password-protection + email-confirmation in Supabase auth dashboard (Pro tier required for HIBP)
- Weekly `pg_dump` GitHub Action — recommended in v1.8 post-mortem; still pending

## Deferred features

- `void_sale` RPC for full sale reversal (reverse debit + restock + voided flag) — deferred from v1.8
- Advance payments (customer credit balance) — deferred from v1.4
- Returns / refunds — deferred since v1.2
- `purchase_overhead_items` append-only enforcement is in v1.9; per-supplier comparison reports UI is a future ticket

## Legacy column / parameter cleanups

- Drop legacy `products.cost` column (deferred from v1.5; `avg_cost` and `last_purchase_cost` are the source of truth)
- Drop legacy `ledger_entries.paid_at` (deferred from v1.6)
- v2.3 cleanup: drop legacy `purchase_items.overhead_per_unit` once all reads/writes have been switched to `line_overhead_amount` (UI already prefers the new column with a fallback)
- v2.5 cleanup: drop legacy `products.type` column once every read path is audited; `create_product_with_opening_stock` snapshots category name into `type` to keep legacy readers working. Also retire the `p_type` fallback parameter on that RPC.
- v2.6 deferred drops (target v2.8+): `products.{stock, price, cost, avg_cost, last_purchase_cost}` are deprecated (variant is source of truth); `sale_items.product_id`, `purchase_items.product_id`, `product_packs.product_id` are kept-in-sync denormalized columns. Drop after v2.7 stabilizes. Also retire the `product_id` fallback path in `record_sale` / `record_purchase` then.
- v2.6 deferred work: SKU uniqueness on `product_variants` (spec §2.1's index used a subquery; deferred to v2.7 when the UI starts generating SKUs).
- v2.7 SKU uniqueness deferred from v2.6 §2.1 is *still* deferred — the v2.7 matrix builder auto-suggests SKUs but writes them as-is. A future migration will add a row trigger enforcing (shop_id, lower(trim(sku))) uniqueness when sku is non-null.

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

## Verification debt

- v2.6 deferred verification: full re-run of v1.3–v2.5 manual test matrices per §11 of the v2.6 spec. Code-level checks (lint, type, build, tests) are green; live-data smoke tests (POS sale, stock-in with overhead, pack-based stock-in, partial payments) need a human to walk through.
- v2.7 deferred verification: §13 manual smoke matrix (tracksuit, yoga mat, masking tape, iPhone, single-variant regression, cross-shop isolation). Code-level checks (lint, type, build, tests) are green.
- v2.8 deferred verification: full §10 manual smoke matrix (cosmetics shop FEFO, multi-batch line split, override, supplier warranty alerts, write-off, cross-shop). Code-level checks (lint, type, build, audits 1–12) are green; live-data flows need a human to walk through.
- v2.8.4 deferred verification: spec §6 manual smoke matrix (cases 6.1–6.19 — default policy resolution, block/warn/allow paths, manual-batch override, mixed cart, receipt disclaimer on/off, sale-detail badge persistence, dashboard widget rollup, cross-shop RLS, non-batched regression, batched-no-expired regression). Code-level checks (lint, type, build) are green; live-data flows need a human to walk through.
