# RBAC Attack Surface and Validation Strategy — 2026-05-13 (Revision 2)

**Status:** Phase C Rev 2 — locked. Derived mechanically from Phase B
Rev 2 (`design/2026-05-13-rbac-model-design.md`).

**Revision history:**
- **Rev 1** (2026-05-13a) — role-based attack surface and test matrix.
  Captured in git history. ~60% of mitigations cited role-based guard
  labels (MGR/OWN); the test matrix was role-bounded.
- **Rev 2** (2026-05-13b) — permission-based. Every mitigation cites a
  specific permission key from the locked 50-permission catalog. The
  test matrix restructures around permission-boundary tests + preset
  application tests + override tests + audit boundary tests. Five new
  attack classes added.

**What's preserved from Rev 1:**
- §C.0.1 threat model framing (insider with valid credentials, stolen
  credential reuse, not nation-state APT)
- §C.0.2 citation discipline pattern (mitigations cite specific
  policies / functions / views; citation **targets** change to
  permission-key based, the pattern is unchanged)
- §C.0.3 reading order structure
- Cross-shop isolation attacks (§C.1.3 OA-* and §C.2.5; independent
  of role model)
- Invitation-flow attacks including brute-force, mistyped email,
  replay, set_active_shop session bypass (§C.1.4 XA-*, §C.2.6)
- C.3 audit query suite (data-integrity-focused, mostly unchanged;
  3 new queries for permission integrity added)
- Anonymous attacks (§C.1.5 NA-*, §C.2.13)

**What revised in Rev 2:**
- Every attack mitigation citing role-based guards (MGR/OWN labels).
  Now cites the specific permission key from Phase B §B.5.
- C.2 test matrix completely restructured to the four-section
  taxonomy required by the user's instruction 2: (a) permission
  boundary, (b) preset application, (c) override, (d) audit boundary.

**What's new in Rev 2:**
- §C.1.6 — Permission grant tampering attacks (PA-NN, 13 attacks)
- §C.1.7 — Stale permission cache attacks (CA-NN, 6 attacks)
- §C.1.8 — Preset drift on feature ship attacks (DA-NN, 6 attacks)
- §C.1.9 — Permission set enumeration attacks (EA-NN, 7 attacks)
- §C.1.10 — Permission-based privilege escalation via social
  engineering (SE-NN, 5 attacks)
- Corresponding §C.2.7–§C.2.11 test sections

---

## C.0 Scope and methodology (PRESERVED)

### C.0.1 Threat model assumed

Per the kickoff prompt's final constraint, the threat model is:

- **Inside actor with valid credentials,** typically a fired
  salesperson, a manager whose role has been wound down but whose JWT
  is still valid, or an existing employee whose permissions have been
  partially restricted. They can hit PostgREST directly, open
  devtools, craft arbitrary SQL via `supabase.rpc(...)`, set session
  config variables, and study the network panel.
- **External attacker with stolen credentials** for any role — same
  capability surface as the inside actor.
- **External attacker without credentials** (anonymous PostgREST) —
  much weaker; default Supabase setup denies most access.
- **Not in scope:** nation-state APT (chained zero-days against the
  Supabase platform itself); supply-chain compromise of the Supabase
  SDK; physical access to the Postgres server.

The permission-based pivot does not change the threat actors. It
changes the privilege boundary they navigate: instead of "salesperson
vs. manager vs. owner," they navigate "do I have permission X for
shop Y." Attacks fall into categories based on which permission is
the target of the attack.

### C.0.2 Citation discipline

Every attack mitigation cites the **specific** RLS policy, function
guard, view, or catalog rule from Phase B Rev 2. Format:

- RLS: `<table>.<policy_name>` from §B.4
- Function guard: `<function_name>` requires permission `<key>` per §B.5
- View body: `<view_name>` with `security_invoker = false`; per-column
  conditional projection from §B.2.0b / §B.3.5
- Trigger: `<trigger_name>` on `<table>`
- Catalog rule: `permissions_catalog` row for `<key>` with
  `requires = [<keys>]` per §B.1.2

When a mitigation depends on a Phase D implementation detail (e.g.,
PostgREST rate-limit configuration), that's flagged as **F-PD-NN**
(Phase D action item) and listed in §C.4.

### C.0.3 Reading order

§C.1 enumerates attacks (10 sub-sections — 5 preserved role-based-
actor classes + 5 new permission-class attack groups). §C.2 enumerates
tests (13 sub-sections — 4 new permission-flow sections + 9 preserved-
plus-revised). Many tests trace 1:1 to an attack ID. §C.3 is the
ongoing-regression audit query suite. §C.4 is the Phase D handoff for
new defects surfaced during this revision.

---

## C.1 Attack surface enumeration

### C.1.1 Salesperson attacks (revised citations)

Throughout this subsection, "salesperson" means: a user whose
`user_shop_access.is_owner = false` AND whose `user_shop_permissions`
rows reflect the salesperson preset (10 ON / 40 OFF per §B.1.1).
Specific permissions referenced cite the catalog key.

**SA-01 — Direct PostgREST `record_purchase` call (privilege escalation
to stock-in).**
- Attack: cashier opens devtools, calls
  `supabase.rpc('record_purchase', { p_items: [...] })`.
- Mitigation: `record_purchase` RPC requires permission `record_purchase`
  per §B.5.1. Salesperson preset has `record_purchase = ·`. RPC raises
  `insufficient_permissions` with `detail = 'Required: record_purchase'`.
- Tested by: T-PB-record_purchase-without.

**SA-02 — Direct PostgREST `deactivate_batch` / `record_partial_writeoff`
call (stock manipulation).**
- Attack: cashier writes off a batch to manipulate inventory.
- Mitigation: both RPCs require permission `writeoff_batch` per §B.5.1.
  Salesperson preset has `writeoff_batch = ·`. RPC raises
  `insufficient_permissions`.
- Tested by: T-PB-writeoff_batch-without.

**SA-03 — Reading raw `sale_items.cost_at_sale` via PostgREST.**
- Attack: cashier queries `from('sale_items').select('cost_at_sale,
  qty, price_at_sale')` directly against the raw table.
- Mitigation: §B.4.6 `sale_items_cost_read` policy requires
  `user_has_permission(shop_id, 'view_sale_cost')`. Salesperson preset
  has `view_sale_cost = ·`. RLS returns empty result set.
- Tested by: T-PB-view_sale_cost-without (raw read).

**SA-04 — Reading raw `product_variants.avg_cost` via PostgREST.**
- Attack: cashier queries `from('product_variants').select('avg_cost,
  cost, last_purchase_cost')`.
- Mitigation: §B.4.3 `variants_cost_read` policy requires
  `view_product_cost`. Salesperson preset has `view_product_cost = ·`.
  Empty result set.
- Tested by: T-PB-view_product_cost-without (variants).

**SA-05 — Reading raw `products.avg_cost` via PostgREST.**
- Attack: same shape as SA-04 against `products`.
- Mitigation: §B.4.3 `products_cost_read` policy requires
  `view_product_cost`. Empty result set.
- Tested by: T-PB-view_product_cost-without (products).

**SA-06 — Reading raw `inventory_batches.cost_per_unit` via PostgREST.**
- Attack: salesperson queries the raw table.
- Mitigation: §B.4.4 `batches_cost_read` policy requires
  `view_batch_cost`. Salesperson preset has `view_batch_cost = ·`.
  Empty result set.
- Tested by: T-PB-view_batch_cost-without.

**SA-07 — Reading raw `purchase_items.cost_at_purchase` / `purchases.total_cost`.**
- Attack: salesperson queries the raw tables.
- Mitigation: §B.4.4 — `purchases_read` requires `view_purchases`;
  `purchase_items_read` and `purchase_overhead_read` join through.
  Salesperson preset has `view_purchases = ·`. Empty result set.
- Tested by: T-PB-view_purchases-without.

**SA-08 — Reading the `invoice_financials_view` (gross_profit / margin
% / total_cost).**
- Attack: salesperson queries `from('invoices_view').select(
  'gross_profit, gross_margin_percent')`.
- Mitigation: per §B.2.0b, the view is `security_invoker = false` and
  projects `gross_profit` only when `user_has_permission(shop_id,
  'view_sale_cost')` is true. Returns NULL for that column when
  salesperson reads. Same for `gross_margin_percent` (gated by
  `view_profit_margin`).
- Tested by: T-PB-view_sale_cost-without (view projection), T-PB-
  view_profit_margin-without (view projection).

**SA-09 — Reading `sale_item_financials` equivalent.**
- Rev 2 collapsed `sale_item_financials` into the `sale_items_view`.
  See SA-08.

**SA-10 — Reading `purchase_item_financials` equivalent.**
- Per §B.2.0b, manager-allowed full visibility. Salesperson denied at
  row level via `view_purchases` gate.
- Tested by: T-PB-view_purchases-without.

**SA-11 — Reading `monthly_summary_view.gross_profit`.**
- Attack: salesperson queries the view.
- Mitigation: per §B.2.0b, `monthly_summary_view` is DEFINER and
  projects `gross_profit` conditional on `view_sale_cost`. Row filter
  via `view_reports` permission. Salesperson preset has both `·` →
  empty rows.
- Tested by: T-PB-view_reports-without, T-PB-view_sale_cost-without.

**SA-12 — Cross-shop read by setting `app.shop_id` to an unrelated
shop's UUID.**
- Attack: salesperson at Shop A calls
  `supabase.rpc('set_active_shop', { p_shop_id: '<Shop B uuid>' })`
  to switch context.
- Mitigation: `set_active_shop` body checks
  `user_has_shop_access(p_shop_id)` per §B.3.3 helper (3). Salesperson
  without `user_shop_access` row at Shop B raises `no_access_to_shop`.
- Tested by: T-CR-set_active_shop-cross-shop.

**SA-13 — Cross-shop read by directly setting the session variable
without calling `set_active_shop`.**
- Attack: salesperson runs `select set_config('app.shop_id', '<Shop B
  uuid>', false)` via PostgREST.
- Mitigation: PostgREST does not expose arbitrary `set_config` calls;
  Supabase's REST-exposed function set is restricted to RPC-registered
  functions. Verify in Phase D as F-PD-01.
- Defense in depth: even if the variable were settable, RLS predicates
  use `user_has_shop_access(shop_id)` which checks `user_shop_access`
  rows, not the session variable. The variable selects WHICH shop the
  user is acting at; access is gated separately.
- Tested by: T-CR-direct-set_config (depends on F-PD-01 verification).

**SA-14 — Cross-shop write by passing another shop's `variant_id` to
an RPC.**
- Attack: salesperson at Shop A calls `record_sale` with `variant_id`
  belonging to Shop B.
- Mitigation: `record_sale` body looks up the variant's product, then
  checks `v_variant.shop_id <> v_shop_id` and raises
  `variant_not_in_shop`. Existing v1.x check preserved.
- Tested by: T-CR-record_sale-cross-shop-variant.

**SA-15 — Privilege escalation via direct `user_shop_permissions`
UPDATE.**
- Attack: salesperson runs `from('user_shop_permissions').update({
  granted: true }).eq('permission_key', 'modify_user_permissions')`.
- Mitigation: §B.4.8 `user_shop_permissions` has no UPDATE policy. Only
  the `modify_user_permission` RPC mutates; the RPC requires
  `modify_user_permissions` permission. Salesperson lacks it.
- Tested by: T-PA-direct-update-user_shop_permissions.

**SA-16 — Privilege escalation via direct `user_shop_permissions`
INSERT.**
- Attack: salesperson inserts a row to grant themselves a permission.
- Mitigation: §B.4.8 no INSERT policy. Denied at RLS layer.
- Tested by: T-PA-direct-insert-user_shop_permissions.

**SA-17 — Inserting a `pending_invitations` row to invite themselves
to a target shop as owner.**
- Attack: salesperson inserts pending_invitations directly.
- Mitigation: §B.4.8 no INSERT policy. Only `create_invitation` RPC,
  which requires `invite_users` permission. Salesperson lacks. Even
  if the RPC were callable, body validates `p_preset IN ('manager',
  'salesperson')` — raises `cannot_invite_owner`.
- Tested by: T-PA-direct-insert-pending_invitations,
  T-INV-cannot-invite-owner.

**SA-18 — Reading other salespeople's sales.**
- Attack: salesperson queries `from('invoices_view').select('*').neq(
  'cashier_id', <self>)`.
- Mitigation: §B.3.5 `sale_items_view` and `invoices_view` apply the
  row filter `user_has_permission(shop_id, 'view_all_sales') OR
  cashier_id = auth.uid()`. Salesperson preset has
  `view_all_sales = ·`. View returns only own rows.
- Tested by: T-PB-view_all_sales-without.

**SA-19 — Reading `shop_owner_details` (PII / CNIC).**
- Attack: salesperson queries the table.
- Mitigation: §B.4.2 `owner_details_read` policy requires
  `view_owner_details`. Salesperson preset has `·`. Empty result set.
- Tested by: T-PB-view_owner_details-without.

**SA-20 — Reading `shop_effective_subscription` for an unrelated
shop.**
- Attack: salesperson queries the view for a shop they don't belong
  to.
- Mitigation: view body filters by `user_has_shop_access(s.id)`.
- Tested by: T-CR-shop_effective_subscription.

**SA-21 — `receive_payment` daily-cap evasion via rapid-fire calls.**
- Attack: salesperson calls `receive_payment` 50 times in 1 second to
  exceed the 10,000 PKR daily cap before per-call read of today's
  total reflects each new insert.
- Mitigation: the cap check inside `receive_payment` runs in the same
  transaction as the `ledger_entries` insert. Postgres's default
  read-committed isolation plus the per-call `SUM(amount) WHERE
  created_by = auth.uid() AND type = 'credit' AND date >= today` is
  computed inside the transaction — concurrent calls serialize via
  unique constraint contention on `ledger_entries.id` (gen_random_uuid
  ensures uniqueness so they don't conflict, but the SUM is consistent
  within each transaction).
- **F-PD-02:** Phase D verifies that two concurrent transactions cannot
  both pass the cap check and insert payments totaling above the cap.
  May require explicit `SELECT FOR UPDATE` on a shop-scoped "daily
  totals" lock row, OR transaction isolation level `repeatable read`,
  OR an advisory lock on `(shop_id, user_id, current_date)`.
- Tested by: T-CAP-concurrent-rapid-fire.

**SA-22 — `receive_payment` single-call exceeds daily cap.**
- Attack: salesperson calls `receive_payment(customer_id, 50000)`.
- Mitigation: `receive_payment` body raises
  `salesperson_payment_cap_exceeded` when caller is non-owner AND
  (today's_total + p_amount) > `shops.salesperson_payment_cap_pkr`.
- Tested by: T-CAP-single-call-exceeds.

**SA-23 — Discount limit bypass via `record_sale` direct call.**
- Attack: salesperson calls `record_sale` with `p_sale_discount_value
  = 90` percent.
- Mitigation: `record_sale` reads caller's
  `user_shop_access.discount_limits` and raises
  `discount_exceeds_invoice_pct_limit`.
- Tested by: T-DC-salesperson-exceeds-invoice-pct.

**SA-24 — Discount limit bypass via per-line `line_discount_value`.**
- Attack: each cart line carries a high per-line discount.
- Mitigation: per-line AND per-invoice limits checked independently
  per §B.2.4 / §B.3.4 `record_sale` body.
- Tested by: T-DC-salesperson-exceeds-line-pct,
  T-DC-salesperson-exceeds-line-pkr.

**SA-25 — Sale with `price_at_sale = 0` (free item ringup, implicit
discount).**
- Attack: salesperson rings up sale with `price_at_sale = 0` and
  `variant.price = 100` (effective 100% line discount, no explicit
  discount field).
- Mitigation: `record_sale` body computes implicit discount percent
  as `1 - (price_at_sale / variant.price)` when `variant.price IS NOT
  NULL`, and applies the per-line / per-invoice cap to that implicit
  percent. Raises `discount_exceeds_line_pct_limit` if exceeds.
- **F-PD-03** (carried over from Rev 1 F-NEW-03): Phase D must
  implement this check in `record_sale`.
- Edge case: if `variant.price IS NULL` (per v2.8.1 batched products
  can have null price), the implicit-discount check is skipped; the
  explicit `price_at_sale` is accepted.
- Tested by: T-DC-implicit-discount-via-zero-price.

**SA-26 — SQL injection via cart item `notes` or other text param.**
- Attack: salesperson sends `p_notes = '" or 1=1 --'` to `record_sale`.
- Mitigation: PostgREST passes params via parameterized binds. The
  DEFINER body uses `nullif(trim(p_notes), '')` — no `format()` or
  `execute` against user input.
- Tested by: T-SI-record_sale-notes.

**SA-27 — SQL injection via JSONB parameter (`p_items`).**
- Attack: crafted JSONB with key names like `'); drop table
  customers; --`.
- Mitigation: `record_sale` reads JSONB via `->>` operator, which
  returns text used only as values cast to typed columns. No dynamic
  SQL.
- Tested by: T-SI-record_sale-items-jsonb.

**SA-28 — Creating customers with arbitrary `address`, `notes`,
`tier_id` via `create_customer_full`.**
- Attack: salesperson calls `create_customer_full(...)` with
  non-default fields.
- Mitigation: `create_customer_full` RPC requires permission
  `create_customer_full`. Salesperson preset has `·`. Raises
  `insufficient_permissions`.
- Tested by: T-PB-create_customer_full-without.

**SA-29 — Updating customer tier via direct UPDATE.**
- Attack: salesperson runs `from('customers').update({ tier_id: '...' })`.
- Mitigation: §B.4.5 `customers_update` policy requires `edit_customer`.
  Salesperson preset has `·`. RLS denied.
- Tested by: T-PB-edit_customer-without (UPDATE attempt).

**SA-30 — Deleting a customer.**
- Attack: salesperson runs `from('customers').delete().eq('id', '...')`.
- Mitigation: §B.4.5 no DELETE policy on `customers`. Any role's
  DELETE fails RLS.
- Tested by: T-PB-customers-delete-denied-all-roles.

**SA-31 — Reading raw `purchases` / `purchase_items` / `suppliers`.**
- Covered by SA-07 (purchases). Suppliers covered separately:
  §B.4.4 `suppliers_read` requires `view_suppliers`. Salesperson
  preset has `·`. Empty result set.
- Tested by: T-PB-view_suppliers-without.

**SA-32 — Reading `expenses`.**
- Attack: salesperson queries `from('expenses').select('*')`.
- Mitigation: §B.4.7 `expenses_read` requires `view_expenses`.
  Salesperson preset has `·`. Empty result set.
- Tested by: T-PB-view_expenses-without.

**SA-33 — Reading `monthly_targets`.**
- Attack: salesperson queries `from('monthly_targets').select('*')`.
- Mitigation: §B.4.7 `monthly_targets_read` requires
  `view_monthly_targets`. Empty result set.
- Tested by: T-PB-view_monthly_targets-without.

**SA-34 — Editing `shops` row directly.**
- Attack: salesperson runs `from('shops').update({ shop_name: '...' })`.
- Mitigation: §B.4.2 — there is NO `shops_*_update` policy in Rev 2.
  All shop UPDATEs go through `update_shop_settings` RPC (requires
  `edit_shop_settings`). Direct UPDATE denied.
- Tested by: T-PB-edit_shop_settings-without (direct UPDATE attempt).

**SA-35 — Calling `set_active_shop` for a shop they do belong to
(positive control).**
- Mitigation: validates and sets the session variable.
- Tested by: T-POS-set_active_shop-own-shop.

**SA-36 — Brute-forcing the `confirmation_code` on an invitation
addressed to themselves.**
- Attack: invitee guesses codes.
- Mitigation: 5-strike auto-cancel via
  `pending_invitations.failed_attempts` per §B.6.3 (unchanged from Rev 1).
- Tested by: T-INV-5-wrong-codes.

**SA-37 — Reading `user_shop_permissions` for other users.**
- Attack: salesperson queries the table to learn colleagues' permission
  sets.
- Mitigation: §B.4.8 `usp_self_or_owner_read` allows: own row OR owner
  OR `user_has_permission(shop_id, 'view_team')`. Salesperson preset
  has `view_team = ·`. Returns only own row (joined through
  user_shop_access).
- Tested by: T-EA-user_shop_permissions-self-only.

**SA-38 — Reading `user_shop_permission_audit`.**
- Attack: salesperson queries the audit table.
- Mitigation: §B.4.8 `uspa_owner_or_audit_read` requires owner OR
  `view_user_audit_log`. Salesperson preset has both `·`. Empty rows.
- Tested by: T-PB-view_user_audit_log-without.

**SA-39 — Reading `pending_invitations` to discover invited emails
beyond own.**
- Attack: salesperson queries the table to see who's been invited.
- Mitigation: §B.4.8 `pi_owner_or_invitee_read` — sees only owners'
  rows OR rows where `lower(email) = self_email`. Salesperson reading
  beyond own: empty.
- Tested by: T-EA-pending_invitations-self-email-only.

**SA-40 — Reading `customer_outstanding` view when
`view_customer_outstanding` is granted (positive control).**
- Mitigation: view body conditions the projection on
  `view_customer_outstanding`. Salesperson preset has `✓` (per Rev 2
  catalog change 3); returns the outstanding number.
- Tested by: T-POS-view_customer_outstanding-with.

**SA-41 — Reading `customer_outstanding` view when
`view_customer_outstanding` is revoked.**
- Mitigation: view body returns `outstanding = NULL` for callers
  without the permission. The derived `has_khata` boolean (Phase B
  §B.2.0b customers_view) remains visible.
- Tested by: T-PB-view_customer_outstanding-without.

**SA-42 — Reading `recent_purchase_products` RPC.**
- Attack: salesperson calls; returns table including `avg_cost`.
- Mitigation: RPC requires `view_product_cost` per §B.5.1. Salesperson
  preset has `·`. Raises `insufficient_permissions`.
- Tested by: T-PB-view_product_cost-without (RPC).

**SA-43 — Reading `recent_suppliers` RPC.**
- Attack: salesperson calls.
- Mitigation: RPC requires `view_suppliers`. Raises.
- Tested by: T-PB-view_suppliers-without (RPC).

**SA-44 — Reading `search_purchases` / `search_purchases_count`.**
- Attack: salesperson calls.
- Mitigation: both require `view_purchases`. Raises.
- Tested by: T-PB-view_purchases-without (RPCs).

**SA-45 — Reading `search_khata_customers` / count.**
- Attack: salesperson calls.
- Mitigation: both require `view_customer_khata`. Salesperson preset
  has `·`. Raises.
- Tested by: T-PB-view_customer_khata-without (RPC).

**SA-46 — Reading `search_products` (cost-bearing RPC).**
- Attack: salesperson calls.
- Mitigation: RPC requires `view_product_cost` per §B.5.1. Raises.
- Salesperson search alternative: the salesperson uses a not-yet-
  existing `search_products_safe` RPC (or `from('products_view')`
  directly). **F-PD-04** (carried from Rev 1 F-NEW-04): Phase D must
  re-add a `search_products_safe` RPC for the salesperson POS path,
  OR confirm that PostgREST `products_view` query with ilike + offset
  filters serves the use case.
- Tested by: T-PB-view_product_cost-without (search_products RPC).

**SA-47 — Calling `search_products_count` (positive control).**
- Mitigation: RPC requires `view_products`. Salesperson preset has `✓`.
- Tested by: T-POS-view_products-with (search_products_count).

**SA-48 — Joining `sale_items_view` with `inventory_batches` to back-
derive cost.**
- Attack: salesperson reads sale_items_view (price + qty + batch_id),
  joins with raw `inventory_batches` to get `cost_per_unit`.
- Mitigation: raw `inventory_batches` SELECT requires `view_batch_cost`
  per §B.4.4. Salesperson preset has `·`. Join returns no batch rows.
- Tested by: T-PB-view_batch_cost-without (join via PostgREST embed).

**SA-49 — Joining `sale_items_view` with `purchase_items` to back-
derive cost.**
- Attack: salesperson tries to join through purchase_items.
- Mitigation: `purchase_items` raw SELECT requires `view_purchases`.
  Empty rows.
- Tested by: T-PB-view_purchases-without (join attempt).

**SA-50 — Observing other employees' cashier_role via `invoices_view`.**
- (Rev-1 SA-49 — re-evaluated for Rev 2.)
- Rev 2 dropped `invoices.cashier_role` column. The view exposes
  `cashier_id` only. The salesperson can see colleagues' user_ids on
  sales they have visibility to (only their own under default preset).
  No additional disclosure.
- Tested by: T-OB-cashier_role-dropped-confirmation.

**SA-51 — Calling `complete_onboarding` to create a new shop and
become its owner.**
- Attack: salesperson runs `complete_onboarding(...)`.
- Mitigation: by design, any authenticated user can call this. They
  become owner of a NEW shop they create. Their access at the
  original Shop A is unaffected.
- Edge case: identical-shop-name match raises
  `already_owner_at_this_email_user_combo` per §B.6 lock.
- Tested by: T-POS-complete_onboarding-new-shop.

### C.1.2 Manager attacks (revised citations)

**MA-01 — Reading raw `sale_items.cost_at_sale`.**
- Attack: manager queries `from('sale_items').select('cost_at_sale')`.
- Mitigation: §B.4.6 `sale_items_cost_read` requires `view_sale_cost`.
  Manager preset has `view_sale_cost = ·` (per D5 override, Rev 2
  catalog default). Empty result set.
- This closes Rev-1 F-NEW-01 (the Rev-1 design admitted manager raw
  read, contradicting D5). The Rev 2 permission-based design has
  no contradictory class; the permission gate is precise.
- Tested by: T-PB-view_sale_cost-without (manager).

**MA-02 — Reading `invoices_view.gross_profit` (default manager).**
- Attack: manager queries the view.
- Mitigation: per §B.2.0b, view projects `gross_profit` conditional on
  `view_sale_cost`. Manager without it sees NULL.
- Tested by: T-PB-view_sale_cost-without (view projection, manager).

**MA-03 — Reading `monthly_summary_view.gross_profit` (default
manager).**
- Same mitigation as MA-02; gated by `view_sale_cost` and `view_reports`.
- Tested by: T-PB-view_sale_cost-without (monthly_summary, manager).

**MA-04 — Reading `purchase_item_financials` equivalent — manager
allowed.**
- Attack: manager queries `from('purchase_items')` or the joined view.
- Mitigation: by design, allowed. Manager preset has
  `view_purchases = ✓`. Returns rows including cost_at_purchase.
- This is the design's intentional "purchase cost is operational for
  the role that records stock-in" per §B.2.2.
- Tested by: T-POS-view_purchases-with (manager positive).

**MA-05 — Privilege escalation via direct `user_shop_permissions`
UPDATE.**
- Attack: manager runs `from('user_shop_permissions').update({granted:
  true})` to grant themselves a missing permission.
- Mitigation: §B.4.8 no UPDATE policy on user_shop_permissions. Only
  `modify_user_permission` RPC, which requires `modify_user_permissions`
  permission. Manager preset has `·`. Raises.
- Tested by: T-PA-direct-update-user_shop_permissions (manager).

**MA-06 — Inviting users without permission.**
- Attack: manager calls `create_invitation(email, ...)`.
- Mitigation: RPC requires `invite_users`. Manager preset has `·`.
  Raises `insufficient_permissions`.
- Tested by: T-PB-invite_users-without.

**MA-07 — Cancelling an invitation that wasn't theirs.**
- Attack: manager calls `cancel_invitation(<owned by another shop's owner>)`.
- Mitigation: RPC body checks: (a) caller has `cancel_invitations`
  permission AND (b) the invitation's `shop_id = current_active_shop_id()`.
  Manager preset has `cancel_invitations = ·`. Raises.
- Tested by: T-PB-cancel_invitations-without.

**MA-08 — Cross-shop access via `set_active_shop` for a shop they
have no access to.**
- Same as SA-12. Manager raises `no_access_to_shop`.
- Tested by: T-CR-set_active_shop-manager-cross-shop.

**MA-09 — Reading `shop_owner_details` (PII).**
- Attack: manager queries the table.
- Mitigation: §B.4.2 `owner_details_read` requires `view_owner_details`.
  Manager preset has `·`. Empty.
- Tested by: T-PB-view_owner_details-without (manager).

**MA-10 — Editing `monthly_targets` via upsert RPC.**
- Attack: manager calls `upsert_monthly_target(...)`.
- Mitigation: RPC requires `manage_monthly_targets`. Manager preset
  has `·`. Raises.
- Tested by: T-PB-manage_monthly_targets-without.

**MA-11 — Removing a salesperson via direct DML.**
- Attack: manager runs `from('user_shop_access').delete()` or
  `from('user_shop_permissions').delete()`.
- Mitigation: §B.4.8 no DELETE policy. Only `revoke_user_access` RPC,
  which requires `revoke_user_access` permission. Manager preset has
  `·`. Raises.
- Tested by: T-PA-direct-delete-user_shop_access.

**MA-12 — Editing variant attributes shop-wide.**
- Attack: manager calls `create_variant_attribute(...)`.
- Mitigation: RPC requires `manage_variant_attributes`. Manager preset
  has `·` (per D9 lock). Raises.
- Tested by: T-PB-manage_variant_attributes-without.

**MA-13 — Creating customer tiers.**
- Attack: manager calls `define_tier(...)`.
- Mitigation: RPC requires `manage_customer_tiers`. Manager preset has
  `·` (per D11 lock). Raises.
- Tested by: T-PB-manage_customer_tiers-without.

**MA-14 — Setting default customer tier.**
- Attack: manager calls `set_default_tier(...)`.
- Mitigation: RPC requires `manage_customer_tiers`. Raises.
- Tested by: T-PB-manage_customer_tiers-without (set_default_tier).

**MA-15 — Discount limit bypass — manager exceeds their own per-line
or per-invoice cap.**
- Attack: manager calls `record_sale` with discount above 25% / 15%
  preset caps.
- Mitigation: `record_sale` reads
  `user_shop_access.discount_limits` and raises typed error per
  §B.2.4.
- Tested by: T-DC-manager-exceeds-line-pct, T-DC-manager-exceeds-
  invoice-pct.

**MA-16 — Edit own discount limits via direct UPDATE.**
- Attack: manager runs `from('user_shop_access').update({
  discount_limits: '{...}' })`.
- Mitigation: §B.4.8 no UPDATE policy on user_shop_access. Only
  `update_user_discount_limits` RPC, which requires
  `modify_user_discount_limits` permission. Manager preset has `·`.
  Raises.
- Tested by: T-PA-direct-update-user_shop_access (discount_limits).

**MA-17 — Edit shop settings (default policies, alerts).**
- Attack: manager calls `update_shop_settings(...)`.
- Mitigation: RPC requires `edit_shop_settings`. Manager preset has
  `·`. Raises.
- Tested by: T-PB-edit_shop_settings-without.

**MA-18 — Manager 100%-line-discount via implicit price-zero.**
- Same as SA-25; manager's per-line cap (25%) catches the implicit
  100% discount.
- Tested by: T-DC-manager-implicit-zero-price.

**MA-19 — Snapshot `cashier_role` falsification.**
- Rev 2 dropped `cashier_role` column. This attack is moot.
- Tested by: T-OB-cashier_role-dropped-confirmation.

**MA-20 — Reading `customer_outstanding` even when permission revoked
by owner.**
- Attack: manager's `view_customer_outstanding` permission revoked;
  manager queries the view.
- Mitigation: view body returns `outstanding = NULL` for callers
  without the permission. (Manager preset default is `✓`; this tests
  the revoke path.)
- Tested by: T-OV-view_customer_outstanding-revoke-effective.

**MA-21 — Manager reads other managers' sales (positive control;
default preset).**
- Attack: manager A queries `from('invoices_view')` for sales by
  manager B.
- Mitigation: manager preset has `view_all_sales = ✓`. View returns
  all rows in active shop.
- Tested by: T-POS-view_all_sales-with (manager).

**MA-22 — Cross-shop manager with active shop set to wrong shop.**
- Attack: manager at both Shop A and Shop B; active is Shop B;
  queries Shop A invoices.
- Mitigation: RLS predicate is `shop_id = current_active_shop_id()`.
  Returns zero rows for Shop A while active is Shop B.
- Tested by: T-CR-manager-multi-shop-active-isolation.

**MA-23 — Receive_payment without daily cap (positive control).**
- Attack: manager receives 50,000 PKR.
- Mitigation: `receive_payment` body skips cap check when caller is
  not `salesperson preset`. Specifically: cap is enforced when
  `user_shop_access.is_owner = false AND user_role_in_shop equivalent
  via preset_applied = 'salesperson'`. Actually under Rev 2 there's
  no "role" — the cap check fires for any non-owner caller. Then it's
  bounded by `shops.salesperson_payment_cap_pkr` regardless of preset.
- **Edit:** the manager has no separate cap. The cap applies to
  salesperson preset users by default. For Rev 2 we lock the rule as:
  the cap applies to **non-owner callers**. Owner skips. Manager
  pays the cap too unless the owner has explicitly raised
  `salesperson_payment_cap_pkr` (the column name is now misleading;
  consider renaming to `non_owner_payment_cap_pkr` in Phase D — F-PD-05).
- Tested by: T-CAP-manager-default-cap, T-CAP-manager-cap-bypass-via-
  shop-setting.

**MA-24 — Manager edits another manager's expense.**
- Attack: manager A calls `update_expense(<created by manager B>)`.
- Mitigation: RPC body checks `created_by = auth.uid()`. Raises
  `not_expense_creator`.
- Tested by: T-OV-edit_expense-other-creator.

**MA-25 — Manager edits expense outside 24h window.**
- Attack: manager updates a 2-day-old expense.
- Mitigation: RPC body checks `created_at > now() - '24 hours'`.
  Raises `expense_edit_window_expired`.
- Tested by: T-OV-edit_expense-window-expired.

**MA-26 — Manager writes off a batch in a shop they don't belong to.**
- Attack: cross-shop write attempt via batch_id from another shop.
- Mitigation: `record_partial_writeoff` / `deactivate_batch` bodies
  check `p.shop_id = current_active_shop_id()`. Raises
  `batch_not_in_shop_or_inactive`.
- Tested by: T-CR-writeoff_batch-cross-shop.

**MA-27 — Manager reads `user_shop_permission_audit`.**
- Attack: manager queries the audit table.
- Mitigation: §B.4.8 requires owner OR `view_user_audit_log`. Manager
  preset has both `·`. Empty.
- Tested by: T-PB-view_user_audit_log-without (manager).

**MA-28 — Manager calls `complete_onboarding` for a new shop.**
- Same as SA-51; allowed by design.
- Tested by: T-POS-complete_onboarding-manager.

### C.1.3 Owner attacks (internal — multi-shop edge cases) — PRESERVED

These attacks are independent of role/permission model and trace 1:1
to Rev 1.

**OA-01 — Owner at Shop A reads Shop B's data without access.**
- Attack: `set_active_shop('<Shop B>')` for unrelated shop.
- Mitigation: §B.3.3 helper (3) — raises `no_access_to_shop`.
- Tested by: T-CR-set_active_shop-cross-shop (owner).

**OA-02 — Owner grants themselves access at another shop via direct
INSERT.**
- Attack: owner inserts `user_shop_access (user_id=self, shop_id=<B>,
  is_owner=true)`.
- Mitigation: §B.4.8 no INSERT policy on `user_shop_access`. Only
  `accept_invitation` (validates pending invitation) and
  `complete_onboarding` (inserts is_owner=true for caller, on
  caller's own NEW shop) can insert. Plus
  `uq_user_shop_access_one_owner_per_shop` would block a second
  owner row at any existing shop.
- Tested by: T-OA-direct-insert-user_shop_access.

**OA-03 — Owner changes their own permissions or revokes own access.**
- Attack: owner calls `revoke_user_access(p_target_user_id = self)`.
- Mitigation: RPC body raises `cannot_revoke_own_access`. Similarly
  for `modify_user_permission` targeting self (raises
  `cannot_modify_owner` because the owner shortcut returns TRUE for
  every permission anyway, and the RPC has an explicit "cannot target
  the owner" check).
- Tested by: T-OA-cannot-revoke-self, T-OA-cannot-modify-own-permission.

**OA-04 — Owner ownership-transfer attempt (multi-owner row).**
- For v2.9: not applicable. One owner per shop via partial unique
  index.
- Tested by: T-OA-one-owner-per-shop-invariant.

**OA-05 — Owner orphans the shop by attempting to revoke own
ownership.**
- Attack: same as OA-03.
- Mitigation: same. The owner cannot be the target of any user-removal
  or role-change action.
- Tested by: T-OA-cannot-orphan-shop.

**OA-06 — Owner edits `shops.owner_user_id` directly to transfer
ownership covertly.**
- Attack: `from('shops').update({ owner_user_id: '<stranger>' })`.
- Mitigation: per §B.4.2, `shops` has no UPDATE policy (route via
  `update_shop_settings` RPC). The RPC does NOT accept `owner_user_id`
  as a parameter. Defense in depth: `revoke update (owner_user_id) on
  public.shops from authenticated;` (Phase B §B.4.2).
- Closes Rev-1 F-NEW-02.
- Tested by: T-OA-direct-update-shops-owner_user_id.

**OA-07 — Owner triggers re-onboarding with their existing shop's
name.**
- Attack: owner calls `complete_onboarding(<same name as existing
  shop>)`.
- Mitigation: per §B.6 lock — raises
  `already_owner_at_this_email_user_combo`.
- Tested by: T-OA-complete_onboarding-duplicate-name.

### C.1.4 External attacker with stolen credentials (XA) — PRESERVED

**XA-01 — Identifying the role of a logged-in user from public data.**
- Mitigation: §B.4.1 `profiles_self_read` / `profiles_team_read`.
  External attacker without ownership of any shop cannot read other
  users' profiles. With stolen credentials, they see what that
  credential's owner sees.
- Tested by: T-XA-profile-enumeration.

**XA-02 — Brute-forcing the invitation `confirmation_code`.**
- Mitigation: 5-strike auto-cancel per §B.6.3. The
  `failed_attempts` counter increments per wrong attempt; on the 5th,
  status flips to `cancelled` and accept_invitation raises
  `invitation_not_pending`.
- Defense in depth: PostgREST rate-limit at the gateway (F-PD-06 —
  Phase D verifies the per-RPC rate-limit configuration).
- Tested by: T-INV-5-wrong-codes, T-XA-code-brute-force-rate-limit.

**XA-03 — Replaying the invitation magic link.**
- Mitigation: `accept_invitation` raises `invitation_not_pending`
  when status != 'pending'. Supabase magic links are one-time by
  default; verify.
- Residual: attacker has a session for the invited email. Without
  matching the confirmation code AND the invitation being pending,
  no `user_shop_access` row is inserted. The session is harmless
  beyond Supabase Auth defaults.
- Tested by: T-XA-replay-magic-link-after-accept.

**XA-04 — Replaying after access was revoked.**
- Attack: revoked employee retrieves their old invitation_id and
  confirmation_code, tries to re-accept.
- Mitigation: `pending_invitations.status = 'accepted'` blocks
  re-acceptance.
- Tested by: T-XA-replay-after-revoke.

**XA-05 — Stolen credentials of a user whose access was revoked.**
- Attack: attacker uses a still-valid JWT for a revoked user.
- Mitigation: every SHOP-guarded RPC starts with
  `if v_shop_id is null then raise 'no_shop_for_user'`. After
  revoke, the user has no `user_shop_access` row, so
  `current_active_shop_id()` returns NULL.
- Residual: JWT lifetime. Supabase default is 1h. The revoked user
  retains access until JWT expiry. **Documented limitation; cannot
  be closed without remote session invalidation, which is not in
  Supabase Auth's default surface.**
- Tested by: T-XA-revoked-user-active-jwt.

**XA-06 — Permission set discovery via stolen credentials at lower
tier.**
- Attack: attacker steals a salesperson's credential and explores
  what they can/can't do via PostgREST RPC catalog.
- Mitigation: PostgREST exposes the function set, but every RPC's
  authorization check fires at call time. Discovery doesn't grant
  capability.
- Tested by: T-XA-rpc-discovery-doesnt-grant-access.

**XA-07 — Session-token carry-over across shop switch (UX, not
security).**
- Mitigation: TopBar surfaces the active shop clearly. UX concern,
  not RBAC defect.
- Tested by: T-XA-shop-switcher-clarity (UX test, not security).

### C.1.5 Anonymous (NA) — PRESERVED

**NA-01 — Direct PostgREST query to any table without auth token.**
- Mitigation: every RLS policy depends on `auth.uid()` (NULL for
  anon) or `current_active_shop_id()` (NULL for anon). All policies
  fail. Empty result.
- Tested by: T-NA-anonymous-table-read.

**NA-02 — Direct PostgREST RPC call without auth token.**
- Mitigation: every RPC's EXECUTE grant excludes `anon`. PostgREST
  returns 401.
- Tested by: T-NA-anonymous-rpc-call.

**NA-03 — Public schema metadata enumeration.**
- Mitigation: PostgREST limits to grantable schemas; data flow is
  blocked at RLS. Metadata leak is accepted intel surface.
- Tested by: T-NA-schema-metadata.

### C.1.6 NEW: Permission grant tampering attacks (PA)

This class covers attacks on the permission-mutation surface — the
RPCs and tables that manage who has what permissions.

**PA-01 — Non-owner calls `modify_user_permission`.**
- Attack: salesperson or manager calls the RPC to grant themselves a
  permission.
- Mitigation: §B.5.4 RPC requires `modify_user_permissions`. Neither
  preset default has it. Raises `insufficient_permissions`.
- Tested by: T-PA-non-owner-modify_user_permission.

**PA-02 — Non-owner calls `apply_preset_to_user`.**
- Mitigation: same — requires `modify_user_permissions`.
- Tested by: T-PA-non-owner-apply_preset_to_user.

**PA-03 — Non-owner calls `update_user_discount_limits`.**
- Mitigation: §B.5.4 RPC requires `modify_user_discount_limits`.
  Raises.
- Tested by: T-PA-non-owner-update_user_discount_limits.

**PA-04 — Non-owner calls `revoke_user_access`.**
- Mitigation: §B.5.4 RPC requires `revoke_user_access`. Raises.
- Tested by: T-PA-non-owner-revoke_user_access.

**PA-05 — Direct INSERT on `user_shop_permissions`.**
- Attack: any user runs the INSERT.
- Mitigation: §B.4.8 no INSERT policy. RLS denied.
- Tested by: T-PA-direct-insert-user_shop_permissions (all roles).

**PA-06 — Direct UPDATE on `user_shop_permissions.granted`.**
- Mitigation: §B.4.8 no UPDATE policy. RLS denied.
- Tested by: T-PA-direct-update-user_shop_permissions.

**PA-07 — Direct DELETE on `user_shop_permissions`.**
- Mitigation: §B.4.8 no DELETE policy. RLS denied. Cascade-delete
  happens only when the parent `user_shop_access` row is deleted (via
  `revoke_user_access` RPC).
- Tested by: T-PA-direct-delete-user_shop_permissions.

**PA-08 — Direct UPDATE on `user_shop_access.is_owner` to grant self
ownership.**
- Attack: any non-owner runs the UPDATE.
- Mitigation: §B.4.8 no UPDATE policy. RLS denied. Only RPCs
  (`apply_preset_to_user`, `update_user_discount_limits`,
  `change_user_role`) update this table, and none accept `is_owner`
  as a mutable parameter.
- Defense in depth: Phase D should add `revoke update (is_owner) on
  public.user_shop_access from authenticated;` — F-PD-07.
- Tested by: T-PA-direct-update-user_shop_access-is_owner.

**PA-09 — Direct INSERT on `user_shop_permission_audit` to forge
audit trail.**
- Attack: any user inserts a fake audit row to disguise a real action.
- Mitigation: §B.4.8 no INSERT policy on the audit table. Only RPCs
  insert; RPCs are DEFINER and write the correct `actor_user_id =
  auth.uid()`. Forgery via direct INSERT impossible.
- Tested by: T-PA-direct-insert-audit.

**PA-10 — Owner attempts to grant permission with missing dependency.**
- Attack: owner calls `modify_user_permission(user, 'record_purchase',
  true)` without first granting `view_products`, `view_product_cost`,
  `view_purchases`, `view_suppliers`, `view_inventory_batches`.
- Mitigation: `validate_permission_grant` (§B.3.3 helper 7) raises
  `permission_dependency_missing` with detail listing the missing
  requirement.
- Tested by: T-OV-grant-with-missing-dep.

**PA-11 — Owner attempts to revoke a permission while dependents are
granted.**
- Attack: owner calls `modify_user_permission(user, 'view_inventory_batches',
  false)` while target user still has `record_purchase` granted.
- Mitigation: `validate_permission_revoke` (§B.3.3 helper 8) raises
  `cannot_revoke_required_permission` with the dependents listed.
- Tested by: T-OV-revoke-with-dependent.

**PA-12 — Owner attempts to modify the owner's own permissions.**
- Attack: owner calls `modify_user_permission(p_target_user_id = self,
  ...)`.
- Mitigation: RPC body raises `cannot_modify_owner` — the owner has
  every permission via implicit shortcut; the RPC refuses to write a
  row that would be ignored anyway.
- Tested by: T-OA-cannot-modify-own-permission.

**PA-13 — Owner of Shop A calls `modify_user_permission` targeting a
user at Shop B.**
- Attack: owner sets `current_active_shop_id` to Shop A; calls
  modify_user_permission with a `p_target_user_id` that's a member
  of Shop B (but not Shop A).
- Mitigation: RPC body resolves the target's `user_shop_access` row
  for the **current active shop** (`shop_id = current_active_shop_id()`).
  If target is not a member, raises `cannot_modify_owner_or_unknown_user`.
- Tested by: T-PA-modify_user_permission-target-not-in-active-shop.

### C.1.7 NEW: Stale permission cache attacks (CA)

This class covers attacks that depend on observable lag between
permission changes and their runtime effect.

**CA-01 — Owner revokes permission while target user is mid-session.**
- Attack: target had `record_purchase` granted; owner revokes; target
  attempts to call `record_purchase` next.
- Mitigation: `user_has_permission` is `STABLE` (not `IMMUTABLE`) and
  reads `user_shop_permissions` per query. Each RPC call resolves
  the current permission state — no in-DB cache.
- Result: target's next `record_purchase` call raises
  `insufficient_permissions` immediately. No lag at the DB layer.
- Tested by: T-CA-revoke-effective-immediately.

**CA-02 — Owner grants permission while target user is mid-session.**
- Same shape; same mitigation. Grant takes effect on the next RPC call.
- Tested by: T-CA-grant-effective-immediately.

**CA-03 — TanStack Query client-side cache staleness.**
- Attack: target's client has cached "can do X = true" from earlier;
  owner revokes; target's client still shows the action as available
  until cache invalidates.
- Mitigation: client-side cache for permissions is a UX concern, not
  a security boundary. The actual RPC call enforces; the UI just
  shows an unexpected error.
- **F-PD-08:** Phase D adds a `permissions` TanStack Query key with
  `staleTime: 30s` and explicit invalidation in the team-edit UI
  after `modify_user_permission` succeeds. The staleness contract is
  documented: changes apply server-side immediately; client UI may
  briefly show stale state up to 30 seconds.
- Tested by: T-CA-client-cache-staleness-bound.

**CA-04 — `set_active_shop` session variable persistence across
PostgREST request boundaries.**
- Attack: target sets `app.shop_id` via `set_active_shop`, but
  PostgREST pools connections; the next request might land on a
  different backend Postgres session where `app.shop_id` is unset.
- Mitigation: `current_active_shop_id` falls back to "user's only
  shop" if exactly one. If the user has multiple shops AND the
  session variable is lost AND no fallback is unique, returns NULL,
  which trips the SHOP guard's `no_shop_for_user`.
- **F-PD-09:** Phase D needs to verify Supabase's PostgREST connection-
  pool behavior. Two options:
  - (a) Use `set_config('app.shop_id', '<uuid>', false)` (session-
    wide). PostgREST connections live for the request only; the
    variable is lost on next request. The fallback returns NULL if
    multi-shop user, breaking the user.
  - (b) Pass shop_id as a header `app-shop-id` and have a
    pre-request PostgREST hook set the config. Per-request, works for
    multi-shop users.
  - (c) Pass shop_id explicitly to every RPC as a parameter. Bloats
    every RPC signature.
- Recommended: option (b). Document the per-request session-variable
  pattern in Phase D.
- Tested by: T-CA-set_active_shop-cross-request-persistence.

**CA-05 — Owner reads stale permissions via the `permissions_catalog`
table during a migration.**
- Attack: Anthropic migration is mid-run (deactivating a permission);
  another session reads the catalog and sees inconsistent state.
- Mitigation: migrations should wrap catalog changes in a single
  transaction. Multi-statement catalog updates are atomic.
- Tested by: T-CA-catalog-migration-atomicity (deferred to migration
  testing in Phase D).

**CA-06 — JWT carries stale permission claims (Supabase doesn't put
permissions in JWT).**
- Mitigation: Supabase JWT contains `sub` (user_id), `aud`, `exp`,
  and minimal claims. Permissions are queried per-call, not embedded.
  No JWT cache invalidation needed.
- Tested by: (none — verified by reading Supabase JWT structure).

### C.1.8 NEW: Preset drift on feature ship (DA)

This class covers the behavior of new permissions added in future
migrations.

**DA-01 — New permission added in v2.9.1 migration; verify owner sees
TRUE.**
- Mitigation: `user_has_permission(shop_id, new_key)` short-circuits to
  TRUE for `is_owner = true`. No `user_shop_permissions` row needed.
- Tested by: T-DA-new-permission-owner-implicit-true.

**DA-02 — New permission added; verify existing manager sees FALSE.**
- Mitigation: missing-row default is FALSE. Manager preset's existing
  `user_shop_permissions` rows don't include the new key.
- Tested by: T-DA-new-permission-existing-manager-false.

**DA-03 — New permission added; verify existing salesperson sees
FALSE.**
- Same as DA-02.
- Tested by: T-DA-new-permission-existing-salesperson-false.

**DA-04 — New invitation created AFTER v2.9.1 migration ships the new
permission.**
- Verify: the invitation's snapshot includes the new permission with
  the catalog's `preset_<role>_default` value.
- Tested by: T-DA-invitation-after-migration-includes-new-key.

**DA-05 — Pending invitation from BEFORE v2.9.1; invitee accepts
AFTER.**
- Verify: the invitation's snapshot was captured at create time; the
  new permission is not in it. After accept, `user_has_permission`
  for the new key returns FALSE (no row, defaults to FALSE).
- This is the expected behavior per §B.6.3 E9.
- Tested by: T-DA-invitation-before-migration-snapshot-stable.

**DA-06 — Catalog row deactivated (`is_active = false`) while users
have grants for the key.**
- Verify: existing `user_shop_permissions` rows for the deactivated
  key still drive runtime checks. The catalog row exists, just
  inactive — the FK is intact.
- Behavior: `user_has_permission` reads the granted value regardless
  of `is_active`. The deactivated permission effectively becomes
  vestigial (no RPC references it). Phase D adds a cleanup pass to
  delete `user_shop_permissions` rows for inactive keys after a grace
  period.
- Tested by: T-DA-catalog-deactivation-existing-grants-honored.

### C.1.9 NEW: Permission set enumeration (EA)

This class covers attacks that aim to learn other users' permission
sets without authorization.

**EA-01 — Salesperson queries `from('user_shop_permissions').select('*')`.**
- Attack: salesperson tries to see colleagues' permissions.
- Mitigation: §B.4.8 `usp_self_or_owner_read` admits: own row OR
  owner OR `user_has_permission(shop_id, 'view_team')`. Salesperson
  preset has `view_team = ·`. Returns only own row.
- Tested by: T-EA-user_shop_permissions-self-only (salesperson).

**EA-02 — Salesperson queries `from('user_shop_access').select('*')`.**
- Attack: salesperson tries to see the full team list.
- Mitigation: §B.4.8 `usa_self_or_owner_read` admits self OR owner.
  Salesperson sees only own row.
- Tested by: T-EA-user_shop_access-self-only (salesperson).

**EA-03 — Salesperson calls `get_team_for_active_shop()`.**
- Mitigation: §B.5.4 RPC requires `view_team`. Raises
  `insufficient_permissions`.
- Tested by: T-EA-get_team_for_active_shop-without.

**EA-04 — Salesperson calls `get_user_permissions(other_user_id)`.**
- Mitigation: §B.5.4 RPC requires `view_team`. Raises.
- Tested by: T-EA-get_user_permissions-without.

**EA-05 — Manager (default preset, `view_team = ·`) calls the team
RPCs.**
- Mitigation: same — `view_team` required. Manager preset has `·`.
- Tested by: T-EA-get_team_for_active_shop-manager-without.

**EA-06 — Any authenticated user reads `permissions_catalog`.**
- Attack: trying to learn the catalog structure.
- Mitigation: §B.4.8 `pc_read` policy grants SELECT to all
  authenticated users. **By design.** The catalog is the UI's source
  for permission display; hiding it would break the team-management
  UI for owners.
- Residual: catalog schema is intel; not security-relevant in the
  threat model.
- Tested by: T-EA-permissions_catalog-readable-by-all.

**EA-07 — Permission probing via RPC error messages.**
- Attack: attacker calls each RPC; some succeed, some return
  `insufficient_permissions`. The pattern reveals their permission set.
- Mitigation: not closeable in design — `insufficient_permissions`
  is the correct response; alternative is silent-fail-or-deny which
  is worse UX. The attacker probing their OWN permission set isn't a
  privilege boundary issue.
- Cross-shop probing: attacker switches active shop and probes; same
  shape; informs them what they have at each shop they're a member
  of. Acceptable.
- Tested by: T-EA-probing-self-permissions-acceptable.

### C.1.10 NEW: Permission-based privilege escalation via social engineering (SE)

This class covers attacks where the attacker socially engineers the
owner into granting permissions, then exploits the granted permission.

**SE-01 — Attacker convinces owner to grant `view_team`.**
- Attack: "I need to coordinate with the cashiers." Owner grants
  `view_team`. Attacker now sees team list + permissions + audit log
  (if granted view_user_audit_log).
- Mitigation: `view_team` alone is read-only. It enables intel
  collection but not direct privilege escalation. The audit log
  shows the grant action attributed to the owner.
- Tested by: T-SE-view_team-grant-audit-trail.

**SE-02 — Attacker convinces owner to grant `modify_user_permissions`.**
- Attack: "I need to manage permissions while you're traveling."
  Owner grants the permission. Attacker now grants themselves
  `view_sale_cost`, `view_profit_margin`, `view_owner_details`, etc.
- Mitigation: every grant action writes to
  `user_shop_permission_audit` with `actor_user_id = attacker_user_id`.
  The owner can review the audit log later and detect the chain.
- **F-PD-10:** Phase D adds an email notification to the owner on
  any `modify_user_permission` action targeting users other than the
  actor — owner sees who's granting what to whom in near-real-time.
- Tested by: T-SE-modify_user_permissions-chained-grants-audit.

**SE-03 — Audit trail catches a grant chain.**
- Verify: Asad is granted `modify_user_permissions`; Asad grants
  himself `view_sale_cost` + `view_profit_margin` + `view_owner_details`.
  Owner reads `user_shop_permission_audit`; sees:
  1. Action `permission_granted`, target=Asad, perm=`modify_user_permissions`,
     actor=owner.
  2. Action `permission_granted`, target=Asad, perm=`view_sale_cost`,
     actor=Asad.
  3. Action `permission_granted`, target=Asad, perm=`view_profit_margin`,
     actor=Asad.
  4. Action `permission_granted`, target=Asad, perm=`view_owner_details`,
     actor=Asad.
- The pattern is detectable: self-grants by a recently-promoted user.
- Tested by: T-SE-self-grant-chain-detectable.

**SE-04 — Attacker grants permissions to a confederate account they
control.**
- Attack: Asad creates a friend account, owner approves invitation as
  salesperson, then Asad (with `modify_user_permissions`) grants the
  friend `view_sale_cost` etc.
- Mitigation: audit shows actor=Asad, target=friend, for each grant.
  Owner detects via audit log.
- Tested by: T-SE-confederate-account-grants-attributed.

**SE-05 — Attacker exploits the 24h invitation window to invite a
confederate quickly.**
- Attack: Asad has `invite_users` (improbable but possible if owner
  granted it). Asad invites a friend's email. Friend accepts with the
  4-digit code. Friend now has whatever permissions Asad granted in
  the invitation overrides.
- Mitigation: audit shows actor=Asad inviting; every grant is
  attributed. The 4-digit code requires verbal coordination (so the
  friend has to know it from Asad, which is plausible).
- Owner's recourse: audit log + revoke the invited user.
- Tested by: T-SE-invitation-by-confederate-attributed.

---

## C.2 Validation test matrix (RESTRUCTURED for permission model)

The matrix follows the four-section structure required by Instruction 2:
- §C.2.1 — Permission boundary tests (a)
- §C.2.2 — Preset application tests (b)
- §C.2.3 — Override tests (c)
- §C.2.4 — Audit boundary tests (d)
- §C.2.5 — Cross-shop tests (preserved)
- §C.2.6 — Invitation flow tests (preserved + Rev 2 additions)
- §C.2.7–§C.2.11 — Test sections for the five new attack classes
- §C.2.12 — Subscription guard tests (preserved)
- §C.2.13 — Anonymous tests (preserved)

### C.2.0 Test environment requirements

- Clean test database, isolated from production.
- Two test shops: Shop X (founded by owner-x), Shop Y (founded by owner-y).
- Test users:
  - `owner-x@test.local` — owner at Shop X
  - `owner-y@test.local` — owner at Shop Y
  - `manager-x@test.local` — manager preset at Shop X
  - `salesperson-x@test.local` — salesperson preset at Shop X
  - `manager-x-custom@test.local` — manager preset at Shop X but with
    permission overrides (e.g., `view_sale_cost` granted, used for
    override tests)
  - `salesperson-x-custom@test.local` — salesperson with overrides
  - `cross-shop@test.local` — manager at Shop X AND salesperson at
    Shop Y, used for cross-shop tests
- Pre-staged data:
  - 5 products (2 batched, 1 multi-variant), 5 customers (2 with
    outstanding balances), 5 sales (3 by salesperson-x, 2 by
    manager-x), 3 purchases by manager-x, 3 expenses.
  - The permissions_catalog seeded from the v2.9 migration (50 rows).

### C.2.1 Permission boundary tests (a)

**For every permission in the catalog, two tests:**
- WITH: a user with the permission granted performs the gated action — succeeds.
- WITHOUT: a user without the permission performs the same action — fails with the specific error code OR returns empty rows (read-side).

Test ID format: `T-PB-<permission_key>-{with|without}[-<variant>]`.

**Verbose enumeration per permission, grouped by category.**

#### C.2.1.1 SALES (5 permissions × multiple test points each)

`record_sale`:
- T-PB-record_sale-with: user with permission calls `record_sale(...)` → succeeds, inserts invoice.
- T-PB-record_sale-without: user without permission calls `record_sale(...)` → raises `insufficient_permissions` (detail: `Required: record_sale`).
- T-PB-record_sale-without-preflight: user without permission calls `preflight_expired_sale_check(...)` → raises `insufficient_permissions` (RPC also requires record_sale per §B.5.1).

`view_all_sales`:
- T-PB-view_all_sales-with-view: with permission, `from('invoices_view').select('*').neq('cashier_id', self_id)` → returns colleagues' sales.
- T-PB-view_all_sales-without-view: without permission, same query → returns only rows where `cashier_id = self_id`.
- T-PB-view_all_sales-with-sale_items_view: with, `from('sale_items_view').select('*').not.eq(...)` → returns colleagues' line items.
- T-PB-view_all_sales-without-sale_items_view: without, same → only own.

`view_sale_cost`:
- T-PB-view_sale_cost-with-raw: with permission, `from('sale_items').select('cost_at_sale')` → returns the column populated.
- T-PB-view_sale_cost-without-raw: without permission, same query → empty rows (RLS denies).
- T-PB-view_sale_cost-with-view-cost_at_sale: with, `from('sale_items_view').select('cost_at_sale')` → populated.
- T-PB-view_sale_cost-without-view-cost_at_sale: without, same → column is NULL.
- T-PB-view_sale_cost-with-view-line_profit: with, `from('sale_items_view').select('line_profit')` → populated.
- T-PB-view_sale_cost-without-view-line_profit: without, same → NULL.
- T-PB-view_sale_cost-with-invoices_view-gross_profit: with, `from('invoices_view').select('gross_profit')` → populated.
- T-PB-view_sale_cost-without-invoices_view-gross_profit: without → NULL.
- T-PB-view_sale_cost-with-monthly_summary_view: with, `from('monthly_summary_view').select('gross_profit')` → populated.
- T-PB-view_sale_cost-without-monthly_summary_view: without → NULL (or row filtered by view_reports).

`view_profit_margin`:
- T-PB-view_profit_margin-with-view: with, `from('invoices_view').select('gross_margin_percent')` → populated.
- T-PB-view_profit_margin-without-view: without → NULL.
- T-PB-view_profit_margin-with-sale_items_view-margin_percent: with, on sale_items_view if exposed → populated.
- T-PB-view_profit_margin-without-sale_items_view-margin_percent: without → NULL.

`reprint_receipt`:
- T-PB-reprint_receipt: this is a UI-only gate; no DB-level RPC corresponds. Document as a client-only test in Phase D acceptance.

#### C.2.1.2 PRODUCTS (7 permissions)

`view_products`:
- T-PB-view_products-with-view: with permission, `from('products_view').select('id, name')` → rows visible.
- T-PB-view_products-without-view: without permission, same query → empty rows.
- T-PB-view_products-with-search_products_count: with, `rpc('search_products_count')` → returns count.
- T-PB-view_products-without-search_products_count: without → `insufficient_permissions`.
- T-PB-view_products-with-search_categories: with, `rpc('search_categories')` → returns rows.
- T-PB-view_products-without-search_categories: without → `insufficient_permissions`.
- T-PB-view_products-with-search_variant_attributes: with → returns.
- T-PB-view_products-without-search_variant_attributes: without → `insufficient_permissions`.
- T-PB-view_products-with-list_attribute_values: with → returns.
- T-PB-view_products-without-list_attribute_values: without → `insufficient_permissions`.

`view_product_cost`:
- T-PB-view_product_cost-with-raw-products: with, `from('products').select('avg_cost')` → populated.
- T-PB-view_product_cost-without-raw-products: without → empty rows.
- T-PB-view_product_cost-with-raw-variants: with, `from('product_variants').select('avg_cost')` → populated.
- T-PB-view_product_cost-without-raw-variants: without → empty rows.
- T-PB-view_product_cost-with-view-projection: with, `from('products_view').select('avg_cost')` → populated.
- T-PB-view_product_cost-without-view-projection: without → NULL.
- T-PB-view_product_cost-with-search_products: with, `rpc('search_products')` → returns rows.
- T-PB-view_product_cost-without-search_products: without → `insufficient_permissions`.
- T-PB-view_product_cost-with-recent_purchase_products: with → returns.
- T-PB-view_product_cost-without-recent_purchase_products: without → `insufficient_permissions`.

`create_product`:
- T-PB-create_product-with-opening: with permission, `rpc('create_product_with_opening_stock')` → succeeds.
- T-PB-create_product-without-opening: without → `insufficient_permissions`.
- T-PB-create_product-with-variants: with, `rpc('create_product_with_variants')` → succeeds.
- T-PB-create_product-without-variants: without → `insufficient_permissions`.
- T-PB-create_product-with-add_variant: with, `rpc('add_variant_to_product')` → succeeds.
- T-PB-create_product-without-add_variant: without → `insufficient_permissions`.
- T-PB-create_product-direct-insert-all-roles: any user `from('products').insert(...)` → RLS denied for non-owner (per §B.4.3; INSERT policy requires `create_product` but the design routes via RPC).

`edit_product`:
- T-PB-edit_product-with-direct: with permission, `from('products').update({name: '...'})` → succeeds.
- T-PB-edit_product-without-direct: without → RLS denied.
- T-PB-edit_product-with-variants: with, `from('product_variants').update({price: ...})` → succeeds.
- T-PB-edit_product-without-variants: without → RLS denied.

`archive_product`:
- T-PB-archive_product-with: with permission (plus edit_product per dep), `from('products').update({is_active: false})` → succeeds.
- T-PB-archive_product-without-archive: with edit_product but without archive_product, same update → trigger raises `insufficient_permissions` (per Phase D archive-trigger detail).
- T-PB-archive_product-without-both: without either → RLS denied (edit_product gate fires first).

`manage_product_categories`:
- T-PB-manage_product_categories-with-create: with, `rpc('create_category_inline')` → succeeds.
- T-PB-manage_product_categories-without-create: without → `insufficient_permissions`.
- T-PB-manage_product_categories-with-update: with, `rpc('update_category')` → succeeds.
- T-PB-manage_product_categories-without-update: without → `insufficient_permissions`.

`manage_product_packs`:
- T-PB-manage_product_packs-with-define: with, `rpc('define_pack_inline')` → succeeds.
- T-PB-manage_product_packs-without-define: without → `insufficient_permissions`.
- T-PB-manage_product_packs-with-update: with, `rpc('update_pack')` → succeeds.
- T-PB-manage_product_packs-without-update: without → `insufficient_permissions`.
- T-PB-manage_product_packs-with-deactivate: with, `rpc('deactivate_pack')` → succeeds.
- T-PB-manage_product_packs-without-deactivate: without → `insufficient_permissions`.

#### C.2.1.3 INVENTORY (7 permissions)

`view_inventory_batches`:
- T-PB-view_inventory_batches-with-view: with, `from('inventory_batches_view').select('*')` → rows.
- T-PB-view_inventory_batches-without-view: without → empty rows.

`view_batch_cost`:
- T-PB-view_batch_cost-with-raw: with, `from('inventory_batches').select('cost_per_unit')` → populated.
- T-PB-view_batch_cost-without-raw: without → empty rows.
- T-PB-view_batch_cost-with-view: with, `from('inventory_batches_view').select('cost_per_unit')` → populated.
- T-PB-view_batch_cost-without-view: without → NULL.

`view_purchases`:
- T-PB-view_purchases-with-raw: with, `from('purchases').select('*')` → rows.
- T-PB-view_purchases-without-raw: without → empty.
- T-PB-view_purchases-with-items: with, `from('purchase_items').select('cost_at_purchase')` → populated.
- T-PB-view_purchases-without-items: without → empty.
- T-PB-view_purchases-with-overhead: with, `from('purchase_overhead_items')` → rows.
- T-PB-view_purchases-without-overhead: without → empty.
- T-PB-view_purchases-with-search: with, `rpc('search_purchases')` → returns.
- T-PB-view_purchases-without-search: without → `insufficient_permissions`.

`record_purchase`:
- T-PB-record_purchase-with: with permission (and 5 dep permissions), `rpc('record_purchase')` → succeeds.
- T-PB-record_purchase-without: without permission, same → `insufficient_permissions`.
- T-PB-record_purchase-with-suggest_batch_no: with, `rpc('suggest_batch_no')` → returns.
- T-PB-record_purchase-without-suggest_batch_no: without → `insufficient_permissions`.

`writeoff_batch`:
- T-PB-writeoff_batch-with-deactivate: with permission (and view_inventory_batches + view_batch_cost deps), `rpc('deactivate_batch')` → succeeds.
- T-PB-writeoff_batch-without-deactivate: without → `insufficient_permissions`.
- T-PB-writeoff_batch-with-partial: with, `rpc('record_partial_writeoff')` → succeeds.
- T-PB-writeoff_batch-without-partial: without → `insufficient_permissions`.

`edit_product_expiry_overrides`:
- T-PB-edit_product_expiry_overrides-with: with permission (and edit_product dep), update `products.expired_sale_policy` / `expiry_alert_days` → succeeds (via the edit_product RLS path, with no additional column-level block needed since edit_product covers this).
- T-PB-edit_product_expiry_overrides-without: without permission, update those specific columns → blocked at the RPC layer or trigger (Phase D detail).
- Note: this is a finer-grained permission carved out of edit_product. Phase D may implement it as a column-level trigger or as a dedicated RPC.

`confirm_expired_sale_at_pos`:
- T-PB-confirm_expired_sale_at_pos-with: with permission, `rpc('record_sale', {..., p_confirm_expired_sale: true})` for a warn-policy batched product → succeeds.
- T-PB-confirm_expired_sale_at_pos-without: without permission, same call → raises `expired_stock_needs_confirmation` (or `insufficient_permissions` if Phase D opts to block the call entirely).
- **F-PD-11**: Phase D must add the permission check in record_sale's warn-branch.

#### C.2.1.4 CUSTOMERS (9 permissions)

`view_customers`:
- T-PB-view_customers-with-view: with, `from('customers_view').select('id, name')` → rows.
- T-PB-view_customers-without-view: without → empty.
- T-PB-view_customers-with-recent: with, `rpc('recent_customers')` → returns.
- T-PB-view_customers-without-recent: without → `insufficient_permissions`.

`view_customer_contact`:
- T-PB-view_customer_contact-with-raw: with, `from('customers').select('phone, address')` → populated.
- T-PB-view_customer_contact-without-raw: without → empty rows (RLS denies raw read).
- T-PB-view_customer_contact-with-view-phone: with, `from('customers_view').select('phone')` → populated.
- T-PB-view_customer_contact-without-view-phone: without → NULL.
- T-PB-view_customer_contact-with-view-address: with → populated.
- T-PB-view_customer_contact-without-view-address: without → NULL.
- T-PB-view_customer_contact-with-list: with, `rpc('list_customers')` → returns phone/address.
- T-PB-view_customer_contact-without-list: without → `insufficient_permissions`.

`view_customer_outstanding`:
- T-PB-view_customer_outstanding-with-view: with permission, `from('customers_view').select('outstanding_balance_visible')` → populated.
- T-PB-view_customer_outstanding-without-view: without → NULL; `has_khata` boolean still visible.
- T-PB-view_customer_outstanding-with-customer_outstanding_view: with, `from('customer_outstanding')` → `outstanding` populated.
- T-PB-view_customer_outstanding-without-customer_outstanding_view: without → `outstanding` is NULL.

`create_customer_basic`:
- T-PB-create_customer_basic-with: with, `rpc('create_customer_basic')` → succeeds.
- T-PB-create_customer_basic-without: without → `insufficient_permissions`.

`create_customer_full`:
- T-PB-create_customer_full-with: with permission (and dep create_customer_basic + view_customer_contact), `rpc('create_customer_full')` → succeeds.
- T-PB-create_customer_full-without: without permission → `insufficient_permissions`.
- T-PB-create_customer_full-with-tier-no-assign: with permission but without `assign_customer_tier`, calling with non-null `p_tier_id` → raises `insufficient_permissions` (assign_customer_tier additional gate).
- T-PB-create_customer_full-with-tier-and-assign: with both → succeeds with tier set.

`edit_customer`:
- T-PB-edit_customer-with: with permission, `from('customers').update({...})` → succeeds.
- T-PB-edit_customer-without: without → RLS denied.
- T-PB-edit_customer-tier-without-assign: with edit_customer but without assign_customer_tier, updating `tier_id` → blocked (Phase D implements column-level trigger or in-RPC check; F-PD-12).

`view_customer_khata`:
- T-PB-view_customer_khata-with-raw: with, `from('ledger_entries').select('*')` → rows.
- T-PB-view_customer_khata-without-raw: without → empty.
- T-PB-view_customer_khata-with-search: with, `rpc('search_khata_customers')` → returns.
- T-PB-view_customer_khata-without-search: without → `insufficient_permissions`.

`assign_customer_tier`:
- T-PB-assign_customer_tier-with: with edit_customer + assign_customer_tier, `from('customers').update({tier_id: ...})` → succeeds.
- T-PB-assign_customer_tier-without-with-edit: with edit_customer but without assign_customer_tier → blocked (Phase D detail).

`manage_customer_tiers`:
- T-PB-manage_customer_tiers-with-define: with, `rpc('define_tier')` → succeeds.
- T-PB-manage_customer_tiers-without-define: without → `insufficient_permissions`.
- T-PB-manage_customer_tiers-with-update: with, `rpc('update_tier')` → succeeds.
- T-PB-manage_customer_tiers-without-update: without → `insufficient_permissions`.
- T-PB-manage_customer_tiers-with-set_default: with, `rpc('set_default_tier')` → succeeds.
- T-PB-manage_customer_tiers-without-set_default: without → `insufficient_permissions`.
- T-PB-manage_customer_tiers-with-deactivate: with, `rpc('deactivate_tier')` → succeeds.
- T-PB-manage_customer_tiers-without-deactivate: without → `insufficient_permissions`.

#### C.2.1.5 SUPPLIERS (2 permissions)

`view_suppliers`:
- T-PB-view_suppliers-with-raw: with, `from('suppliers').select('*')` → rows.
- T-PB-view_suppliers-without-raw: without → empty.
- T-PB-view_suppliers-with-search: with, `rpc('search_suppliers')` → returns.
- T-PB-view_suppliers-without-search: without → `insufficient_permissions`.
- T-PB-view_suppliers-with-recent: with, `rpc('recent_suppliers')` → returns.
- T-PB-view_suppliers-without-recent: without → `insufficient_permissions`.

`manage_suppliers`:
- T-PB-manage_suppliers-with-create: with, `rpc('create_supplier_inline')` → succeeds.
- T-PB-manage_suppliers-without-create: without → `insufficient_permissions`.
- T-PB-manage_suppliers-with-update: with, `from('suppliers').update({...})` → succeeds (RLS gate).
- T-PB-manage_suppliers-without-update: without → RLS denied.

#### C.2.1.6 FINANCIAL (8 permissions)

`receive_payment`:
- T-PB-receive_payment-with: with permission (and deps view_customers + view_customer_outstanding), `rpc('receive_payment')` → succeeds (subject to cap).
- T-PB-receive_payment-without: without → `insufficient_permissions`.

`reverse_ledger_entry`:
- T-PB-reverse_ledger_entry-with: with permission (and dep view_customer_khata), `rpc('reverse_ledger_entry')` → succeeds.
- T-PB-reverse_ledger_entry-without: without → `insufficient_permissions`.

`view_expenses`:
- T-PB-view_expenses-with-raw: with, `from('expenses').select('*')` → rows.
- T-PB-view_expenses-without-raw: without → empty.

`create_expense`:
- T-PB-create_expense-with-rpc: with, `rpc('create_expense')` → succeeds.
- T-PB-create_expense-without-rpc: without → `insufficient_permissions`.
- T-PB-create_expense-with-direct: with, `from('expenses').insert({...})` → succeeds (RLS gate).
- T-PB-create_expense-without-direct: without → RLS denied.

`edit_expense`:
- T-PB-edit_expense-with-own-recent: with, `rpc('update_expense')` on own expense < 24h → succeeds.
- T-PB-edit_expense-without: without → `insufficient_permissions`.
- T-PB-edit_expense-with-other-creator: with permission but on another user's expense → raises `not_expense_creator`.
- T-PB-edit_expense-with-old: with permission on own expense > 24h → raises `expense_edit_window_expired`.

`view_monthly_targets`:
- T-PB-view_monthly_targets-with-raw: with, `from('monthly_targets').select('*')` → rows.
- T-PB-view_monthly_targets-without-raw: without → empty.

`manage_monthly_targets`:
- T-PB-manage_monthly_targets-with-upsert: with permission (and dep view_monthly_targets), `rpc('upsert_monthly_target')` → succeeds.
- T-PB-manage_monthly_targets-without-upsert: without → `insufficient_permissions`.

`view_reports`:
- T-PB-view_reports-with-monthly_summary: with, `from('monthly_summary_view')` → rows.
- T-PB-view_reports-without-monthly_summary: without → empty.
- T-PB-view_reports-with-daily_sales_7: with, `from('daily_sales_7')` (existing v1 view, now wrapped in permission gate per Phase D update) → rows.
- T-PB-view_reports-without-daily_sales_7: without → empty.

#### C.2.1.7 SETTINGS (5 permissions)

`edit_shop_settings`:
- T-PB-edit_shop_settings-with: with, `rpc('update_shop_settings')` → succeeds.
- T-PB-edit_shop_settings-without: without → `insufficient_permissions`.
- T-PB-edit_shop_settings-direct-update-denied: any user `from('shops').update({...})` → RLS denied (no UPDATE policy per Rev 2).

`view_owner_details`:
- T-PB-view_owner_details-with-raw: with, `from('shop_owner_details').select('*')` → rows.
- T-PB-view_owner_details-without-raw: without → empty.

`edit_owner_details`:
- T-PB-edit_owner_details-with: with permission (and dep view_owner_details), `rpc('update_owner_details')` → succeeds.
- T-PB-edit_owner_details-without: without → `insufficient_permissions`.

`manage_units_of_measure`:
- T-PB-manage_units_of_measure-with-insert: with, `from('units_of_measure').insert({...})` → succeeds (RLS gate).
- T-PB-manage_units_of_measure-without-insert: without → RLS denied.
- T-PB-manage_units_of_measure-with-update: with, `from('units_of_measure').update({...})` → succeeds.
- T-PB-manage_units_of_measure-without-update: without → RLS denied.

`manage_variant_attributes`:
- T-PB-manage_variant_attributes-with-create_attr: with, `rpc('create_variant_attribute')` → succeeds.
- T-PB-manage_variant_attributes-without-create_attr: without → `insufficient_permissions`.
- T-PB-manage_variant_attributes-with-update_attr: with, `rpc('update_variant_attribute')` → succeeds.
- T-PB-manage_variant_attributes-without-update_attr: without → `insufficient_permissions`.
- T-PB-manage_variant_attributes-with-deactivate_attr: with, `rpc('deactivate_variant_attribute')` → succeeds.
- T-PB-manage_variant_attributes-without-deactivate_attr: without → `insufficient_permissions`.
- T-PB-manage_variant_attributes-with-add_value: with, `rpc('add_variant_value')` → succeeds.
- T-PB-manage_variant_attributes-without-add_value: without → `insufficient_permissions`.
- T-PB-manage_variant_attributes-with-update_value: with, `rpc('update_variant_value')` → succeeds.
- T-PB-manage_variant_attributes-without-update_value: without → `insufficient_permissions`.
- T-PB-manage_variant_attributes-with-deactivate_value: with, `rpc('deactivate_variant_value')` → succeeds.
- T-PB-manage_variant_attributes-without-deactivate_value: without → `insufficient_permissions`.

#### C.2.1.8 TEAM (7 permissions)

`view_team`:
- T-PB-view_team-with-rpc: with, `rpc('get_team_for_active_shop')` → returns rows.
- T-PB-view_team-without-rpc: without → `insufficient_permissions`.
- T-PB-view_team-with-get_user_permissions: with, `rpc('get_user_permissions', {p_target_user_id: ...})` → returns rows.
- T-PB-view_team-without-get_user_permissions: without → `insufficient_permissions`.
- T-PB-view_team-with-user_shop_access-read: with, `from('user_shop_access').select('*')` → returns shop's team rows.
- T-PB-view_team-without-user_shop_access-read: without → only own row.

`invite_users`:
- T-PB-invite_users-with: with permission (and dep view_team), `rpc('create_invitation')` → succeeds.
- T-PB-invite_users-without: without → `insufficient_permissions`.

`cancel_invitations`:
- T-PB-cancel_invitations-with: with, `rpc('cancel_invitation')` → succeeds.
- T-PB-cancel_invitations-without: without → `insufficient_permissions`.

`modify_user_permissions`:
- T-PB-modify_user_permissions-with: with, `rpc('modify_user_permission')` → succeeds.
- T-PB-modify_user_permissions-without: without → `insufficient_permissions`.
- T-PB-modify_user_permissions-with-apply_preset: with, `rpc('apply_preset_to_user')` → succeeds.
- T-PB-modify_user_permissions-without-apply_preset: without → `insufficient_permissions`.

`modify_user_discount_limits`:
- T-PB-modify_user_discount_limits-with: with, `rpc('update_user_discount_limits')` → succeeds.
- T-PB-modify_user_discount_limits-without: without → `insufficient_permissions`.

`revoke_user_access`:
- T-PB-revoke_user_access-with: with, `rpc('revoke_user_access')` → succeeds.
- T-PB-revoke_user_access-without: without → `insufficient_permissions`.

`view_user_audit_log`:
- T-PB-view_user_audit_log-with: with, `from('user_shop_permission_audit').select('*')` → returns rows.
- T-PB-view_user_audit_log-without: without → empty rows.

**Total tests in C.2.1: ~190 tests across 50 permissions.**

### C.2.2 Preset application tests (b)

For each preset, applying it to a fresh user produces the expected
permission set. Plus invariants:

#### C.2.2.1 Owner preset (implicit, via `complete_onboarding`)

- T-PA-onboarding-owner-row-inserted: after `complete_onboarding`, `user_shop_access (user_id, shop_id, is_owner = true)` row exists.
- T-PA-onboarding-no-user_shop_permissions-rows: after onboarding, owner has zero rows in `user_shop_permissions` (implicit shortcut applies).
- T-PA-owner-implicit-true-every-key: for every key in `permissions_catalog`, `user_has_permission(shop_id, key)` returns TRUE for the owner.
- T-PA-owner-cannot-be-revoked: `revoke_user_access` targeting owner → raises `cannot_revoke_owner_access`.
- T-PA-owner-cannot-be-modified: `modify_user_permission` targeting owner → raises `cannot_modify_owner`.

#### C.2.2.2 Manager preset (via `apply_preset_to_user`)

- T-PA-apply-manager-preset: `apply_preset_to_user(target, 'manager')` inserts 50 rows in `user_shop_permissions` for the target, each with `granted = preset_manager_default`.
- T-PA-manager-preset-32-on: 32 permissions in `user_shop_permissions` for the target have `granted = true`. Verify each key.
- T-PA-manager-preset-18-off: 18 permissions have `granted = false`. Verify each key.
- T-PA-manager-preset-source: every row has `source = 'preset'`.
- T-PA-manager-preset-preset_applied-stamp: `user_shop_access.preset_applied = 'manager'`.
- T-PA-manager-preset-audit-row: a `user_shop_permission_audit` row exists with `action = 'preset_applied'`.

#### C.2.2.3 Salesperson preset

- T-PA-apply-salesperson-preset: `apply_preset_to_user(target, 'salesperson')` inserts 50 rows.
- T-PA-salesperson-preset-10-on: 10 specific permissions have `granted = true` — verify each is exactly:
  `record_sale`, `reprint_receipt`, `view_products`, `view_inventory_batches`,
  `confirm_expired_sale_at_pos`, `view_customers`, `view_customer_contact`,
  `view_customer_outstanding`, `create_customer_basic`, `receive_payment`.
- T-PA-salesperson-preset-40-off: the other 40 have `granted = false`. Verify.
- T-PA-salesperson-preset-source: every row has `source = 'preset'`.
- T-PA-salesperson-preset-preset_applied-stamp: `user_shop_access.preset_applied = 'salesperson'`.
- T-PA-salesperson-preset-audit-row: audit row written.

#### C.2.2.4 Preset dependency consistency

- T-PA-manager-preset-deps-satisfied: every permission granted in the manager preset has all its `requires` permissions also granted. Run `validate_permission_grant` for each granted manager-preset key — should not raise.
- T-PA-salesperson-preset-deps-satisfied: same check for salesperson preset.

#### C.2.2.5 Preset re-application

- T-PA-re-apply-manager-preset: re-running `apply_preset_to_user(target, 'manager')` after the user has manual overrides → upserts all 50 rows back to preset defaults; source flips back to `'preset'`. Audit row written.
- T-PA-switch-preset: applying `salesperson` to a `manager`-preset user → all 50 rows update to salesperson defaults; preset_applied stamp flips.

### C.2.3 Override tests (c)

These tests verify the per-permission grant/revoke RPCs behave
correctly on top of a preset, including dependency enforcement.

#### C.2.3.1 Simple grant / revoke

- T-OV-grant-single-permission: owner calls `modify_user_permission(target, 'view_sale_cost', true)` on a manager-preset user (default `·`) → row updated to `granted = true`, source = 'manual'. Target can now read `cost_at_sale`.
- T-OV-revoke-single-permission: owner calls `modify_user_permission(target, 'view_products', false)` on a manager-preset user (default `✓`) → row updated to `granted = false`. Target can no longer read products_view rows.
- T-OV-grant-already-granted: owner grants a permission that's already granted → upsert is idempotent; audit row may or may not be written (Phase D detail).
- T-OV-revoke-already-revoked: owner revokes a permission that's already revoked → upsert is idempotent.
- T-OV-grant-source-changes: a permission granted via preset (`source = 'preset'`) when explicitly granted via `modify_user_permission` → row's `source` flips to `'manual'`.

#### C.2.3.2 Dependency-aware grant

- T-OV-grant-with-missing-dep: owner calls `modify_user_permission(target, 'record_purchase', true)` on a user who doesn't have `view_suppliers` → raises `permission_dependency_missing` with detail.
- T-OV-grant-with-all-deps-present: same call after `view_suppliers` etc. are granted → succeeds.
- T-OV-grant-deep-dep-chain: granting `create_customer_full` on a user with neither `create_customer_basic` nor `view_customer_contact` → raises with appropriate detail.
- T-OV-grant-deep-dep-chain-partial: granting after only one dep present → raises with the still-missing one.

#### C.2.3.3 Dependency-aware revoke

- T-OV-revoke-with-dependent-granted: owner calls `modify_user_permission(target, 'view_products', false)` on a user with `record_purchase = true` → raises `cannot_revoke_required_permission` listing `record_purchase` (and other dependents).
- T-OV-revoke-after-dependents-revoked: same revoke after dependents are first revoked → succeeds.
- T-OV-revoke-root-permission-affects-many: revoking `view_customers` requires first revoking `view_customer_contact`, `view_customer_outstanding`, `create_customer_basic`, `view_customer_khata`, `assign_customer_tier` (5 dependents). Verify the cascade order is enforced.

#### C.2.3.4 Discount limits override

- T-OV-update-discount-limits-permission-only: owner calls `update_user_discount_limits(target, '{}'::jsonb)` → row's `discount_limits` updated, audit row written.
- T-OV-update-discount-limits-mixed: owner sets `{"per_line_max_pct": 50}`; target now uses 50% per-line cap. Test record_sale to verify enforcement.

#### C.2.3.5 Mixed scenarios

- T-OV-manager-preset-plus-margin: manager preset + grant `view_profit_margin` only. Verify: target sees margin% in `invoices_view`, but `gross_profit` and `cost_at_sale` still NULL.
- T-OV-manager-preset-plus-full-cost: manager preset + grant `view_sale_cost` + `view_profit_margin`. Verify: full cost / profit / margin visible.
- T-OV-salesperson-preset-plus-suppliers: salesperson preset + grant `view_suppliers`. Verify: target sees supplier list but still no manage capability.
- T-OV-salesperson-preset-minus-outstanding: salesperson preset (default `view_customer_outstanding = ✓`) with explicit revoke → target sees only `has_khata` boolean.

### C.2.4 Audit boundary tests (d)

Every permission-changing action writes a `user_shop_permission_audit`
row with correct fields.

- T-AB-permission-granted-audit: `modify_user_permission(..., granted=true)` writes audit row with `action='permission_granted'`, `permission_key=<key>`, `old_granted=<prev>`, `new_granted=true`, `actor_user_id=<caller>`, `reason=<provided>`.
- T-AB-permission-revoked-audit: same shape with `action='permission_revoked'`.
- T-AB-preset-applied-audit: `apply_preset_to_user(target, 'manager')` writes audit row with `action='preset_applied'`, `target_user_id=<target>`, `actor_user_id=<owner>`, `new_value={preset: 'manager'}`.
- T-AB-discount-limits-changed-audit: `update_user_discount_limits` writes row with `action='discount_limits_changed'`, `old_value=<old jsonb>`, `new_value=<new jsonb>`.
- T-AB-access-granted-audit: `accept_invitation` writes row with `action='access_granted'`, `target_user_id=<invitee>`, `actor_user_id=<inviter>`, `new_value=<full permission snapshot>`.
- T-AB-access-revoked-audit: `revoke_user_access` writes row with `action='access_revoked'`.
- T-AB-audit-shop_id-correct: every audit row's `shop_id` matches the shop the action was taken in.
- T-AB-audit-changed_at-monotonic: audit rows for sequential changes are ordered correctly by `changed_at`.
- T-AB-audit-no-direct-insert: any user attempts `from('user_shop_permission_audit').insert(...)` → RLS denied.
- T-AB-audit-no-update: any user attempts `from('user_shop_permission_audit').update(...)` → RLS denied (no UPDATE policy).
- T-AB-audit-no-delete: any user attempts `from('user_shop_permission_audit').delete(...)` → RLS denied.

### C.2.5 Cross-shop tests (PRESERVED)

| Test ID | Scenario | Expected |
|---|---|---|
| T-CR-01 | salesperson at A `set_active_shop('<B>')` | raise `no_access_to_shop` |
| T-CR-02 | manager at A `set_active_shop('<B>')` | raise `no_access_to_shop` |
| T-CR-03 | owner at A `set_active_shop('<B>')` | raise `no_access_to_shop` |
| T-CR-04 | salesperson at A + manager at B `set_active_shop('<B>')` | allow |
| T-CR-05 | (post T-CR-04) read `from('invoices_view')` at B | manager-grade rows (view_all_sales granted to manager preset) |
| T-CR-06 | (post T-CR-04) read invoices from A while active=B | empty |
| T-CR-07 | salesperson at A `record_sale` with variant_id from B | raise `variant_not_in_shop` |
| T-CR-08 | salesperson at A direct `from('products').select('*').eq('shop_id','<B>')` | empty (RLS filters) |
| T-CR-09 | manager at A direct `from('purchases').select('*').eq('shop_id','<B>')` | empty |
| T-CR-10 | owner at A `modify_user_permission` for user at B | raise `cannot_modify_owner_or_unknown_user` |
| T-CR-11 | owner at A `revoke_user_access` for user at B | raise — user not in active shop |
| T-CR-12 | owner at A `create_invitation` for an email at B's shop_id | raise — shop_id is the active shop's, no cross-shop invite path |
| T-CR-13 | session variable lost mid-request; multi-shop user; verify behavior | per F-PD-09 |

### C.2.6 Invitation flow tests (preserved + Rev 2 additions)

| Test ID | Scenario | Expected |
|---|---|---|
| T-INV-01 | happy path: owner creates → invitee accepts | `user_shop_access` row + 50 `user_shop_permissions` rows from snapshot |
| T-INV-02 | invitee enters wrong code | raise `invalid_confirmation_code`; `failed_attempts` incremented |
| T-INV-03 | 5 wrong codes | 5th attempt → status='cancelled'; raises `invitation_not_pending` |
| T-INV-04 | invitee tries to accept after 24h | raise `invitation_expired` |
| T-INV-05 | invitee tries to accept after cleanup_invitations cron flipped status | raise `invitation_not_pending` |
| T-INV-06 | two pending invitations for same (shop, email) | second raises unique-violation |
| T-INV-07 | E2: invitee already has an account | succeeds; no new auth.users row |
| T-INV-08 | E4: invitee already member | raise `already_a_member_at_this_shop` |
| T-INV-09 | E5: owner cancels before accept | invitee's accept raises `invitation_not_pending` |
| T-INV-10 | E6: invitee uses link twice | second is Supabase one-time; if reaches RPC, status mismatch |
| T-INV-11 | E7: owner removes invitee right after accept | accept succeeds; revoke proceeds against the new row |
| T-INV-12 | XA-02: brute-force codes | auto-cancel at 5 |
| T-INV-13 | XA-03: replay magic link | raise `invitation_not_pending` |
| T-INV-14 | XA-05: revoked employee at active JWT | RPC raises `no_shop_for_user` (after JWT lifetime ends) |
| T-INV-15 | owner attempts to invite 'owner' role | raise `cannot_invite_owner` |
| T-INV-16 | owner cancels a non-pending invitation | raise `invitation_not_pending` |
| T-INV-17 | non-invitee user attempts to accept someone else's invitation | raise `invitation_email_mismatch` |
| T-INV-18 (NEW) | create invitation with custom permission overrides | snapshot stored, deps validated |
| T-INV-19 (NEW) | create invitation with dependency-violating overrides | raise `permission_dependency_missing` |
| T-INV-20 (NEW) | accept invitation with snapshot from before a catalog change | snapshot stable; new permissions absent → default FALSE for them |
| T-INV-21 (NEW) | accept invitation; verify all 50 user_shop_permissions rows inserted | exact count check |
| T-INV-22 (NEW) | accept invitation; verify user_shop_access.discount_limits matches invitation snapshot | jsonb equality |

### C.2.7 NEW: Permission grant tampering tests (PA)

| Test ID | Scenario | Expected |
|---|---|---|
| T-PA-non-owner-modify_user_permission | salesperson calls `modify_user_permission` | raise `insufficient_permissions` |
| T-PA-non-owner-apply_preset_to_user | manager calls `apply_preset_to_user` | raise `insufficient_permissions` |
| T-PA-non-owner-update_user_discount_limits | manager calls the RPC | raise `insufficient_permissions` |
| T-PA-non-owner-revoke_user_access | manager calls the RPC | raise `insufficient_permissions` |
| T-PA-direct-insert-user_shop_permissions | any user attempts INSERT | RLS denied |
| T-PA-direct-update-user_shop_permissions | any user attempts UPDATE | RLS denied |
| T-PA-direct-delete-user_shop_permissions | any user attempts DELETE | RLS denied |
| T-PA-direct-update-user_shop_access-is_owner | any non-owner attempts to set is_owner=true on self | RLS denied + F-PD-07 column revoke |
| T-PA-direct-insert-audit | any user attempts INSERT into audit | RLS denied |
| T-PA-direct-update-audit | any user attempts UPDATE on audit | RLS denied (no UPDATE policy) |
| T-PA-direct-delete-audit | any user attempts DELETE on audit | RLS denied |
| T-PA-modify_user_permission-target-not-in-active-shop | owner of A targets user only in B | raise `cannot_modify_owner_or_unknown_user` |
| T-PA-grant-with-missing-dep | owner grants record_purchase without view_suppliers | raise `permission_dependency_missing` |
| T-PA-revoke-with-active-dependent | owner revokes view_products while user has record_purchase | raise `cannot_revoke_required_permission` |
| T-PA-modify-owner-permissions | owner calls modify_user_permission targeting another owner (different shop, irrelevant) or self | raise `cannot_modify_owner` |
| T-PA-apply-preset-owner-target | owner calls apply_preset_to_user targeting an owner | raise `cannot_modify_owner` |
| T-PA-revoke-own-access | owner calls revoke_user_access targeting self | raise `cannot_revoke_own_access` |
| T-PA-revoke-owner-target | owner calls revoke_user_access targeting another owner (which can't exist due to one-owner-per-shop, but test edge) | raise (data invariant — no such user) |

### C.2.8 NEW: Stale permission cache tests (CA)

| Test ID | Scenario | Expected |
|---|---|---|
| T-CA-revoke-effective-immediately | owner revokes user's permission; next RPC by user | raises `insufficient_permissions` immediately (no DB cache) |
| T-CA-grant-effective-immediately | owner grants user's permission; next RPC | succeeds immediately |
| T-CA-client-cache-staleness-bound | with TanStack Query, document the bound | Phase D: 30s staleTime + explicit invalidation on grant-side |
| T-CA-set_active_shop-cross-request-persistence | multi-shop user sets active shop; subsequent request | per F-PD-09 — recommended Option B (per-request header) |
| T-CA-jwt-no-permission-claims | inspect JWT structure | confirm no permission data embedded |
| T-CA-catalog-migration-atomicity | run migration mid-query | atomic within transaction |

### C.2.9 NEW: Preset drift on feature ship tests (DA)

| Test ID | Scenario | Expected |
|---|---|---|
| T-DA-new-permission-owner-implicit-true | new permission added; owner queries `user_has_permission(shop, new_key)` | TRUE |
| T-DA-new-permission-existing-manager-false | new permission added; existing manager (no row for new key) queries `user_has_permission` | FALSE |
| T-DA-new-permission-existing-salesperson-false | same for salesperson | FALSE |
| T-DA-invitation-after-migration-includes-new-key | new permission added; new invitation created; verify snapshot contains the new key | present |
| T-DA-invitation-before-migration-snapshot-stable | new permission added between invitation create and accept; verify snapshot unchanged | only original keys |
| T-DA-catalog-deactivation-existing-grants-honored | catalog row marked is_active=false; existing user_shop_permissions rows still drive runtime | check returns existing granted value |

### C.2.10 NEW: Permission set enumeration tests (EA)

| Test ID | Scenario | Expected |
|---|---|---|
| T-EA-user_shop_permissions-self-only | salesperson queries the table | only own row |
| T-EA-user_shop_access-self-only | salesperson queries | only own row |
| T-EA-get_team_for_active_shop-without | salesperson calls the RPC | `insufficient_permissions` |
| T-EA-get_user_permissions-without | salesperson calls with arbitrary uuid | `insufficient_permissions` |
| T-EA-get_team_for_active_shop-manager-without | manager (no view_team) calls | `insufficient_permissions` |
| T-EA-permissions_catalog-readable-by-all | any authenticated reads | rows returned (by design) |
| T-EA-pending_invitations-self-email-only | salesperson queries | only rows where their email matches |
| T-EA-probing-self-permissions-acceptable | user calls multiple RPCs; sees own permission boundary | acceptable; not a defect |

### C.2.11 NEW: Social engineering audit tests (SE)

| Test ID | Scenario | Expected |
|---|---|---|
| T-SE-view_team-grant-audit-trail | owner grants view_team to user; audit row written | `action='permission_granted'`, `actor_user_id=owner`, `permission_key='view_team'` |
| T-SE-modify_user_permissions-chained-grants-audit | attacker granted modify_user_permissions; grants self other permissions | each grant attributed in audit |
| T-SE-self-grant-chain-detectable | reconstruct the chain from audit log | sequence visible |
| T-SE-confederate-account-grants-attributed | attacker grants confederate; audit shows actor=attacker | attribution correct |
| T-SE-invitation-by-confederate-attributed | attacker (with invite_users) invites confederate; audit + invitation row attributed | actor=attacker |
| T-SE-owner-notified-of-grants | F-PD-10 — owner email notification on permission_granted actions targeting non-self | (deferred to Phase D) |

### C.2.12 Subscription guard tests (PRESERVED)

| Test ID | Scenario | Expected |
|---|---|---|
| T-SUB-01 | invited employee logs in; shop owner has active subscription | `shop_effective_subscription.effective_status = 'active'`; access granted |
| T-SUB-02 | invited employee logs in; owner's trial expired | `effective_status = 'expired'`; access denied (bounced to `/subscription/expired`) |
| T-SUB-03 | invited employee logs in; owner suspended | `effective_status = 'suspended'`; access denied |
| T-SUB-04 | owner's subscription renewed | next page-load: employee regains access (5-min staleness) |
| T-SUB-05 | invited employee at A (active) and B (expired); active=A | full access at A |
| T-SUB-06 | (post T-SUB-05) employee sets active=B | bounced to `/subscription/expired` |

### C.2.13 Anonymous tests (PRESERVED)

| Test ID | Action | Expected |
|---|---|---|
| T-NA-01 | `from('sale_items').select('*')` without auth | empty rows |
| T-NA-02 | `rpc('record_sale', ...)` without auth | 401 / function not accessible |
| T-NA-03 | enumerate `/rest/v1/` | metadata visible; no data flows |
| T-NA-04 | `from('shops').select('shop_name')` | empty rows |
| T-NA-05 | `from('profiles').select('*')` | empty rows |
| T-NA-06 | `from('permissions_catalog').select('*')` | (this might be readable; verify Phase D — anon should NOT see catalog) |

---

## C.3 Audit query suite (PRESERVED with permission integrity additions)

Run weekly. Each returns zero rows when healthy.

```sql
-- AQ-01: Every active user_shop_access row corresponds to a real auth user + shop.
select usa.id, usa.user_id, usa.shop_id
  from public.user_shop_access usa
  left join public.profiles p on p.id = usa.user_id
  left join public.shops s on s.id = usa.shop_id
 where p.id is null or s.id is null;

-- AQ-02: No user has multiple rows at the same shop.
select user_id, shop_id, count(*)
  from public.user_shop_access
 group by user_id, shop_id
having count(*) > 1;

-- AQ-03: Each shop has exactly one owner.
select shop_id, count(*)
  from public.user_shop_access
 where is_owner = true
 group by shop_id
having count(*) <> 1;

-- AQ-04: No pending invitation accepted past expiry.
select id, expires_at, accepted_at
  from public.pending_invitations
 where status = 'accepted'
   and accepted_at > expires_at;

-- AQ-05: Every invoice cashier exists in user_shop_access for the shop.
select i.id, i.cashier_id, i.shop_id
  from public.invoices i
 where i.cashier_id is not null
   and not exists (
     select 1 from public.user_shop_access usa
     where usa.user_id = i.cashier_id and usa.shop_id = i.shop_id
   )
   and i.created_at >= (select min(joined_at) from public.user_shop_access);

-- AQ-06: Same check for purchases.
select p.id, p.cashier_id, p.shop_id
  from public.purchases p
 where p.cashier_id is not null
   and not exists (
     select 1 from public.user_shop_access usa
     where usa.user_id = p.cashier_id and usa.shop_id = p.shop_id
   )
   and p.created_at >= (select min(joined_at) from public.user_shop_access);

-- AQ-07: shops.owner_user_id matches a user_shop_access row with is_owner=true.
select s.id, s.owner_user_id,
       (select usa.user_id from public.user_shop_access usa
         where usa.shop_id = s.id and usa.is_owner = true) as current_owner
  from public.shops s
 where (select usa.user_id from public.user_shop_access usa
         where usa.shop_id = s.id and usa.is_owner = true) is null
    or (select usa.user_id from public.user_shop_access usa
         where usa.shop_id = s.id and usa.is_owner = true) <> s.owner_user_id;

-- AQ-08: Salesperson daily receive_payment within cap.
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
   and d.daily_total > s.salesperson_payment_cap_pkr;

-- AQ-09: No sale's line_discount_amount exceeds the cashier's effective per-line limit.
-- (Revised for permission model: reads user_shop_access.discount_limits, not preset defaults.)
with cashier_limits as (
  select i.id as invoice_id, i.shop_id, i.cashier_id,
         coalesce(
           (usa.discount_limits ->> 'per_line_max_pct')::numeric,
           1000  -- effectively no limit if not set
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
   and (si.line_discount_amount / nullif(si.price_at_sale * si.qty, 0)) * 100 > cl.line_max_pct + 0.01;

-- AQ-10: No active pending invitation with failed_attempts >= 5 should still be pending.
select id, failed_attempts, status
  from public.pending_invitations
 where status = 'pending' and failed_attempts >= 5;

-- AQ-11: Cleanup-expired-invitations cron has been running.
select id, expires_at, status
  from public.pending_invitations
 where status = 'pending' and expires_at < now() - interval '6 hours';

-- AQ-12: Customer balance reconciliation. REPOINTED 2026-05-14 (v2.10
-- mig 0104): customer_balance_reconciliation AND ledger_entries.customer_id
-- are both dropped by 0104 — the v2.9 form is doubly un-runnable. Now
-- reconciles the customer side via contact_balance_reconciliation (the
-- v2.10 view, created in mig 0102). Overlaps AQ-31's customer-side half
-- by design — AQ-12 keeps its identity as the dedicated customer-balance
-- check; AQ-31 is the both-sides check.
select contact_id, customer_drift
  from public.contact_balance_reconciliation
 where abs(customer_drift) > 0.01;

-- AQ-13 (refined 2026-05-13): every ACTIVE product has at least one active variant.
-- Filter on p.is_active=true added because inactive products are correctly
-- allowed to have inactive variants. See decisions/2026-05-13-rbac-audit-query-refinements.md.
select p.id, p.name, p.shop_id
  from public.products p
 where p.is_active = true
   and not exists (select 1 from public.product_variants v
                    where v.product_id = p.id and v.is_active);

-- AQ-14 split into 14a (informational) + 14b (regression) on 2026-05-13.
-- The original "every batched product has at least one batch" was a v2.8 invariant
-- relaxed by v2.8.1 (decoupling stock creation from product) and v2.8.2 (auto-
-- deactivate when qty=0).

-- AQ-14a (informational): batched products never stocked in, older than 30 days.
select p.id, p.name, p.created_at
  from public.products p
 where p.has_batches = true
   and p.is_active = true
   and p.created_at < now() - interval '30 days'
   and not exists (
     select 1 from public.product_variants v
     join public.inventory_batches b on b.variant_id = v.id
     where v.product_id = p.id);

-- AQ-14b (regression): orphan batches (FK violation).
select b.id from public.inventory_batches b
  left join public.product_variants v on v.id = b.variant_id
  left join public.products p on p.id = v.product_id
 where v.id is null or p.id is null;

-- AQ-15: Functions granted to authenticated WITHOUT auth.uid() or
-- current_active_shop_id() or user_has_permission in body.
-- Hardened 2026-05-14 (after the 0104b AQ-33 incident): the public
-- DEFINER-function set is filtered + MATERIALIZED before pg_get_functiondef
-- runs. pg_get_functiondef ERRORS on aggregate functions, and an unfenced
-- `WHERE n.nspname='public' AND ... pg_get_functiondef(p.oid) ...` lets the
-- planner push pg_get_functiondef (a pg_proc-only filter) below the
-- pg_namespace join, onto pg_catalog aggregates (array_agg). prosecdef=true
-- excludes aggregates — but only if the planner evaluates it first, which
-- is not guaranteed. The MATERIALIZED CTE makes it guaranteed.
with public_definer_fns as materialized (
  select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef = true and p.prokind in ('f','p')
)
select proname
  from public_definer_fns pdf
 where exists (
     select 1 from information_schema.routine_privileges r
     where r.specific_schema = 'public'
       and r.routine_name = pdf.proname
       and r.privilege_type = 'EXECUTE'
       and r.grantee = 'authenticated')
   and not (
     pg_get_functiondef(pdf.oid) like '%auth.uid()%'
     or pg_get_functiondef(pdf.oid) like '%current_active_shop_id%'
     or pg_get_functiondef(pdf.oid) like '%user_has_permission%'
     or pg_get_functiondef(pdf.oid) like '%user_has_shop_access%'
   );

-- AQ-16: Every shop has a corresponding shop_owner_details row.
select s.id, s.shop_name
  from public.shops s
 where not exists (select 1 from public.shop_owner_details d where d.shop_id = s.id);

-- AQ-17: No pending invitation has role='owner' (per cannot_invite_owner).
select id, shop_id, preset_applied
  from public.pending_invitations
 where preset_applied not in ('manager', 'salesperson');

-- AQ-18: NEW (permission integrity) — every user_shop_permissions row
-- references an active catalog key.
select usp.id, usp.permission_key
  from public.user_shop_permissions usp
  left join public.permissions_catalog pc on pc.key = usp.permission_key
 where pc.key is null or pc.is_active = false;
-- Inactive-but-existing keys are flagged for cleanup; missing-from-catalog is a bug.

-- AQ-19: NEW — every user_shop_permissions row's user_shop_access_id is valid
-- and belongs to a non-owner (owners shouldn't have these rows).
select usp.id, usp.user_shop_access_id
  from public.user_shop_permissions usp
  join public.user_shop_access usa on usa.id = usp.user_shop_access_id
 where usa.is_owner = true;
-- Should be empty: owners don't get explicit permission rows.

-- AQ-20: NEW — dependency consistency. For every (user, granted_permission)
-- where the permission has requires, all required permissions are also granted.
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
   );

-- AQ-21: NEW — every requires[] entry in the catalog points to a real catalog key.
select pc.key, missing_require
  from public.permissions_catalog pc
  cross join lateral unnest(pc.requires) as missing_require
 where not exists (
   select 1 from public.permissions_catalog pc2 where pc2.key = missing_require
 );

-- AQ-22: NEW — permission audit log is non-empty and consistent.
-- (Sanity check; not a regression query — just verifies audit is writing.)
-- Verifies: every preset_applied action has a corresponding row with
-- action='preset_applied' for each user_shop_access that has preset_applied set.
select usa.id, usa.user_id, usa.shop_id, usa.preset_applied
  from public.user_shop_access usa
 where usa.preset_applied is not null
   and not exists (
     select 1 from public.user_shop_permission_audit uspa
     where uspa.target_user_id = usa.user_id
       and uspa.shop_id = usa.shop_id
       and uspa.action = 'preset_applied'
       and uspa.new_value->>'preset' = usa.preset_applied);

-- AQ-23 (added 2026-05-13 v2.9 cleanup, ADR #23): DEFINER-wrapper shape-drift
-- detector. Scope: DEFINER functions in public GRANTED EXECUTE to authenticated
-- AND non-trigger AND not _v28 inner bodies. Matches advisor lint
-- `authenticated_security_definer_function_executable` population exactly (65).
--
-- Four properties checked:
--   P1: not_authenticated precondition present in body
--   P2: no_shop_for_user precondition present in body
--   P3: user_has_permission(...) gate present in body
--   P4: delegates to <name>_v28 body (informational, not enforced)
--
-- Exempt list (waived from P1/P2/P3 individually with documented reason):
--   accept_invitation        — pre-grant flow; permissions not yet present
--   cancel_invitation        — invitee/inviter match; no permission gate needed
--   complete_onboarding      — creates the first shop; no shop_id exists yet
--   current_active_shop_id   — helper; reads header
--   current_shop_id          — helper alias
--   get_user_permissions     — the permission lookup itself
--   get_user_shop_list       — helper; enumerates the user's shops
--   set_active_shop          — helper; validates + no-ops
--   user_has_permission      — helper
--   user_has_shop_access     — helper
--   user_permissions_in_shop — the permission lookup itself
--
-- v2.9.1 (migration 0087) extended exempt list with 2 more shop-membership-
-- gated helpers: get_active_shop, get_shop_settings.
-- v2.9.1 (migration 0088) extended exempt list with 1 pre-shop helper:
-- get_invitation_for_acceptance. By design the invitee has no shop access
-- yet at the time of this call (same rationale as accept_invitation and
-- cancel_invitation). P2/P3 would be incorrect gates. P1 is present.
-- v2.9.1 (migration 0090) extended exempt list with 1 more pre-shop helper:
-- get_my_pending_invitation. The invitee calls it from RequireOnboarded
-- BEFORE they have any shop access — used to detect pending invitations
-- and redirect to /invite/accept instead of /onboarding. Same exempt
-- rationale as get_invitation_for_acceptance. P1 is present.
-- Exempt list now 15 entries.
-- Halt on any non-exempt row missing P1, P2, or P3.
-- Hardened 2026-05-14 (0104b AQ-33 incident): the public-DEFINER-function
-- set is filtered + MATERIALIZED before pg_get_functiondef /
-- pg_get_function_result run — see AQ-15's note for the planner-pushdown
-- failure mode. prokind in ('f','p') excludes aggregates explicitly.
with public_definer_fns as materialized (
  select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.prosecdef=true and p.prokind in ('f','p')
     and p.proname not like '%\_v28' escape '\'
),
f as (
  select proname as name, pg_get_functiondef(oid) as body
    from public_definer_fns
   where has_function_privilege('authenticated', oid, 'execute')
     and pg_get_function_result(oid) <> 'trigger'
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
      -- v2.9.1 additions (mig 0087): shop-membership-gated, not permission-gated
      'get_active_shop','get_shop_settings',
      -- v2.9.1 addition (mig 0088): pre-shop helper; invitee has no shop access yet
      'get_invitation_for_acceptance',
      -- v2.9.1 addition (mig 0090): pre-shop helper; reads caller's email and
      -- returns their latest pending invitation (or none). Called by
      -- RequireOnboarded guard BEFORE the invitee has any shop access.
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
   and not (has_p1 and has_p2 and has_p3);
-- Should return 0 rows.

-- AQ-24 (added 2026-05-13 v2.9.1 Phase C migration 0087): legacy
-- current_shop_id() callers outside the baseline allowlist. The
-- migration 0078 alias makes current_shop_id() resolve to
-- current_active_shop_id(), so pre-v2.9 callers still work; the audit's
-- purpose is to catch NEW code (post v2.9.1) that grew sloppy on
-- discipline. The allowlist captures the v2.9-and-prior baseline:
--   * All _v28 inner functions (38 entries) — ADR rule: preserve v2.8
--     bodies unchanged; alias resolves correctly.
--   * 2 pre-v2.9 views: daily_sales_7, expenses_by_category_mtd —
--     deferred to v2.10 cleanup (see docs/todos.md).
-- Any NEW SQL outside the allowlist that references current_shop_id()
-- without also referencing current_active_shop_id() is a discipline
-- violation; v2.9.1+ code must call current_active_shop_id() directly.
-- Hardened 2026-05-14 (0104b AQ-33 incident): the public function/procedure
-- set is filtered + MATERIALIZED before pg_get_functiondef runs — see
-- AQ-15's note. This query was the most exposed of the three: it had NO
-- prosecdef/prokind filter at all on the functions arm, so it "passed" only
-- by planner luck (its union/subquery shape happened to avoid the pushdown).
-- prokind in ('f','p') excludes aggregates explicitly; the views arm is
-- unaffected (pg_get_viewdef does not error on aggregates).
with public_fns as materialized (
  select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.prokind in ('f','p')
)
select name, kind from (
  select proname as name, 'function' as kind, pg_get_functiondef(oid) as body
    from public_fns
  union all
  select v.viewname as name, 'view' as kind, pg_get_viewdef(v.viewname::regclass) as body
    from pg_views v where v.schemaname='public'
) x
 where body ~ 'current_shop_id\s*\(\s*\)'
   and name <> 'current_shop_id'
   and body !~ 'current_active_shop_id'
   and name not like '%\_v28' escape '\'
   and name not in ('daily_sales_7', 'expenses_by_category_mtd');
-- Should return 0 rows.
```

---

## C.4 Defects discovered during C.1 enumeration (Phase D handoff)

Twelve Phase D action items surfaced during this revision. Carrying
forward from Rev 1's F-NEW-01 through F-NEW-04 (some now resolved by
the Rev 2 design):

- **F-NEW-01 (Rev 1: `sale_items_manager_read` too permissive)** —
  RESOLVED in Rev 2. The permission model gates `sale_items` raw read
  on `view_sale_cost`. Manager doesn't have it by default. No
  contradiction.
- **F-NEW-02 (Rev 1: `shops.owner_user_id` editable)** — INCORPORATED
  into Rev 2 §B.4.2. The `shops_owner_update` policy is dropped; all
  shop edits via `update_shop_settings` RPC. Plus `revoke update
  (owner_user_id) on public.shops from authenticated`.
- **F-NEW-03 (Rev 1: implicit discount via price=0)** → **F-PD-03**.
  Phase D adds implicit-discount check in `record_sale`.
- **F-NEW-04 (Rev 1: `list_customers` salesperson projection)** →
  **F-PD-04 RESOLVED 2026-05-13 (post-Phase-C review).** Path: convert
  the existing cost-bearing search/list RPCs to **permission-conditional
  projection** — same pattern as the per-table `_view`s. Single RPC
  per surface (`search_products`, `recent_purchase_products`,
  `list_customers`) gates on the lowest-tier read permission
  (`view_products` / `view_customers`); body conditionally NULLs the
  cost-bearing columns based on the caller's specific cost permissions
  (`view_product_cost`, `view_customer_contact`, `view_customer_outstanding`).
  PostgREST + view alone is insufficient for the search UX because
  it lacks trigram-based relevance ranking. Phase B §B.5.1 amended;
  no new `_safe` RPCs.

**New in Rev 2:**

- **F-PD-01:** Phase D verifies that PostgREST does NOT expose
  `set_config(...)` as a callable RPC. If it does, the hybrid
  `current_active_shop_id` model is bypassable — close it by either
  (a) using a header-based per-request shop_id pattern, OR (b) gating
  set_config inside a wrapper function.
- **F-PD-02:** Phase D implements concurrent-cap-check serialization
  in `receive_payment`. Recommendation: pg_advisory_lock on `(shop_id,
  cashier_user_id, current_date_int)`.
- **F-PD-03:** implicit-discount check in `record_sale` per SA-25 /
  Rev-1-F-NEW-03.
- **F-PD-04: RESOLVED.** See updated entry above (permission-conditional
  RPC projection; no `_safe` variants needed).
- **F-PD-05:** Rename `shops.salesperson_payment_cap_pkr` to
  `non_owner_payment_cap_pkr` — the column applies to any non-owner
  caller, not just salesperson-preset. (Cosmetic; backward-compat is
  fine.)
- **F-PD-06:** Verify PostgREST per-RPC rate-limit for
  `accept_invitation` (defense in depth for code brute-force).
- **F-PD-07:** Add `revoke update (is_owner) on public.user_shop_access
  from authenticated` as defense in depth for PA-08.
- **F-PD-08: RESOLVED 2026-05-13.** TanStack Query staleness contract
  for permissions: **bounded staleness, option (b).** Specifically:
  - Query key: `['permissions', shop_id, target_user_id]`.
  - `staleTime: 60_000` (60 seconds).
  - `refetchOnWindowFocus: true` (catches resume-from-background).
  - `refetchInterval: false` (no polling).
  - **Explicit invalidation** on the owner's session after a
    successful `modify_user_permission` / `apply_preset_to_user` /
    `update_user_discount_limits` / `revoke_user_access` /
    `accept_invitation` / `cancel_invitation` call: invalidate
    `['permissions', shop_id, target_user_id]` AND `['team',
    shop_id]`.
  - **The affected user's session** (different browser tab, possibly
    different device) naturally refetches on window-focus OR after
    60s of activity. Their UI may briefly show "I can do X" between
    a permission revoke and the next refetch (max 60s of activity-
    driven staleness).
  - Security posture rationale: the **DB layer enforces immediately**
    (every RPC re-queries `user_has_permission`), so the worst case
    is a UX glitch (user sees an enabled button, click returns
    `insufficient_permissions`). For the SMB threat model (fired
    salesperson, not APT), 60s lag is negligible vs the dominant
    Supabase JWT lifetime (1h default). Real-time (option a) is the
    upgrade path if the user later wants stronger posture; the
    per-shop user count (1–10) makes Realtime affordable but
    unnecessary now.
  - Invalidate-on-mutation alone (option c) was rejected: the modifying
    session invalidates its own cache, but the affected user's
    separate session has no signal until window-focus or staleTime
    expiry. Same effective behavior as bounded staleness with extra
    complexity.
- **F-PD-09: RESOLVED 2026-05-13.** `set_active_shop` persistence
  via header-based per-request pattern. Specifically:
  - **Header name:** `app-shop-id` (lowercase per HTTP convention;
    Supabase / PostgREST normalize). Value is a UUID string.
  - **Client-side:** the Supabase JS client is created with a custom
    `fetch` wrapper that reads `nizaamify.active_shop_id` from
    `localStorage` and injects the header on every PostgREST request.
    Implementation pattern:
    ```typescript
    const customFetch: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      const shopId = localStorage.getItem('nizaamify.active_shop_id');
      if (shopId) headers.set('app-shop-id', shopId);
      return fetch(input, { ...init, headers });
    };
    export const supabase = createClient(URL, ANON_KEY, {
      global: { fetch: customFetch }
    });
    ```
    The TopBar shop-switcher writes to `localStorage` and triggers
    a TanStack Query cache invalidation for the new shop's data.
  - **Server-side validation:** PostgREST pre-request function
    `public.pre_request_set_active_shop()` configured via the
    Supabase project's "Pre-request function" setting. Runs after
    JWT verification, before any RLS evaluation. Body:
    ```sql
    create or replace function public.pre_request_set_active_shop()
    returns void
    language plpgsql security definer set search_path = public, pg_catalog
    as $$
    declare
      v_shop_id_str text := current_setting('request.headers', true)::jsonb ->> 'app-shop-id';
      v_shop_id uuid;
    begin
      -- Always reset before evaluating, so connection-pool reuse can't leak
      perform set_config('app.shop_id', '', false);
      if v_shop_id_str is null or v_shop_id_str = '' then
        return;  -- Fallback to single-shop user via current_active_shop_id()
      end if;
      begin
        v_shop_id := v_shop_id_str::uuid;
      exception when others then
        raise exception 'invalid_app_shop_id_header'
          using errcode = 'P0001';
      end;
      if auth.uid() is null then
        return;  -- Anonymous request; no shop to set
      end if;
      if not public.user_has_shop_access(v_shop_id) then
        raise exception 'no_access_to_shop'
          using errcode = 'P0001',
                detail = format('header app-shop-id=%s; caller has no access', v_shop_id_str);
      end if;
      perform set_config('app.shop_id', v_shop_id::text, false);
    end;
    $$;
    grant execute on function public.pre_request_set_active_shop() to authenticated, anon;
    ```
  - **Failure modes:**
    - **Header missing** → fallback to "user's single shop" via
      `current_active_shop_id()`; if multi-shop user with no header,
      RPC's `v_shop_id` is NULL → raises `no_shop_for_user`. Client
      UI surfaces "Pick a shop" via the TopBar switcher.
    - **Invalid UUID format** → pre-request raises
      `invalid_app_shop_id_header`. PostgREST returns standard error;
      client clears `localStorage.nizaamify.active_shop_id` and
      prompts user.
    - **Shop UUID is well-formed but user has no access** → pre-request
      raises `no_access_to_shop`. Same client handling.
    - **Connection pool reuse** → the explicit `set_config('app.shop_id',
      '', false)` at the top of the pre-request function clears any
      stale state from a previous request on the same connection.
  - **The `set_active_shop` RPC retains its current form** (§B.2.0a)
    as a "manual switch" path — UI calls it to validate-and-cache
    before writing to localStorage. The localStorage write is the
    durable side; the RPC just confirms membership.
- **F-PD-10:** Email notification to owner on `permission_granted`
  actions where `actor_user_id != target_user_id` and target is not
  the owner. Defends against SE-02 / SE-04.
- **F-PD-11:** Add `confirm_expired_sale_at_pos` permission check in
  `record_sale`'s warn-branch.
- **F-PD-12:** Column-level `assign_customer_tier` enforcement on
  `customers.UPDATE` — either via trigger or in-RPC check.

---

## C.5 Summary

The permission-based pivot reduces Rev 1's attack surface in two
ways:

1. **Tighter mitigation citations.** Every attack now cites a single
   permission key as the gate, not a role-tier label. This makes the
   gate auditable (any owner can read the permission catalog + per-
   user permission rows to see exactly who can do what).
2. **Closes the Rev-1 F-NEW-01 contradiction.** The role-based design
   had manager admitted to raw `sale_items` SELECT while D5 said
   "manager sees nothing cost-related." The permission model has no
   such contradiction — `view_sale_cost` is the only gate, and
   manager doesn't have it by default.

The test matrix grew from ~180 tests in Rev 1 to roughly:
- ~190 permission boundary tests (C.2.1)
- ~15 preset application tests (C.2.2)
- ~15 override tests (C.2.3)
- ~11 audit boundary tests (C.2.4)
- ~13 cross-shop tests (C.2.5, preserved)
- ~22 invitation tests (C.2.6, including Rev 2 additions)
- ~18 permission tampering tests (C.2.7)
- ~6 stale cache tests (C.2.8)
- ~6 preset drift tests (C.2.9)
- ~8 enumeration tests (C.2.10)
- ~6 social engineering tests (C.2.11)
- ~6 subscription tests (C.2.12, preserved)
- ~6 anon tests (C.2.13, preserved)

**Total: ~322 test cases.**

Twelve Phase D action items (F-PD-01 through F-PD-12) carry over.

The acceptance gate for v2.9 production deployment is:
- All §C.2.1 boundary tests pass.
- All §C.2.2 preset tests pass.
- All §C.2.3 override tests including dep enforcement pass.
- All §C.2.4 audit boundary tests pass.
- All §C.2.5 cross-shop tests pass.
- All §C.2.6 invitation flow tests pass (including Rev 2 additions).
- All §C.2.7–§C.2.11 new-attack-class tests pass.
- §C.2.12 subscription tests pass in staging.
- §C.2.13 anon tests pass.
- §C.3 audit query suite returns zero rows for AQ-01 through AQ-23
  (AQ-23 added 2026-05-13 in v2.9 cleanup — DEFINER-wrapper shape-drift
  detector; see ADR `2026-05-13-v29-cleanup-permissive-policies.md`).

§C.3 must run clean at the time of v2.9 launch and weekly thereafter.

---

*End of Phase C Rev 2. Document locked 2026-05-13.*
