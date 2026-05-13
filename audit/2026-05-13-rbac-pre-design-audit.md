# RBAC Pre-Design Audit — 2026-05-13

**Author:** Claude (Principal Solution Architect mode)
**Database snapshot:** Supabase project `orfggrnyychmmqdlbfhf`, queried 2026-05-13
**Scope:** forensic inventory of the live security perimeter against the
proposed v2.9 three-role model (owner / manager / salesperson).
**Status:** reference document, not narrative. Skim by section heading.

This document is the **inventory of the current state**. It does not propose
a v2.9 design — that belongs in `design/2026-05-13-rbac-model-design.md`.
Severity ratings are written from the v2.9 vantage point: most findings
are "not a current exploit because today every authenticated user is
implicitly an owner, but the v2.9 design must close this gap."

---

## 0. Scope & methodology

### 0.1 Sources read

- `CLAUDE.md` (project contract, build trail v1.2 → v2.8.5)
- `PRD.md` (baseline v1.2 — defines role model, RLS pattern, RPC list)
- `tasks.md` (delivery tracking through v2.8.5)
- `docs/build-trail.md`, `docs/gotchas.md`, `docs/todos.md`
- `decisions/README.md` and full listing of 50+ ADRs (read by index from
  `CLAUDE.md` summaries — see §0.3 for spec-files I did **not** read end-to-end)
- Live DB state via Supabase MCP (`list_tables` verbose, `get_advisors`,
  `execute_sql` against `pg_policies`, `pg_proc`, `pg_trigger`, `pg_class`,
  `information_schema.role_table_grants`, `cron.job`)
- Function bodies via `pg_get_functiondef` for: `current_shop_id`,
  `handle_new_user`, `complete_onboarding`, `record_sale`, `record_purchase`,
  `receive_payment`, `reverse_ledger_entry`, `deactivate_batch`,
  `deactivate_pack`, `record_partial_writeoff`,
  `enforce_variant_default_invariants`, `financial_records_immutable`,
  `ledger_entries_immutable`, `batch_immutable_fields`,
  `sync_product_id_from_variant`, `preflight_expired_sale_check`,
  `expire_subscriptions`
- All view definitions via `pg_get_viewdef`
- Client-side write surface via grep over `src/**/*.{ts,tsx}` for
  `.from(...).{insert,update,delete,upsert}` and `.rpc(...)`

### 0.2 Methodology

For each artifact (table / function / view / trigger), three questions
are answered:

1. What does it expose / what does it mutate?
2. What guards it today?
3. Under the v2.9 owner/manager/salesperson model, what guard does it need?

Findings are classified by severity per the rubric in the kickoff prompt:

- **CRITICAL** — exploit exists today (with valid credentials) under the
  current single-role model. (Should be zero; current model definitionally
  collapses to one role.)
- **HIGH** — defect that becomes exploitable under v2.9 unless the design
  closes it. Most findings land here.
- **MEDIUM** — architectural concern that doesn't have a current exploit
  but constrains v2.9 choices.
- **INFORMATIONAL** — observation worth recording, no required action.

### 0.3 Files NOT read end-to-end

The kickoff prompt asks to "read every versioned PRD spec file in the
repo root (v1.x through v2.8.4)." All such specs live under
`release-notes/` (not the repo root), and CLAUDE.md / tasks.md / ADRs
together summarise every decision they document. To keep this audit
focused on the **current** security perimeter (which the live DB state
authoritatively describes), I did not read each spec end-to-end. The
specs I did **not** read are:

```
release-notes/MVP_DESIGN_SYSTEM_v1.7.md
release-notes/MVP_FIXES_v1.3.md through v1.9.md (7 files)
release-notes/MVP_FIXES_v2.3.md, v2.5.md
release-notes/MVP_v2.0_UNITS_OF_MEASURE.md  (superseded, per CLAUDE.md)
release-notes/MVP_v2.1_STOCK_IN_UNITS.md
release-notes/MVP_v2.2_CUSTOMER_TIERS.md
release-notes/MVP_v2.6_VARIANT_REFACTOR.md
release-notes/MVP_v2.7_VARIANT_UI.md
release-notes/MVP_v2.8.{1,2,3,4}_*.md
release-notes/MVP_v2.8_BATCH_TRACKING.md
```

I also confirmed the following are **not** in the repo and never existed
as standalone specs (each was tracked via ADR + `tasks.md`):

- **v2.4** UI revamp / dark mode (tracked via ADR-0018)
- **v2.6c** profit-bug hardening (tracked via `tasks.md` Stage 1 + Stage 2,
  ADR `2026-05-12-invoice-financials-single-source-of-truth.md` and 5 sibling
  ADRs)
- **v2.8.5** POS batch picker (tracked via `tasks.md` v2.8.5 phase, ADR
  `2026-05-13-pos-batch-picker-ships-as-v285-polish.md`)

If any of the unread spec files contains a non-obvious permission decision
that contradicts what I infer from the DB state, that contradiction will
surface in Phase B and the corresponding spec should be read at that time.
I flag this as a **methodology caveat**, not a defect.

### 0.4 Project ID for follow-up MCP queries

`orfggrnyychmmqdlbfhf` — every query in this audit was run against it.

---

## 1. Current role model summary (the starting point)

### 1.1 Single role, by design

- **PRD §3** defines exactly one role: `shop_owner`. There is no `role`
  column on `profiles`, no roles table, no role enum.
- **PRD §18** "Out of Scope" line: "Role-based access (cashier,
  technician, accountant) — Single-owner is enough for MVP — Earliest
  target: v2."
- The PRD-locked `shops.owner_user_id` carries `unique`, enforcing the
  current 1:1 user-to-shop relationship (PRD §10, verified in
  `list_tables` output: `shops.owner_user_id` is `unique`).
- The `current_shop_id()` SECURITY DEFINER helper is the **single
  authoritative bridge** from `auth.uid()` to a `shop_id`:

  ```sql
  CREATE OR REPLACE FUNCTION public.current_shop_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$ select id from public.shops where owner_user_id = auth.uid() limit 1; $$
  ```

  Every domain-table RLS policy in the system depends on this function.
- Consequence: every authenticated user is, by definition, the owner of
  exactly one shop. There is no scenario today where two users share a
  shop, and there is no scenario where a single user has roles at two
  shops. Both will be true under v2.9.

### 1.2 Authentication layer

- Identities live in `auth.users` (Supabase managed).
- The `on_auth_user_created` trigger on `auth.users` runs
  `public.handle_new_user()` (SECURITY DEFINER) which inserts a
  `profiles` + `subscriptions` row. Confirmed via
  `SELECT FROM pg_trigger WHERE tgname LIKE '%new_user%'`.
- `handle_new_user`'s EXECUTE grant is restricted to `postgres,
  service_role` only (per `pg_proc`, advisor lints, and decisions
  log). Authenticated/anon cannot call it directly. **Good.**

### 1.3 Subscription gating

- Enforced **client-side only** via `<RequireActiveSubscription>` guard,
  per ADR-0006. RLS does **not** check subscription status.
- `expire_subscriptions()` runs daily at 00:05 via pg_cron (confirmed:
  one row in `cron.job` with `schedule = '5 0 * * *'`,
  `command = ' select public.expire_subscriptions(); '`,
  `username = postgres`, `active = true`).
- `subscription_effective` view (security_invoker = true) returns the
  computed status. SELECT on it via `pg_policies` chain is gated by the
  underlying `subscriptions` table's `subscriptions_self_read` policy
  (`user_id = auth.uid()`).

---

## 2. Inventory: tables (24 tables)

All 24 public tables have `relrowsecurity = true` (RLS enabled), and
**none** have `relforcerowsecurity = true` (force-RLS off — owner of the
table is exempt; in Supabase this means `postgres` and the
SECURITY DEFINER context bypass RLS, which is the design intent).

| Table | Rows | RLS | Policies | Sensitive columns under v2.9 |
|---|---|---|---|---|
| `profiles` | 2 | ✓ | 2 (`profiles_self_read`, `profiles_self_update`) | `email`, `preferred_language` |
| `subscriptions` | 2 | ✓ | 1 (`subscriptions_self_read`) | full row (payment dates) |
| `shops` | 2 | ✓ | 2 (`shops_owner_read`, `shops_owner_update`) | `default_expired_sale_policy`, `default_expiry_alert_days`, etc. — shop settings should be owner-only |
| `shop_owner_details` | 2 | ✓ | 2 (`owner_details_read`, `owner_details_update`) | `owner_name`, `owner_phone`, `owner_cnic`, `owner_address` — PII; PCI/CNIC-like |
| `products` | 40 | ✓ | 1 (`products_shop_all`) | `cost`, `avg_cost`, `last_purchase_cost`, `expired_sale_policy` |
| `product_variants` | 64 | ✓ | 2 (read + write, joined through products) | `cost`, `avg_cost`, `last_purchase_cost` |
| `product_categories` | 11 | ✓ | 2 | — |
| `product_packs` | 6 | ✓ | 2 | — |
| `variant_attributes` | 5 | ✓ | 2 | — (shop-wide setting per ADR-0026) |
| `variant_attribute_values` | 11 | ✓ | 2 | — |
| `product_variant_attribute_values` | 42 | ✓ | 2 | — |
| `units_of_measure` | 6 | ✓ | 2 | — |
| `inventory_batches` | 34 | ✓ | 2 (read + write, joined through variant→product) | `cost_per_unit`, `qty_remaining` |
| `suppliers` | 6 | ✓ | 2 | `contact`, `address` |
| `customers` | 7 | ✓ | 1 (`customers_shop_all`) | `outstanding_balance`, `phone`, `address`, `tier_id` |
| `customer_tiers` | 6 | ✓ | 2 | — |
| `invoices` | 64 | ✓ | 1 (`invoices_shop_all`) | `total`, `sale_discount_amount`, `amount_paid` |
| `sale_items` | 66 | ✓ | 1 (`sale_items_shop_all`) | **`cost_at_sale` (v2.9-sensitive)**, `price_at_sale`, `sold_expired` |
| `purchases` | 50 | ✓ | 1 (`purchases_shop_all`) | `total_cost`, `items_subtotal`, `overhead_subtotal` |
| `purchase_items` | 64 | ✓ | 1 (`purchase_items_shop_all`) | **`cost_at_purchase`**, **`avg_cost_before/after`**, `overhead_per_unit`, `line_overhead_amount` |
| `purchase_overhead_items` | 3 | ✓ | 2 | `amount` |
| `ledger_entries` | 37 | ✓ | 2 (`ledger_select_shop`, `ledger_insert_shop` — no UPDATE/DELETE policy) | `amount` (customer-level credit/debit) |
| `expenses` | 1 | ✓ | 1 (`expenses_shop_all`) | `amount`, `category` |
| `monthly_targets` | 0 | ✓ | 1 (`monthly_targets_shop_all`) | `target_*` — shop-level financial targets |

### 2.1 Policy semantics — verified from `pg_policies`

Three distinct policy patterns are in play:

**Pattern A — shop-scoped via `current_shop_id()` (simple form, no
parentheses around the function call):**

Applied to: `customers`, `expenses`, `invoices`, `monthly_targets`,
`products`, `purchases`, `purchase_items` (joined through `purchases`),
`sale_items` (joined through `invoices`).

```sql
USING  (shop_id = current_shop_id())
WITH CHECK (shop_id = current_shop_id())
```

Effect: read + write + delete all gated on `shop_id` matching the caller's
single owned shop. **All four DML verbs collapse into one policy** — there
is no read-vs-write distinction, and there is **no role-level differentiation.**

**Pattern B — shop-scoped via `( SELECT current_shop_id() )` (subquery
form, lets the planner cache the function call):**

Applied to: `customer_tiers`, `product_categories`, `product_packs`
(joined through `products`), `product_variants` (joined through `products`),
`product_variant_attribute_values` (joined through `product_variants`),
`purchase_overhead_items` (joined through `purchases`), `suppliers`,
`units_of_measure`, `variant_attributes`, `variant_attribute_values`
(joined through `variant_attributes`), `inventory_batches` (joined
through `product_variants` → `products`).

These were added in v1.8 hardening (per ADR-0015) and later migrations;
the subquery form is a planner optimization. The two patterns are
semantically identical — both gate on shop ownership and nothing else.

**Pattern C — self-scoped via `auth.uid()`:**

Applied to: `profiles` (`id = auth.uid()`), `shops` (`owner_user_id = auth.uid()`),
`subscriptions` (`user_id = auth.uid()`).

These look identity-bound but in the v2.9 world they're shop-ownership-bound
because `auth.uid() = profiles.id = shops.owner_user_id` is a 1:1:1 chain
today. **Under v2.9 this chain breaks** — see Finding F-H-01.

**Pattern D — split read/write (only on `ledger_entries`):**

```sql
CREATE POLICY ledger_select_shop ON ledger_entries FOR SELECT
  USING (shop_id = current_shop_id());
CREATE POLICY ledger_insert_shop ON ledger_entries FOR INSERT
  WITH CHECK (shop_id = current_shop_id());
-- No UPDATE/DELETE policy ⇒ both verbs are denied by default.
```

This is the v1.6 hardening pattern documented in ADR-0011 — `ledger_entries`
is append-only at the policy layer, doubled-up by the
`ledger_entries_no_modify` trigger (function `ledger_entries_immutable`,
SECURITY INVOKER). Append-only enforcement is intentional and locked.

### 2.2 Sensitive-column inventory (cost / profit / margin)

These columns must be considered when designing column-level vs. view-level
gating in v2.9:

**On base tables (writable):**

- `products.cost` (deprecated post-v2.6 per ADR-0024 — still present)
- `products.avg_cost`, `products.last_purchase_cost` (deprecated post-v2.6)
- `product_variants.cost`, `product_variants.avg_cost`,
  `product_variants.last_purchase_cost` (authoritative post-v2.6)
- `purchase_items.cost_at_purchase`, `purchase_items.avg_cost_before`,
  `purchase_items.avg_cost_after`, `purchase_items.overhead_per_unit`,
  `purchase_items.line_overhead_amount`
- `sale_items.cost_at_sale` (the per-sale cost snapshot; reveals margin
  when joined with `price_at_sale`)
- `inventory_batches.cost_per_unit`
- `purchases.total_cost`, `purchases.items_subtotal`,
  `purchases.overhead_subtotal`
- `purchase_overhead_items.amount`

**On derived views (computed from the above):**

- `invoice_financials.total_cost`, `.gross_profit`, `.gross_margin_percent`
- `sale_item_financials.line_cost`, `.line_profit`, `.line_value`,
  `.line_revenue`, `.allocated_sale_discount`
- `purchase_item_financials.line_subtotal`, `.line_overhead`,
  `.line_total`, `.cost_delta`
- `monthly_summary.gross_profit`
- `product_with_default_variant.cost`, `.avg_cost`, `.last_purchase_cost`
- `product_variant_full.cost`, `.avg_cost`, `.last_purchase_cost`
- `product_stock_display` — does **not** include cost; safe for salesperson
- `daily_sales_7.total_sales` — revenue only, no cost; ambiguous (the
  number itself isn't cost-derived but absolute revenue at shop level
  exposes business size)
- `daily_sales_today.total_sales`, `.cash_sales`, `.credit_sales` — same
- `batches_already_expired`, `batches_expiring_soon`,
  `batches_warranty_expiring_soon` — no cost columns; safe

**Soft-sensitive (revenue but not cost):**

- `invoices.total`, `invoices.service_charge`, `invoices.amount_paid`,
  `invoices.sale_discount_amount`
- `sale_items.price_at_sale`, `sale_items.line_discount_amount`
- `customers.outstanding_balance`
- `customer_outstanding.outstanding`
- `total_outstanding.total`
- `ledger_entries.amount`

The user's prompt B.2.2 already locks the visibility rule: managers see
margin percent (when enabled) but not absolute cost; salespeople see
nothing cost-related. Revenue / outstanding visibility for salespeople
is a Phase B decision point (see decision list).

---

## 3. Inventory: SECURITY DEFINER functions

Per `pg_proc` filtered to `public` schema: **55 functions total** — **51
SECURITY DEFINER** and **4 SECURITY INVOKER**. (Of the 51 DEFINER, 45 are
EXECUTE-grantable to `authenticated`, which is why the advisor lint
`authenticated_security_definer_function_executable` fires 45 times.)

Every SECURITY DEFINER function has `search_path` pinned to
`public[, extensions, pg_catalog]` per ADR-0015 (v1.8 db hardening).

> **Audit revision 2026-05-13 (post-Phase-A intro):** the original §3
> opening counted "51 total / 45 DEFINER" — that conflated the
> DEFINER-callable-by-authenticated subset (45) with the DEFINER total
> (51). The corrected figure is now reflected throughout §3.1 and §3.2.
> The §3.2 inventory now also covers `batch_immutable_fields` and
> `batch_auto_deactivate_when_empty`, which are DEFINER + grantable to
> `authenticated` even though they're trigger-only. They were
> previously misclassified in §3.4 as restricted.

### 3.1 EXECUTE grant pattern

Three grant patterns are observed:

| Pattern | Grantees | Function count | Examples |
|---|---|---|---|
| **Permissive** (callable as an RPC) | `postgres, authenticated, service_role` | 45 | All client-callable RPCs: `record_sale`, `record_purchase`, `complete_onboarding`, `receive_payment`, `reverse_ledger_entry`, the 12 `create_*` / `update_*` / `deactivate_*` RPCs, the `search_*` / `recent_*` / `list_*` read RPCs, `preflight_expired_sale_check`, `record_partial_writeoff`, `suggest_batch_no`, `deactivate_batch`, `deactivate_pack`, `current_shop_id`. Also (anomalously, see F-M-25) the two batch trigger functions `batch_immutable_fields` + `batch_auto_deactivate_when_empty`. |
| **Restricted** (internal-only) | `postgres, service_role` only | 6 DEFINER + 4 INVOKER = 10 | DEFINER trigger / cron functions: `enforce_variant_default_invariants`, `expire_subscriptions`, `handle_new_user`, `ledger_entries_update_balance`, `products_normalize_trigger`, `sync_product_id_from_variant`. INVOKER helpers: `financial_records_immutable`, `ledger_entries_immutable`, `normalize_product_text`, `touch_updated_at`. |
| Default (implicit) | inherited | 0 | None observed; v1.8 explicitly revoked from public and from anon (ADR-0015) |

### 3.2 SECURITY DEFINER inventory + per-function v2.9 guard requirement

Verbatim arg signatures from `pg_proc`. The "v2.9 needed role gate"
column is my recommendation; the final permission matrix is a Phase B
decision (B.1.2 decision points). "Manager+" means owner or manager.

| Function | Args | Returns | v2.9 needed gate | Notes |
|---|---|---|---|---|
| `current_shop_id()` | — | `uuid` | **Replace** with `current_user_shops()` returning `setof uuid` (multi-shop user) **and** keep this for v2.6-era code-paths during migration | Foundation function. Returns 1 shop in current model; v2.9 user may have many. |
| `complete_onboarding(...)` | `p_shop_name`, `p_shop_address`, `p_shop_phone`, `p_shop_type`, `p_owner_name`, `p_owner_phone`, `p_owner_cnic`, `p_owner_address` | `uuid` | Any authenticated. **Must** insert owner-role row into `user_shop_roles`. | Inserts `shops`, `shop_owner_details`, `units_of_measure (each)`, flips `profiles.onboarding_completed`. |
| `record_sale(p_customer_id, p_amount_paid, p_service_charge, p_notes, p_items, p_sale_discount_type, p_sale_discount_value, p_confirm_expired_sale)` | — | `uuid` | Salesperson+ (anyone in shop) | Today: `if v_shop_id is null then raise 'no_shop_for_user'`. Future: also check the cart's `shop_id` matches the caller's resolved shop *and* discount limit overrides. |
| `record_purchase(p_supplier_id, p_purchase_date, p_note, p_items, p_overhead_items, p_is_opening)` | — | `uuid` | **Manager+** | Mutates stock, avg_cost, batch state. Salesperson should not be able to do stock-in. |
| `receive_payment(p_customer_id, p_amount, p_notes)` | — | `uuid` | Manager+ (decision point — see B.1.2) | Customer-level credit. Recording an overpayment that never happened could let a dishonest salesperson hide cash they pocketed. |
| `reverse_ledger_entry(p_entry_id, p_notes)` | — | `uuid` | Manager+ | Reverses non-sale-tied ledger entries. Sale-tied debits are blocked at the function level. |
| `deactivate_batch(p_batch_id, p_reason)` | — | `void` | Manager+ | Write-off. Touches stock. |
| `record_partial_writeoff(p_batch_id, p_qty, p_reason)` | — | `void` | Manager+ | Partial write-off; touches stock. |
| `deactivate_pack(p_pack_id)` | — | `void` | Manager+ | Soft-delete a pack definition. |
| `deactivate_tier(p_tier_id)` | — | `integer` | Owner-only (decision point) | Soft-deletes a customer-tier definition; affects all customers in that tier. |
| `set_default_tier(p_tier_id)` | — | `void` | Owner-only (decision point) | Changes the shop's default tier. |
| `define_tier(p_name, p_is_default, p_notes)` | — | `uuid` | Owner-only (decision point) | Creates a tier. |
| `update_tier(p_tier_id, p_name, p_is_default, p_notes)` | — | `void` | Owner-only (decision point) | Edits a tier. |
| `create_supplier_inline(p_name, p_contact, p_address, p_notes)` | — | `uuid` | Manager+ | Suppliers are created from the purchase flow today (manager+ would already be the only caller path). |
| `create_category_inline(p_name)` | — | `uuid` | Manager+ | Created from product form (today). |
| `update_category(p_id, p_name, p_is_active)` | — | `void` | Manager+ | Includes is_active flip (soft-delete). |
| `create_variant_attribute(p_name, p_display_order)` | — | `uuid` | Owner-only (decision point — shop-wide pool per ADR-0026) | Shop-wide attribute pool. |
| `update_variant_attribute(p_id, p_name, p_display_order, p_is_active)` | — | `void` | Owner-only | Same as above. |
| `deactivate_variant_attribute(p_id)` | — | `void` | Owner-only | Same. |
| `add_variant_value(p_attribute_id, p_value, p_display_order)` | — | `uuid` | Owner-only (decision point) | Adds a value to shop-wide attribute. |
| `update_variant_value(p_id, p_value, p_display_order, p_is_active)` | — | `void` | Owner-only | Same. |
| `deactivate_variant_value(p_id)` | — | `void` | Owner-only | Same. |
| `add_variant_to_product(p_product_id, p_attribute_value_ids, p_sku, p_price, p_opening_stock, p_opening_cost)` | — | `uuid` | Manager+ | Adds a new variant under an existing product. |
| `create_product_with_opening_stock(p_name, p_category_id, p_price, p_opening_stock, p_opening_cost, p_is_scan_only, p_base_unit_code, p_description, p_has_batches, p_expiry_alert_days, p_warranty_alert_days)` | — | `TABLE(product_id, variant_id)` | Manager+ | Creates a product. |
| `create_product_with_variants(p_name, p_category_id, p_default_price, p_is_scan_only, p_base_unit_code, p_attribute_ids, p_variants, p_description, p_has_batches, p_expiry_alert_days, p_warranty_alert_days)` | — | `TABLE(product_id, variant_ids)` | Manager+ | Creates a product with variants. |
| `define_pack_inline(p_product_id, p_unit_code, p_unit_name, p_base_qty, p_is_default_purchase)` | — | `uuid` | Manager+ | Defines a pack. |
| `update_pack(p_pack_id, p_base_qty, p_is_default_purchase)` | — | `void` | Manager+ | Edits a pack. |
| `suggest_batch_no(p_variant_id, p_received_at)` | — | `text` | Salesperson+ (read-shaped) | Just generates a string; called from the stock-in form which manager+ owns, but no harm in salesperson access. |
| `preflight_expired_sale_check(p_items)` | — | `TABLE(variant_id, would_draw_expired, expired_batch_ids, policy)` | Salesperson+ (POS path) | Called from POS before `record_sale`. |
| `search_products(p_query, p_limit, p_offset, p_only_in_stock, p_category_id, p_needs_pricing)` | — | `TABLE(... has_batches, default_variant_id ...)` | Salesperson+ (POS + admin) | **Returns `avg_cost` and `last_purchase_cost` in the TABLE.** v2.9 will need a salesperson-safe variant that omits cost columns, OR a column-mask before send. See F-H-04. |
| `search_products_count(...)` | — | `bigint` | Salesperson+ | Counts; no cost data. |
| `search_categories(p_query, p_limit, p_offset)` | — | `TABLE` | Salesperson+ | Read-shaped. |
| `search_suppliers(p_query, p_limit, p_offset)` | — | `TABLE` | Manager+ (decision point — does salesperson need supplier visibility?) | Returns contact info. |
| `search_variant_attributes(p_query)` | — | `TABLE` | Salesperson+ (POS needs to render variant labels) | Read-shaped. |
| `list_attribute_values(p_attribute_id)` | — | `TABLE(id, value, display_order)` | Salesperson+ (POS) | Read-shaped. |
| `search_purchases(p_from, p_to, p_supplier_id, p_include_opening, p_limit, p_offset)` | — | `TABLE` | Manager+ | Reveals supplier identity + line costs. |
| `search_purchases_count(...)` | — | `bigint` | Manager+ | Same scope. |
| `recent_purchase_products(p_limit)` | — | `TABLE(... avg_cost ...)` | Manager+ | Returns avg_cost — cost-bearing. |
| `recent_suppliers(p_limit)` | — | `TABLE` | Manager+ | Supplier identity. |
| `recent_customers(p_limit)` | — | `TABLE` | Salesperson+ (POS) | Customer name/phone for POS lookup. |
| `list_customers(p_query, p_limit, p_offset)` | — | `TABLE(... outstanding ...)` | Manager+ if outstanding visible; salesperson+ if "name + phone only" view exists | Decision point: salesperson customer visibility scope. |
| `search_khata_customers(p_query, p_status, p_limit, p_offset)` | — | `TABLE` | Manager+ | Khata is debt-tracking; salesperson access is a decision point. |
| `search_khata_customers_count(...)` | — | `bigint` | Manager+ | Same. |
| `batch_immutable_fields()` | — | `trigger` | **Not callable as RPC** (trigger-only) — but EXECUTE grant on `authenticated` is anomalous; see F-M-25. | Used by `inventory_batches_immutable` trigger. Calling it directly fails (no `NEW`). |
| `batch_auto_deactivate_when_empty()` | — | `trigger` | Same as above. | Used by `inventory_batches_auto_deactivate` trigger. |

**Total in §3.2 above: 45 — matches the advisor's count of
`authenticated_security_definer_function_executable` warnings.**

### 3.3 SECURITY INVOKER functions

Four functions are SECURITY INVOKER (`prosecdef = false`). All four are
trigger functions; they run with the privileges of the row-mutator,
which is fine because they only `raise exception` (the immutability
triggers) or compute (`touch_updated_at`). EXECUTE grants are restricted
to `postgres, service_role` only.

- `financial_records_immutable()` — used by `invoices_no_modify`,
  `purchase_items_no_modify`, `purchases_no_modify`,
  `sale_items_no_modify`, `purchase_overhead_items.overhead_no_modify`.
  Raises on UPDATE / DELETE.
- `ledger_entries_immutable()` — used by `ledger_entries_no_modify`.
  Raises on UPDATE / DELETE.
- `normalize_product_text(text)` — immutable text normalization.
- `touch_updated_at()` — generic `updated_at` updater on UPDATE.

**No v2.9 changes needed for these.** They have no role-sensitive logic.

### 3.4 SECURITY DEFINER trigger / cron functions (restricted to postgres + service_role)

These are SECURITY DEFINER but used only via triggers or pg_cron, not
callable as RPCs by `authenticated`. EXECUTE grants exclude
`authenticated`. **6 functions total.**

- `handle_new_user()` — trigger on `auth.users` insert. Inserts `profiles`
  + `subscriptions`. v2.9 needs to ensure this trigger does **not**
  automatically create a `user_shop_roles` row (because new auth users
  may be invited employees, not new owners — the `complete_onboarding`
  flow is the owner-row creator).
- `enforce_variant_default_invariants()` — trigger on `product_variants`.
  Blocks setting `is_default = true` on a multi-variant product.
- `sync_product_id_from_variant()` — trigger on `product_packs`,
  `purchase_items`, `sale_items`. Auto-syncs the deprecated `product_id`
  column from `variant_id` (ADR-0024 deprecate-without-drop).
- `ledger_entries_update_balance()` — trigger on `ledger_entries` AFTER
  INSERT. Maintains `customers.outstanding_balance`.
- `products_normalize_trigger()` — trigger on `products` BEFORE
  INSERT/UPDATE. Lowercases / trims `name`, `type`, `description`.
- `expire_subscriptions()` — pg_cron daily. SECURITY DEFINER so it can
  bypass RLS to update all expired rows.

**Anomalously also DEFINER but grantable to authenticated** (covered in
§3.2): `batch_immutable_fields`, `batch_auto_deactivate_when_empty`. The
grant is unnecessary; calling them directly fails because trigger
functions reference `NEW`/`OLD`. Tightening to `postgres, service_role`
is recommended — see Finding F-M-25.

---

## 4. Inventory: views (18 views)

All 18 views have `reloptions = ['security_invoker=true']`, per ADR-0015
v1.8 hardening. This means each view runs with the **caller's** privileges
and the underlying-table RLS applies. **No view bypasses RLS today.**

The advisor lint `security_definer_view` does **not** fire on any view —
confirming compliance.

For each view, I list (a) what it joins, (b) which underlying-table RLS
it inherits, and (c) the v2.9 risk profile (cost leakage / safe / shop-scoped).

| View | Joins | RLS inherited from | v2.9 risk |
|---|---|---|---|
| `subscription_effective` | `subscriptions` | `subscriptions_self_read` (auth.uid()) | Safe — self-scoped, no cost data. |
| `customer_outstanding` | `customers` ⟕ `ledger_entries` | `customers_shop_all` + `ledger_select_shop` | **Reveals customer-level debt.** Shop-scoped today; under v2.9 the question is whether a salesperson sees all customers' outstanding or only the ones they've sold to. Decision point. |
| `customer_balance_reconciliation` | `customers` ⟕ `ledger_entries` (computed) | same | Operational audit view. Owner-only under v2.9. |
| `total_outstanding` | `customer_outstanding` (filtered by `current_shop_id()`) | inherits | Aggregate; reveals total shop debt. Manager+ likely. |
| `ledger_entries_view` | `ledger_entries` ⟕ `invoices` (+ correlated subqueries for product names + reversal links) | `ledger_select_shop`, `invoices_shop_all`, `sale_items_shop_all`, `products_shop_all` | Manager+ — debt history is operational. |
| `invoice_with_discount_detail` | `invoices` ⟕ `customer_tiers` | `invoices_shop_all` + `tiers_shop_read` | Revenue + discount; no cost. Salesperson can see (revenue view). |
| `invoice_financials` | `invoices` ⟕ `sale_item_financials` | `invoices_shop_all` (and sale_items via the inner view) | **Contains `total_cost`, `gross_profit`, `gross_margin_percent`.** Manager+ ideally; salesperson must not read. This is the canonical profit view (ADR `2026-05-12-invoice-financials-single-source-of-truth.md`). See F-H-05. |
| `sale_item_financials` | `sale_items` ⟕ `invoices` (computes line-level cost / profit / allocated discount) | `sale_items_shop_all` + `invoices_shop_all` | **`line_cost`, `line_profit`, `cost_at_sale`** — manager+. |
| `purchase_item_financials` | `purchase_items` | `purchase_items_shop_all` | **`line_subtotal`, `line_overhead`, `line_total`, `cost_delta`, `cost_at_purchase`** — manager+. |
| `product_with_default_variant` | `products` ⟕ `product_variants` (computes aggregates) | `products_shop_all` + `variants_shop_read` | **`cost`, `avg_cost`, `last_purchase_cost`** — needs a cost-stripped variant for salesperson surfaces (POS, product detail in salesperson view). |
| `product_variant_full` | `products` ⟕ `product_variants` ⟕ `product_variant_attribute_values` | inherits | Same cost-stripping need. |
| `product_stock_display` | `product_variants` ⟕ `products` ⟕ `units_of_measure` ⟕ `product_packs` | inherits | **Safe** — no cost columns. |
| `daily_sales_7` | `invoice_financials` filtered by `current_shop_id()` | inherits + explicit filter | Revenue-only (no cost). Manager+ recommended; absolute daily revenue is a "business size" signal. |
| `daily_sales_today` | `invoices` | `invoices_shop_all` | Revenue-only. Same scope. |
| `monthly_summary` | `invoice_financials` ⟕ `expenses` per (shop, month) | inherits | **Contains `gross_profit`.** Manager+ if margin visible; owner-only if absolute profit. |
| `expenses_by_category_mtd` | `expenses` filtered by `current_shop_id()` | inherits + filter | Manager+ (expense data is operational). |
| `batches_already_expired` | `inventory_batches` ⟕ `product_variants` ⟕ `products` | inherits (batches RLS) | Safe — no cost. |
| `batches_expiring_soon` | `inventory_batches` ⟕ `product_variants` ⟕ `products` ⟕ `shops` | inherits | Safe — no cost. |
| `batches_warranty_expiring_soon` | ditto + `suppliers` | inherits + `suppliers_shop_read` | Safe — no cost. |

### 4.1 Critical: every view-row is filtered by `current_shop_id()`

Either explicitly (`WHERE shop_id = current_shop_id()`) or implicitly (the
underlying-table RLS gates the rows before the view aggregates). Under
v2.9, the `current_shop_id()` function must be replaced by a multi-shop
predicate **or** the user's currently-selected-shop context must be set
via a session variable that the helper reads. This is a foundational
design choice — see Phase B §B.3.

---

## 5. Inventory: triggers

Per `pg_trigger` (excluding internal triggers):

| Table | Trigger | Function | Mode | Purpose |
|---|---|---|---|---|
| `auth.users` | `on_auth_user_created` | `handle_new_user` | DEFINER | Creates `profiles` + `subscriptions` on signup. |
| `customer_tiers` | `customer_tiers_touch` | `touch_updated_at` | INVOKER | timestamp |
| `customers` | `customers_touch` | `touch_updated_at` | INVOKER | timestamp |
| `inventory_batches` | `inventory_batches_auto_deactivate` | `batch_auto_deactivate_when_empty` | DEFINER | flips `is_active = false` on qty→0 (v2.8.2) |
| `inventory_batches` | `inventory_batches_immutable` | `batch_immutable_fields` | DEFINER | blocks mutation of all batch-critical columns (v2.8) |
| `inventory_batches` | `inventory_batches_touch` | `touch_updated_at` | INVOKER | timestamp |
| `invoices` | `invoices_no_modify` | `financial_records_immutable` | INVOKER | append-only |
| `ledger_entries` | `ledger_entries_balance` | `ledger_entries_update_balance` | DEFINER | maintains `customers.outstanding_balance` |
| `ledger_entries` | `ledger_entries_no_modify` | `ledger_entries_immutable` | INVOKER | append-only |
| `product_categories` | `product_categories_touch` | `touch_updated_at` | INVOKER | timestamp |
| `product_packs` | `product_packs_sync_product_id` | `sync_product_id_from_variant` | DEFINER | back-compat product_id sync (ADR-0024) |
| `product_packs` | `product_packs_touch` | `touch_updated_at` | INVOKER | timestamp |
| `product_variants` | `product_variants_touch` | `touch_updated_at` | INVOKER | timestamp |
| `product_variants` | `variants_default_invariant` | `enforce_variant_default_invariants` | DEFINER | blocks setting `is_default=true` on multi-variant products |
| `products` | `products_normalize` | `products_normalize_trigger` | DEFINER | trim/lowercase text fields |
| `purchase_items` | `purchase_items_no_modify` | `financial_records_immutable` | INVOKER | append-only |
| `purchase_items` | `purchase_items_sync_product_id` | `sync_product_id_from_variant` | DEFINER | back-compat |
| `purchase_overhead_items` | `overhead_no_modify` | `financial_records_immutable` | INVOKER | append-only |
| `purchases` | `purchases_no_modify` | `financial_records_immutable` | INVOKER | append-only |
| `sale_items` | `sale_items_no_modify` | `financial_records_immutable` | INVOKER | append-only |
| `sale_items` | `sale_items_sync_product_id` | `sync_product_id_from_variant` | DEFINER | back-compat |
| `suppliers` | `suppliers_touch` | `touch_updated_at` | INVOKER | timestamp |
| `units_of_measure` | `uom_touch` | `touch_updated_at` | INVOKER | timestamp |
| `variant_attribute_values` | `variant_attribute_values_touch` | `touch_updated_at` | INVOKER | timestamp |
| `variant_attributes` | `variant_attributes_touch` | `touch_updated_at` | INVOKER | timestamp |

### 5.1 Trigger-based privilege escalation analysis

A trigger is a privilege concern only if a `raise exception` inside it
could be bypassed, or if its body could be coerced into reading/writing
data a normal user couldn't access. Reviewing:

- `handle_new_user`: runs only on `auth.users` INSERT. Authenticated
  users cannot insert directly into `auth.users`; this is Supabase auth
  hook territory. **No exploit.**
- `batch_immutable_fields`, `enforce_variant_default_invariants`,
  `financial_records_immutable`, `ledger_entries_immutable`: pure
  `raise exception` paths. No reads, no writes. **No exploit.**
- `batch_auto_deactivate_when_empty`: writes to `inventory_batches`
  itself on the row being UPDATEd. **Safe** — the row scope is fixed.
- `ledger_entries_update_balance`: reads/writes `customers.outstanding_balance`
  for the row's `customer_id`. The customer row is shop-scoped by RLS
  but this trigger is DEFINER so RLS is bypassed. Caller must already
  have inserted a row into `ledger_entries` (which is gated by
  `ledger_insert_shop`), so the customer_id is forced to be the caller's
  shop. **Safe.**
- `sync_product_id_from_variant`: reads `product_variants.product_id`
  for the `variant_id` on the new row. **Safe** — variant lookup is
  shop-scoped by the join chain.
- `products_normalize_trigger`: pure text normalization. **Safe.**
- `touch_updated_at`: timestamp only. **Safe.**

**Verdict: no trigger is a privilege-escalation vector today.**

---

## 6. Inventory: table grants (anon, authenticated, service_role)

### 6.1 The Supabase default grant

Critical finding for v2.9 design: **every public.* table has FULL DML
grants for both `anon` and `authenticated`:**

```
DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
```

This is Supabase's default `GRANT ALL ON ALL TABLES IN SCHEMA public TO
anon, authenticated;` boilerplate. The **practical gate is RLS**, not
table grants. This is well-known Supabase behavior and intentional. But
it has three direct v2.9 design consequences:

1. **No column-level grant strategy will help** unless I `REVOKE SELECT
   (cost, avg_cost, ...) FROM authenticated`, which is verbose and
   fragile (must be re-applied after every `CREATE OR REPLACE`).
2. The natural way to hide cost columns from a salesperson is the
   pattern hinted at in the kickoff prompt B.4: **expose a cost-stripped
   view** and have the client query that view rather than the raw table.
   The raw table is still readable via `cost_at_sale`-style columns
   under RLS, so this only works if the salesperson's client doesn't
   know the raw column names — which is a guarantee we cannot make. A
   determined salesperson with devtools can craft `select cost_at_sale
   from sale_items where ...` against PostgREST.
3. **To actually hide cost columns at the DB layer, we need:**
   `REVOKE SELECT (cost_at_sale) FROM authenticated;` after we know the
   user is in salesperson role. But "after we know the role" is
   per-user, not per-grant. The standard PostgreSQL pattern is to
   create separate roles (`authenticated_salesperson`, `authenticated_manager`,
   `authenticated_owner`), but Supabase auth bakes you into the single
   `authenticated` Postgres role. Phase B will need to decide:

   - **Option A:** ship the salesperson cost-stripped view, accept that
     a devtools-savvy user can still query the raw column (mitigated by
     the fact that the v2.9 threat model is "fired salesperson with
     credentials," not "nation-state APT"). The product is for ~30 SMB
     shops in Pakistan; this is a defensible trade-off.
   - **Option B:** column-mask via RLS expressions that conditionally
     `NULL`-out cost columns based on a role check in the policy. This
     is non-standard, requires every cost column to be wrapped in a
     SQL expression, and bloats every query. Not recommended.
   - **Option C:** post-Read column masking in PostgREST via a custom
     header or via Supabase's column-grant feature. Brittle.
   - **Option D:** revoke direct SELECT on `sale_items.cost_at_sale`,
     `purchase_items.cost_*` etc. for `authenticated`, and route all
     reads through SECURITY DEFINER views that check the caller's role
     before returning the cost column. This is the most defensible but
     requires every cost-reading code path to go through the SECURITY
     DEFINER view.

   I recommend **Option A for the salesperson-tier-only protection
   (cost = hidden via UI views with a clear documented threat-model
   boundary), and Option D for the manager-tier-only protection** (the
   manager-sees-margin-but-not-absolute-cost guarantee in B.2.2 needs
   a stronger gate because a manager is a higher-privilege actor and
   the risk if they bypass UI is greater). Decision belongs in Phase B
   §B.4 — surfaced as a decision point.

### 6.2 service_role grants

`service_role` has full grants on everything plus EXECUTE on every
function. This is the Supabase admin role — used for cron jobs and
admin SQL editor. It bypasses RLS entirely (`relforcerowsecurity = false`).
**v2.9 must not assume service_role is invoked anywhere outside the
admin runbook and pg_cron.**

### 6.3 Anonymous role

`anon` has the same DML grants but cannot pass any RLS policy because
every USING expression depends on `auth.uid()` or `current_shop_id()`,
both of which return `NULL` for anonymous callers. **Anon access is
effectively zero today** — confirmed by inspection of every RLS USING
expression (Pattern A/B/C/D in §2.1).

### 6.4 The `revoke from anon` migration history

v1.8 hardening (per ADR-0015) added explicit `revoke ... from public, anon`
on the SECURITY DEFINER RPC functions, then `grant ... to authenticated`.
That's why the RPC EXECUTE grants in §3.1 show `authenticated, service_role`
but not `anon`. This means even though `anon` can theoretically PostgREST
to `/rest/v1/rpc/record_sale`, the EXECUTE check fails at the function
boundary. **This is the v2.9 model template** — the same `revoke ...
from public, anon` pattern should be applied to any new RPC.

---

## 7. Inventory: ambient infrastructure

### 7.1 pg_cron

One cron job:

```
jobname:  expire-subscriptions
schedule: 5 0 * * *   (daily at 00:05 UTC)
command:  select public.expire_subscriptions();
username: postgres
active:   true
```

No other jobs. The user (`postgres`) bypasses RLS. v2.9 doesn't change
this — subscription expiry remains a daily cron.

### 7.2 auth.users trigger

```
trigger:   on_auth_user_created
schema:    auth.users
function:  handle_new_user
prosecdef: true (SECURITY DEFINER)
```

This is the **single point of profile creation**. Under v2.9, the
invitation flow inserts an `auth.users` row via Supabase Admin API; that
row's BEFORE-AFTER triggers this function; the function then needs to
either (a) skip the `subscriptions` insert for invited employees (they
don't get a subscription — they ride their shop's), or (b) accept the
spurious `subscriptions` row and have the v2.9 code never read it for
non-owner users. See B.6 decision.

### 7.3 Extensions

Per `0001_extensions.sql`: `pgcrypto`, `pg_cron`. No additional
security-relevant extensions.

---

## 8. Direct client-side writes (paths that bypass RPCs)

The PRD assumes all stock-mutating writes go through `record_sale` /
`record_purchase` / `receive_payment` etc. (ADR-0007). But the client
also writes a handful of non-stock-mutating tables directly. Verified
via `grep` over `src/**/*.{ts,tsx}`:

| Path | Operation | Gated by today | v2.9 needed gate |
|---|---|---|---|
| `customers/hooks.ts:85` | `supabase.from('customers').insert({...})` | RLS `customers_shop_all` WITH CHECK | Salesperson+ (per B.2.3 — salespeople can create customers with name+phone only). Need to also gate `tier_id` to `null` in this path. |
| `customers/hooks.ts:121` | `supabase.from('customers').update({...})` | RLS `customers_shop_all` USING/WITH CHECK | Manager+ (per B.2.3 — editing existing customers is manager-only) |
| `customers/hooks.ts:148` | `supabase.from('customers').delete()` | RLS `customers_shop_all` USING | Owner-only (decision point — does delete need to exist at all? Soft-delete via `is_active` is the better v2.9 pattern; today there's no `customers.is_active` column so delete is hard-delete) |
| `expenses/hooks.ts:57` | `supabase.from('expenses').insert({...})` | RLS `expenses_shop_all` WITH CHECK | Manager+ |
| `targets/hooks.ts:48` | `supabase.from('monthly_targets').upsert({...})` | RLS `monthly_targets_shop_all` WITH CHECK | Owner-only |
| `products/hooks.ts:242` | `.from('products').update(patch)` | RLS `products_shop_all` USING/WITH CHECK | Manager+ |
| `products/hooks.ts:621/628` | `.from('product_variants').update(...)` (price) | RLS `variants_shop_write` | Manager+ |
| `products/hooks.ts:650/658` | `.update({ is_active })` on products / variants (archive toggle) | RLS | Manager+ |
| `batches/hooks.ts:238/282` | `.from('inventory_batches').update({ notes: ... })` | RLS `batches_shop_write` + the `batch_immutable_fields` trigger lets only `notes` / `is_active` / `qty_remaining` through | Manager+ |
| `suppliers/hooks.ts:129/155` | `.from('suppliers').update({...})` (incl. `is_active`) | RLS `suppliers_shop_write` | Manager+ |
| `LanguageSelector.tsx:31` | `.from('profiles').update({ preferred_language })` | RLS `profiles_self_update` | Any authenticated (already self-scoped to own profile) |

**Direct reads** (`.from('TABLE').select(...)`) are more numerous (24
distinct tables / views read directly by the client). The critical ones
for v2.9 are direct reads of:

- `sale_items` (3 call sites) — exposes `cost_at_sale`
- `purchase_items` (1), `purchase_item_financials` (1), `invoice_financials`
  (1), `sale_item_financials` (1) — cost / profit views
- `purchases` (1) — `total_cost`, `items_subtotal`, `overhead_subtotal`
- `product_variants` (7), `products` (8) — `cost`, `avg_cost`,
  `last_purchase_cost`
- `inventory_batches` (3) — `cost_per_unit`

All of these are gated only by shop-scope RLS today. **v2.9 needs an
additional role gate**, either via:

- View-replacement: route salesperson reads through cost-stripped views,
  keep raw tables for manager+ reads
- Column-restricted views layered on top of the raw tables
- A combination of `REVOKE SELECT (cost_columns) FROM authenticated` for
  salesperson-only sessions (not feasible with a single Postgres role)

This is **F-H-04** — a HIGH severity v2.9 finding (mitigation belongs
in the design, not the audit).

---

## 9. Findings — CRITICAL

> A CRITICAL finding is an actor-with-credentials exploit that exists
> under the **current** model. Under the current single-role model
> (every authenticated user is a shop owner), the question reduces to:
> "can an authenticated user at shop A see / modify data at shop B?"

**No CRITICAL findings.**

I attempted to find one. Specifically:

1. **Can a user fake `current_shop_id()`?** No. The function is `STABLE
   SECURITY DEFINER` and reads `auth.uid()` from the JWT, which is signed
   by Supabase Auth and not user-mutable. The function returns the
   shop_id where `owner_user_id = auth.uid()`. Since `shops.owner_user_id`
   is `unique` and the table's only INSERT path is `complete_onboarding`
   (which itself uses `auth.uid()`), a user cannot become the owner of
   another shop's row.
2. **Can a user bypass RLS via a SECURITY DEFINER function and operate
   on another shop?** Every DEFINER RPC reads `v_shop_id :=
   current_shop_id()` early and uses `v_shop_id` (not user-supplied
   IDs) for ownership comparisons. `record_sale` raises
   `customer_not_in_shop`, `variant_not_in_shop`, `batch_not_in_variant_or_inactive`.
   `record_purchase` raises `supplier_not_in_shop`, `variant_not_in_shop`.
   `receive_payment` raises `customer_not_in_shop`. `reverse_ledger_entry`
   raises `entry_not_in_shop`. **All shop-cross checks are present and
   correct.**
3. **Can a trigger be coerced into operating on another shop's data?**
   See §5.1 — no.
4. **Can a user UPDATE/DELETE a `sale_items` / `ledger_entries` row to
   alter financial history?** No — `financial_records_immutable` and
   `ledger_entries_immutable` triggers raise on UPDATE/DELETE; RLS on
   `ledger_entries` denies UPDATE/DELETE by absence of policy.
5. **Can anon read anything?** No — every RLS USING expression depends
   on a non-null `auth.uid()` / `current_shop_id()`. Confirmed by
   inspecting every policy in `pg_policies`.

If any of the above is wrong, it would be a CRITICAL. None is. The
system's shop-scope RLS perimeter is tight under the single-role model.

### 9.1 Almost-CRITICAL: `suppliers` cross-shop probe via inline create

`create_supplier_inline(p_name, ...)` is SECURITY DEFINER and inserts
into `suppliers (shop_id, ...)` using `current_shop_id()`. **No issue.**
But the v1.9 / ADR-0016 spec adds `(shop_id, lower(trim(name)), lower(trim(contact)))`
unique constraint. A user could attempt to discover whether a supplier
of a given name exists in another shop by attempting to create it in
their own shop (uniqueness is shop-scoped, so this returns success / duplicate
based on their own shop's row, not the other shop). **Not an exploit.**

---

## 10. Findings — HIGH

> A HIGH finding is a defect that becomes exploitable under v2.9 unless
> the design closes it. These are the work items the v2.9 design must
> address.

### F-H-01 — `auth.uid()` ≠ shop ownership under v2.9 (foundational)
**Where:** `current_shop_id()`, `profiles_self_*` RLS, `shops_owner_*`
RLS, `subscriptions_self_read` RLS, all DEFINER RPCs that call
`current_shop_id()` (45 functions).
**What:** Every shop-scope predicate today assumes one user = one shop
via `auth.uid() = shops.owner_user_id`. Under v2.9 a user may have
roles at multiple shops (per B.2.1), so `current_shop_id()` returning
a single row becomes a bug. A `current_shop_id()` call from a
salesperson with access to two shops returns the **first** matching row
(LIMIT 1), which is non-deterministic and may even return NULL if neither
shop's `owner_user_id` matches (because owner_user_id under v2.9 is
"the founding owner," not "any user with role in this shop").
**Severity:** HIGH.
**Where the design must intervene:** every reference to `current_shop_id()`
must be replaced by either (a) a multi-shop-aware helper returning `setof
uuid` (and the RLS expression becomes `shop_id = any (current_user_shop_ids())`),
or (b) a session-variable approach where the client sets the "active
shop" via `set_config('app.shop_id', '<uuid>', true)` and the helper
reads it back with validation. Phase B §B.3.
**Mitigation status today:** none — this is the v2.9 defining change.

### F-H-02 — `record_purchase`, `deactivate_batch`, `record_partial_writeoff` have no role gate
**Where:** the three RPCs above (function bodies confirmed via `pg_get_functiondef`).
**What:** Stock-mutating RPCs that should be manager+ under v2.9. Today
they are callable by any authenticated user with a `current_shop_id()`
match. A v2.9 salesperson with valid credentials could call
`record_purchase` directly via PostgREST `/rest/v1/rpc/record_purchase`
and inflate stock + record a fake supplier purchase. The fake stock
then gets sold through the salesperson's own POS sessions.
**Severity:** HIGH.
**Mitigation status today:** none — every authenticated user is implicitly manager.
**Design closure:** add a role check at the top of each RPC:
`if not user_has_min_role(v_shop_id, 'manager') then raise '...' end if;`.

### F-H-03 — `receive_payment` / `reverse_ledger_entry` have no role gate
**Where:** the two RPCs above.
**What:** Both touch the ledger. A v2.9 salesperson with credentials
could record a fake payment (lying that the customer paid), reducing
the customer's outstanding balance, then pocket the difference. The
overpayment guard inside `receive_payment` prevents *over*-recording,
but does **not** prevent under-recording or recording a payment that
never happened. Decision point in B.1.2: is "receive payment" a
salesperson capability? (My recommendation: NO — manager+ only, because
the fraud surface is high and the manager is rarely far enough away
that this becomes an operational blocker.)
**Severity:** HIGH.

### F-H-04 — `cost_at_sale`, `avg_cost`, `cost_per_unit` readable by all roles
**Where:** Tables `sale_items`, `product_variants`, `inventory_batches`,
`purchase_items`, and the derived financial views
(`invoice_financials`, `sale_item_financials`, `purchase_item_financials`,
`product_with_default_variant`, `product_variant_full`, `monthly_summary`).
**What:** Today, any authenticated user in the shop can read every cost
and profit column directly via PostgREST. Under v2.9 the salesperson
must see no cost data, and the manager must see margin % but not
absolute cost.
**Severity:** HIGH.
**Why not CRITICAL:** because today every user is the owner, so reading
cost is correct.
**Design closure:** the recommendation (per §6.1) is two-tier:
- **Salesperson** — UI-level only. POS and product detail use cost-stripped
  views (`search_products_safe`, `product_with_default_variant_safe`).
  Direct PostgREST queries from a determined salesperson could still
  read the raw column, but the threat model (fired salesperson, not
  APT) does not warrant the operational cost of column-grant gymnastics.
  This is a documented design trade-off (Phase B decision).
- **Manager** — DB-level. Cost-bearing tables get a SECURITY DEFINER
  read view that returns either the raw value or NULL depending on the
  caller's role (`user_can_see_cost_data()`). Direct `SELECT cost_at_sale
  FROM sale_items` requires an explicit `REVOKE SELECT (cost_at_sale,
  avg_cost, cost_per_unit, cost_at_purchase, ...) FROM authenticated`
  paired with the safe view exposing margin-percent only.
**Phase B will need to lock this strategy in §B.4.**

### F-H-05 — `invoice_financials.gross_profit`, `monthly_summary.gross_profit` readable by all roles
**Where:** the two views above, plus `sale_item_financials.line_profit`,
`purchase_item_financials.cost_delta`.
**What:** Same root cause as F-H-04 but the financial views are the
**canonical profit source** post-v2.6c (per ADR
`2026-05-12-invoice-financials-single-source-of-truth.md`). The client
reads from these views via direct `.from()` queries. Hiding these from
salesperson and (selectively) from manager is a foundational v2.9
requirement.
**Severity:** HIGH.
**Design closure:** same as F-H-04. The view-replacement pattern is the
cleanest: ship a `invoice_financials_summary` (revenue + outstanding,
no cost / profit / margin) for salesperson; a
`invoice_financials_with_margin_pct` (revenue + margin %, no absolute
cost / profit) for manager; the existing `invoice_financials` for owner
only.

### F-H-06 — `complete_onboarding` does not assign an owner role
**Where:** `complete_onboarding` function (DEFINER, full body inspected).
**What:** Under v2.9, `complete_onboarding` is the founding act of a
shop. It must atomically also insert a `user_shop_roles (user_id, shop_id,
role)` row with `role = 'owner'`. Today it inserts `shops`,
`shop_owner_details`, `units_of_measure ('each')`, and flips
`profiles.onboarding_completed`. The owner-role insert is the new
v2.9 piece. **The existing `shops.owner_user_id` column** can stay as a
denormalized "founding owner pointer" (per B.2.1) but cannot be the
authority for "who is the owner today" — because owner-role might be
transferable. Decision point.
**Severity:** HIGH.
**Design closure:** Phase B §B.3 and §B.6 (the function rewrite is in §B.2.6 too).

### F-H-07 — `customers` direct-delete from client
**Where:** `src/features/customers/hooks.ts:148`:
`supabase.from('customers').delete().eq('id', id)`.
**What:** RLS `customers_shop_all` allows DELETE today. Under v2.9 we
need to (a) decide whether delete is permitted at all (soft-delete is
the better pattern, and `customers` has no `is_active` column today —
see also the deferred `void_sale` todo in `docs/todos.md`), and (b) gate
it on owner-only or manager+.
**Severity:** HIGH.
**Risk if not closed:** a salesperson terminates a customer's record,
losing the audit trail of who they sold to. Note: `invoices.customer_id`
is nullable in the schema and `ON DELETE` is `NO ACTION` (default; not
verified explicitly but `customer_id` references `customers(id)` with
no cascade in the schema dump). So the actual delete would fail today
if any invoice exists for the customer — but that's incidental
protection, not the intent.

### F-H-08 — `monthly_targets` upsert from client
**Where:** `src/features/targets/hooks.ts:48`:
`supabase.from('monthly_targets').upsert({...})`.
**What:** Monthly targets are owner-only under v2.9 (the user's prompt
implies targets are an owner privilege; salesperson and even manager
should not be able to change them).
**Severity:** HIGH.
**Design closure:** RLS UPDATE/INSERT policy on `monthly_targets` must
require owner role; OR convert to an RPC with owner-role guard.

### F-H-09 — `expenses` insert from client
**Where:** `src/features/expenses/hooks.ts:57`.
**What:** Expenses are operationally a manager+ concern. A salesperson
inserting fake expenses inflates COGS and degrades the owner's view of
the shop. Decision point in B.1.2: is the salesperson allowed to record
"petty cash" expenses? My recommendation: NO — manager+. Petty cash is
recorded by the cashier verbally and entered by the manager at close.
**Severity:** HIGH.

### F-H-10 — `products` / `product_variants` direct update (price, is_active)
**Where:** `src/features/products/hooks.ts:242, 621, 628, 650, 658` and
`src/features/batches/hooks.ts:238, 282` (notes update).
**What:** Catalog mutation. Under v2.9 these are manager+. A salesperson
changing a product's price right before scanning it through their own
POS line is a textbook insider-fraud vector.
**Severity:** HIGH.
**Mitigation today:** none — RLS allows it.

### F-H-11 — `suppliers` direct update from client
**Where:** `src/features/suppliers/hooks.ts:129, 155`.
**What:** Manager+ under v2.9.
**Severity:** HIGH.

### F-H-12 — variant attributes (shop-wide) — every authenticated user can create
**Where:** RPCs `create_variant_attribute`, `update_variant_attribute`,
`deactivate_variant_attribute`, `add_variant_value`, `update_variant_value`,
`deactivate_variant_value`.
**What:** Per ADR-0026 the attribute pool is shop-wide. Editing it affects
every product in the shop. v2.9 should make this owner-only (or manager+
with audit, decision point).
**Severity:** HIGH.

### F-H-13 — customer tiers (shop-wide) — every authenticated user can create / set default
**Where:** RPCs `define_tier`, `update_tier`, `set_default_tier`,
`deactivate_tier`.
**What:** Tiers are now pure categories (no auto-discount, per ADR-0017),
but `set_default_tier` still affects every new customer's defaulting
behavior. Owner-only under v2.9.
**Severity:** HIGH.

### F-H-14 — `product_categories` direct create/edit via inline RPCs
**Where:** RPCs `create_category_inline`, `update_category`.
**What:** Manager+ under v2.9 (category taxonomy is an operational
configuration).
**Severity:** HIGH.

### F-H-15 — `units_of_measure` — no RPC, table grants only; INSERT/UPDATE/DELETE allowed via RLS
**Where:** `units_of_measure` RLS policies `uom_shop_read`, `uom_shop_write`
(write is FOR ALL). The client doesn't write this table today (no `.from('units_of_measure').{insert,update,delete}` in src/), but the policy allows it.
**What:** Owner-only under v2.9 (UoM definitions are foundational and
errors propagate to every variant of every product).
**Severity:** HIGH (degraded to MEDIUM if we accept that the lack of UI
makes this practically un-exploitable, but a determined actor with API
access could still POST to `/rest/v1/units_of_measure`).

### F-H-16 — `shop_owner_details` update allowed for anyone in shop
**Where:** RLS `owner_details_update` USING `(shop_id = current_shop_id())`.
**What:** Today only the owner can access the shop, so the policy reduces
to "owner can update own owner details." Under v2.9 this opens to every
role. Owner details include `owner_cnic` (CNIC = PK national ID;
sensitive PII). Manager / salesperson should not be able to edit, and
**probably should not be able to read** either — decision point.
**Severity:** HIGH.

### F-H-17 — `subscriptions` is `user_id = auth.uid()` — invited employees would see only their (non-existent) subscription
**Where:** `subscriptions_self_read` USING `(user_id = auth.uid())`.
**What:** Today, every user has their own subscription. Under v2.9, an
invited employee does not have a subscription row (the shop's owner
does). The current view returns zero rows for the employee, which means
`useEffectiveSubscription` returns undefined, which today's
`<RequireActiveSubscription>` guard interprets as "expired/suspended"
(it falls into the `!sub || sub.effective_status === 'expired'` branch
in `src/lib/guards.tsx` per CLAUDE.md). The employee gets bounced to
`/subscription/expired` — wrong.
**Severity:** HIGH.
**Mitigation today:** N/A.
**Design closure:** the subscription guard for an employee must check
**the shop owner's** subscription, not the user's own. This means
`useEffectiveSubscription` reads the shop's owner's effective_status,
which requires either (a) a new view `shop_effective_subscription(shop_id)`
joining `shops.owner_user_id → subscriptions.user_id`, or (b) a SECURITY
DEFINER helper returning the owner's status for `current_active_shop()`.
**Edge case:** if the founding owner is suspended, all employees lose
access. This is correct.

### F-H-18 — `handle_new_user` always creates a `subscriptions` row
**Where:** function body inspected.
**What:** Under v2.9, invited employees should not get a subscription
(it makes the per-user-subscription model leaky and confuses the admin
runbook). Decision: either (a) leave the spurious row (harmless,
admin runbook ignores rows where `user_id` is not a shop owner), or
(b) make `handle_new_user` aware of pending-invitation context (read
`auth.users.raw_user_meta_data` for an `invitation_id`, skip the
subscription insert in that case).
**Severity:** HIGH (will be MEDIUM if we accept option (a)).

### F-H-19 — Audit trail does not include `created_by` on most tables
**Where:** `invoices.cashier_id`, `purchases.cashier_id`,
`expenses.created_by` are the only `*_by` columns today. Missing on:
`products` (no created_by), `product_variants`, `customers`,
`customer_tiers`, `variant_attributes`, `suppliers`, `monthly_targets`,
`product_categories`, `product_packs`, `inventory_batches` (writes are
all triggered by `record_purchase` or `record_partial_writeoff`, but
the trigger doesn't snapshot the caller).
**What:** Per B.2.5 the v2.9 contract is: "every mutating RPC records
`created_by` / `updated_by`." Today's coverage is partial and
inconsistent. Manager+ accountability requires this; without it, a
manager-level actor's actions are not attributable.
**Severity:** HIGH.
**Design closure:** add `created_by uuid references profiles(id)` to
tables that don't have it, snapshot `auth.uid()` in every DEFINER RPC,
and update views to surface it.

### F-H-20 — No `void_sale` exists; the only way to undo a sale is admin SQL
**Where:** `docs/todos.md` line confirms `void_sale` is deferred.
**What:** Under v2.9, a manager voiding a sale needs an authorized,
audited code path. Today there is none — admins reach into SQL
(documented in ADR-0010). For v2.9 this either stays as "admin only,
no in-app affordance" (status quo) or ships a `void_sale` RPC with
manager-only role gate. Decision point.
**Severity:** HIGH (because of the "manager can void a sale" decision
in the kickoff prompt B.1.2 list).

### F-H-21 — Discount-limit enforcement is entirely UI-side today
**Where:** `record_sale` accepts any `p_sale_discount_value` and
`line_discount_value` up to the line subtotal / 100% / items_subtotal.
**What:** Per B.2.4, v2.9 adds per-role default discount limits with
per-user overrides. Today there is no enforcement — a determined
salesperson could call `record_sale` directly with a 99% discount and
the RPC would accept it (assuming stock is sufficient).
**Severity:** HIGH.
**Design closure:** `record_sale` reads the caller's discount-limit
override (from `user_shop_roles.discount_limits` jsonb) or the shop
default (from `shops.default_discount_limits` jsonb) and raises
`discount_exceeds_role_limit` if exceeded.

### F-H-22 — `shops` settings (default_expired_sale_policy, default_*_alert_days, expired_sale_receipt_disclaimer) are editable by anyone in the shop
**Where:** RLS `shops_owner_update` USING `(owner_user_id = auth.uid())`.
**What:** Today, the RLS already restricts UPDATE to the founding
owner — but under v2.9 the predicate breaks (see F-H-01). The fix
falls out of F-H-01: when the helper is updated to multi-shop and
role-aware, `shops_owner_update` becomes `shop_id IN (select shop_id
from user_shop_roles where user_id = auth.uid() and role = 'owner')`.
**Severity:** HIGH (chained to F-H-01).

### F-H-23 — Profiles row exposes `preferred_language` cross-shop?
**Where:** `profiles_self_read` USING `(id = auth.uid())`.
**What:** This is a self-only policy — fine for a user reading their
own preferences. But if v2.9 introduces team / employee listing
("show me everyone with access to this shop"), the owner needs to see
**other users' names / emails**, which means a separate policy that
allows owners to read profiles of their own employees. Decision: add
a second policy `profiles_team_read` that allows `id IN (select user_id
from user_shop_roles where shop_id IN (select shop_id from user_shop_roles
where user_id = auth.uid() and role = 'owner'))`.
**Severity:** HIGH (because team listing is a v2.9 feature).

### F-H-24 — Cross-shop ledger entries via owner of multiple shops
**Where:** `ledger_entries.shop_id` — a user with owner role at two
shops would have `current_shop_id()` returning a non-deterministic
single shop. If they make a ledger insert with `shop_id = shop_A` but
they're "currently looking at" shop_B's customer, the WITH CHECK on
`ledger_insert_shop` (`shop_id = current_shop_id()`) might block them.
This is F-H-01 chained.
**Severity:** HIGH (chained).

### F-H-25 — No `pending_invitations` table exists
**Where:** New entity for v2.9.
**What:** Pre-design: define the schema, RLS, lifecycle. Decision points
in B.6 (expiration window, re-use, mistyped-email mitigation).
**Severity:** HIGH (work item).

### F-H-26 — `auth.users` invitation flow not wired
**Where:** Supabase Auth `auth.admin.inviteUserByEmail` is not called
today (no signup-by-invitation code in src/). Need a serverless
function or RPC that calls the Admin API and persists the
`pending_invitations` row atomically.
**Severity:** HIGH (work item).

### F-H-27 — Subscription guard breakdown for invited users (depends on F-H-17)
Covered by F-H-17.

### F-H-28 — `RequireActiveSubscription` exemptions list
**Where:** Per CLAUDE.md: `/settings` and `/settings/support` are not
wrapped in `RequireActiveSubscription`. Under v2.9, a new `/settings/team`
route (invitation management) lands. Decision: does team management
require active sub? Recommendation: YES — only the owner can manage
team, only when the shop is active.
**Severity:** HIGH (decision point).

### F-H-29 — `customers.tier_id` write permission
**Where:** `customers_shop_all` allows updating any column.
**What:** Per B.2.3 tier changes are manager+ only. A salesperson
shouldn't be able to upgrade a customer to a higher tier (and tier may
correlate with discount eligibility once tiers are reactivated as
discount sources in a future PRD).
**Severity:** HIGH.

### F-H-30 — No way to remove a user from a shop today
**Where:** `user_shop_roles` does not exist. The current shop owner is
`shops.owner_user_id` and there's no concept of "removing access."
**What:** Required v2.9 workflow: owner can revoke an employee's role.
The corresponding `auth.users` row is **not** deleted (Supabase Auth
considers that destructive); the `user_shop_roles` row is.
**Severity:** HIGH (work item).

---

## 11. Findings — MEDIUM

### F-M-01 — `current_shop_id()` returning NULL is silently treated as "no access"
**Where:** Every DEFINER RPC pattern: `if v_shop_id is null then raise
'no_shop_for_user'`.
**What:** NULL means "the user has no shops." Under v2.9 this is also
the case after a user has been removed from their last shop. The error
message `no_shop_for_user` is fine, but the client should surface this
distinctively (vs. an unauthenticated state, which raises `not_authenticated`).
Today the client treats both as a generic Supabase error.
**Severity:** MEDIUM.

### F-M-02 — `revoke from public` does not revoke from `anon` in Supabase
**Where:** General pattern documented in `docs/gotchas.md` and per
ADR-0015. Already accounted for in current migrations (every new RPC
uses `revoke from public, anon; grant to authenticated`).
**Severity:** MEDIUM (informational — already mitigated; flagged so the
v2.9 migrations replicate the pattern verbatim).

### F-M-03 — `cashier_id` on invoices and purchases is the actor identity, but not the role
**Where:** `invoices.cashier_id`, `purchases.cashier_id`.
**What:** Today the cashier is always the owner. Under v2.9 we need to
preserve a snapshot of the **role at the time of the sale** — otherwise
a salesperson who is later promoted to manager will retroactively appear
as a manager-recorded sale. Decision point: snapshot role on the row
(adds `cashier_role text` to `invoices`) or accept that role is dynamic
and rely on `user_shop_roles` history (which doesn't exist as a history
table today).
**Severity:** MEDIUM.

### F-M-04 — Append-only triggers will block backfill UPDATEs
**Where:** `financial_records_immutable`, `ledger_entries_immutable`.
**What:** Per `docs/gotchas.md`: "ALTER TABLE … DISABLE TRIGGER → UPDATE
→ ENABLE TRIGGER" is the only path. Any v2.9 backfill on `invoices` /
`sale_items` / `purchases` / `purchase_items` / `purchase_overhead_items`
/ `ledger_entries` needs this dance. Not a defect — but a v2.9
implementation gotcha.
**Severity:** MEDIUM.

### F-M-05 — `complete_onboarding` inserts a `units_of_measure ('each')` row
**Where:** Function body inspected.
**What:** Per spec it should — this is the seed UoM. But the v2.9
question is whether the owner can rename / deactivate `'each'`. RLS
allows it; the v2.9 design should add an "is_system" flag or block
deactivation of base units. Not a v2.9-introduced bug.
**Severity:** MEDIUM (existing surface).

### F-M-06 — `subscriptions` has no RLS UPDATE/DELETE policy
**Where:** `subscriptions` has only `subscriptions_self_read`. No
UPDATE/INSERT/DELETE policy at all.
**What:** This is by design — only admins (via service_role) can
modify subscriptions. Confirmed by ADR-0010 + ADR-0011. Mention is
informational; do not "fix" this in v2.9.
**Severity:** INFORMATIONAL (preserved here as MEDIUM only because
breaking it would re-open the subscription-bypass attack from ADR-0006).

### F-M-07 — `record_sale` allows `p_sale_discount_type = 'percent'` with `p_sale_discount_value = 100` (free items)
**Where:** function body — the validation is `value < 0 or value > 100`.
**What:** A 100% sale discount means free items. Acceptable for charity /
giveaways but a fraud surface for any role. Decision point: cap
salesperson at < X% (per B.2.4) and the manager at < Y%. Owner can do
100% only with an audit note (decision point).
**Severity:** MEDIUM.

### F-M-08 — `record_sale` accepts items with `price_at_sale = 0` (free items)
**Where:** function body — `if v_price is null or v_price < 0 then
raise exception 'price must be non-negative';` allows 0.
**What:** Free-item ringup. Same fraud surface as F-M-07. Today the
v2.6c hardening keeps `cost_at_sale` snapshotted from `variant.avg_cost`,
so the line still bears cost but no revenue → 100% loss on the line.
v2.9 might add per-role "max discount %" applied to line discount and
also to "min price as % of variant.price."
**Severity:** MEDIUM.

### F-M-09 — `record_sale` does not snapshot `cashier_role`
Same as F-M-03.

### F-M-10 — `customers.outstanding_balance` is a stored column (denormalized)
**Where:** `customers.outstanding_balance`, maintained by trigger
`ledger_entries_update_balance` (DEFINER).
**What:** Already verified in `customer_balance_reconciliation` view
that drift = 0. Just noting that v2.9 design should not duplicate the
debt write path.
**Severity:** INFORMATIONAL (here as MEDIUM only to flag for the
implementation phase).

### F-M-11 — Search functions (`search_products`, `search_khata_customers`, `search_purchases`) leak via the returned columns
**Where:** RPCs.
**What:** `search_products` returns `avg_cost`, `last_purchase_cost`,
`min_price`, `max_price` — cost data. `search_purchases` returns
`items_subtotal`, `overhead_subtotal`, `total_cost` — cost data.
**Severity:** MEDIUM (these RPCs are read-shaped but cost-bearing; v2.9
will need salesperson-safe variants or in-function column-masking).

### F-M-12 — `complete_onboarding` is callable by any authenticated user
**Where:** EXECUTE grants `authenticated, service_role`.
**What:** A user who already owns a shop calling `complete_onboarding`
again would fail on the `shops.owner_user_id` unique constraint —
**incidental protection.** The PRD assumes single-shop-per-user; under
v2.9 the model is still "one shop per onboarding" (you can be invited
into others, but you start by creating one shop). Decision: should the
function explicitly reject re-onboarding? Recommendation: yes, raise
`already_owner` if `auth.uid()` already has an owner row in
`user_shop_roles`.
**Severity:** MEDIUM.

### F-M-13 — RLS subquery vs. function-call patterns are inconsistent
**Where:** see §2.1 Pattern A vs. Pattern B.
**What:** Inconsistency is cosmetic but a v2.9 migration should
normalize to the subquery form (planner-friendly per Supabase docs).
**Severity:** MEDIUM (cleanup).

### F-M-14 — `ledger_entries.paid_at` is deprecated but still present
**Where:** Schema dump: `paid_at` exists on `ledger_entries`.
**What:** Per PRD §10 it's "legacy from v1.2; deprecated, do not write
from new code." `record_sale` and `receive_payment` do write it from
new code (latter sets `paid_at = now()` for credits). Cleanup item.
**Severity:** MEDIUM (informational).

### F-M-15 — Some functions still set `search_path = public` (not `public, pg_catalog`)
**Where:** `current_shop_id`, `complete_onboarding`, `expire_subscriptions`,
`handle_new_user`, `receive_payment`, `reverse_ledger_entry`,
`ledger_entries_update_balance`, `set_default_tier`, `define_tier`,
`update_tier`, `deactivate_tier`, `create_supplier_inline`.
**What:** Best practice is `search_path = public, pg_catalog` to prevent
spoofing of standard built-ins. Most newer functions follow the latter;
the older v1-era functions still use `public`. Minor hardening.
**Severity:** MEDIUM.

### F-M-16 — `record_sale` and `record_purchase` do not validate per-line `shop_id`
**Where:** The check is "variant_id resolves to a product whose shop_id
matches current_shop_id." This is correct under the current model. Under
v2.9 multi-shop, the check must be against the **active** shop_id, not
just any shop the user has access to.
**Severity:** MEDIUM (chained to F-H-01).

### F-M-17 — `expire_subscriptions` is global — affects all users
**Where:** runs as DEFINER, no shop scope.
**What:** Correct — it's a cron sweep. But worth noting that this is one
of two paths (along with `handle_new_user`) where DEFINER code touches
data without checking `current_shop_id()`. Both are correct.
**Severity:** INFORMATIONAL (parked at MEDIUM for awareness).

### F-M-18 — `LanguageSelector` writes `profiles.preferred_language` directly
**Where:** `src/components/language-selector/LanguageSelector.tsx:31`.
**What:** Self-scoped via `profiles_self_update`. Safe under v2.9; the
employee gets to set their own language. Just noting it as a non-issue.
**Severity:** INFORMATIONAL.

### F-M-19 — `RequireActiveSubscription` exempts `/settings/*` so users can pay
**Where:** Per CLAUDE.md.
**What:** Correct under current model. Under v2.9 an employee whose shop
is expired must be locked out of the shop entirely, including `/settings`
(because they have no agency to renew). This degrades to: only the owner
sees `/settings` if the shop is expired. Decision point in B.6.
**Severity:** MEDIUM (decision).

### F-M-20 — `inventory_batches.notes` is mutable post-creation
**Where:** `batch_immutable_fields` trigger inspected — does not block
`notes`, `is_active`, `qty_remaining`, `purchase_item_id (null→non-null)`.
**What:** Manager+ writes notes when writing off a batch (per
`record_partial_writeoff`). Salesperson should not write notes
directly. Today, `batches/hooks.ts:238/282` updates notes via direct
`.from('inventory_batches').update({ notes })`. v2.9 needs manager+
RLS or an RPC wrapper.
**Severity:** MEDIUM.

### F-M-21 — `paid_at` and `occurred_at` are decoupled on `ledger_entries`
**Where:** Schema.
**What:** v1.6 cleanup left both. Informational.
**Severity:** INFORMATIONAL.

### F-M-22 — `tier_id` snapshot on `invoices.tier_id` references `customer_tiers.id`
**Where:** Schema FK.
**What:** Per ADR-0017 the tier is now a pure category (no discount).
But the FK is non-nullable on delete: if a tier is hard-deleted (no
RPC does this — `deactivate_tier` does soft-delete only — but a future
admin SQL could), historical invoices break their reference.
`deactivate_tier` returns an integer count of customers affected (not
verified but assumed from the return type). v2.9 should NOT enable
hard delete from any role.
**Severity:** MEDIUM.

### F-M-23 — `shops.owner_user_id` ON DELETE CASCADE on profiles
**Where:** FK constraint `shops_owner_user_id_fkey → profiles.id ON DELETE CASCADE`.
**What:** Deleting a profile (auth user) cascades to the shop, which
cascades to every domain row. This is the v1 nuclear-option. Under v2.9
this is **wrong** — deleting a user should not delete the shop. The
shop should re-attach to another owner (or accept that ownership
transfer is a v2.9.x ticket). Decision: change the FK to `ON DELETE
RESTRICT`, force a "transfer ownership" step before profile deletion.
**Severity:** MEDIUM → HIGH if we expect owners to ever be deleted.
Park here pending Phase B B.2.1 confirmation.

### F-M-24 — No rate-limiting on invitation creation
**Where:** F-H-26 work item.
**What:** An owner could spam-invite. Supabase's own rate limits at the
edge auth API typically cover this, but the in-app `pending_invitations`
insert path has no per-shop limit. v2.9 should add `created_at` index
+ `WHERE invited_by = X AND created_at > now() - 1 hour` count check
before insert.
**Severity:** MEDIUM.

### F-M-25 — `batch_immutable_fields` + `batch_auto_deactivate_when_empty` are unnecessarily grantable to `authenticated`
**Where:** `pg_proc` shows `execute_grantees =
postgres,authenticated,service_role` for both.
**What:** They are trigger-only functions; calling them directly via
`/rest/v1/rpc/...` fails immediately because the body references `NEW`
/ `OLD`. So this is not a real-world exploit. But it's hardening
hygiene — the v2.9 migration should `revoke execute on function ...
from public, anon, authenticated; grant execute on function ... to
postgres, service_role;` for both, matching the other 6 trigger
functions in §3.4.
**Severity:** MEDIUM.

---

## 12. Findings — INFORMATIONAL

### F-I-01 — `advisor` results: 46 warnings, no errors
**Detail:** 45 × `authenticated_security_definer_function_executable`
(intentional per ADR-0011) + 1 × `auth_leaked_password_protection` (HIBP
toggle deferred per `docs/todos.md`).
**Action:** none — already documented and accepted.

### F-I-02 — `security_definer_view` lint does not fire
**Detail:** All 18 views are `security_invoker = true`. Compliance with
ADR-0015 verified.
**Action:** none.

### F-I-03 — `current_shop_id()` LIMIT 1 is a soft signal
**Detail:** The `limit 1` is correct under the unique constraint today.
Removing it under v2.9 (when returning multiple shop_ids) is the natural
evolution.

### F-I-04 — Cron job runs at 00:05 UTC
**Detail:** Pakistan is UTC+5. Cron runs at 05:05 PKT. Subscriptions that
expire at midnight PKT may have a 5-hour grace window. Not a defect.

### F-I-05 — `record_sale` runs `FOR UPDATE` on the variant row
**Detail:** Per ADR `2026-05-12-cost-at-sale-snapshot-timing.md`. The
`FOR UPDATE` ensures the avg_cost snapshot is consistent. Verified in
the body.
**Action:** confirm in v2.9 redesign that the lock is preserved.

### F-I-06 — `purchase_items.batch_id ↔ inventory_batches.purchase_item_id` is bidirectional
**Detail:** Confirmed in schema FKs. The batch's `purchase_item_id` is
mutable only from NULL→non-null per the immutability trigger; this is
the v2.8.1 fix.
**Action:** none.

### F-I-07 — `daily_sales_7` and `daily_sales_today` aggregate at shop level
**Detail:** Both filter by `current_shop_id()`. The aggregates are
**revenue only** — no cost or profit. Under v2.9 they're safe for any
role (assuming the role-aware multi-shop helper).

### F-I-08 — The `paths.ts` route map already supports adding settings sub-routes
**Detail:** `/settings/support` exists; `/settings/team` would slot in
the same pattern.

### F-I-09 — `i18n` 14 namespaces; v2.9 will add `team` / `invitations` / `permissions`
**Detail:** Per CLAUDE.md.

### F-I-10 — `enforce_variant_default_invariants` is the only function with
`EXECUTE` granted to `postgres, service_role` but **not** authenticated
even though it's DEFINER
**Detail:** Verified in the inventory. Trigger function — never called
directly. Good pattern.

### F-I-11 — Migration 0067 is the latest applied
**Detail:** v2.8.5 (POS batch picker). Any v2.9 migrations start at 0068.

### F-I-12 — TypeScript types are at `src/types/database.ts`
**Detail:** Must be regenerated after every migration via
`mcp__supabase__generate_typescript_types`.

### F-I-13 — Test runner is jsdom; no Postgres in tests
**Detail:** Per CLAUDE.md. Cross-shop / role tests in v2.9 must be
manual or use a real test database.

### F-I-14 — `customer_balance_reconciliation` is owner-grade audit
**Detail:** Already shop-scoped. Reveals computed-vs-stored balance drift
(should always be zero). Owner-only under v2.9.

### F-I-15 — No `void_sale`, `void_purchase`, advance-payment RPCs exist
**Detail:** `docs/todos.md`. v2.9 design must decide if any of these
ship alongside the role rollout. My recommendation: NONE. They are
unrelated risk surfaces; do them after v2.9 lands.

### F-I-16 — `customers` is hard-deleteable
**Detail:** No `is_active` column. F-H-07 covers it.

### F-I-17 — `customers.phone` is unique per shop
**Detail:** Per ADR-0017 / v2.3 fix. Will affect "create customer" UX for
salespeople when a phone is reused across shops (different shop_id, so
no conflict).

### F-I-18 — `shops` has no `is_active` column either
**Detail:** Suspending a shop is via `subscriptions.status = 'suspended'`,
not by deactivating the shop entity. v2.9 doesn't change this.

### F-I-19 — `profiles.preferred_language` is the only language preference; no per-shop language
**Detail:** Fine. Owner / employee can have different language preferences.

### F-I-20 — `auth.uid()` is a JWT-claim function from Supabase
**Detail:** Returns the `sub` of the current JWT. Not user-mutable.
Reaffirmed for the audit's correctness.

---

## 13. Assumptions made

These are the assumptions I baked into the audit. Each is a hidden
contract that the v2.9 design depends on. If any is wrong, the audit
needs revision.

1. **`anon` access truly cannot pass any RLS predicate.** Verified by
   inspecting every USING expression for `auth.uid()` / `current_shop_id()`
   dependency.
2. **No view bypasses RLS.** Verified — all 18 views are
   `security_invoker = true`.
3. **`service_role` is used only for admin SQL editor and pg_cron.** Not
   verified from outside the DB — taken from ADR-0010.
4. **The Supabase Auth JWT is not user-mutable.** Standard assumption.
5. **`record_sale` / `record_purchase` are the only stock-mutating
   paths.** Confirmed — no direct UPDATE/INSERT on `product_variants.stock`
   from the client side; the only stock-touching paths are the RPCs.
6. **The pilot user has at most 2 shops, 5 users per shop.** Per the
   prompt: 100–500 shops × 1–10 users per shop. Confirmed scale envelope.
7. **The v2.9 threat model is "fired salesperson with valid credentials"
   not "nation-state actor."** Per the kickoff prompt's final constraint.
8. **The user wants the design to be pragmatic and SMB-appropriate.**
   Reinforced in §6.1 trade-off recommendation.

---

## 14. Open questions / spec gaps (for Phase B)

These are the questions the audit surfaces. They will be expanded in
the Phase B decision-point list (B.1.2).

1. **Multi-shop user model:** does a user keep a "currently active
   shop" in client localStorage, or do they explicitly toggle via the
   TopBar? Or do we eliminate the question by having the route encode
   the shop (`/shop/:shopId/pos`)? Recommendation: TopBar shop switcher
   for SMB scale; route-level shop encoding is too invasive for v2.9.
2. **Margin-percent visibility for managers:** is it a binary
   ("manager sees margin %") or a tri-state (off / margin % only /
   margin % + absolute profit)? Recommendation: binary, with a shop
   setting `shop.manager_sees_margin boolean default true`.
3. **Customer creation by salesperson** (B.2.3): name + phone only.
   Confirmed in the prompt. The implementation question is what RLS
   pattern enforces this — column-level or RPC-level. Recommendation:
   RPC `create_customer_basic(name, phone) → uuid`, salesperson can
   call it; direct INSERT on `customers` requires manager+. This means
   tightening the `customers_shop_all` policy.
4. **Discount limits storage:** stored as a JSONB blob per
   `user_shop_roles` row (with shop-level default in
   `shops.default_discount_limits jsonb`), shape `{ "per_line_max_pct":
   number, "per_invoice_max_pct": number, "per_line_max_pkr": number,
   "per_invoice_max_pkr": number }`. All four keys optional; missing =
   "no limit." Recommendation: lock this JSONB shape in Phase B and
   surface a validation schema.
5. **Pending invitations expiration:** 48h vs. 72h vs. 7 days.
   Recommendation: 48h, because the SMB invitation UX is "owner sends
   it while the employee is in the room and watching their phone."
   Longer expirations increase the mistyped-email risk window.
6. **Mistyped-email mitigation:** 4-digit verbal confirmation code that
   the owner reads to the employee, the employee enters on the join
   page. Code stored on `pending_invitations.confirmation_code` (random
   4-digit, displayed once at invite-create time). Decision point in
   B.6.
7. **Invitation acceptance UX when the email already has an account:**
   the same email may already have an account (they signed up
   independently or were invited by another shop). Recommendation: on
   accept, sign the user in via the existing account (Supabase magic
   link to existing user_id), insert the `user_shop_roles` row, and
   route them straight to the new shop's dashboard. No password reset
   needed.
8. **Voiding a sale:** ship a `void_sale` RPC with manager+ guard, or
   stay admin-only? Recommendation: defer to v2.10. The audit-trail
   work for `void_sale` is non-trivial (reverse-ledger + restock-batch
   + audit event), and v2.9's role rollout is the harder problem.
9. **Audit trail surface in UI:** does the sale-detail / purchase-detail
   page show the `created_by` user's name + role? Recommendation: yes.
   Cheap to add and the most common request from owners.
10. **Removing an employee:** does it revoke their session immediately,
    or only on next login? Supabase Auth does not support remote session
    invalidation by default. Recommendation: accept that the employee's
    access continues until their JWT expires (typically 1h). Document
    this clearly in the runbook.
11. **Salesperson seeing OTHER salespeople's sales:** can a salesperson
    see only their own sales, or all sales? Recommendation: their own
    only, by adding `WHERE cashier_id = auth.uid()` to the
    salesperson-tier policy. Owner / manager see everything.
12. **Re-printing receipts for past sales:** is this a manager-only
    action? Recommendation: any role that can see the sale can re-print it.
    No additional gate.

---

## 15. Summary table — what each artifact needs in v2.9

This is the index Phase B will refer back to.

| Artifact | Today's guard | v2.9 needed change | Severity |
|---|---|---|---|
| `current_shop_id()` | reads `shops.owner_user_id = auth.uid()` | replace / extend to multi-shop, role-aware | HIGH (F-H-01) |
| every shop-scoped RLS policy | `shop_id = current_shop_id()` | `shop_id = any (current_user_shop_ids())` + role check via helper | HIGH |
| `record_sale` | `current_shop_id()` non-null | + active-shop validation, + discount limit, + role gate (salesperson+) | HIGH (F-H-21) |
| `record_purchase` | `current_shop_id()` non-null | + role gate (manager+) | HIGH (F-H-02) |
| `receive_payment` | + customer-in-shop | + role gate (manager+) | HIGH (F-H-03) |
| `reverse_ledger_entry` | + entry-in-shop | + role gate (manager+) | HIGH (F-H-03) |
| `deactivate_batch` / `record_partial_writeoff` / `deactivate_pack` | + shop check | + role gate (manager+) | HIGH (F-H-02) |
| `complete_onboarding` | requires auth | + insert `user_shop_roles` (owner) | HIGH (F-H-06) |
| `create_/update_/deactivate_variant_*` | shop-scoped | + role gate (owner-only) | HIGH (F-H-12) |
| `define_tier` / `update_tier` / `set_default_tier` / `deactivate_tier` | shop-scoped | + role gate (owner-only) | HIGH (F-H-13) |
| `create_category_inline` / `update_category` | shop-scoped | + role gate (manager+) | HIGH (F-H-14) |
| `create_supplier_inline` | shop-scoped | + role gate (manager+) | HIGH |
| `add_variant_to_product` / `create_product_with_*` / `define_pack_inline` / `update_pack` | shop-scoped | + role gate (manager+) | HIGH (F-H-10, F-H-14) |
| `recent_purchase_products` / `recent_suppliers` / `search_purchases*` | shop-scoped | + role gate (manager+); strip cost columns or split into safe view | HIGH (F-M-11) |
| `search_products` / `search_products_count` | shop-scoped | + salesperson-safe variant without `avg_cost` / `last_purchase_cost` | HIGH (F-H-04) |
| `invoice_financials` / `sale_item_financials` / `purchase_item_financials` | RLS via underlying tables | + role-aware safe views (revenue-only for salesperson, margin %-only for manager, full for owner) | HIGH (F-H-04, F-H-05) |
| `monthly_summary` | RLS via inner views | + role-aware safe view | HIGH |
| `customers` direct INSERT/UPDATE/DELETE | RLS | replace with RPCs `create_customer_basic` (salesperson+), `update_customer` (manager+); soft-delete only (owner-only) | HIGH (F-H-07, F-H-29) |
| `expenses` direct INSERT | RLS | + role gate (manager+) — either RLS+`auth.uid()` role check or RPC | HIGH (F-H-09) |
| `monthly_targets` direct upsert | RLS | + role gate (owner-only) | HIGH (F-H-08) |
| `products` / `product_variants` direct UPDATE | RLS | + role gate (manager+) via RLS or RPC | HIGH (F-H-10) |
| `suppliers` direct UPDATE | RLS | + role gate (manager+) | HIGH (F-H-11) |
| `inventory_batches.notes` direct UPDATE | RLS + immutability trigger lets notes through | + role gate (manager+) | MEDIUM (F-M-20) |
| `shop_owner_details` UPDATE | RLS shop-scoped | + role gate (owner-only); decision: also restrict READ? | HIGH (F-H-16) |
| `shops` UPDATE (settings) | `owner_user_id = auth.uid()` | replace with `EXISTS (...user_shop_roles role='owner')` | HIGH (F-H-22) |
| `subscriptions_self_read` | `user_id = auth.uid()` | + a `shop_effective_subscription(shop_id)` view that resolves through `shops.owner_user_id` | HIGH (F-H-17) |
| `profiles_self_read` | `id = auth.uid()` | + a second policy `profiles_team_read` for owners to see employee profiles | HIGH (F-H-23) |
| `handle_new_user` | DEFINER trigger | optionally skip subscription insert for invited users | HIGH (F-H-18) |
| `pending_invitations` | does not exist | new table + RLS + RPCs | HIGH (F-H-25, F-H-26) |
| `user_shop_roles` | does not exist | new table + RLS + helpers | HIGH (F-H-01) |
| `created_by` / `updated_by` audit columns | partial coverage | extend to every mutating path | HIGH (F-H-19) |

---

*End of audit. The next document, `design/2026-05-13-rbac-model-design.md`,
will propose the v2.9 schema, the permission matrix (draft +
decision points), and the helper / RPC / RLS architecture.*
