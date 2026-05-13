# v2.9.1 Frontend Integration Contract — RPC + View Inventory

> **Status:** authoritative for the React frontend (v2.9.1) wiring against
> the v2.9 server-side RBAC backend. Source-of-truth is the migration SQL
> in `supabase/migrations/0068_*.sql` through `0086_*.sql`. Verified
> against project `orfggrnyychmmqdlbfhf` on 2026-05-13 via
> `pg_proc` introspection.
>
> **Audience:** every PR that adds or modifies a Supabase RPC call in
> `src/features/**/hooks.ts`, `src/features/**/api.ts`, or that reads
> from a `*_view` should consult the matching entry here first.

---

## Table of contents

- [0. Overview](#0-overview)
- [1. RPCs by category](#1-rpcs-by-category)
  - [1.1 Sales (record_sale + reads)](#11-sales-record_sale--reads)
  - [1.2 Products](#12-products)
  - [1.3 Inventory](#13-inventory)
  - [1.4 Customers](#14-customers)
  - [1.5 Suppliers](#15-suppliers)
  - [1.6 Financial (ledger, expenses, targets)](#16-financial-ledger-expenses-targets)
  - [1.7 Settings](#17-settings)
  - [1.8 Team](#18-team)
  - [1.9 Identity / RBAC](#19-identity--rbac)
- [2. Permission-aware views](#2-permission-aware-views)
- [3. Error code → UX mapping summary table](#3-error-code--ux-mapping-summary-table)
- [4. Active-shop header pattern](#4-active-shop-header-pattern)
- [5. Audit pattern](#5-audit-pattern)
- [6. Open items / explicit not-supported](#6-open-items--explicit-not-supported)
- [7. Methodology / sources](#7-methodology--sources)
- [8. Discrepancies](#8-discrepancies)

---

## 0. Overview

### 0.1 RPC counts by category

| Category | Wrapped (from `_v28`) | Net-new in v2.9 | Total caller-facing |
|----------|----------------------:|----------------:|--------------------:|
| Sales | 1 (`record_sale`) + 1 (`preflight_expired_sale_check`) | — | 2 |
| Products | 5 (search/recent/category/variant CRUD) + 4 (create/update product variant funcs) | 1 (`update_shop_settings` partially affects, listed under Settings) | 9 |
| Inventory | 2 (`record_purchase`, `suggest_batch_no`) + 2 (`deactivate_batch`, `record_partial_writeoff`) | — | 4 |
| Customers | 3 (search/recent + list_customers) + 2 (tier define/update) + 2 (tier deactivate/set_default) | 2 (`create_customer_basic`, `create_customer_full`) | 9 |
| Suppliers | 2 (`search_suppliers`, `recent_suppliers`, `create_supplier_inline`) | — | 3 |
| Financial | 2 (`receive_payment`, `reverse_ledger_entry`) + 2 (khata search) | 4 (`create_expense`, `update_expense`, `upsert_monthly_target`) | 8 |
| Settings | — | 4 (`update_shop_settings`, `update_owner_details`, set_active_shop, complete_onboarding-rewrite) | 4 |
| Team | — | 2 (`get_team_for_active_shop`, `get_user_permissions`) | 2 |
| Identity / RBAC (Section 1.9) | — | 8 (modify_user_permission, apply_preset_to_user, update_user_discount_limits, revoke_user_access, create_invitation, cancel_invitation, accept_invitation, get_user_shop_list) + 3 helpers (`set_active_shop`, `user_has_shop_access`, `user_has_permission`, `user_permissions_in_shop`) | 12 |
| Trigger-only / internal | — | — | (not callable from frontend; see §0.6) |

**Top-line totals**

- 41 wrapped RPCs (each preserves the v2.8.5 body as `<name>_v28`, callable only via the wrapper)
- 17 net-new RPCs in `0075_v29_new_rpcs.sql`
- 1 full rewrite (`complete_onboarding`)
- 6 additional rewrites in `0076b_*.sql` adding conditional projection + caps to `record_sale`, `receive_payment`, `search_products`, `recent_purchase_products`, `list_customers`, `recent_customers`
- Final caller-facing surface (`prosecdef=true`, `revoke from public, anon; grant to authenticated`, name does **not** end in `_v28`): **~74 callable RPCs + 6 trigger-only functions**

### 0.2 Total error code count

A combined ~30 distinct error code strings are raised across the surface.
The most frequent (raised by every gated wrapper):

- `not_authenticated`
- `no_shop_for_user`
- `insufficient_permissions`

These three error codes plus the active-shop header errors
(`invalid_app_shop_id_header`, `no_access_to_shop`) form the **5
universal RPC errors** every Tanstack mutation/query handler must
handle. The full list is in [§3](#3-error-code--ux-mapping-summary-table).

### 0.3 Active-shop header pattern

```
HTTP header: app-shop-id: <uuid>
   │
   ▼
public.current_active_shop_id()                      <-- DEFINER, stable
   │   (reads request.headers GUC as JSONB)
   ├── if header present + valid → validates user_has_shop_access → returns
   ├── if header present + bad UUID → raises invalid_app_shop_id_header
   ├── if header present + no access → raises no_access_to_shop
   └── if header absent → fallback path:
         single-shop user → returns their sole shop_id
         multi-shop user  → returns NULL  (caller's next check raises no_shop_for_user)
```

The shop **does not** come from a Supabase Pre-request hook (Free tier
constraint, see ADR `2026-05-13-rbac-set-active-shop-fallback-path`).
The frontend MUST inject `app-shop-id` via a `customFetch` wrapper
once a user has more than one shop. Until then, the fallback covers
the 99% case of single-shop owners.

See [§4](#4-active-shop-header-pattern) for the full transport contract.

### 0.4 Permission resolution model

```
user_has_permission(shop_id, permission_key)
   │
   ├── owner shortcut:  if user_shop_access.is_owner = true     → true
   │                    (owner has every permission implicitly;
   │                     `user_shop_permissions` rows for owners
   │                     do not exist by construction — ADR
   │                     'rbac-owner-implicit-shortcut')
   │
   └── lookup:  user_shop_permissions.granted for (access_id, permission_key)
                coalesce(<row>, false)
```

Three system presets seed `user_shop_permissions.granted`:

- **owner** (implicit only; never rows in `user_shop_permissions`)
- **manager** (`preset_manager_default`) — 33 of 50 permissions
- **salesperson** (`preset_salesperson_default`) — 12 of 50 permissions

29 dependency rules are encoded in `permissions_catalog.requires`
and enforced symmetrically (grant + revoke) by
`validate_permission_grant()` / `validate_permission_revoke()`.

### 0.5 The `_v28` inner-wrapper pattern (do NOT call `_v28` directly)

For 41 v2.8.5 RPCs, migration 0076 used `ALTER FUNCTION … RENAME TO
<name>_v28` then `CREATE` a new outer wrapper with the original name.
Each wrapper:

1. Checks `auth.uid() is null`            → `not_authenticated`
2. Checks `current_active_shop_id() is null` → `no_shop_for_user`
3. Checks `user_has_permission(shop, key)` → `insufficient_permissions` if false
4. (Optionally) enforces caps (`record_sale`, `receive_payment`),
   conditional projection (search_*, recent_*, list_customers), or
   audit `_by_user_id` writes (0080)
5. Delegates to `<name>_v28(...)` with the same args

All `_v28` functions are `revoked from public, anon, authenticated`;
they are only reachable from inside another DEFINER body. **Frontend
calls must always be against the un-suffixed name.**

### 0.6 Functions explicitly NOT callable from the frontend

- Trigger functions: `batch_immutable_fields()`,
  `batch_auto_deactivate_when_empty()`,
  `check_product_archive_gate()`, `check_customer_tier_change_gate()`,
  `enforce_variant_default_invariants()`, `handle_new_user()`,
  `ledger_entries_update_balance()`, `products_normalize_trigger()`,
  `sync_product_id_from_variant()`
- Internal validators: `validate_permission_grant(uuid, text)`,
  `validate_permission_revoke(uuid, text)`
- Cron-only: `expire_subscriptions()`, `cleanup_invitations()`
- Legacy helper: `current_shop_id()` (DEFINER, owner-only body
  preserved as a no-op for non-owners during stabilization — never
  invoke directly; use `current_active_shop_id()`)

---

## 1. RPCs by category

> Conventions for every entry:
>
> - **Signature** is quoted verbatim from `pg_get_function_identity_arguments(p.oid)` + `pg_get_function_result(p.oid)` on project `orfggrnyychmmqdlbfhf`.
> - **Permission required** is the exact catalog `key` from migration 0068.
> - **Error codes** all carry `errcode = 'P0001'` (Postgres "raise_exception") unless noted otherwise.
> - **Wrapper / new** indicates whether the body is in `0076_*.sql` (wraps a `_v28`) or `0075_*.sql` (net-new).

### 1.1 Sales (record_sale + reads)

#### `record_sale`

- **Signature**: `(p_customer_id uuid, p_amount_paid numeric, p_service_charge numeric, p_notes text, p_items jsonb, p_sale_discount_type text, p_sale_discount_value numeric, p_confirm_expired_sale boolean) RETURNS uuid`
- **Permission required**: `record_sale`
- **Wrapper / new**: wraps `record_sale_v28`. The wrapper body is the **final** version from migration 0086 (which superseded 0076b → 0080 because the ledger insert moved inline to `_v28`).
- **Purpose**: Atomic POS sale — inserts `invoices` + N `sale_items`, decrements `product_variants.stock`, batch-allocates if `products.has_batches`, writes a `ledger_entries` debit row for credit/partial sales.
- **Params**:
  - `p_customer_id` — nullable for cash sales; required if `amount_paid < total`
  - `p_amount_paid` — `>= 0`, `<= total`
  - `p_service_charge` — `>= 0`
  - `p_notes` — free text or `null`
  - `p_items` — JSONB array of `{ variant_id?: uuid, product_id?: uuid (legacy fallback), qty: int>0, price_at_sale: numeric>=0, line_discount_type?: 'percent'|'fixed', line_discount_value?: numeric, batch_id?: uuid (manual batch pick) }`
  - `p_sale_discount_type` — `'percent'` | `'fixed'` | `null`; type+value must both be set or both null
  - `p_sale_discount_value` — paired with type
  - `p_confirm_expired_sale` — passes through to `_v28`; on the wrapper side, **setting `true` requires the `confirm_expired_sale_at_pos` permission**
- **Returns**: `uuid` (new invoice_id)
- **Error codes** (wrapper layer):
  - `not_authenticated`
  - `no_shop_for_user` (raised both pre- and post-`select is_owner`)
  - `insufficient_permissions` — `Required: record_sale`
  - `insufficient_permissions` — `Required: confirm_expired_sale_at_pos` (only when `p_confirm_expired_sale=true`)
  - `discount_exceeds_line_pct_limit` — non-owner per-line percent cap (from `user_shop_access.discount_limits.per_line_max_pct`)
  - `discount_exceeds_line_pkr_limit` — non-owner per-line PKR cap (`per_line_max_pkr`)
  - `implicit_discount_exceeds_line_pct_limit` — non-owner; computed from `1 - (price_at_sale / variant.price)`
  - `discount_exceeds_invoice_pct_limit` — non-owner `per_invoice_max_pct`
  - `discount_exceeds_invoice_pkr_limit` — non-owner `per_invoice_max_pkr`
- **Error codes** (`_v28` body — surfaces through the wrapper, **no `using errcode` so codes are `'P0001'` by default**):
  - `amount_paid_negative`, `service_charge_negative`
  - `empty_sale: a sale must have items or a service charge`
  - `sale_discount_type_and_value_must_both_be_set_or_neither`
  - `invalid_sale_discount_type`, `sale_discount_percent_out_of_range`, `sale_discount_fixed_negative`, `sale_discount_fixed_exceeds_items_subtotal`
  - `line_discount_percent_out_of_range`, `line_discount_fixed_negative`, `line_discount_exceeds_line_subtotal`, `invalid_line_discount_type`
  - `qty must be positive`, `price must be non-negative`
  - `amount_paid_exceeds_total`, `customer_required_for_credit`, `customer_not_in_shop`
  - `product_has_no_default_variant`, `item_missing_variant_or_product_id`
  - `variant_not_found_or_inactive`, `variant_not_in_shop`, `variant_not_sellable` (variant.price null), `insufficient_stock for variant <uuid>`
  - `batch_not_in_variant_or_inactive`, `selected_batch_insufficient`
  - `expired_stock_blocked`, `expired_stock_needs_confirmation`, `insufficient_non_expired_stock for variant <uuid>`, `no_batch_stock_available for variant <uuid>`
- **Notes**:
  - The `_v28` body is the single source of stock arithmetic and batch FEFO logic. No JS should attempt to replicate or anticipate it.
  - `created_by_user_id` on `ledger_entries` is set inline at INSERT (per migration 0086 — ledger is append-only, so post-delegation UPDATE is impossible).
  - The wrapper computes both **explicit** discounts (from `line_discount_*` keys) and **implicit** discounts (`price_at_sale << variant.price`) for non-owner cap enforcement.

#### `preflight_expired_sale_check`

- **Signature**: `(p_items jsonb) RETURNS TABLE(variant_id uuid, would_draw_expired boolean, expired_batch_ids uuid[], policy expired_sale_policy)`
- **Permission required**: `record_sale`
- **Wrapper / new**: wraps `preflight_expired_sale_check_v28`
- **Purpose**: POS pre-flight that tells the cashier UI whether the
  current cart would draw on expired batches under the effective policy,
  before committing the sale. Used to show the expired-stock banner +
  the "Confirm anyway" toggle (`p_confirm_expired_sale=true` on the
  follow-up `record_sale`).
- **Params**:
  - `p_items` — JSONB array of `{ variant_id: uuid, qty: int }`
- **Returns**: one row per input variant, `policy` is the effective
  shop+product policy (`'block'` | `'warn'` | `'allow'`).
- **Error codes**:
  - `not_authenticated`
  - `no_shop_for_user`
  - `insufficient_permissions` — `Required: record_sale`
- **Notes**: Read-only; no audit / no row writes.

### 1.2 Products

#### `search_products`

- **Signature**: `(p_query text, p_limit integer, p_offset integer, p_only_in_stock boolean, p_category_id uuid, p_needs_pricing boolean) RETURNS TABLE(id uuid, name text, type text, category_id uuid, description text, price numeric, avg_cost numeric, last_purchase_cost numeric, stock integer, is_active boolean, relevance real, has_variants boolean, variant_count bigint, min_price numeric, max_price numeric, total_stock_all_variants bigint, has_null_price_variant boolean, has_batches boolean, default_variant_id uuid)`
- **Permission required**: `view_products`
- **Wrapper / new**: wraps `search_products_v28`. The 0076b version applies **conditional projection** on cost columns:
  - `avg_cost`, `last_purchase_cost`, `min_price`, `max_price` → projected only when `user_has_permission(shop, 'view_product_cost')` is true; otherwise NULL.
- **Purpose**: Primary product search RPC used by `/products` and POS. Returns one row per template product, with variant rollup fields when `has_variants=true`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions` (Required: view_products).
- **Notes**: Frontend should call this and **not** read `products` table directly — the table-level RLS requires `view_product_cost` and would hide rows for view-only users.

#### `search_products_count`

- **Signature**: `(p_query text, p_only_in_stock boolean, p_category_id uuid, p_needs_pricing boolean) RETURNS bigint`
- **Permission required**: `view_products`
- **Wrapper / new**: wraps `search_products_count_v28`
- **Purpose**: Pagination count companion to `search_products`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `recent_purchase_products`

- **Signature**: `(p_limit integer) RETURNS TABLE(id uuid, name text, type text, price numeric, avg_cost numeric, stock integer, last_used_at timestamptz)`
- **Permission required**: `view_products`
- **Wrapper / new**: wraps `recent_purchase_products_v28` with conditional `avg_cost` projection (NULL when missing `view_product_cost`).
- **Purpose**: Stock-in autocomplete — last N products purchased.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `search_categories`

- **Signature**: `(p_query text, p_limit integer, p_offset integer) RETURNS TABLE(id uuid, name text, product_count bigint)`
- **Permission required**: `view_products`
- **Wrapper / new**: wraps `search_categories_v28`.
- **Purpose**: Category picker (POS filter, stock-in form).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `create_category_inline`

- **Signature**: `(p_name text) RETURNS uuid`
- **Permission required**: `manage_product_categories`
- **Wrapper / new**: wraps `create_category_inline_v28`. Migration 0080 adds `update public.product_categories set created_by_user_id, updated_by_user_id` post-delegation.
- **Purpose**: Inline category creation from product-create or stock-in flows.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; the `_v28` body may raise `duplicate_category_name` (Postgres unique_violation surfacing).

#### `update_category`

- **Signature**: `(p_id uuid, p_name text, p_is_active boolean) RETURNS void`
- **Permission required**: `manage_product_categories`
- **Wrapper / new**: wraps `update_category_v28` with post-delegation `updated_by_user_id` write.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise `category_not_in_shop`.

#### `create_product_with_opening_stock`

- **Signature**: `(p_name text, p_category_id uuid, p_price numeric, p_opening_stock integer, p_opening_cost numeric, p_is_scan_only boolean, p_base_unit_code text, p_description text, p_has_batches boolean, p_expiry_alert_days integer, p_warranty_alert_days integer) RETURNS TABLE(product_id uuid, variant_id uuid)`
- **Permission required**: `create_product`
- **Wrapper / new**: wraps `create_product_with_opening_stock_v28`. 0080 adds post-delegation `created_by_user_id`/`updated_by_user_id` writes on both `products` and the synthetic default variant.
- **Purpose**: Single-variant product creation with optional opening stock.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `category_required`, `category_not_in_shop`, `duplicate_product_name`.

#### `create_product_with_variants`

- **Signature**: `(p_name text, p_category_id uuid, p_default_price numeric, p_is_scan_only boolean, p_base_unit_code text, p_attribute_ids uuid[], p_variants jsonb, p_description text, p_has_batches boolean, p_expiry_alert_days integer, p_warranty_alert_days integer) RETURNS TABLE(product_id uuid, variant_ids uuid[])`
- **Permission required**: `create_product`
- **Wrapper / new**: wraps `create_product_with_variants_v28`. 0080 adds bulk `created_by_user_id`/`updated_by_user_id` writes on `products` + each variant.
- **Purpose**: Multi-variant product creation with v2.7 attribute matrix.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `too_many_attributes` (>3, ADR-0027), `duplicate_variant_value_combination`, `attribute_not_in_shop`, `value_not_in_attribute`, `duplicate_product_name`.

#### `add_variant_to_product`

- **Signature**: `(p_product_id uuid, p_attribute_value_ids uuid[], p_sku text, p_price numeric, p_opening_stock integer, p_opening_cost numeric) RETURNS uuid`
- **Permission required**: `create_product`
- **Wrapper / new**: wraps `add_variant_to_product_v28` + post-delegation audit write.
- **Purpose**: Add a new variant to an existing variant-enabled product.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `product_not_in_shop`, `attribute_value_combination_must_match_product_attributes`, `duplicate_variant_value_combination`.

#### `define_pack_inline`

- **Signature**: `(p_product_id uuid, p_unit_code text, p_unit_name text, p_base_qty integer, p_is_default_purchase boolean) RETURNS uuid`
- **Permission required**: `manage_product_packs`
- **Wrapper / new**: wraps `define_pack_inline_v28` + audit write.
- **Purpose**: Per-product pack definition for stock-in shortcuts.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `product_not_in_shop`, `base_qty_must_be_positive`, `duplicate_pack_unit`.

#### `update_pack`

- **Signature**: `(p_pack_id uuid, p_base_qty integer, p_is_default_purchase boolean) RETURNS void`
- **Permission required**: `manage_product_packs`
- **Wrapper / new**: wraps `update_pack_v28` + audit write.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `pack_not_in_shop`.

#### `deactivate_pack`

- **Signature**: `(p_pack_id uuid) RETURNS void`
- **Permission required**: `manage_product_packs`
- **Wrapper / new**: wraps `deactivate_pack_v28` + audit write.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `pack_not_in_shop`.

#### `create_variant_attribute`

- **Signature**: `(p_name text, p_display_order integer) RETURNS uuid`
- **Permission required**: `manage_variant_attributes`
- **Wrapper / new**: wraps `create_variant_attribute_v28` + audit write.
- **Purpose**: Shop-wide variant attribute (Color, Size, Storage, …).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `duplicate_attribute_name`.

#### `update_variant_attribute`

- **Signature**: `(p_id uuid, p_name text, p_display_order integer, p_is_active boolean) RETURNS void`
- **Permission required**: `manage_variant_attributes`
- **Wrapper / new**: wraps `update_variant_attribute_v28` (no audit write — `variant_attributes` has no `updated_by_user_id` column).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `attribute_not_in_shop`.

#### `deactivate_variant_attribute`

- **Signature**: `(p_id uuid) RETURNS void`
- **Permission required**: `manage_variant_attributes`
- **Wrapper / new**: wraps `deactivate_variant_attribute_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `add_variant_value`

- **Signature**: `(p_attribute_id uuid, p_value text, p_display_order integer) RETURNS uuid`
- **Permission required**: `manage_variant_attributes`
- **Wrapper / new**: wraps `add_variant_value_v28` + audit write.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `attribute_not_in_shop`, `duplicate_value_in_attribute`.

#### `update_variant_value`

- **Signature**: `(p_id uuid, p_value text, p_display_order integer, p_is_active boolean) RETURNS void`
- **Permission required**: `manage_variant_attributes`
- **Wrapper / new**: wraps `update_variant_value_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `deactivate_variant_value`

- **Signature**: `(p_id uuid) RETURNS void`
- **Permission required**: `manage_variant_attributes`
- **Wrapper / new**: wraps `deactivate_variant_value_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `search_variant_attributes`

- **Signature**: `(p_query text) RETURNS TABLE(id uuid, name text, display_order integer, value_count bigint)`
- **Permission required**: `view_products`
- **Wrapper / new**: wraps `search_variant_attributes_v28`.
- **Purpose**: Shop-wide attribute list for variant matrix builder.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `list_attribute_values`

- **Signature**: `(p_attribute_id uuid) RETURNS TABLE(id uuid, value text, display_order integer)`
- **Permission required**: `view_products`
- **Wrapper / new**: wraps `list_attribute_values_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

> **Trigger gate (no RPC)**: flipping `products.is_active` is gated by the
> `archive_product` permission via `v29_products_archive_gate` (see
> `0073_*.sql`). The error is `insufficient_permissions` with
> `detail = 'is_active toggle requires archive_product permission'`.
> Frontend should hide the archive toggle in the edit modal when the
> user lacks `archive_product`.

### 1.3 Inventory

#### `record_purchase`

- **Signature**: `(p_supplier_id uuid, p_purchase_date date, p_note text, p_items jsonb, p_overhead_items jsonb, p_is_opening boolean) RETURNS uuid`
- **Permission required**: `record_purchase`
- **Wrapper / new**: wraps `record_purchase_v28`.
- **Purpose**: Atomic stock-in. Inserts `purchases` + N `purchase_items` (+ batch rows when `has_batches`), increments `product_variants.stock`, allocates landed-cost overhead pro-rata-by-value, snapshots `avg_cost_before`/`avg_cost_after`.
- **Params**:
  - `p_supplier_id` — nullable for opening stock
  - `p_purchase_date` — defaults to current date
  - `p_items` — JSONB array of `{ variant_id?, product_id? (legacy), qty: int>0, qty_in_base?, cost_at_purchase: numeric>=0, pack_id?, pack_qty?, pack_base_qty_snapshot?, batch_no?, manufactured_date?, expiry_date?, supplier_warranty_days? }`
  - `p_overhead_items` — JSONB array of `{ category: text, amount: numeric>=0, description? }`
  - `p_is_opening` — opening-stock import flag (skips supplier requirement)
- **Returns**: `uuid` (new purchase_id)
- **Error codes (wrapper)**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions` — `Required: record_purchase`.
- **Error codes (`_v28`)**: `empty_purchase`, `supplier_not_in_shop`, `supplier_required_for_non_opening`, `item_missing_variant_or_product_id`, `product_has_no_default_variant`, `variant_not_in_shop`, `qty must be positive`, `qty_in_base must be positive`, `cost_at_purchase_negative`, `batch_no_required_for_has_batches_product`, `expiry_or_warranty_required_for_has_batches_product`, `duplicate_batch_no_in_variant`.
- **Notes**: Append-only — purchase_items, purchase_overhead_items, purchases all have immutability triggers. `created_by_user_id` (cashier_id) is set inline by `_v28`. The wrapper has **no** discount cap or audit-update logic (purchases are cost-side, not customer-facing).

#### `suggest_batch_no`

- **Signature**: `(p_variant_id uuid, p_received_at date) RETURNS text`
- **Permission required**: `record_purchase`
- **Wrapper / new**: wraps `suggest_batch_no_v28`.
- **Purpose**: Build a deterministic batch_no suggestion (e.g. `B-YYYYMMDD-NN`) for the stock-in form.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `deactivate_batch`

- **Signature**: `(p_batch_id uuid, p_reason text) RETURNS void`
- **Permission required**: `writeoff_batch`
- **Wrapper / new**: wraps `deactivate_batch_v28` + post-delegation `inventory_batches.last_modified_by_user_id = auth.uid()` write (0080).
- **Purpose**: Full write-off of a batch (sets `is_active=false`).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `batch_not_in_shop`, `batch_already_inactive`.

#### `record_partial_writeoff`

- **Signature**: `(p_batch_id uuid, p_qty integer, p_reason text) RETURNS void`
- **Permission required**: `writeoff_batch`
- **Wrapper / new**: wraps `record_partial_writeoff_v28` + audit write.
- **Purpose**: Decrement `qty_remaining` on a batch by an absolute amount; auto-deactivates when zero (via `batch_auto_deactivate_when_empty` trigger).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `batch_not_in_shop`, `partial_writeoff_qty_must_be_positive`, `partial_writeoff_exceeds_remaining`.

#### `search_purchases`

- **Signature**: `(p_from date, p_to date, p_supplier_id uuid, p_include_opening boolean, p_limit integer, p_offset integer) RETURNS TABLE(id uuid, purchase_date date, supplier_id uuid, supplier_name text, source text, note text, items_count bigint, items_subtotal numeric, overhead_subtotal numeric, total_cost numeric, is_opening boolean)`
- **Permission required**: `view_purchases`
- **Wrapper / new**: wraps `search_purchases_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `search_purchases_count`

- **Signature**: `(p_from date, p_to date, p_supplier_id uuid, p_include_opening boolean) RETURNS bigint`
- **Permission required**: `view_purchases`
- **Wrapper / new**: wraps `search_purchases_count_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

### 1.4 Customers

#### `create_customer_basic`

- **Signature**: `(p_name text, p_phone text) RETURNS uuid`
- **Permission required**: `create_customer_basic`
- **Wrapper / new**: **NEW** in `0075_v29_new_rpcs.sql`.
- **Purpose**: Create customer with name + phone only, auto-assigned to the shop's default tier. Writes `created_by_user_id = auth.uid()` inline.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions` (Required: create_customer_basic), `name_required`, `phone_required`, `duplicate_phone_in_shop`.

#### `create_customer_full`

- **Signature**: `(p_name text, p_phone text, p_address text, p_notes text, p_tier_id uuid) RETURNS uuid`
- **Permission required**: `create_customer_full` (+ `assign_customer_tier` if `p_tier_id` is non-null)
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Create customer with full attributes.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions` — `Required: create_customer_full` OR `Required: assign_customer_tier (to set tier_id)`, `name_required`, `phone_required`, `tier_not_in_shop`, `duplicate_phone_in_shop`.

#### `list_customers`

- **Signature**: `(p_query text, p_limit integer, p_offset integer) RETURNS TABLE(id uuid, name text, phone text, address text, outstanding numeric, invoice_count bigint, last_activity_at timestamptz, total_count bigint)`
- **Permission required**: `view_customers`
- **Wrapper / new**: wraps `list_customers_v28`. **Conditional projection** (0076b):
  - `phone`, `address` → NULL unless `view_customer_contact`
  - `outstanding` → NULL unless `view_customer_outstanding`
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `recent_customers`

- **Signature**: `(p_limit integer) RETURNS TABLE(id uuid, name text, phone text, address text, last_activity_at timestamptz)`
- **Permission required**: `view_customers`
- **Wrapper / new**: wraps `recent_customers_v28`. Conditional `phone`/`address` projection (NULL without `view_customer_contact`).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `search_khata_customers`

- **Signature**: `(p_query text, p_status text, p_limit integer, p_offset integer) RETURNS TABLE(id uuid, name text, phone text, address text, outstanding_balance numeric, last_activity_at timestamptz, entry_count bigint)`
- **Permission required**: `view_customer_khata`
- **Wrapper / new**: wraps `search_khata_customers_v28`.
- **Purpose**: Khata page customer list (open/closed/all). The khata feature requires the full numeric outstanding so this is gated by `view_customer_khata`, not `view_customers`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `search_khata_customers_count`

- **Signature**: `(p_query text, p_status text) RETURNS bigint`
- **Permission required**: `view_customer_khata`
- **Wrapper / new**: wraps `search_khata_customers_count_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `define_tier`

- **Signature**: `(p_name text, p_is_default boolean, p_notes text) RETURNS uuid`
- **Permission required**: `manage_customer_tiers`
- **Wrapper / new**: wraps `define_tier_v28` + post-delegation `created_by_user_id`/`updated_by_user_id` audit write (0080).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `duplicate_tier_name`.

#### `update_tier`

- **Signature**: `(p_tier_id uuid, p_name text, p_is_default boolean, p_notes text) RETURNS void`
- **Permission required**: `manage_customer_tiers`
- **Wrapper / new**: wraps `update_tier_v28` + audit write.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `tier_not_in_shop`.

#### `set_default_tier`

- **Signature**: `(p_tier_id uuid) RETURNS void`
- **Permission required**: `manage_customer_tiers`
- **Wrapper / new**: wraps `set_default_tier_v28` + audit write.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `deactivate_tier`

- **Signature**: `(p_tier_id uuid) RETURNS integer`
- **Permission required**: `manage_customer_tiers`
- **Wrapper / new**: wraps `deactivate_tier_v28` + audit write. Returns the count of customers that were rebound to the default tier.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `cannot_deactivate_default_tier`.

> **Trigger gate (no RPC)**: changing `customers.tier_id` is gated by
> the `assign_customer_tier` permission via
> `v29_customers_tier_change_gate` (`0073_*.sql`). Frontend must hide
> the tier picker on the customer-edit modal when the user lacks
> `assign_customer_tier`.

### 1.5 Suppliers

#### `search_suppliers`

- **Signature**: `(p_query text, p_limit integer, p_offset integer) RETURNS TABLE(id uuid, name text, contact text, address text, is_active boolean, total_count bigint)`
- **Permission required**: `view_suppliers`
- **Wrapper / new**: wraps `search_suppliers_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `recent_suppliers`

- **Signature**: `(p_limit integer) RETURNS TABLE(id uuid, name text, contact text, last_used_at timestamptz)`
- **Permission required**: `view_suppliers`
- **Wrapper / new**: wraps `recent_suppliers_v28`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `create_supplier_inline`

- **Signature**: `(p_name text, p_contact text, p_address text, p_notes text) RETURNS uuid`
- **Permission required**: `manage_suppliers`
- **Wrapper / new**: wraps `create_supplier_inline_v28` + audit write.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`; `_v28` may raise: `duplicate_supplier_name_contact`.

### 1.6 Financial (ledger, expenses, targets)

#### `receive_payment`

- **Signature**: `(p_customer_id uuid, p_amount numeric, p_notes text) RETURNS uuid`
- **Permission required**: `receive_payment`
- **Wrapper / new**: wraps `receive_payment_v28`. Final version in migration 0086 (the 0080 post-update was removed because ledger inserts now write `created_by_user_id` inline).
- **Purpose**: Record customer credit payment (`ledger_entries` row of `type='credit'`).
- **Caps**: Non-owner callers are capped at `shops.salesperson_payment_cap_pkr` per day per `(shop, user)` — serialized via `pg_advisory_xact_lock`.
- **Error codes (wrapper)**:
  - `not_authenticated`, `no_shop_for_user`
  - `insufficient_permissions` — `Required: receive_payment`
  - `amount_must_be_positive`
  - `salesperson_payment_cap_exceeded` — detail includes today's running total + the cap
- **Error codes (`_v28`)**:
  - `customer_not_in_shop`
  - `overpayment_customer max=<n>` — overpayment beyond outstanding
- **Returns**: `uuid` (the new `ledger_entries.id`).

#### `reverse_ledger_entry`

- **Signature**: `(p_entry_id uuid, p_notes text) RETURNS uuid`
- **Permission required**: `reverse_ledger_entry`
- **Wrapper / new**: wraps `reverse_ledger_entry_v28`. Final version in 0086 (no post-delegation UPDATE — created_by_user_id is written inline at the reversal insert).
- **Purpose**: Insert the reversing `ledger_entries` row for a non-sale-tied entry.
- **Error codes (wrapper)**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.
- **Error codes (`_v28`)**:
  - `entry_not_in_shop`
  - `cannot_reverse_a_reversal`
  - `cannot_reverse_invoice_tied_debit` (with hint about `void_sale`)
  - `entry_already_reversed`

#### `create_expense`

- **Signature**: `(p_category text, p_amount numeric, p_expense_date date, p_note text) RETURNS uuid`
- **Permission required**: `create_expense`
- **Wrapper / new**: **NEW** in 0075. Writes `created_by = auth.uid()` inline.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`, `amount_invalid`.

#### `update_expense`

- **Signature**: `(p_expense_id uuid, p_category text, p_amount numeric, p_note text) RETURNS void`
- **Permission required**: `edit_expense`
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Edit own expense within 24h of creation.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions` (Required: edit_expense), `expense_not_in_shop`, `not_expense_creator`, `expense_edit_window_expired`.

#### `upsert_monthly_target`

- **Signature**: `(p_month date, p_target_sale numeric, p_target_gross_profit numeric, p_target_net_profit numeric) RETURNS uuid`
- **Permission required**: `manage_monthly_targets`
- **Wrapper / new**: **NEW** in 0075. Writes `updated_by_user_id = auth.uid()`.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions` (Required: manage_monthly_targets).
- **Notes**: `date_trunc('month', p_month)` normalizes input; conflict on `(shop_id, month)` upserts.

### 1.7 Settings

#### `update_shop_settings`

- **Signature**: `(p_shop_name text, p_shop_address text, p_shop_phone text, p_shop_type text, p_default_expiry_alert_days integer, p_default_warranty_alert_days integer, p_default_expired_sale_policy expired_sale_policy, p_expired_sale_receipt_disclaimer boolean, p_salesperson_payment_cap_pkr numeric) RETURNS void`
- **Permission required**: `edit_shop_settings`
- **Wrapper / new**: **NEW** in 0075. All params nullable — uses `coalesce(param, existing)` to allow partial updates.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `update_owner_details`

- **Signature**: `(p_owner_name text, p_owner_phone text, p_owner_cnic text, p_owner_address text) RETURNS void`
- **Permission required**: `edit_owner_details`
- **Wrapper / new**: **NEW** in 0075. All params nullable.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.

#### `complete_onboarding`

- **Signature**: `(p_shop_name text, p_shop_address text, p_shop_phone text, p_shop_type text, p_owner_name text, p_owner_phone text, p_owner_cnic text, p_owner_address text) RETURNS uuid`
- **Permission required**: **none** — anyone authenticated who is not already an owner can call this.
- **Wrapper / new**: **REWRITTEN** in `0076_v29_modify_existing_rpcs.sql`. The rewrite adds `INSERT INTO user_shop_access (user_id, shop_id, is_owner=true)` so the founding owner has a row from the moment onboarding completes.
- **Purpose**: First-time onboarding atomic write (shops + shop_owner_details + units_of_measure 'each' row + user_shop_access owner row + profiles.onboarding_completed=true).
- **Error codes**: `not_authenticated`, `already_owner_at_this_email_user_combo`.

#### `set_active_shop`

- **Signature**: `(p_shop_id uuid) RETURNS void`
- **Permission required**: **none** beyond membership — caller must have a `user_shop_access` row for `p_shop_id`.
- **Wrapper / new**: **NEW** in `0070_v29_helper_functions.sql`.
- **Purpose**: **Validation-only** RPC. The actual active-shop transport is the `app-shop-id` HTTP header (read by `current_active_shop_id()`). Clients call this once on shop-switch to confirm membership before writing the new value to `localStorage`. No DB state changes on success.
- **Error codes**: `not_authenticated`, `no_access_to_shop`.

### 1.8 Team

#### `get_team_for_active_shop`

- **Signature**: `() RETURNS TABLE(user_id uuid, email text, is_owner boolean, preset_applied text, joined_at timestamptz, granted_permission_count integer)`
- **Permission required**: `view_team`
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: `/settings/team` employee roster.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`.
- **Notes**: `granted_permission_count` counts only rows where `granted=true`. For the owner row, the count will be 0 (owners have no `user_shop_permissions` rows by design — frontend should display this as "all permissions").

#### `get_user_permissions`

- **Signature**: `(p_target_user_id uuid) RETURNS TABLE(permission_key text, granted boolean, source text)`
- **Permission required**: caller must be either (a) viewing their own permissions (`p_target_user_id = auth.uid()`) or (b) hold `view_team`.
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Permission detail drawer on `/settings/team/<user>`. Source values: `'owner_implicit'` (every catalog row, granted=true) or `'preset'` / `'manual'` / `'default'` (no row in `user_shop_permissions`).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions` (Required: view_team).
- **Notes**: Returns no rows if the target user has no `user_shop_access` row at the active shop.

### 1.9 Identity / RBAC

> These are the v2.9-net-new RPCs. None of them call into `_v28`
> bodies — they're entirely new infrastructure.

#### `user_has_shop_access`

- **Signature**: `(p_shop_id uuid) RETURNS boolean`
- **Permission required**: **none** — public helper for `authenticated` role.
- **Wrapper / new**: **NEW** in 0070.
- **Purpose**: Pure set-membership probe. Used by every RLS policy and by the active-shop validator.
- **Error codes**: none — returns `false` (not throws) if user is not in shop.

#### `user_has_permission`

- **Signature**: `(p_shop_id uuid, p_permission_key text) RETURNS boolean`
- **Permission required**: **none** — public helper.
- **Wrapper / new**: **NEW** in 0070.
- **Purpose**: The fundamental "does caller have X" check. Owner shortcut hard-coded. Called from every wrapper + every RLS policy + every conditional-projection view.
- **Error codes**: none.
- **Notes**: This is the function the **frontend `usePermission()` hook** should mirror client-side (after pulling the once-per-session permission set via `user_permissions_in_shop`). Server is authoritative; client cache is for UX optimism.

#### `user_permissions_in_shop`

- **Signature**: `(p_shop_id uuid) RETURNS TABLE(permission_key text, granted boolean, source text)`
- **Permission required**: **none** — caller queries their own permissions.
- **Wrapper / new**: **NEW** in 0070.
- **Purpose**: Pull the full effective permission set for the calling user at a shop. Frontend calls this once per session (and on shop-switch) and caches in the `usePermission()` provider. For owners returns 50 rows all `granted=true` source `'owner_implicit'`.
- **Error codes**: none — returns 0 rows if caller has no `user_shop_access` row at the shop.

#### `get_user_shop_list`

- **Signature**: `() RETURNS TABLE(shop_id uuid, shop_name text, is_owner boolean, preset_applied text)`
- **Permission required**: **none** — caller queries their own list.
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Populate the shop-switcher dropdown for multi-shop users.
- **Error codes**: none.

#### `modify_user_permission`

- **Signature**: `(p_target_user_id uuid, p_permission_key text, p_granted boolean, p_reason text) RETURNS void`
- **Permission required**: `modify_user_permissions`
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Grant or revoke a single permission on another user. Validates dependency rules (symmetrically — grant + revoke). Writes audit row.
- **Error codes**:
  - `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`
  - `cannot_modify_own_permissions`
  - `cannot_modify_owner_or_unknown_user`
  - `unknown_permission_key`
  - `permission_dependency_missing` (detail: `Granting X requires Y to also be granted`)
  - `cannot_revoke_required_permission` (detail: `Cannot revoke X: Y depends on it and is granted`)
- **Notes**: source is set to `'manual'` on the resulting `user_shop_permissions` row.

#### `apply_preset_to_user`

- **Signature**: `(p_target_user_id uuid, p_preset text) RETURNS void`
- **Permission required**: `modify_user_permissions`
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Reset a non-owner user's permissions to the manager or salesperson preset. Bulk upserts every catalog row.
- **Error codes**:
  - `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`
  - `invalid_preset` (must be `'manager'` or `'salesperson'`)
  - `cannot_modify_own_permissions`
  - `cannot_modify_owner_or_unknown_user`
- **Notes**: Sets `user_shop_access.preset_applied`. All permission rows get `source='preset'`.

#### `update_user_discount_limits`

- **Signature**: `(p_target_user_id uuid, p_discount_limits jsonb, p_reason text) RETURNS void`
- **Permission required**: `modify_user_discount_limits`
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Replace the `user_shop_access.discount_limits` JSONB. Audit row written.
- **JSONB shape**: `{ per_line_max_pct?, per_invoice_max_pct?, per_line_max_pkr?, per_invoice_max_pkr? }` (all optional; null/missing = no cap on that dimension).
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`, `cannot_modify_owner_or_unknown_user`.

#### `revoke_user_access`

- **Signature**: `(p_target_user_id uuid, p_reason text) RETURNS void`
- **Permission required**: `revoke_user_access`
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Remove a non-owner user from the shop (`DELETE FROM user_shop_access`). CASCADE removes their `user_shop_permissions` rows.
- **Error codes**: `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`, `cannot_revoke_own_access`, `cannot_revoke_owner_or_unknown_user`.

#### `create_invitation`

- **Signature**: `(p_email text, p_preset text, p_permission_overrides jsonb, p_discount_limit_overrides jsonb) RETURNS TABLE(invitation_id uuid, confirmation_code text)`
- **Permission required**: `invite_users`
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Generate a pending invitation row. Frontend reads the
  returned `confirmation_code` (4-digit) and presents it verbally /
  alongside the email. The invitee enters the code in their account to
  accept. Resolved permissions are snapshotted into
  `pending_invitations.permissions` — this is authoritative at accept
  time (ADR `rbac-invitation-snapshot-not-resolved-at-accept`).
- **Override shape**:
  - `p_permission_overrides` — partial JSONB `{ permission_key: boolean }` applied on top of the preset defaults
  - `p_discount_limit_overrides` — partial JSONB applied on top of the preset's default limits
- **Default discount limits per preset**:
  - manager: `{per_line_max_pct: 25, per_invoice_max_pct: 15}`
  - salesperson: `{per_line_max_pct: 5, per_invoice_max_pct: 3, per_line_max_pkr: 100, per_invoice_max_pkr: 300}`
- **Error codes**:
  - `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`
  - `cannot_invite_owner` (preset must be `'manager'` or `'salesperson'`)
  - `invalid_email`
  - `permission_dependency_missing` — surface as "permission X requires Y" in the UI
- **Expiry**: 24 hours from creation (`expires_at = now() + interval '24 hours'`).
- **Notes**: Confirmation code is generated via
  `lpad((floor(random() * 10000)::int)::text, 4, '0')`. Frontend
  should display this as the only thing the inviter shows to the
  invitee verbally — the mistyped-email mitigation per ADR
  `rbac-4-digit-code-mistyped-email-mitigation`.

#### `cancel_invitation`

- **Signature**: `(p_invitation_id uuid) RETURNS void`
- **Permission required**: `cancel_invitations`
- **Wrapper / new**: **NEW** in 0075.
- **Error codes**:
  - `not_authenticated`, `no_shop_for_user`, `insufficient_permissions`
  - `invitation_not_in_shop`
  - `invitation_not_pending` (detail includes the actual status: `'accepted'`, `'cancelled'`, `'expired'`)

#### `accept_invitation`

- **Signature**: `(p_invitation_id uuid, p_confirmation_code text) RETURNS uuid`
- **Permission required**: **none** — invitee flow.
- **Wrapper / new**: **NEW** in 0075.
- **Purpose**: Accept a pending invitation. Validates code with 5-strike auto-cancel. Creates `user_shop_access` + inserts the snapshotted `permissions` JSONB into `user_shop_permissions` rows. Returns the new `user_shop_access.id`.
- **Error codes**:
  - `not_authenticated`
  - `invitation_not_found`
  - `invitation_not_pending` (also raised on the 5th wrong code with `detail = 'auto_cancelled_5_strike'`)
  - `invitation_expired`
  - `invalid_confirmation_code` (failed_attempts is incremented; status flips to `'cancelled'` at attempt 5)
  - `invitation_email_mismatch` (caller's profiles.email lowercased ≠ invitation.email)
  - `already_a_member_at_this_shop`

### 1.10 Helper / public (no permission required)

These are called by the frontend without a `usePermission()` check:

| RPC | Why it's ungated |
|-----|------------------|
| `current_active_shop_id` (internal — not directly callable from supabase-js) | DEFINER helper |
| `user_has_shop_access(uuid)` | Pure boolean; safe to expose |
| `user_has_permission(uuid, text)` | Pure boolean (returns false for non-members) |
| `user_permissions_in_shop(uuid)` | Returns 0 rows for non-members |
| `set_active_shop(uuid)` | Membership check is the gate |
| `get_user_shop_list()` | Returns the caller's own shops only |
| `complete_onboarding(...)` | Only callable by users who do not already own a shop |
| `accept_invitation(uuid, text)` | Invitee flow; gated by code + email match |

---

## 2. Permission-aware views

All views below are `security_invoker = false` (DEFINER-context) so
they can apply conditional projection without exposing the underlying
table to permissions the caller lacks. RLS on the underlying tables
remains as a defense in depth.

The standard CTE pattern is reproduced verbatim from `0074_v29_new_views.sql`:

```sql
with caller_perms as materialized (
  select
    (select public.current_active_shop_id()) as active_shop_id,
    (select public.user_has_permission(..., 'X')) as can_X,
    ...
)
select ..., case when cp.can_X then col end as col, ...
  from <table>
  cross join caller_perms cp
 where shop_id = cp.active_shop_id
   and cp.can_view;
```

### 2.1 `products_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `shop_id`, `name`, `category_id`, `description`, `type`, `base_unit_id`, `is_scan_only`, `is_active`, `has_variants`, `has_batches`, `expired_sale_policy`, `expiry_alert_days`, `warranty_alert_days`, `price`, `stock`, `created_at`, `updated_at` | yes | — | `products.*` |
| `cost`, `avg_cost`, `last_purchase_cost` | — | `view_product_cost` | `products.*` |

Row filter: `shop_id = active_shop_id AND user_has_permission(active_shop_id, 'view_products')`.

**Used by**: `/products` list page, product detail (`/products/:id`).

### 2.2 `product_variants_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `product_id`, `sku`, `stock`, `price`, `is_default`, `is_active`, `created_at`, `updated_at` | yes | — | `product_variants.*` |
| `cost`, `avg_cost`, `last_purchase_cost` | — | `view_product_cost` | `product_variants.*` |

Row filter: joined to `products`; same shop + `view_products` required.

**Used by**: product detail page (variant list section), variant matrix builder.

### 2.3 `inventory_batches_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `variant_id`, `batch_no`, `purchase_item_id`, `supplier_id`, `qty_received`, `qty_remaining`, `manufactured_date`, `expiry_date`, `supplier_warranty_days`, `warranty_expires_at`, `received_at`, `is_active`, `notes`, `created_at`, `updated_at` | yes | — | `inventory_batches.*` |
| `cost_per_unit` | — | `view_batch_cost` | `inventory_batches.cost_per_unit` |

Row filter: `view_inventory_batches`.

**Used by**: batch list per variant on the product detail page; `/inventory/batches/*` admin surfaces.

### 2.4 `invoices_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `shop_id`, `customer_id`, `total`, `service_charge`, `payment_type`, `cashier_id`, `amount_paid`, `notes`, `tier_id`, `sale_discount_type`, `sale_discount_value`, `sale_discount_percent_snapshot`, `sale_discount_amount`, `outstanding`, `created_at` | yes | — | `invoices.*` |
| `gross_profit` (computed `total - total_cost`) | — | `view_sale_cost` | derived |
| `gross_margin_percent` (computed `(total - total_cost)/total * 100`) | — | `view_profit_margin` | derived |

Row filter:
- `shop_id = active_shop_id`
- AND ( `user_has_permission('view_all_sales')` OR `cashier_id = auth.uid()` )

**Used by**: `/sales` list, `/dashboard` recent invoices widget, receipt reprint flow.

### 2.5 `sale_items_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `invoice_id`, `variant_id`, `product_id`, `qty`, `price_at_sale`, `line_discount_type`, `line_discount_value`, `line_discount_amount`, `batch_id`, `sold_expired` | yes | — | `sale_items.*` |
| `cost_at_sale`, `line_profit` (computed `(price*qty - line_disc) - cost*qty`) | — | `view_sale_cost` | derived |
| `margin_percent` (computed `(price - cost)/price * 100`) | — | `view_profit_margin` | derived |

Row filter: joined to `invoices`; same `view_all_sales` OR `cashier_id = auth.uid()` rule.

**Used by**: receipt detail (sales page row-expansion), invoice line drill-down.

### 2.6 `purchases_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `shop_id`, `total_cost`, `source`, `note`, `purchase_date`, `cashier_id`, `is_opening`, `supplier_id`, `items_subtotal`, `overhead_subtotal`, `created_at` | yes | — | `purchases.*` |

Row filter: `view_purchases`.

**Used by**: `/purchases` list.

### 2.7 `purchase_items_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `purchase_id`, `product_id`, `variant_id`, `batch_id`, `qty`, `qty_in_base`, `cost_at_purchase`, `line_overhead_amount`, `overhead_per_unit`, `avg_cost_before`, `avg_cost_after`, `pack_id`, `pack_qty`, `pack_base_qty_snapshot` | yes (entire row is gated by `view_purchases`) | — | `purchase_items.*` |

Row filter: joined via `purchases`; gated by `view_purchases`.

**Used by**: purchase detail (drill-down on a stock-in).

### 2.8 `purchase_overhead_items_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `purchase_id`, `category`, `amount`, `description`, `created_at` | yes | — | `purchase_overhead_items.*` |

Row filter: `view_purchases`.

**Used by**: purchase detail.

### 2.9 `customers_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `shop_id`, `name`, `tier_id`, `is_active`, `notes`, `created_at`, `updated_at`, `created_by_user_id`, `has_khata` (computed `outstanding_balance > 0`) | yes | — | `customers.*` |
| `phone`, `address` | — | `view_customer_contact` | `customers.*` |
| `outstanding_balance` | — | `view_customer_outstanding` | `customers.*` |

Row filter: `view_customers`.

**Used by**: `/customers` list, customer detail page, POS customer picker.

### 2.10 `shop_owner_details_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `id`, `shop_id`, `owner_name`, `owner_phone`, `owner_cnic`, `owner_address`, `created_at`, `updated_at` | yes (entire row gated) | — | `shop_owner_details.*` |

Row filter: `view_owner_details` (returns 0 rows if missing).

**Used by**: `/settings` (owner details section).

### 2.11 `monthly_summary_view`

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `shop_id`, `month`, `total_sales`, `total_expenses` | yes | — | `monthly_summary.*` |
| `gross_profit` | — | `view_sale_cost` | `monthly_summary.*` |

Row filter: `view_reports`.

**Used by**: `/reports` monthly trend panel.

### 2.12 `shop_effective_subscription`

| Column | Always projected | Source |
|--------|-----------------|--------|
| `shop_id`, `effective_status`, `status`, `trial_ends_at`, `current_period_ends_at`, `last_payment_date` | yes | computed: `case ... when 'active' and now() > current_period_ends_at then 'expired' ...` |

Row filter: `user_has_shop_access(shop_id)` — any shop member can read (not gated by a specific permission).

**Used by**: `RequireActiveSubscription` guard. Frontend should read this view, not `subscriptions` directly, because the table is owner-only by RLS and members of a non-owner shop need to know their effective subscription state.

### 2.13 `customer_outstanding` (replaced in 0074)

| Column | Always projected | Gated NULL when missing | Source |
|--------|-----------------|-------------------------|--------|
| `shop_id`, `customer_id`, `name`, `phone`, `last_activity_at` | yes | — | derived from `customers` left-join `ledger_entries` |
| `outstanding` (computed `sum(debit) - sum(credit)`) | — | `view_customer_outstanding` | derived |

Row filter: `shop_id = active_shop_id`.

**Used by**: khata page customer cards, customer detail outstanding banner.

### 2.14 `total_outstanding`

| Column | Always projected |
|--------|-----------------|
| `total` (sum of `customer_outstanding.outstanding`) | yes |
| `customer_count` (count where `outstanding > 0`) | yes |

Row filter: `shop_id = current_active_shop_id()`.

**Used by**: dashboard outstanding tile, khata summary header.

---

## 3. Error code → UX mapping summary table

> All codes are raised as Postgres `RAISE EXCEPTION ... USING errcode='P0001'` unless noted. `_v28` bodies often raise without an explicit `using errcode`, which defaults to `'P0001'` as well. The frontend should match by the **message string**, not the SQLSTATE, since they collide.

### 3.1 Universal RPC errors (every Tanstack mutation/query needs)

| Error code (message) | Raised by | i18n key suggestion | UX pattern |
|---|---|---|---|
| `not_authenticated` | every wrapper + every new RPC | `errors.notAuthenticated` | redirect to `/login`, clear AuthContext |
| `no_shop_for_user` | every wrapper + most new RPCs | `errors.noShopForUser` | redirect to `/onboarding` if `!profiles.onboarding_completed`, else to a shop-picker fallback (multi-shop user with missing header) |
| `insufficient_permissions` | every wrapper + every new RPC (the `detail` carries `Required: <key>`) | `errors.insufficientPermissions` (with `{permission}` interpolation) | toast + disable the originating control; on next render, hide it via `usePermission()` |
| `invalid_app_shop_id_header` | `current_active_shop_id` | `errors.invalidShopHeader` | force shop re-selection (write null to `localStorage`, reload) |
| `no_access_to_shop` | `current_active_shop_id`, `set_active_shop` | `errors.noAccessToShop` | force shop re-selection |

### 3.2 Permission-management errors (Section 1.9)

| Error code | Raised by | i18n key | UX |
|---|---|---|---|
| `cannot_modify_own_permissions` | `modify_user_permission`, `apply_preset_to_user` | `errors.team.cannotModifySelf` | toast "You cannot edit your own permissions" |
| `cannot_modify_owner_or_unknown_user` | `modify_user_permission`, `apply_preset_to_user`, `update_user_discount_limits` | `errors.team.cannotModifyOwner` | toast "Cannot modify the shop owner" |
| `cannot_revoke_own_access` | `revoke_user_access` | `errors.team.cannotRevokeSelf` | toast "You cannot revoke your own access" |
| `cannot_revoke_owner_or_unknown_user` | `revoke_user_access` | `errors.team.cannotRevokeOwner` | toast "Cannot remove the shop owner" |
| `unknown_permission_key` | `modify_user_permission` | `errors.team.unknownPermission` | bug-class — log + generic toast |
| `permission_dependency_missing` | `modify_user_permission`, `create_invitation` | `errors.team.dependencyMissing` (interpolate `{permission}` + `{required}`) | parse `detail = 'Granting X requires Y to also be granted'`; modal "Grant {required} first" |
| `cannot_revoke_required_permission` | `modify_user_permission` | `errors.team.cannotRevokeDependedOn` (interpolate `{permission}` + `{dependent}`) | parse `detail`; modal "Revoke {dependent} first" |
| `invalid_preset` | `apply_preset_to_user` | `errors.team.invalidPreset` | bug-class |
| `cannot_invite_owner` | `create_invitation` | `errors.invitations.cannotInviteOwner` | toast (UI should prevent this) |
| `invalid_email` | `create_invitation` | `errors.invitations.invalidEmail` | inline form error |
| `invitation_not_in_shop` | `cancel_invitation` | `errors.invitations.notInShop` | toast — race condition, reload |
| `invitation_not_pending` | `cancel_invitation`, `accept_invitation` | `errors.invitations.notPending` (interpolate `{status}`) | parse detail for status; redirect to invitations list |
| `invitation_not_found` | `accept_invitation` | `errors.invitations.notFound` | redirect to invitations landing |
| `invitation_expired` | `accept_invitation` | `errors.invitations.expired` | screen with "Ask your manager for a fresh invitation" |
| `invalid_confirmation_code` | `accept_invitation` | `errors.invitations.invalidCode` | inline field error + decrementing-attempts counter |
| `invitation_email_mismatch` | `accept_invitation` | `errors.invitations.emailMismatch` | screen "This invitation is for a different email" |
| `already_a_member_at_this_shop` | `accept_invitation` | `errors.invitations.alreadyMember` | redirect to the shop dashboard |

### 3.3 Sale / discount-cap errors

| Error code | Raised by | i18n key | UX |
|---|---|---|---|
| `discount_exceeds_line_pct_limit` | `record_sale` (wrapper) | `errors.pos.discountLinePctCap` | inline POS error: "Discount per line cannot exceed {cap}%" |
| `discount_exceeds_line_pkr_limit` | `record_sale` (wrapper) | `errors.pos.discountLinePkrCap` | inline POS error |
| `implicit_discount_exceeds_line_pct_limit` | `record_sale` (wrapper) | `errors.pos.implicitDiscountCap` | "Selling below {variant.price - cap%} requires manager approval" |
| `discount_exceeds_invoice_pct_limit` | `record_sale` (wrapper) | `errors.pos.discountInvoicePctCap` | banner above checkout button |
| `discount_exceeds_invoice_pkr_limit` | `record_sale` (wrapper) | `errors.pos.discountInvoicePkrCap` | banner |
| `salesperson_payment_cap_exceeded` | `receive_payment` (wrapper) | `errors.khata.dailyCapExceeded` | "You can only receive PKR {cap} per day. {remaining} remaining today." Parse detail for numbers. |
| `amount_must_be_positive` | `receive_payment` | `errors.khata.amountMustBePositive` | form-field error |

### 3.4 Sale `_v28` body errors (raised through the wrapper)

| Error code | Used in | UX |
|---|---|---|
| `empty_sale: a sale must have items or a service charge` | `record_sale` | bug-class; UI shouldn't allow |
| `amount_paid_negative`, `service_charge_negative` | `record_sale` | form-field errors |
| `sale_discount_type_and_value_must_both_be_set_or_neither`, `invalid_sale_discount_type`, `sale_discount_percent_out_of_range`, `sale_discount_fixed_negative`, `sale_discount_fixed_exceeds_items_subtotal` | `record_sale` | invoice-discount popup field errors |
| `line_discount_*` family | `record_sale` | per-line cart errors |
| `qty must be positive`, `price must be non-negative` | `record_sale` | per-line cart errors |
| `amount_paid_exceeds_total` | `record_sale` | "Amount received exceeds total" |
| `customer_required_for_credit` | `record_sale` | "Choose a customer to record on khata" |
| `customer_not_in_shop` | `record_sale`, `receive_payment` | "Customer not found — reload" |
| `product_has_no_default_variant` | `record_sale`, `record_purchase` | bug-class |
| `item_missing_variant_or_product_id` | `record_sale`, `record_purchase` | bug-class |
| `variant_not_found_or_inactive`, `variant_not_in_shop`, `variant_not_sellable` | `record_sale` | "This variant is not sellable — refresh" |
| `insufficient_stock for variant <uuid>` | `record_sale` | "Out of stock" — refresh prices |
| `batch_not_in_variant_or_inactive`, `selected_batch_insufficient` | `record_sale` | re-open batch picker |
| `expired_stock_blocked` | `record_sale` | "This product is blocked on expired stock" |
| `expired_stock_needs_confirmation` | `record_sale` | toggle the "Confirm expired sale" switch |
| `insufficient_non_expired_stock for variant <uuid>` | `record_sale` | offer expired-sale confirmation if user has permission |
| `no_batch_stock_available for variant <uuid>` | `record_sale` | refresh stock |

### 3.5 Purchase errors

| Error code | Raised by | UX |
|---|---|---|
| `empty_purchase` | `record_purchase_v28` | bug-class |
| `supplier_not_in_shop` | `record_purchase_v28` | re-pick supplier |
| `supplier_required_for_non_opening` | `record_purchase_v28` | inline form error |
| `qty_in_base must be positive`, `qty must be positive`, `cost_at_purchase_negative` | `record_purchase_v28` | line errors |
| `batch_no_required_for_has_batches_product` | `record_purchase_v28` | line error: prompt for batch_no |
| `expiry_or_warranty_required_for_has_batches_product` | `record_purchase_v28` | line error |
| `duplicate_batch_no_in_variant` | `record_purchase_v28` | suggest auto-batch-no |

### 3.6 Batch write-off errors

| Error code | Raised by | UX |
|---|---|---|
| `batch_not_in_shop` | `deactivate_batch_v28`, `record_partial_writeoff_v28` | reload |
| `batch_already_inactive` | `deactivate_batch_v28` | refresh button state |
| `partial_writeoff_qty_must_be_positive` | `record_partial_writeoff_v28` | form-field error |
| `partial_writeoff_exceeds_remaining` | `record_partial_writeoff_v28` | clamp input |

### 3.7 Ledger reversal errors

| Error code | Raised by | UX |
|---|---|---|
| `entry_not_in_shop` | `reverse_ledger_entry_v28` | reload |
| `cannot_reverse_a_reversal` | `reverse_ledger_entry_v28` | disable button in UI |
| `cannot_reverse_invoice_tied_debit` | `reverse_ledger_entry_v28` | "Sale-tied debits cannot be reversed directly" — hint in raised `hint` |
| `entry_already_reversed` | `reverse_ledger_entry_v28` | refresh row state |
| `overpayment_customer max=<n>` | `receive_payment_v28` | inline "Customer's outstanding is only {n}" |

### 3.8 Customer / tier errors

| Error code | Raised by | UX |
|---|---|---|
| `name_required`, `phone_required` | `create_customer_basic`, `create_customer_full` | form-field errors |
| `tier_not_in_shop` | `create_customer_full` | reload tier picker |
| `duplicate_phone_in_shop` | both `create_customer_*` | inline "A customer with this phone already exists" |
| `cannot_deactivate_default_tier` | `deactivate_tier_v28` | "Set a different default tier first" |

### 3.9 Expense errors

| Error code | Raised by | UX |
|---|---|---|
| `amount_invalid` | `create_expense` | form-field error |
| `expense_not_in_shop` | `update_expense` | reload |
| `not_expense_creator` | `update_expense` | "You can only edit your own expenses" |
| `expense_edit_window_expired` | `update_expense` | "Editing is only allowed within 24h of creation" |

### 3.10 Onboarding error

| Error code | Raised by | UX |
|---|---|---|
| `already_owner_at_this_email_user_combo` | `complete_onboarding` | redirect to dashboard (race-condition / re-submission) |

### 3.11 Trigger-gate errors (column-level)

Both raise `insufficient_permissions` with specific `detail`:

| Trigger | Detail string | UX |
|---|---|---|
| `v29_products_archive_gate` | `is_active toggle requires archive_product permission` | hide the archive toggle in the edit modal if user lacks `archive_product` |
| `v29_customers_tier_change_gate` | `tier_id change requires assign_customer_tier permission` | hide tier picker on customer-edit form if user lacks `assign_customer_tier` |

---

## 4. Active-shop header pattern

### 4.1 Server-side contract

The `current_active_shop_id()` function (final body in
`0085_fix_current_active_shop_id_fallback_v2.sql`) executes the
following logic on every call:

```text
1. v_headers_text := current_setting('request.headers', true)
2. if header GUC is present and non-empty:
   a. try v_headers_text::jsonb ->> 'app-shop-id' → v_shop_id_str
   b. if v_shop_id_str is non-empty:
      - cast to uuid (raises 'invalid_app_shop_id_header' on bad UUID)
      - validate user_has_shop_access (raises 'no_access_to_shop' on miss)
      - RETURN v_shop_id
3. Fallback (no header):
   return (
     select case when count(*) = 1 then (array_agg(shop_id))[1] end
       from public.user_shop_access
      where user_id = auth.uid()
   )
   → returns the sole shop_id for single-shop users
   → returns NULL for multi-shop users without a header
   → returns NULL for users with zero shops
4. If returns NULL, caller's next check raises 'no_shop_for_user'
```

PostgREST exposes incoming HTTP headers as a JSONB-encoded GUC at
`request.headers`. Only **lowercased** header names are visible — so
the client header must be `app-shop-id`, not `App-Shop-Id`. Supabase's
JS SDK preserves header case in `customFetch`, but PostgREST
lowercases on read.

### 4.2 Client-side transport (Phase C requirement)

Frontend must implement a `customFetch` wrapper in `supabase-js`:

```ts
// pseudo-code; actual implementation in src/lib/supabase.ts during Phase C
const customFetch: typeof fetch = (input, init) => {
  const activeShopId = getActiveShopId(); // from localStorage / context
  const headers = new Headers(init?.headers);
  if (activeShopId) headers.set('app-shop-id', activeShopId);
  return fetch(input, { ...init, headers });
};
```

The `activeShopId` source-of-truth precedence:

1. `useActiveShop()` React context (in-memory, fastest)
2. `localStorage['nizaamify.active_shop_id']` (rehydrate after reload)
3. If neither, no header is sent → fallback path covers single-shop owners.

### 4.3 Switching shops

```text
1. user picks shop from dropdown (populated by get_user_shop_list)
2. call set_active_shop(p_shop_id) → validates membership
3. on success: write to localStorage + update useActiveShop context
4. invalidate all React Query caches (`queryClient.clear()` or scoped invalidation)
5. UI re-renders with the new shop's data
```

If `set_active_shop` raises `no_access_to_shop`, the user has been
removed from that shop since the dropdown was populated — refetch
`get_user_shop_list`.

### 4.4 When both paths fail

If `current_active_shop_id()` returns NULL (multi-shop user, no
header), every wrapper raises `no_shop_for_user`. The frontend's
universal handler should:

1. If `useAuth().profile.onboarding_completed === false` → redirect to `/onboarding`
2. Else fetch `get_user_shop_list()`:
   - 0 rows → bug-class; log and redirect to onboarding
   - 1 row → write to localStorage + reload (single-shop fallback will succeed next time)
   - 2+ rows → show shop picker modal

---

## 5. Audit pattern

Per ADR `2026-05-13-v29-rbac-deployment-phasing` + the
post-stabilization migrations 0080 and 0086, the `*_by_user_id`
columns are populated by **two different patterns** depending on
table mutability.

### 5.1 Pattern A: post-delegation UPDATE (migration 0080)

For tables that allow UPDATE, the wrapper executes:

```sql
v_id := public.<name>_v28(...);
update public.<table> set <by_col> = auth.uid()[, <other_by_col> = auth.uid()] where id = v_id;
return v_id;
```

**Tables affected**:

- `inventory_batches.last_modified_by_user_id` — written by `deactivate_batch`, `record_partial_writeoff`
- `customer_tiers.created_by_user_id` + `updated_by_user_id` — by `define_tier`, `update_tier`, `set_default_tier`, `deactivate_tier`
- `suppliers.created_by_user_id` + `updated_by_user_id` — by `create_supplier_inline`
- `product_categories.created_by_user_id` + `updated_by_user_id` — by `create_category_inline`, `update_category`
- `variant_attributes.created_by_user_id` — by `create_variant_attribute`
- `variant_attribute_values.created_by_user_id` — by `add_variant_value`
- `product_variants.created_by_user_id` + `updated_by_user_id` — by `add_variant_to_product`, `create_product_with_opening_stock`, `create_product_with_variants`
- `products.created_by_user_id` + `updated_by_user_id` — by `create_product_with_opening_stock`, `create_product_with_variants`
- `product_packs.created_by_user_id` + `updated_by_user_id` — by `define_pack_inline`, `update_pack`, `deactivate_pack`

### 5.2 Pattern B: inline-at-INSERT (migration 0086)

For append-only tables, the post-delegation UPDATE pattern is
**impossible** — the `<table>_no_modify` trigger blocks every UPDATE
by design. Audit columns must be written at INSERT time inside the
`_v28` body.

**Tables affected**:

- `ledger_entries.created_by_user_id` — written inline by `record_sale_v28` (debit row on credit/partial sale), `receive_payment_v28` (credit row), `reverse_ledger_entry_v28` (reversal row). Migration 0086 patched these three `_v28` bodies to accept `v_user_id := auth.uid()` and pass it into the INSERT.

### 5.3 Tables that already had the audit column inline

- `invoices.cashier_id` — written inline by `record_sale_v28` (was already in v2.8.5; not a v2.9 change)
- `purchases.cashier_id` — written inline by `record_purchase_v28` (was already in v2.8.5)
- `sale_items`, `purchase_items`, `purchase_overhead_items` — no `_by` audit column (they inherit from their parent row's cashier_id)
- `expenses.created_by` — written inline by `create_expense` (NEW RPC, not wrapped)
- `customers.created_by_user_id` — written inline by `create_customer_basic`, `create_customer_full` (NEW RPCs, not wrapped)
- `monthly_targets.updated_by_user_id` — written inline by `upsert_monthly_target` (NEW RPC, not wrapped)

### 5.4 Audit table

`user_shop_permission_audit` rows are written by the **RBAC RPCs**
(modify_user_permission, apply_preset_to_user,
update_user_discount_limits, revoke_user_access, accept_invitation).
Frontend reads via standard RLS (`view_user_audit_log` permission
gates `uspa_owner_read` policy on the table).

---

## 6. Open items / explicit not-supported

### 6.1 Deferred to v2.10+

| Capability | Status | Workaround |
|---|---|---|
| `void_sale` (full sale reversal) | not implemented | `reverse_ledger_entry` returns `cannot_reverse_invoice_tied_debit` with hint — no current path to void a posted sale |
| Customer delete (`delete_customer` RPC) | not implemented | UI removed per v2.9.0.1 sweep; customers can only be deactivated via `customers.is_active = false` (direct RLS UPDATE under `edit_customer`) |
| Edit sale notes (`edit_sale_notes` RPC) | deferred | `invoices.notes` is append-only via invoice trigger; no current path |
| Ownership transfer | deferred | `shops.owner_user_id` UPDATE is revoked from `authenticated` (see `0073_*.sql` end) |
| Advance payments (positive customer balance) | deferred | `receive_payment` raises `overpayment_customer` if `amount > outstanding` |
| Returns / refunds | deferred | no RPC |
| `update_customer` RPC | deferred | `customers` table UPDATE works for `view_customer_contact + edit_customer` holders; no DEFINER wrapper |
| `update_supplier` RPC | deferred | `suppliers` UPDATE policy `v29_suppliers_update` covers it under `manage_suppliers` |
| `update_invitation` (edit pending invitation) | not in plan | cancel + re-create |

### 6.2 Frontend gaps surfaced by the inventory

- **No `usePermission()` hook yet** — must be built in Phase C, sourced from `user_permissions_in_shop()` and cached for the session.
- **No shop-switcher UI yet** — `get_user_shop_list` + `set_active_shop` are in place server-side, but the dropdown is a v2.9.1 client task.
- **No `customFetch` wrapper yet** — required for any multi-shop user to use the system; single-shop users are covered by the fallback path. Phase C must add this before the second shop becomes possible.
- **Receipt re-print path** is unwrapped — the `/sales/:id` detail page reads from `invoices_view` + `sale_items_view`. There's no `reprint_receipt` RPC; the `reprint_receipt` permission (catalog row, salesperson default) is currently enforced only by the row filter on `invoices_view` (own sales unless `view_all_sales`). Frontend may need a future audit hook here.
- **`confirm_expired_sale_at_pos` permission** is enforced by the `record_sale` wrapper only when `p_confirm_expired_sale=true`. Frontend must (a) call `preflight_expired_sale_check` to determine if the cart would draw on expired stock, (b) show the toggle only if the policy is `'warn'` and user has the permission, (c) pass `p_confirm_expired_sale=true` on commit.

### 6.3 Verified gaps with no RPC mapping

- **`view_team`** is required by the **trigger gate** on the team page but the page also reads `pending_invitations` directly (its RLS policy `pi_owner_or_invitee_read` gates by `is_owner = true`, not by `view_team`). Non-owner team-viewers will see audit-history rows but will NOT see pending invitations from the same shop. **Discrepancy**: the audit / design docs reference `view_team` as a unified gate, but the RLS policy on `pending_invitations` is owner-only. Flagged in §8 below.
- **`view_user_audit_log`** is in the catalog but the `uspa_owner_read` policy on `user_shop_permission_audit` is also owner-only (not `view_user_audit_log`-gated). Same discrepancy class. Flagged in §8.

---

## 7. Methodology / sources

### 7.1 Files read end-to-end

Primary (authoritative):

1. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0068_v29_foundation_enum_catalog.sql`
2. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0069_v29_identity_tables.sql`
3. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0070_v29_helper_functions.sql`
4. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0073_v29_new_rls_policies.sql`
5. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0074_v29_new_views.sql`
6. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0075_v29_new_rpcs.sql`
7. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0076_v29_modify_existing_rpcs.sql`
8. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0076b_v29_conditional_projection_and_caps.sql`
9. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0079_v29_hardening.sql`
10. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0080_v29_audit_by_user_id_writes.sql`
11. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0084_fix_current_active_shop_id_fallback.sql`
12. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0085_fix_current_active_shop_id_fallback_v2.sql`
13. `/home/ali/Documents/nizaam/nizaamify/supabase/migrations/0086_ledger_audit_at_insert.sql`

Cross-reference:

- `/home/ali/Documents/nizaam/nizaamify/design/2026-05-13-rbac-model-design.md`
- `/home/ali/Documents/nizaam/nizaamify/design/2026-05-13-rbac-attack-surface.md`
- `/home/ali/Documents/nizaam/nizaamify/design/2026-05-13-rbac-implementation-plan.md`

### 7.2 Verification SQL executed on `orfggrnyychmmqdlbfhf`

```sql
-- Final RPC inventory (caller-facing — excludes _v28 inner functions)
SELECT proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef=true
   AND p.proname NOT LIKE '%\_v28'
 ORDER BY proname;

-- _v28 inner-wrapper inventory
SELECT proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef=true
   AND p.proname LIKE '%\_v28'
 ORDER BY proname;

-- Confirm no anon/public EXECUTE on any DEFINER RPC
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       r.rolname AS grantee,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') AS has_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.rolname IN ('anon','authenticated','public')
 WHERE n.nspname='public' AND p.prosecdef=true
   AND has_function_privilege(r.oid, p.oid, 'EXECUTE') = true
   AND p.proname NOT LIKE '%\_v28'
   AND r.rolname IN ('anon','public')
 ORDER BY p.proname, r.rolname;
-- Result: 0 rows. ✅

-- Permission-aware views
SELECT table_name FROM information_schema.views
 WHERE table_schema='public' ORDER BY table_name;
```

### 7.3 Verification results (counts)

- **Caller-facing DEFINER RPCs**: 74 (incl. 6 trigger functions, 2 cron, 2 internal validators, 1 legacy `current_shop_id` no-op).
- **Actually-frontend-callable RPCs** (DEFINER, `revoke from public,anon; grant to authenticated;`, non-trigger): 65
- **_v28 inner functions**: 41 (matches the migration plan exactly)
- **Permission-aware views (v2.9 additions)**: 14 (matches `0074_v29_new_views.sql`)
- **Trigger gate functions**: 2 (`check_product_archive_gate`, `check_customer_tier_change_gate`)
- **No anon/public EXECUTE grants** on any v2.9 DEFINER RPC ✅

---

## 8. Discrepancies

When the migration source disagrees with the design / audit docs, the
migration wins. Documenting both so we can update the docs in a
follow-up sweep:

### 8.1 `view_team` permission name vs `pending_invitations` RLS

- **Design doc** (`rbac-model-design.md` §B.1) implies the `view_team`
  permission unlocks the entire `/settings/team` page including
  pending invitations and the audit log.
- **Migration source** (`0069_v29_identity_tables.sql`,
  `pi_owner_or_invitee_read` policy and `uspa_owner_read` policy)
  gates `pending_invitations` and `user_shop_permission_audit`
  reads by `is_owner = true` only, NOT by the `view_team` or
  `view_user_audit_log` permissions.
- **Effect**: A manager with `view_team + view_user_audit_log` will
  see the team roster (via `get_team_for_active_shop` RPC) but will
  NOT see pending invitations or audit log entries when reading
  those tables directly. They'd need to call additional RPCs that
  bypass RLS, but no such RPCs exist as of 0086.
- **Recommended fix**: when v2.9.1 client lands, either (a) add a
  `pending_invitations` read policy gated by `invite_users` (or a
  new `view_invitations` permission), and audit-log read policy gated
  by `view_user_audit_log`, or (b) add list-RPCs
  `list_pending_invitations()` and `list_audit_log()` that gate by
  the catalog permissions.

### 8.2 Categories of RPC error code escape

- **`record_sale_v28` body** raises many errors **without**
  `using errcode`. The Postgres default for raised exceptions
  without an explicit code is `'P0001'` — same as the wrapper
  errors. Frontend must match by message string, not SQLSTATE.
- **Convention going forward**: prefer matching by the message text
  (which is stable across releases by the no-rename rule below) or
  parse `details` / `hints` when they carry interpolated values.

### 8.3 Wrapper count: 41 vs design doc's "41 existing RPCs"

- **Verified**: exactly 41 `_v28` functions exist in
  production (matches the design doc count).
- **Wrappers in `0076_*.sql`**: 41
- **Wrappers also rewritten in `0076b_*.sql`** (for conditional
  projection / caps): 6 → `search_products`, `recent_purchase_products`,
  `list_customers`, `recent_customers`, `record_sale`, `receive_payment`
- **Wrappers also rewritten in `0080_*.sql`** (for audit `_by_user_id`):
  many — see §5.1 above.
- **Wrappers also rewritten in `0086_*.sql`** (to drop the post-delegation
  ledger UPDATE): 3 → `record_sale`, `receive_payment`,
  `reverse_ledger_entry`.
- Each wrapper has been redefined multiple times across migrations;
  the **final** body is whichever migration touched it last. The doc
  above reflects the final (production) state.

### 8.4 `complete_onboarding` permission

- Design implies `complete_onboarding` is "for first-time users
  only." The migration enforces this via `already_owner_at_this_email_user_combo`
  check (one shop per user-email pair), NOT via a permission key.
  There is no `complete_onboarding` permission in the catalog. Any
  authenticated, profile-completed user who is not already an owner
  can call it.

### 8.5 `set_active_shop` is a no-op on success

- Migration 0070 comment is explicit: "No-op beyond validation in
  the fallback path." This is intentional — the active shop is
  carried by the HTTP header per call, not server-side state.
- Frontend should treat success as "this shop_id is yours; safe to
  write to localStorage and start sending the header."

### 8.6 `current_shop_id()` (legacy) still exists

- Migration 0070 deliberately leaves the v2.8.5 body
  (`select id from shops where owner_user_id = auth.uid() limit 1`)
  intact. For non-owner users it returns NULL, making any leftover
  RLS policy that references it a no-op.
- **Frontend MUST NOT call `current_shop_id()`** — it returns the
  wrong shop for owner-of-multiple-shops users and NULL for everyone
  else. Always use `current_active_shop_id()` directly (or rely on
  it transitively via the RPC wrappers and views).

---

*End of inventory. Total: 8 sections, ~74 caller-facing RPCs documented, 14 views, ~70 distinct error code strings catalogued.*
