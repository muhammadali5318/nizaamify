# RBAC Model Design — 2026-05-13 (Revision 2: permission-based pivot)

**Status:** Phase B — **LOCKED** (permission-based pivot, revision 2).

**Revision history:**
- **Rev 1** (2026-05-13a) — role-based: three fixed roles (owner /
  manager / salesperson), permissions implied by role. Captured in
  git history. Superseded by Rev 2 in response to customer demand
  for granular permission control (3 sports shops + 10 mobile shops
  in the pipeline asked for it).
- **Rev 2** (2026-05-13b) — permission-based: 50 boolean permissions
  + three presets as starting templates + unlimited per-user
  overrides. This document.

**What's preserved from Rev 1:**
- §B.2.0a hybrid `current_shop_id` mechanism with four helpers
- §B.2.0b three-layer view strategy at the mechanism level (view bodies
  now gate by permission, not by role)
- §B.2.1 multi-shop-per-user via the join table (renamed
  `user_shop_access`, no longer `user_shop_roles`)
- §B.2.4 discount-limits JSONB shape and resolution rule
- §B.2.5 created_by / updated_by audit pattern (with one removal:
  `cashier_role` snapshot dropped — see §B.2.5)
- §B.6 invitation flow narrative, with edge cases E1–E8 + the
  4-digit verbal-confirmation mistyped-email mitigation + the
  failed_attempts auto-cancel after 5 wrong tries

**What pivoted to permission-based:**
- §B.1: role-based permission matrix → 50-permission catalog with
  three presets and per-user overrides
- §B.2.2 (cost visibility policy): role gates → permission gates
- §B.2.3 (customer creation): role gates → permission gates
- §B.2.6 (invitation flow): preset selection + override delta at
  invitation create; preset+resolved-set snapshot on the pending row
- §B.3 (schema): `user_shop_roles` table dropped; replaced with
  `user_shop_access` + `user_shop_permissions` + `permissions_catalog`
  + `user_shop_permission_audit`
- §B.4 (RLS strategy): every `user_has_min_role(...)` check becomes
  `user_has_permission(shop_id, '<key>')`
- §B.5 (function guards): the AUTH/SHOP/MGR/OWN labels collapse to
  permission-key references; each RPC names the specific permission
  it requires

**Companion docs:**
- Audit: `audit/2026-05-13-rbac-pre-design-audit.md`
- Attack surface: `design/2026-05-13-rbac-attack-surface.md` (Phase C —
  to be revised post-pivot, per the user's instruction 2)
- Implementation plan: `design/2026-05-13-rbac-implementation-plan.md`
  (Phase D — to be written post-Phase-C revision)

---

## B.0 Scope and status

This document holds **decisions** — not implementation. The
permissions catalog (B.1), the architectural mechanisms that shape
every downstream design choice (B.2.0a, B.2.0b), the schema, RLS
strategy, function guard mapping, and invitation flow are all locked.
Phase C derives mechanically from this document. Phase D writes the
actual migrations.

> **A note on style.** I am opinionated. Every row of the catalog and
> every design choice carries my recommendation; the alternative is
> documented; the downstream impact of taking the alternative is noted.
> The user is the decision-maker; I am the architect proposing options.

---

## B.1 Permissions catalog (LOCKED)

### B.1.0 Model overview

- **50 permissions** across 8 feature areas — within the 40-60 medium-
  granularity range from the kickoff instruction.
- Each permission is a boolean grant/revoke on a `(user, shop,
  permission_key)` tuple.
- **Owner is special.** The shop owner (one per shop, signing-up
  user) has every permission implicitly. The `user_has_permission(...)`
  helper short-circuits to TRUE for any permission when
  `user_shop_access.is_owner = true`. Owner is not editable in the
  permission UI. Cannot be revoked. Cannot have permissions revoked
  individually.
- **Three presets — Owner / Manager / Salesperson — are starting
  templates** at invitation time. The owner picks a preset; the
  catalog rows' `preset_*_default` columns determine which permissions
  start ON. After invitation acceptance, each granted permission is a
  row in `user_shop_permissions` (which the owner can flip
  per-permission via `modify_user_permission` RPC).
- **Presets are system-wide,** defined by Anthropic via migrations.
  Per-user overrides are unlimited per shop.
- **New permissions ship via migration.** Owners get them automatically
  (implicit ownership shortcut). Staff get them OFF by default until
  the owner grants. There's no backfill of `user_shop_permissions`
  rows when a new permission lands — `user_has_permission(...)`
  defaults to FALSE if no row exists, which is the desired "OFF for
  staff" behavior.
- **Discount limits are NOT permissions.** Numerics live in a separate
  `user_shop_access.discount_limits` JSONB. Permissions are booleans.
- **Shop access is implicit:** "having any permission at a shop" is
  equivalent to "being a member of the shop." Membership = at least
  one row in `user_shop_access` for that (user, shop). No explicit
  `shop_member` permission needed.

### B.1.1 The 50 permissions

Notation: ✓ = ON by default in this preset, · = OFF by default. The
Owner column is informational (always ON via implicit shortcut).

#### SALES (5)

| Key | Description | Owner | Manager | Salesperson |
|---|---|---|---|---|
| `record_sale` | Make a new sale through POS | ✓ | ✓ | ✓ |
| `view_all_sales` | See sales recorded by other staff. Without this permission, user sees only sales they personally recorded (filtered by `cashier_id = auth.uid()`). | ✓ | ✓ | · |
| `view_sale_cost` | See `cost_at_sale` and absolute gross profit on past sales. | ✓ | · | · |
| `view_profit_margin` | See margin % on sales. Operates without exposing absolute cost or profit. | ✓ | · | · |
| `reprint_receipt` | Print receipts for past sales. | ✓ | ✓ | ✓ |

#### PRODUCTS (7)

| Key | Description | Owner | Manager | Salesperson |
|---|---|---|---|---|
| `view_products` | Read product list and detail pages (no cost columns). | ✓ | ✓ | ✓ |
| `view_product_cost` | Read `products.cost` / `variants.avg_cost` / `last_purchase_cost`. | ✓ | ✓ | · |
| `create_product` | Create new products and variants. | ✓ | ✓ | · |
| `edit_product` | Modify product name, description, price. | ✓ | ✓ | · |
| `archive_product` | Toggle product `is_active = false`. | ✓ | ✓ | · |
| `manage_product_categories` | Create / edit / deactivate categories. | ✓ | ✓ | · |
| `manage_product_packs` | Create / edit / deactivate UoM packs. | ✓ | ✓ | · |

#### INVENTORY (7)

| Key | Description | Owner | Manager | Salesperson |
|---|---|---|---|---|
| `view_inventory_batches` | Read batch list (qty_remaining, expiry, batch_no — no cost). | ✓ | ✓ | ✓ |
| `view_batch_cost` | Read `cost_per_unit` on batches. | ✓ | ✓ | · |
| `view_purchases` | Read past purchases including their costs (operational data for stock-in). | ✓ | ✓ | · |
| `record_purchase` | Record a stock-in / purchase. | ✓ | ✓ | · |
| `writeoff_batch` | Partial or full write-off of a batch. | ✓ | ✓ | · |
| `edit_product_expiry_overrides` | Set per-product `expiry_alert_days` / `expired_sale_policy`. | ✓ | ✓ | · |
| `confirm_expired_sale_at_pos` | Accept a warn-policy expired-batch sale at POS. Only meaningful when the shop's `expired_sale_policy` is `'warn'`; ignored under `'block'` or `'allow'`. | ✓ | ✓ | ✓ |

#### CUSTOMERS (9)

| Key | Description | Owner | Manager | Salesperson |
|---|---|---|---|---|
| `view_customers` | Read customer name. Phone and address gated by `view_customer_contact`. | ✓ | ✓ | ✓ |
| `view_customer_contact` | Read customer phone and address fields. Without this permission, list shows name only. | ✓ | ✓ | ✓ |
| `view_customer_outstanding` | Read customer's `outstanding_balance` numeric amount. Without this permission, user sees only a `has_khata` boolean without the numeric value. | ✓ | ✓ | ✓ |
| `create_customer_basic` | Create customer with name + phone only (assigned to shop's default tier). | ✓ | ✓ | ✓ |
| `create_customer_full` | Create customer with address, `tier_id`, notes. | ✓ | ✓ | · |
| `edit_customer` | Modify existing customer (except tier — separate permission). | ✓ | ✓ | · |
| `view_customer_khata` | Read full ledger history (debits and credits) for a customer. | ✓ | ✓ | · |
| `assign_customer_tier` | Change a customer's `tier_id`. | ✓ | ✓ | · |
| `manage_customer_tiers` | Create / edit / deactivate tier definitions (shop-wide). | ✓ | · | · |

#### SUPPLIERS (2)

| Key | Description | Owner | Manager | Salesperson |
|---|---|---|---|---|
| `view_suppliers` | Read supplier list. | ✓ | ✓ | · |
| `manage_suppliers` | Create / edit / deactivate suppliers. | ✓ | ✓ | · |

#### FINANCIAL (8)

| Key | Description | Owner | Manager | Salesperson |
|---|---|---|---|---|
| `receive_payment` | Record a customer credit payment. Cap enforced via `shops.salesperson_payment_cap_pkr` (default 10,000 PKR). Cap and permission are separate gates; both must pass. | ✓ | ✓ | ✓ |
| `reverse_ledger_entry` | Reverse a non-sale-tied ledger entry. | ✓ | ✓ | · |
| `view_expenses` | Read expense list. | ✓ | ✓ | · |
| `create_expense` | Record a new expense. | ✓ | ✓ | · |
| `edit_expense` | Modify own expense within 24h of creation. | ✓ | ✓ | · |
| `view_monthly_targets` | Read shop's `target_sale` / `target_gross_profit` / `target_net_profit`. | ✓ | ✓ | · |
| `manage_monthly_targets` | Set / update monthly targets. | ✓ | · | · |
| `view_reports` | Access `/reports` page (data within is gated by other permissions). | ✓ | ✓ | · |

#### SETTINGS (5)

| Key | Description | Owner | Manager | Salesperson |
|---|---|---|---|---|
| `edit_shop_settings` | Change shop_name, address, phone, default alert days, default policies. | ✓ | · | · |
| `view_owner_details` | Read CNIC / owner PII. | ✓ | · | · |
| `edit_owner_details` | Modify owner PII. | ✓ | · | · |
| `manage_units_of_measure` | Create new units of measure. | ✓ | · | · |
| `manage_variant_attributes` | Manage shop-wide Color / Size / etc. attribute pool. | ✓ | · | · |

#### TEAM (7)

| Key | Description | Owner | Manager | Salesperson |
|---|---|---|---|---|
| `view_team` | Access `/settings/team` page (see employee list + their permissions). | ✓ | · | · |
| `invite_users` | Create invitations. | ✓ | · | · |
| `cancel_invitations` | Cancel pending invitations. | ✓ | · | · |
| `modify_user_permissions` | Grant / revoke permissions on other users. | ✓ | · | · |
| `modify_user_discount_limits` | Change other users' discount-limit JSON. | ✓ | · | · |
| `revoke_user_access` | Remove a user from the shop. | ✓ | · | · |
| `view_user_audit_log` | Read `user_shop_permission_audit` table. | ✓ | · | · |

**Totals: 5 + 7 + 7 + 9 + 2 + 8 + 5 + 7 = 50 permissions.**

Preset summary:
- Owner preset: 50 ✓ (informational; owner has all via implicit
  shortcut)
- Manager preset: 32 ✓ / 18 ·
- Salesperson preset: 10 ✓ / 40 ·

### B.1.2 Permission dependencies

**Approach (a) chosen:** dependencies are declared in the catalog
itself as a `requires text[]` column. The user's instruction was
explicit that runtime `user_has_permission` should not traverse
dependencies; enforcement happens at grant time and revoke time
(symmetric). This catalog-driven approach is preferred over the
RPC-procedural approach because:
- The catalog row is the single source of truth for the dependency rule.
- Both `apply_preset_to_user` (invitation-time) and `modify_user_permission`
  (per-permission grant) consult the same column.
- The UI can derive its dependency-aware behavior (grey-out, cascade-
  warning) from the catalog data.
- Adding a new permission specifies its deps in one place.

**Dependency rules (15 total):**

| Permission | Requires |
|---|---|
| `view_product_cost` | `view_products` |
| `create_product` | `view_products` |
| `edit_product` | `view_products` |
| `archive_product` | `view_products` |
| `manage_product_packs` | `view_products` |
| `view_batch_cost` | `view_inventory_batches` |
| `record_purchase` | `view_products`, `view_product_cost`, `view_purchases`, `view_suppliers`, `view_inventory_batches` |
| `writeoff_batch` | `view_inventory_batches`, `view_batch_cost` |
| `edit_product_expiry_overrides` | `view_products`, `edit_product` |
| `manage_suppliers` | `view_suppliers` |
| `view_customer_contact` | `view_customers` |
| `view_customer_outstanding` | `view_customers` |
| `create_customer_basic` | `view_customers` |
| `create_customer_full` | `create_customer_basic`, `view_customer_contact` |
| `edit_customer` | `view_customers`, `view_customer_contact` |
| `view_customer_khata` | `view_customers` |
| `assign_customer_tier` | `view_customers` |
| `receive_payment` | `view_customers`, `view_customer_outstanding` |
| `reverse_ledger_entry` | `view_customer_khata` |
| `create_expense` | `view_expenses` |
| `edit_expense` | `view_expenses` |
| `manage_monthly_targets` | `view_monthly_targets` |
| `edit_owner_details` | `view_owner_details` |
| `invite_users` | `view_team` |
| `cancel_invitations` | `view_team` |
| `modify_user_permissions` | `view_team` |
| `modify_user_discount_limits` | `view_team` |
| `revoke_user_access` | `view_team` |
| `view_user_audit_log` | `view_team` |

(That's 29 dep declarations across the 50 permissions; 21 permissions
have no requires, are root permissions. After array expansion, 38
individual `(permission, required-key)` pairs.)

**Rationale for `writeoff_batch` requiring `view_batch_cost`:** locked
2026-05-13 after Phase C review. Write-offs have real financial impact
(inventory value reduction). A manager who can write off but cannot
see cost cannot self-regulate at the boundary where escalation to
owner would be appropriate. The dependency forces cost visibility to
accompany write-off authority.

**Enforcement points:**

1. **Grant-time** (`modify_user_permission(p_target_user_id,
   p_permission_key, p_granted = true)`): the RPC validates that every
   key in the catalog's `requires` array is also granted for the
   target user. Raises `permission_dependency_missing` if not, with a
   detail listing the missing dependency.
2. **Revoke-time** (`modify_user_permission(..., p_granted = false)`):
   the RPC validates that no granted permission depends on the one
   being revoked. Raises `cannot_revoke_required_permission` with the
   list of dependents.
3. **Preset application** (`apply_preset_to_user`): no special handling
   needed — the catalog's per-preset defaults are designed to be
   consistent (e.g., if `manager.preset_default = ✓` for
   `record_purchase`, then `view_products`, `view_product_cost`, etc.
   are also `✓`). Phase D's migration must enforce this consistency at
   catalog-insert time.

**Why not auto-cascade?** Granting `record_purchase` could
auto-grant its 5 dependencies. Revoking `view_products` could
auto-revoke `record_purchase`. Either direction surprises the owner —
they expect "I clicked grant on X" to grant only X. The error-and-
require-explicit-action pattern is what enterprise IAM tools (AWS IAM,
Okta) ship; we mirror.

**The runtime `user_has_permission` check is single-permission.** It
does not traverse `requires`. The user's instruction was explicit on
this. The dependency system is purely a state-coherence guarantee,
not a runtime resolution.

### B.1.3 Open questions deferred

The user previously accepted defaults on D1, D4, D6, D7, D8, D9, D10,
D11, D13, D16, D17, D18, D19, D20, D22, D23, D25, D26 and overrode D5,
D14, D15, D21, D22, D24. **All these decisions are baked into the
catalog defaults above.** No new decision points open in Rev 2.

### B.1.4 [SUPERSEDED] Rev-1 role-based locked answers

The Rev-1 locked decision answers and final matrix are preserved in
git history. The permission catalog above (§B.1.1) supersedes them
in v2.9. Cross-reference:

| Rev 1 cell | Rev 2 equivalent |
|---|---|
| Role hierarchy (`owner > manager > salesperson` with `min_role` checks) | Per-permission grant/revoke. The "manager preset" + "salesperson preset" preserve the role intent at invitation time. |
| `manager_sees_margin` shop column | `view_profit_margin` permission, per-user. Shop column dropped. |
| `salesperson_sees_customer_outstanding` shop column | `view_customer_outstanding` permission, per-user. Shop column dropped. |
| `salesperson_payment_cap_pkr` shop column | Retained — the cap remains numeric and shop-wide. Permission `receive_payment` AND cap are AND-ed at runtime. |
| `shops.default_discount_limits` (`{owner, manager, salesperson}` keys) | Discount limits stored on `user_shop_access.discount_limits` (per-user). Shop-level defaults removed; presets at invitation time seed user-level limits from a per-preset JSONB. |

---

## B.2 Specific design decisions

### B.2.0a — Mechanism: `current_shop_id` refactor (UNCHANGED from Rev 1)

**Locked: Option C (hybrid) with four helpers**, plus the user's
locked refinement that `set_active_shop(p_shop_id)` MUST verify
`user_has_shop_access(p_shop_id)` before storing the session variable.

#### Helper functions (unchanged from Rev 1 in signature; bodies
adjusted for the renamed `user_shop_access` table)

```sql
-- (1) Pure set-membership: any role in the shop counts as access
create or replace function public.user_has_shop_access(p_shop_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_shop_access
    where user_id = auth.uid() and shop_id = p_shop_id
  );
$$;

-- (2) Active shop: reads the per-request session variable, validates fallback
create or replace function public.current_active_shop_id()
returns uuid
language sql stable security definer set search_path = public, pg_catalog
as $$
  select coalesce(
    nullif(current_setting('app.shop_id', true), '')::uuid,
    (select shop_id from public.user_shop_access
       where user_id = auth.uid()
       group by user_id having count(*) = 1
       limit 1)
  );
$$;

-- (3) Set the active shop (LOCKED REFINEMENT: validates membership)
create or replace function public.set_active_shop(p_shop_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not public.user_has_shop_access(p_shop_id) then
    raise exception 'no_access_to_shop' using errcode = 'P0001';
  end if;
  perform set_config('app.shop_id', p_shop_id::text, false);
end;
$$;

-- (4) Back-compat: `current_shop_id()` body is INTENTIONALLY NOT replaced
-- during migration 0070. The v2.8.5 body
--   `select id from public.shops where owner_user_id = auth.uid() limit 1;`
-- is preserved so that old PERMISSIVE RLS policies (which reference
-- `current_shop_id()`) return NULL for non-owner users during the
-- stabilization week. This makes the old policies a no-op for invited
-- employees, so PostgreSQL's allow-wins OR-combination across old and
-- new policies does NOT widen access — the new policy is the only gate
-- that can permit non-owners. Closes the "deny wins" concern raised
-- during Phase D review (2026-05-13).
--
-- After migration 0077 drops the old policies (Day 7 cutover), no caller
-- references this body. v2.10+ may optionally re-alias to
-- `current_active_shop_id()` or drop the function entirely.
```

#### NEW helper functions (replace role-based helpers from Rev 1)

```sql
-- (5) Owner shortcut + per-permission lookup; missing row = FALSE
create or replace function public.user_has_permission(
  p_shop_id uuid, p_permission_key text
) returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select case
    when exists (
      select 1 from public.user_shop_access
      where user_id = auth.uid() and shop_id = p_shop_id and is_owner = true
    ) then true
    else coalesce(
      (select usp.granted
         from public.user_shop_access usa
         join public.user_shop_permissions usp on usp.user_shop_access_id = usa.id
        where usa.user_id = auth.uid()
          and usa.shop_id = p_shop_id
          and usp.permission_key = p_permission_key),
      false
    )
  end;
$$;

-- (6) Convenience: list every permission the current user has at a shop
create or replace function public.user_permissions_in_shop(p_shop_id uuid)
returns table(permission_key text, granted boolean, source text)
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare
  v_is_owner boolean;
begin
  select is_owner into v_is_owner
    from public.user_shop_access
   where user_id = auth.uid() and shop_id = p_shop_id;
  if v_is_owner is null then return; end if;
  if v_is_owner then
    return query
      select pc.key, true, 'owner_implicit'::text
        from public.permissions_catalog pc where pc.is_active;
    return;
  end if;
  return query
    select pc.key, coalesce(usp.granted, false),
           coalesce(usp.source, 'default')
      from public.permissions_catalog pc
      left join public.user_shop_access usa
        on usa.user_id = auth.uid() and usa.shop_id = p_shop_id
      left join public.user_shop_permissions usp
        on usp.user_shop_access_id = usa.id
       and usp.permission_key = pc.key
     where pc.is_active;
end;
$$;
```

The Rev-1 `user_role_in_shop` / `user_has_min_role` /
`current_shop_has_min_role` / `current_user_can_see_sale_cost`
helpers are **dropped**. They're replaced by direct
`user_has_permission(...)` calls.

### B.2.0b — Mechanism: cost visibility (REVISED to permission-based)

The three-layer view strategy from Rev 1 collapses into **one view
per cost-bearing table**, with **per-column conditional projection
based on the caller's permissions**. This is simpler than the Rev-1
three-named-views-per-table scheme and aligns naturally with the
permission model.

#### One view per cost-bearing table

Each `<table>_view` is a `security_invoker = false` view that:
- Projects every row that passes the shop-scope filter AND any
  row-level permission gates (e.g., `view_all_sales` OR own).
- Projects every column unconditionally if it's non-sensitive
  (qty, price, name, id, etc.).
- Projects sensitive columns as `NULL` unless the caller has the
  specific permission for that column.

Example — `sale_items_view`:

```sql
create view public.sale_items_view with (security_invoker = false) as
select
  si.id, si.invoice_id, si.variant_id, si.product_id,
  si.qty, si.price_at_sale,
  si.line_discount_type, si.line_discount_value, si.line_discount_amount,
  si.batch_id, si.sold_expired,
  -- Sensitive: cost_at_sale gated by view_sale_cost
  case when public.user_has_permission(i.shop_id, 'view_sale_cost')
       then si.cost_at_sale
       else null
  end as cost_at_sale,
  -- Computed: line_profit (only if cost is visible)
  case when public.user_has_permission(i.shop_id, 'view_sale_cost')
       then ((si.price_at_sale * si.qty - coalesce(si.line_discount_amount, 0))
             - si.cost_at_sale * si.qty)::numeric(12,2)
       else null
  end as line_profit
  from public.sale_items si
  join public.invoices i on i.id = si.invoice_id
 where i.shop_id = public.current_active_shop_id()
   and public.user_has_shop_access(i.shop_id)
   and (public.user_has_permission(i.shop_id, 'view_all_sales')
        or i.cashier_id = auth.uid());
```

The raw `sale_items` table has RLS that denies SELECT to anyone
without `view_sale_cost` — effectively owner-only direct read (since
non-owners would need that permission AND the row-visibility
permission; the gate is stricter than the view's per-column gate).

Compared to Rev-1's `sale_items_safe` / `sale_items_revenue` /
`sale_items_with_margin` three-view scheme:
- (+) One view to maintain instead of three.
- (+) The owner can grant `view_sale_cost` to a single specific
  manager without flipping a shop-wide toggle. The view auto-respects.
- (+) Adding new sensitive columns: one view to update, with a
  `case when user_has_permission(...) then col else null end`.
- (−) Every cost-sensitive column reads call `user_has_permission(...)`
  once. Postgres should cache this within a query plan via the
  STABLE attribute, but verify in Phase D.

#### Tables that get a `_view`

| Table | View | Sensitive columns gated by |
|---|---|---|
| `sale_items` | `sale_items_view` | `cost_at_sale` → `view_sale_cost`; computed `line_profit` → `view_sale_cost`; computed `margin_percent` → `view_profit_margin` |
| `invoices` | `invoices_view` | computed `gross_profit` → `view_sale_cost`; computed `gross_margin_percent` → `view_profit_margin`; row filter: `view_all_sales` OR own |
| `products` | `products_view` | `cost`, `avg_cost`, `last_purchase_cost` → `view_product_cost` |
| `product_variants` | `product_variants_view` | `cost`, `avg_cost`, `last_purchase_cost` → `view_product_cost` |
| `inventory_batches` | `inventory_batches_view` | `cost_per_unit` → `view_batch_cost` |
| `purchases` | `purchases_view` | row filter: requires `view_purchases` |
| `purchase_items` | `purchase_items_view` | row filter: requires `view_purchases` |
| `purchase_overhead_items` | `purchase_overhead_items_view` | row filter: requires `view_purchases` |
| `customers` | `customers_view` | `phone`, `address` → `view_customer_contact`; `outstanding_balance` → `view_customer_outstanding`; computed `has_khata` → always visible if any access |
| `ledger_entries` | `ledger_entries_view` | row filter: requires `view_customer_khata` |
| `monthly_summary` | `monthly_summary_view` | computed `gross_profit` → `view_sale_cost`; row filter: requires `view_monthly_targets` (since the view is mostly target-style data) — actually no, monthly_summary is a sales aggregate, separate from targets. Row filter: requires `view_reports` |
| `shop_owner_details` | `shop_owner_details_view` | row filter: requires `view_owner_details` |

The raw tables have RLS that requires the most-permissive permission
for the table's primary sensitive data (e.g., raw `sale_items`
requires `view_sale_cost` — owner-only direct read). The views are
the only practical way for non-owners to read these tables; the
client always reads from the `_view`.

### B.2.1 — Many-shops-per-user (UNCHANGED from Rev 1)

The `user_shop_access` join table (renamed from `user_shop_roles`)
lets a user have a different permission set at each shop. The
locked rationale from Rev 1 §B.2.1 holds: SMB Pakistani context where
small-shop owners moonlight as managers at relatives' shops, and
pilot users may own multiple shops.

The TopBar gains a shop switcher when the user has >1 row in
`user_shop_access`. The `set_active_shop` RPC drives it.

### B.2.2 — Cost visibility policy (REVISED to permission-based)

The Rev-1 role-based table:

| Role | Sale cost / profit | Sale margin % | Purchase cost | Variant cost | Batch cost |

…collapses to a per-permission rule:

| Permission | What it unlocks |
|---|---|
| `view_sale_cost` | `sale_items.cost_at_sale`, computed `line_profit`, `invoices.gross_profit`, `monthly_summary.gross_profit` |
| `view_profit_margin` | `invoices.gross_margin_percent`, `sale_items.margin_percent` (no absolute cost or profit) |
| `view_product_cost` | `products.cost` / `avg_cost` / `last_purchase_cost`, same on `product_variants` |
| `view_batch_cost` | `inventory_batches.cost_per_unit` |
| `view_purchases` | All purchases / purchase_items / purchase_overhead_items rows including cost |

**The defaults from §B.1.1 enforce the Rev-1 policy implicitly:**
- Manager preset has `view_sale_cost = ·` and `view_profit_margin = ·`
  → manager sees nothing cost-related on sales by default (Rev-1 D5
  override).
- Manager preset has `view_product_cost = ✓` and `view_batch_cost = ✓`
  and `view_purchases = ✓` → manager sees purchase-side cost (Rev-1
  B.2.2 operational rationale).
- Owner toggle from Rev 1 (`shops.manager_sees_margin`) becomes
  per-user grant of `view_profit_margin`. Per-shop is now per-user;
  the owner enables it for the specific manager they trust.
- Owner toggle for salesperson outstanding visibility (Rev 1
  `shops.salesperson_sees_customer_outstanding`) becomes per-user
  grant of `view_customer_outstanding`. **CHANGE from Rev 1:** the
  salesperson preset default is now ✓ (per the user's catalog-revision
  point 3). Owners revoke if untrusted.

**Mechanism (per B.2.0b):** the per-column conditional projection in
each `_view` enforces this. There is no view-tier split anymore.

**Leaky-abstraction acknowledgment unchanged from Rev 1:** a manager
who recorded a recent purchase can mentally remember the cost and
compute profit on adjacent sales. Out of scope for v2.9.

### B.2.3 — Customer creation (REVISED to permission-based)

Rev 1 had two distinct paths: salesperson via RPC `create_customer_basic`,
manager+ via direct INSERT. Rev 2 unifies these:

- **All customer creates go through RPCs.** Two RPCs:
  - `create_customer_basic(p_name, p_phone)` — guarded by
    `create_customer_basic` permission; inserts row with default tier,
    no address.
  - `create_customer_full(p_name, p_phone, p_address, p_notes,
    p_tier_id)` — guarded by `create_customer_full` permission;
    inserts row with all fields.
- **Direct INSERT on `customers` is denied** for non-owners. The
  RLS policy is `(user_id has create_customer_basic OR
  create_customer_full) AND <field-level checks>`. Since field-level
  RLS is awkward, simpler: deny INSERT entirely for non-owners,
  require the RPC.

The dependency rules (B.1.2) enforce:
- `create_customer_basic` requires `view_customers`.
- `create_customer_full` requires `create_customer_basic` AND
  `view_customer_contact`.
- `edit_customer` requires `view_customers` AND `view_customer_contact`.

So a user with `edit_customer` automatically has the read paths they
need to construct a valid edit form.

**`assign_customer_tier`** is a separate permission. The edit_customer
RPC has a check: if the request includes a tier_id change, the caller
also needs `assign_customer_tier`. (Otherwise, tier-edit is silently
ignored.) Document the layered check in the RPC body in Phase D.

### B.2.4 — Discount limits (UNCHANGED from Rev 1)

**Storage** (renamed table):

```sql
alter table public.user_shop_access add column discount_limits jsonb
  not null default '{}'::jsonb;
```

**Default values applied at preset time** (per `apply_preset_to_user`
RPC, see §B.3.4):

- Owner: `{}` (no limits).
- Manager: `{"per_line_max_pct": 25, "per_invoice_max_pct": 15}`.
- Salesperson: `{"per_line_max_pct": 5, "per_invoice_max_pct": 3,
  "per_line_max_pkr": 100, "per_invoice_max_pkr": 300}`.

These defaults live in a system-managed constants block in the
migration that ships the `apply_preset_to_user` body. Owner can
override per-user via `modify_user_discount_limits` RPC.

**Resolution rule unchanged:** Missing key = no limit on that axis.

**Enforced in `record_sale`** — reads the caller's
`user_shop_access.discount_limits` (no shop-default fallback in
Rev 2; the preset values are baked into the user's row at preset
time).

### B.2.5 — Audit trail (REVISED — `cashier_role` dropped)

**Locked design changes from Rev 1:**

1. **`cashier_role` snapshot column DROPPED** from `invoices` and
   `purchases`. Reasoning: there's no longer a role to snapshot. The
   audit reconstruction goes through `user_shop_permission_audit`
   instead — query the audit log for permission changes around the
   sale's `created_at` to know what permissions the cashier had at
   that time.
2. **`cashier_id` snapshot retained** on `invoices` and `purchases`
   (already there; v2.9 adds no new column).
3. **`created_by_user_id` / `updated_by_user_id`** added to writable
   catalog tables per Rev 1 §B.2.5; unchanged.
4. **New `user_shop_permission_audit` table** replaces the Rev-1
   `user_shop_role_audit`. Records every permission grant / revoke /
   preset application / discount-limit change / access revocation.
   See §B.3.1.

**Audit UI surfacing** (deferred to Phase D detail):
- Sale detail: "Sold by Asad on 2026-05-13 14:23" (no role label —
  the user can be looked up in `/settings/team` for current
  permissions).
- Team page: per-user history of permission changes via
  `view_user_audit_log` permission.

### B.2.6 — Invitation flow (REVISED with preset + override delta)

**Locked design changes from Rev 1:**

1. **Invitation stores preset + resolved permission set.** Two new
   columns on `pending_invitations`:
   - `preset_applied text` — record of which preset the owner picked
     (`'manager'` or `'salesperson'`; no `'owner'` preset for
     invitations).
   - `permissions jsonb` — resolved permission set at invitation-
     create time. Shape: `{"permission_key": boolean, ...}` covering
     every catalog row.
   - `discount_limits jsonb` — resolved discount limits (presets +
     any owner overrides at create time).
2. **`create_invitation` RPC** takes `(p_email, p_preset,
   p_permission_overrides jsonb, p_discount_limit_overrides jsonb)`:
   - Validates `p_preset IN ('manager', 'salesperson')`.
   - Reads catalog `preset_<role>_default` columns to compute
     baseline permissions.
   - Applies `p_permission_overrides` (key→bool delta) on top.
   - Validates dependency rules (catalog `requires`) — raises
     `permission_dependency_missing` if overrides leave the user in
     an inconsistent state.
   - Resolves discount_limits = preset default + overrides.
   - Snapshots the resolved sets into the `pending_invitations` row.
   - Returns `(invitation_id, confirmation_code)` for owner UI.
3. **`accept_invitation` RPC** reads the snapshotted permissions
   JSONB and inserts one row per key into `user_shop_permissions`,
   plus the `user_shop_access` row with `discount_limits` and
   `preset_applied`. No re-resolution of preset defaults at accept
   time (the snapshot is authoritative — Rev 1's potential drift
   between invite-create and accept is closed).
4. **The dependency-rule validation runs at both invitation-create
   AND accept time.** Belt and suspenders: even if the catalog
   shifted between create and accept, the snapshot still satisfies
   the dependency check at accept time.

**Owner-mistype mitigation unchanged from Rev 1:** 4-digit verbal
confirmation code + 24h expiration + 5-strike auto-cancel via
`pending_invitations.failed_attempts`.

**Edge cases E1–E8 from Rev 1 §B.6.3 carry over unchanged.** See §B.6
of this document for the revised RPC bodies and the unchanged edge
case handling.

---

## B.3 Schema design (REVISED)

> All DDL below is design SQL, not production migrations. Phase D
> translates into ordered migration files.

### B.3.1 NEW tables

```sql
-- (1) Permissions catalog — system-wide, Anthropic-managed via migrations
create table public.permissions_catalog (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null,
  category text not null check (category in (
    'sales', 'products', 'inventory', 'customers', 'suppliers',
    'financial', 'settings', 'team'
  )),
  preset_owner_default boolean not null default true,  -- informational only
  preset_manager_default boolean not null default false,
  preset_salesperson_default boolean not null default false,
  requires text[] not null default '{}'::text[],
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- RLS: read by all authenticated; no writes (managed by migration)
alter table public.permissions_catalog enable row level security;
create policy catalog_read_all on public.permissions_catalog
  for select to authenticated using (true);

-- (2) User's access to a shop — one row per (user, shop)
create table public.user_shop_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  is_owner boolean not null default false,
  preset_applied text check (preset_applied in ('manager', 'salesperson') or preset_applied is null),
  discount_limits jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, shop_id)
);
create unique index uq_user_shop_access_one_owner_per_shop
  on public.user_shop_access (shop_id)
  where is_owner = true;
create index ix_usa_user on public.user_shop_access (user_id);
create index ix_usa_shop on public.user_shop_access (shop_id);
alter table public.user_shop_access enable row level security;

-- (3) Per-permission grants for non-owner users
create table public.user_shop_permissions (
  id uuid primary key default gen_random_uuid(),
  user_shop_access_id uuid not null references public.user_shop_access(id) on delete cascade,
  permission_key text not null references public.permissions_catalog(key),
  granted boolean not null,
  granted_by_user_id uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  source text not null default 'preset' check (source in ('preset', 'manual')),
  unique (user_shop_access_id, permission_key)
);
create index ix_usp_lookup on public.user_shop_permissions
  (user_shop_access_id, permission_key) include (granted);
alter table public.user_shop_permissions enable row level security;

-- (4) Audit log: every permission change, preset application, discount-limit
-- change, access grant/revoke
create table public.user_shop_permission_audit (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id),
  actor_user_id uuid not null references public.profiles(id),
  permission_key text,  -- null for non-permission actions
  old_granted boolean,
  new_granted boolean,
  old_value jsonb,  -- for discount_limits_changed (full old json)
  new_value jsonb,  -- for discount_limits_changed (full new json)
  action text not null check (action in (
    'permission_granted', 'permission_revoked',
    'preset_applied', 'discount_limits_changed',
    'access_granted', 'access_revoked'
  )),
  reason text,
  changed_at timestamptz not null default now()
);
create index ix_uspa_shop on public.user_shop_permission_audit (shop_id, changed_at desc);
create index ix_uspa_target on public.user_shop_permission_audit (target_user_id, changed_at desc);
alter table public.user_shop_permission_audit enable row level security;

-- (5) Pending invitations — REVISED with snapshot
create type public.invitation_status as enum ('pending', 'accepted', 'cancelled', 'expired');
create table public.pending_invitations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null check (length(trim(email)) > 0 and email = lower(email)),
  preset_applied text not null check (preset_applied in ('manager', 'salesperson')),
  permissions jsonb not null,  -- resolved set at create time
  discount_limits jsonb not null default '{}'::jsonb,
  invited_by_user_id uuid not null references public.profiles(id),
  confirmation_code text not null check (confirmation_code ~ '^[0-9]{4}$'),
  failed_attempts int not null default 0,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references public.profiles(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index uq_pending_invitations_one_pending_per_shop_email
  on public.pending_invitations (shop_id, email) where status = 'pending';
create index ix_pi_email on public.pending_invitations (lower(email)) where status = 'pending';
create index ix_pi_shop on public.pending_invitations (shop_id, created_at desc);
alter table public.pending_invitations enable row level security;
```

### B.3.2 Columns added to existing tables

```sql
-- shops: salesperson cap retained, manager_sees_margin and
-- salesperson_sees_customer_outstanding DROPPED from Rev 1 (now permissions)
alter table public.shops
  add column salesperson_payment_cap_pkr numeric(12,2) not null default 10000
    check (salesperson_payment_cap_pkr >= 0);

-- shops.owner_user_id unchanged; FK changed to RESTRICT (per F-M-23 from
-- the audit)
alter table public.shops drop constraint shops_owner_user_id_fkey;
alter table public.shops add constraint shops_owner_user_id_fkey
  foreign key (owner_user_id) references public.profiles(id) on delete restrict;

-- ledger_entries: who recorded
alter table public.ledger_entries
  add column created_by_user_id uuid references public.profiles(id);

-- customers: soft-delete + creator
alter table public.customers
  add column is_active boolean not null default true,
  add column created_by_user_id uuid references public.profiles(id);

-- monthly_targets: updater
alter table public.monthly_targets
  add column updated_by_user_id uuid references public.profiles(id);

-- inventory_batches: last modifier (for partial write-off attribution)
alter table public.inventory_batches
  add column last_modified_by_user_id uuid references public.profiles(id);

-- Generic created_by / updated_by on the writable catalog tables
alter table public.products add column created_by_user_id uuid references public.profiles(id),
                            add column updated_by_user_id uuid references public.profiles(id);
alter table public.product_variants add column created_by_user_id uuid references public.profiles(id),
                                    add column updated_by_user_id uuid references public.profiles(id);
alter table public.product_categories add column created_by_user_id uuid references public.profiles(id),
                                       add column updated_by_user_id uuid references public.profiles(id);
alter table public.suppliers add column created_by_user_id uuid references public.profiles(id),
                             add column updated_by_user_id uuid references public.profiles(id);
alter table public.product_packs add column created_by_user_id uuid references public.profiles(id),
                                 add column updated_by_user_id uuid references public.profiles(id);
alter table public.variant_attributes add column created_by_user_id uuid references public.profiles(id);
alter table public.variant_attribute_values add column created_by_user_id uuid references public.profiles(id);
alter table public.customer_tiers add column created_by_user_id uuid references public.profiles(id),
                                   add column updated_by_user_id uuid references public.profiles(id);
```

**Dropped from Rev 1 design** (these never existed; were Rev-1
proposals):
- `shops.manager_sees_margin` — replaced by `view_profit_margin` permission
- `shops.salesperson_sees_customer_outstanding` — replaced by `view_customer_outstanding` permission
- `shops.default_discount_limits` — replaced by preset defaults baked into `apply_preset_to_user`
- `invoices.cashier_role` — dropped per B.2.5
- `purchases.cashier_role` — dropped per B.2.5

### B.3.3 Helper functions (FROM B.2.0a)

Defined in §B.2.0a. The complete set:

1. `user_has_shop_access(p_shop_id)`
2. `current_active_shop_id()`
3. `set_active_shop(p_shop_id)`
4. `current_shop_id()` — back-compat alias
5. `user_has_permission(p_shop_id, p_permission_key)` — **primary
   runtime check, used by every RLS policy and function guard**
6. `user_permissions_in_shop(p_shop_id)` — convenience for UI

Plus two dependency-validation helpers (Phase D will inline these in
the relevant RPCs if appropriate; keeping them factored for clarity):

```sql
-- (7) Validate grant-time dependencies
create or replace function public.validate_permission_grant(
  p_access_id uuid, p_permission_key text
) returns void
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare
  v_requires text[];
  v_req text;
  v_req_granted boolean;
begin
  select requires into v_requires
    from public.permissions_catalog where key = p_permission_key;
  if v_requires is null or cardinality(v_requires) = 0 then return; end if;

  foreach v_req in array v_requires loop
    select coalesce(usp.granted, false) into v_req_granted
      from public.user_shop_permissions usp
     where usp.user_shop_access_id = p_access_id
       and usp.permission_key = v_req;
    if not coalesce(v_req_granted, false) then
      raise exception 'permission_dependency_missing'
        using errcode = 'P0001',
              detail = format('Granting %s requires %s to also be granted', p_permission_key, v_req);
    end if;
  end loop;
end;
$$;

-- (8) Validate revoke-time dependencies (no dependents granted)
create or replace function public.validate_permission_revoke(
  p_access_id uuid, p_permission_key text
) returns void
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare v_dep record;
begin
  for v_dep in
    select pc.key, pc.name
      from public.permissions_catalog pc
     where p_permission_key = any(pc.requires)
       and exists (
         select 1 from public.user_shop_permissions usp
         where usp.user_shop_access_id = p_access_id
           and usp.permission_key = pc.key and usp.granted)
  loop
    raise exception 'cannot_revoke_required_permission'
      using errcode = 'P0001',
            detail = format('Cannot revoke %s: %s depends on it and is granted',
                            p_permission_key, v_dep.key);
  end loop;
end;
$$;
```

### B.3.4 NEW SECURITY DEFINER RPCs (signatures + behavior contract)

**Permission management:**

```sql
create function public.modify_user_permission(
  p_target_user_id uuid,
  p_permission_key text,
  p_granted boolean,
  p_reason text default null
) returns void;
-- Caller permission: modify_user_permissions
-- Cannot target the owner (raises cannot_modify_owner).
-- If p_granted: calls validate_permission_grant.
-- If not p_granted: calls validate_permission_revoke.
-- Upserts user_shop_permissions row with source='manual'.
-- Writes user_shop_permission_audit row.

create function public.apply_preset_to_user(
  p_target_user_id uuid,
  p_preset text  -- 'manager' or 'salesperson'
) returns void;
-- Caller permission: modify_user_permissions
-- Cannot target the owner.
-- Inserts/upserts user_shop_permissions rows per catalog defaults for the preset.
-- Updates user_shop_access.preset_applied.
-- Writes user_shop_permission_audit row with action='preset_applied'.

create function public.update_user_discount_limits(
  p_target_user_id uuid,
  p_discount_limits jsonb,
  p_reason text default null
) returns void;
-- Caller permission: modify_user_discount_limits
-- Cannot target the owner.
-- Updates user_shop_access.discount_limits.
-- Writes audit row.

create function public.revoke_user_access(
  p_target_user_id uuid,
  p_reason text default null
) returns void;
-- Caller permission: revoke_user_access
-- Cannot revoke own access (cannot_revoke_own_access).
-- Cannot revoke owner (cannot_revoke_owner_access).
-- Deletes user_shop_access row (cascades to user_shop_permissions).
-- Writes audit row with action='access_revoked'.
```

**Invitation flow:**

```sql
create function public.create_invitation(
  p_email text,
  p_preset text,  -- 'manager' or 'salesperson'
  p_permission_overrides jsonb default '{}'::jsonb,  -- key→bool delta
  p_discount_limit_overrides jsonb default '{}'::jsonb
) returns table(invitation_id uuid, confirmation_code text);
-- Caller permission: invite_users
-- Resolves: baseline = catalog preset defaults; final = baseline + overrides.
-- Validates dependencies on the final set (raises permission_dependency_missing).
-- Snapshots into pending_invitations.permissions (JSONB).
-- Generates 4-digit code, sets expires_at = now() + 24h.
-- Triggers the Supabase Admin API invite email via an edge function.

create function public.cancel_invitation(p_invitation_id uuid) returns void;
-- Caller permission: cancel_invitations + (shop ownership of the invitation's shop)
-- Sets status='cancelled', cancelled_at=now().

create function public.accept_invitation(
  p_invitation_id uuid,
  p_confirmation_code text
) returns uuid;  -- returns user_shop_access.id
-- Caller is the invitee (auth.uid()).
-- Verifies status='pending', expires_at>now(), failed_attempts<5,
--   confirmation_code matches, email matches caller's profile email.
-- On code mismatch: increments failed_attempts; if >=5 after increment,
--   sets status='cancelled' and raises invitation_not_pending.
-- On success: inserts user_shop_access (with discount_limits from snapshot),
--   inserts user_shop_permissions from snapshot, updates invitation to accepted.
-- Calls set_active_shop on the new shop.
-- Writes audit row with action='access_granted'.
```

**Customer creation (per B.2.3):**

```sql
create function public.create_customer_basic(p_name text, p_phone text)
returns uuid;
-- Caller permission: create_customer_basic
-- Inserts customer with default tier, no address.

create function public.create_customer_full(
  p_name text, p_phone text, p_address text default null,
  p_notes text default null, p_tier_id uuid default null
) returns uuid;
-- Caller permission: create_customer_full
-- (If p_tier_id is non-null: also requires assign_customer_tier; raises insufficient_permissions.)
-- Inserts customer with full fields.
```

**Expense / settings:**

```sql
create function public.create_expense(
  p_category text, p_amount numeric(12,2),
  p_expense_date date default current_date, p_note text default null
) returns uuid;
-- Caller permission: create_expense

create function public.update_expense(
  p_expense_id uuid, p_category text, p_amount numeric(12,2), p_note text default null
) returns void;
-- Caller permission: edit_expense
-- Body check: caller is creator (created_by = auth.uid()) AND created_at > now() - '24 hours'.

create function public.update_shop_settings(
  p_shop_name text default null, p_shop_address text default null,
  p_shop_phone text default null, p_shop_type text default null,
  p_default_expiry_alert_days int default null,
  p_default_warranty_alert_days int default null,
  p_default_expired_sale_policy public.expired_sale_policy default null,
  p_expired_sale_receipt_disclaimer boolean default null,
  p_salesperson_payment_cap_pkr numeric(12,2) default null
) returns void;
-- Caller permission: edit_shop_settings
-- Updates only the non-null parameters.

create function public.update_owner_details(
  p_owner_name text default null, p_owner_phone text default null,
  p_owner_cnic text default null, p_owner_address text default null
) returns void;
-- Caller permission: edit_owner_details (which requires view_owner_details)

create function public.upsert_monthly_target(
  p_month date, p_target_sale numeric(12,2),
  p_target_gross_profit numeric(12,2), p_target_net_profit numeric(12,2)
) returns uuid;
-- Caller permission: manage_monthly_targets
```

**Onboarding (revised):**

```sql
-- complete_onboarding: now also inserts user_shop_access (is_owner=true)
-- and skips user_shop_permissions inserts (owner uses implicit shortcut).
-- Raises already_owner_at_this_email_user_combo on duplicate shop name attempt.
```

**Helper RPCs for the new UI:**

```sql
create function public.get_user_shop_list()
returns table(shop_id uuid, shop_name text, is_owner boolean, preset_applied text);
-- Returns all shops the calling user has access to. Used by the TopBar shop switcher.

create function public.get_team_for_active_shop()
returns table(
  user_id uuid, email text, is_owner boolean, preset_applied text,
  joined_at timestamptz, granted_permission_count int
);
-- Caller permission: view_team
-- Lists all users with access to the current_active_shop_id().

create function public.get_user_permissions(p_target_user_id uuid)
returns table(permission_key text, granted boolean, source text);
-- Caller permission: view_team
-- Lists target user's permissions at current_active_shop_id().
```

### B.3.5 NEW views (per B.2.0b mechanism)

The eleven `_view`s listed in B.2.0b: `sale_items_view`,
`invoices_view`, `products_view`, `product_variants_view`,
`inventory_batches_view`, `purchases_view`, `purchase_items_view`,
`purchase_overhead_items_view`, `customers_view`,
`ledger_entries_view` (replaces the existing one), `monthly_summary_view`,
`shop_owner_details_view`.

Plus the unchanged `shop_effective_subscription` from Rev 1 (resolves
through `shops.owner_user_id` to subscription).

All views are `security_invoker = false` and read
`user_has_permission(...)` in their bodies. Full DDL deferred to Phase D
migrations.

### B.3.6 RLS policies on new tables

See §B.4 below.

### B.3.7 The Anthropic-managed catalog seed

A migration inserts the 50 catalog rows verbatim from §B.1.1. The
`requires` arrays from §B.1.2 are populated. Phase D writes this
migration; here's the shape:

```sql
insert into public.permissions_catalog (
  key, name, description, category, display_order,
  preset_owner_default, preset_manager_default, preset_salesperson_default,
  requires
) values
  -- SALES
  ('record_sale', 'Record sale', 'Make a new sale through POS', 'sales', 1,
    true, true, true, '{}'::text[]),
  ('view_all_sales', 'View all sales', '...', 'sales', 2,
    true, true, false, '{}'::text[]),
  -- ... (48 more rows)
;
```

When v2.9.1 ships a new permission, the migration inserts a new row
(no backfill of `user_shop_permissions` for existing users — staff
defaults to OFF via missing-row, owners pass implicitly).

---

## B.4 RLS policy strategy (REVISED, per-permission)

Every shop-scoped table's RLS now uses `user_has_permission(shop_id,
'<key>')` for the gate. The Rev-1 enforcement classes collapse: each
table's read/write predicate is the relevant permission key.

### B.4.1 Identity & subscription

**`profiles`** (unchanged from Rev 1; team-read added):
```sql
create policy profiles_self_read on public.profiles
  for select using (id = (select auth.uid()));
create policy profiles_team_read on public.profiles
  for select using (
    exists (
      select 1 from public.user_shop_access usa_target
      join public.user_shop_access usa_caller on usa_caller.shop_id = usa_target.shop_id
      where usa_target.user_id = profiles.id
        and usa_caller.user_id = (select auth.uid())
        and usa_caller.is_owner = true
    )
  );
create policy profiles_self_update on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
```

**`subscriptions`** (unchanged; self-only):
```sql
create policy subscriptions_self_read on public.subscriptions
  for select using (user_id = (select auth.uid()));
-- No write policies; service_role only.
```

### B.4.2 Shop, owner details, settings

**`shops`:**
```sql
-- All members read (basic info)
create policy shops_member_read on public.shops
  for select using (public.user_has_shop_access(id));

-- INSERT via complete_onboarding only (no policy).
-- UPDATE via update_shop_settings RPC only — DIRECT UPDATE DENIED (per F-NEW-02 from
-- Phase C / audit residual finding; rev 2 incorporates).
-- No DELETE.
```

Note: in Rev 1 §B.4.6 we had `shops_owner_update`. Rev 2 drops this
entirely; the only update path is via the `update_shop_settings`
RPC. This is stricter than Rev 1 and closes Phase C's F-NEW-02
finding (owner_user_id was editable via the broad policy).

Defense in depth (matches Phase C F-NEW-02):
```sql
revoke update (owner_user_id) on public.shops from authenticated;
```

**`shop_owner_details`:**
```sql
create policy owner_details_read on public.shop_owner_details
  for select using (public.user_has_permission(shop_id, 'view_owner_details'));
-- Write via update_owner_details RPC only.
```

### B.4.3 Catalog

**`products`:**
```sql
-- Raw table SELECT requires the most-permissive permission (cost-bearing)
create policy products_cost_read on public.products
  for select using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'view_product_cost')
  );
-- Non-cost reads go via products_view (DEFINER); requires only view_products
-- via the view body.

create policy products_write_create on public.products
  for insert with check (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'create_product')
  );
create policy products_write_edit on public.products
  for update using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'edit_product')
  ) with check (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'edit_product')
  );
-- DELETE: no policy (use archive_product → toggle is_active).
```

**`product_variants`:** same shape, joined through products for shop scope.
```sql
create policy variants_cost_read on public.product_variants
  for select using (
    exists (select 1 from public.products p
      where p.id = product_variants.product_id
        and p.shop_id = public.current_active_shop_id()
        and public.user_has_permission(p.shop_id, 'view_product_cost'))
  );
create policy variants_write_create on public.product_variants
  for insert with check (
    exists (select 1 from public.products p
      where p.id = product_variants.product_id
        and p.shop_id = public.current_active_shop_id()
        and public.user_has_permission(p.shop_id, 'create_product'))
  );
create policy variants_write_edit on public.product_variants
  for update using (
    exists (select 1 from public.products p
      where p.id = product_variants.product_id
        and p.shop_id = public.current_active_shop_id()
        and public.user_has_permission(p.shop_id, 'edit_product'))
  ) with check (
    exists (select 1 from public.products p
      where p.id = product_variants.product_id
        and p.shop_id = public.current_active_shop_id()
        and public.user_has_permission(p.shop_id, 'edit_product'))
  );
```

**`product_categories`:**
```sql
-- All members can read (used everywhere)
create policy categories_read on public.product_categories
  for select using (shop_id = public.current_active_shop_id() and public.user_has_shop_access(shop_id));
-- Write via create_category_inline / update_category RPCs; gated on
-- manage_product_categories at the function level.
```

**`product_packs`:**
```sql
create policy packs_read on public.product_packs
  for select using (
    exists (select 1 from public.products p
      where p.id = product_packs.product_id
        and p.shop_id = public.current_active_shop_id()
        and public.user_has_shop_access(p.shop_id))
  );
-- Writes via RPCs gated on manage_product_packs.
```

**`variant_attributes`** / **`variant_attribute_values`** /
**`product_variant_attribute_values`:**
```sql
-- Read by all (POS needs labels)
create policy variant_attr_read on public.variant_attributes
  for select using (shop_id = public.current_active_shop_id() and public.user_has_shop_access(shop_id));
-- Write via RPCs gated on manage_variant_attributes.
-- Same pattern for the other two tables.
```

**`units_of_measure`:**
```sql
create policy uom_read on public.units_of_measure
  for select using (shop_id = public.current_active_shop_id() and public.user_has_shop_access(shop_id));
-- Write via RPC (manage_units_of_measure permission).
```

### B.4.4 Inventory

**`inventory_batches`:**
```sql
-- Raw read requires view_batch_cost (since the column is the sensitive piece)
create policy batches_cost_read on public.inventory_batches
  for select using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory_batches.variant_id
        and p.shop_id = public.current_active_shop_id()
        and public.user_has_permission(p.shop_id, 'view_batch_cost')
    )
  );
-- Salesperson POS reads via inventory_batches_view (DEFINER).
-- Writes (record_purchase, record_partial_writeoff, deactivate_batch)
-- go through RPCs with their own permission gates.
```

**`suppliers`:**
```sql
create policy suppliers_read on public.suppliers
  for select using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'view_suppliers')
  );
create policy suppliers_write on public.suppliers
  for all using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'manage_suppliers')
  ) with check (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'manage_suppliers')
  );
```

**`purchases` / `purchase_items` / `purchase_overhead_items`:**
```sql
-- All three follow the same shape: read requires view_purchases.
create policy purchases_read on public.purchases
  for select using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'view_purchases')
  );
-- INSERT only via record_purchase RPC (which requires record_purchase permission).
-- UPDATE/DELETE: blocked by financial_records_immutable trigger.

create policy purchase_items_read on public.purchase_items
  for select using (
    exists (select 1 from public.purchases p
      where p.id = purchase_items.purchase_id
        and p.shop_id = public.current_active_shop_id()
        and public.user_has_permission(p.shop_id, 'view_purchases'))
  );

create policy purchase_overhead_read on public.purchase_overhead_items
  for select using (
    exists (select 1 from public.purchases p
      where p.id = purchase_overhead_items.purchase_id
        and p.shop_id = public.current_active_shop_id()
        and public.user_has_permission(p.shop_id, 'view_purchases'))
  );
```

### B.4.5 Customers

**`customers`:**
```sql
-- Read: name only via view_customers; phone/address via view_customer_contact
-- (gated in the customers_view, not via RLS). Raw table read requires the
-- most-permissive: view_customer_contact (phone/address visibility).
create policy customers_read on public.customers
  for select using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'view_customer_contact')
  );
-- Non-contact readers read customers_view (DEFINER) which projects phone/address as null.

-- INSERT via create_customer_basic / create_customer_full RPCs only.
-- UPDATE via edit_customer-gated path:
create policy customers_update on public.customers
  for update using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'edit_customer')
  ) with check (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'edit_customer')
  );
-- DELETE: no policy.
```

**`customer_tiers`:**
```sql
create policy tiers_read on public.customer_tiers
  for select using (shop_id = public.current_active_shop_id() and public.user_has_shop_access(shop_id));
-- Write via RPCs gated on manage_customer_tiers.
```

### B.4.6 Sales

**`invoices`:**
```sql
-- Raw read requires view_sale_cost (since cost is reachable via the join)
-- Non-cost readers go through invoices_view.
create policy invoices_cost_read on public.invoices
  for select using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'view_sale_cost')
  );
-- INSERT only via record_sale (which gates on record_sale permission).
-- UPDATE/DELETE blocked by financial_records_immutable trigger.
```

**`sale_items`:**
```sql
create policy sale_items_cost_read on public.sale_items
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = sale_items.invoice_id
        and i.shop_id = public.current_active_shop_id()
        and public.user_has_permission(i.shop_id, 'view_sale_cost')
    )
  );
-- Non-cost readers read sale_items_view (DEFINER), which also applies the
-- cashier filter for view_all_sales=false users.
```

### B.4.7 Ledger / financial

**`ledger_entries`:**
```sql
create policy ledger_read on public.ledger_entries
  for select using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'view_customer_khata')
  );
-- INSERT only via record_sale (debit, gated on record_sale) and receive_payment (credit, gated on receive_payment).
-- UPDATE/DELETE blocked by ledger_entries_immutable trigger.
```

**`expenses`:**
```sql
create policy expenses_read on public.expenses
  for select using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'view_expenses')
  );
create policy expenses_create on public.expenses
  for insert with check (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'create_expense')
  );
-- UPDATE only via update_expense RPC (which checks 24h-window AND creator).
```

**`monthly_targets`:**
```sql
create policy monthly_targets_read on public.monthly_targets
  for select using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'view_monthly_targets')
  );
create policy monthly_targets_write on public.monthly_targets
  for all using (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'manage_monthly_targets')
  ) with check (
    shop_id = public.current_active_shop_id()
    and public.user_has_permission(shop_id, 'manage_monthly_targets')
  );
```

### B.4.8 Team / RBAC tables

**`user_shop_access`:**
```sql
-- Self-read at any shop; owner reads everyone for shops they own
create policy usa_self_or_owner_read on public.user_shop_access
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.user_shop_access usa_caller
      where usa_caller.user_id = (select auth.uid())
        and usa_caller.shop_id = user_shop_access.shop_id
        and usa_caller.is_owner = true
    )
  );
-- INSERT only via accept_invitation RPC.
-- UPDATE only via apply_preset_to_user / update_user_discount_limits / change_user_role RPCs.
-- DELETE only via revoke_user_access RPC.
```

**`user_shop_permissions`:**
```sql
create policy usp_self_or_owner_read on public.user_shop_permissions
  for select using (
    exists (
      select 1 from public.user_shop_access usa
      where usa.id = user_shop_permissions.user_shop_access_id
        and (usa.user_id = (select auth.uid())
             or exists (
               select 1 from public.user_shop_access usa_caller
               where usa_caller.user_id = (select auth.uid())
                 and usa_caller.shop_id = usa.shop_id
                 and usa_caller.is_owner = true
             )
             or public.user_has_permission(usa.shop_id, 'view_team'))
    )
  );
-- All writes via RPCs.
```

**`user_shop_permission_audit`:**
```sql
create policy uspa_owner_or_audit_read on public.user_shop_permission_audit
  for select using (
    exists (
      select 1 from public.user_shop_access usa
      where usa.user_id = (select auth.uid())
        and usa.shop_id = user_shop_permission_audit.shop_id
        and usa.is_owner = true
    )
    or public.user_has_permission(user_shop_permission_audit.shop_id, 'view_user_audit_log')
  );
-- INSERT only via RPCs (no policy needed).
```

**`pending_invitations`:**
```sql
create policy pi_owner_or_invitee_read on public.pending_invitations
  for select using (
    public.user_has_permission(shop_id, 'view_team')
    or lower(email) = (select lower(email) from public.profiles where id = (select auth.uid()))
  );
-- INSERT only via create_invitation. UPDATE only via cancel_invitation / accept_invitation.
```

**`permissions_catalog`:**
```sql
-- Anyone authenticated can read (UI needs to render permission names/descriptions)
create policy pc_read on public.permissions_catalog
  for select to authenticated using (true);
-- No write policies (migration-managed).
```

### B.4.9 Mechanism summary table

Every public.* table → its enforcement summary:

| Table | SELECT gate | INSERT gate | UPDATE gate | DELETE |
|---|---|---|---|---|
| `profiles` | self ∪ owner-team-read | trigger only | self | denied |
| `subscriptions` | self only | service_role | service_role | denied |
| `shops` | `user_has_shop_access` | `complete_onboarding` only | `update_shop_settings` RPC only (no direct UPDATE) | denied |
| `shop_owner_details` | `view_owner_details` | `complete_onboarding` only | `update_owner_details` RPC | denied |
| `products` | `view_product_cost` (raw) OR `products_view` if just `view_products` | `create_product` RPC | `edit_product` direct or RPC | denied (use `archive_product`) |
| `product_variants` | `view_product_cost` (raw) OR view | `create_product` or `manage_variants` RPC | `edit_product` direct | denied |
| `product_categories` | shop access | `manage_product_categories` RPC | same RPC | denied |
| `product_packs` | shop access | `manage_product_packs` RPC | same RPC | denied |
| `variant_attributes` (and values + assignments) | shop access | `manage_variant_attributes` RPC | same RPC | denied |
| `units_of_measure` | shop access | `manage_units_of_measure` RPC | same RPC | denied |
| `inventory_batches` | `view_batch_cost` (raw) OR view | `record_purchase` only | trigger-bounded; via `record_partial_writeoff`/`deactivate_batch` | denied |
| `suppliers` | `view_suppliers` | `manage_suppliers` | `manage_suppliers` direct or RPC | denied |
| `customers` | `view_customer_contact` (raw) OR view (cost-stripped) | `create_customer_basic`/`_full` RPC | `edit_customer` direct or RPC | denied |
| `customer_tiers` | shop access | `manage_customer_tiers` RPC | same RPC | denied |
| `invoices` | `view_sale_cost` (raw) OR view | `record_sale` only | denied (trigger) | denied (trigger) |
| `sale_items` | `view_sale_cost` (raw) OR view | `record_sale` only | denied | denied |
| `purchases` | `view_purchases` | `record_purchase` only | denied | denied |
| `purchase_items` | `view_purchases` | `record_purchase` only | denied | denied |
| `purchase_overhead_items` | `view_purchases` | `record_purchase` only | denied | denied |
| `ledger_entries` | `view_customer_khata` | `record_sale` / `receive_payment` / `reverse_ledger_entry` only | denied | denied |
| `expenses` | `view_expenses` | `create_expense` direct or RPC | `update_expense` RPC (24h + creator) | denied |
| `monthly_targets` | `view_monthly_targets` | `manage_monthly_targets` (RPC) | same RPC | denied |
| `user_shop_access` | self ∪ owner | `accept_invitation` only | RPCs only | `revoke_user_access` only |
| `user_shop_permissions` | self ∪ owner ∪ `view_team` | RPCs only | RPCs only | denied |
| `user_shop_permission_audit` | owner ∪ `view_user_audit_log` | RPC-internal only | denied | denied |
| `pending_invitations` | `view_team` ∪ invitee-by-email | `create_invitation` only | `cancel_invitation`/`accept_invitation` only | denied |
| `permissions_catalog` | any authenticated | migration only | migration only | denied |

---

## B.5 Function guard mapping (REVISED, exhaustive, permission-based)

**Method:** every callable RPC declares its required permission key.
The guard block is:

```sql
declare v_shop_id uuid := public.current_active_shop_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user' using errcode = 'P0001'; end if;
  if not public.user_has_permission(v_shop_id, '<key>') then
    raise exception 'insufficient_permissions'
      using errcode = 'P0001',
            detail = 'Required: <key>';
  end if;
  -- rest of body
end;
```

Helpers (`user_has_shop_access`, `current_active_shop_id`, etc.) and
trigger functions don't have caller-facing guards; they're called by
RLS / other DEFINER bodies / triggers.

### B.5.1 Existing 45 RPC-callable DEFINER functions → permission key

| Function | Required permission | Notes |
|---|---|---|
| `current_shop_id()` / `current_active_shop_id()` | (helper) | No caller-facing guard |
| `user_has_shop_access(uuid)` | (helper) | Used by RLS / RPCs |
| `complete_onboarding(...)` | (no permission — AUTH only) | Any authenticated; inserts `user_shop_access.is_owner = true` |
| `record_sale(...)` | `record_sale` | Plus discount-limit check via `user_shop_access.discount_limits`. Plus `confirm_expired_sale_at_pos` check when applicable. |
| `record_purchase(...)` | `record_purchase` | |
| `receive_payment(...)` | `receive_payment` | Plus salesperson-cap check (sum of today's credits where creator is the caller AND caller is non-owner) compared to `shops.salesperson_payment_cap_pkr`. If caller is owner, cap skipped. |
| `reverse_ledger_entry(...)` | `reverse_ledger_entry` | |
| `deactivate_batch(...)` | `writeoff_batch` | |
| `record_partial_writeoff(...)` | `writeoff_batch` | |
| `deactivate_pack(...)` | `manage_product_packs` | |
| `deactivate_tier(...)` | `manage_customer_tiers` | |
| `set_default_tier(...)` | `manage_customer_tiers` | |
| `define_tier(...)` | `manage_customer_tiers` | |
| `update_tier(...)` | `manage_customer_tiers` | |
| `create_supplier_inline(...)` | `manage_suppliers` | |
| `create_category_inline(...)` | `manage_product_categories` | |
| `update_category(...)` | `manage_product_categories` | |
| `create_variant_attribute(...)` | `manage_variant_attributes` | |
| `update_variant_attribute(...)` | `manage_variant_attributes` | |
| `deactivate_variant_attribute(...)` | `manage_variant_attributes` | |
| `add_variant_value(...)` | `manage_variant_attributes` | |
| `update_variant_value(...)` | `manage_variant_attributes` | |
| `deactivate_variant_value(...)` | `manage_variant_attributes` | |
| `add_variant_to_product(...)` | `create_product` | (Creating a variant = creating a product) |
| `create_product_with_opening_stock(...)` | `create_product` | |
| `create_product_with_variants(...)` | `create_product` | |
| `define_pack_inline(...)` | `manage_product_packs` | |
| `update_pack(...)` | `manage_product_packs` | |
| `suggest_batch_no(...)` | `record_purchase` (the only path that uses it) | |
| `preflight_expired_sale_check(...)` | `record_sale` | (Called before sale submission) |
| `search_products(...)` | `view_products` | **Permission-conditional projection** per F-PD-04 resolution: body NULLs `avg_cost`, `last_purchase_cost`, `min_price`, `max_price` when caller lacks `view_product_cost`. Single RPC serves all tiers. |
| `search_products_count(...)` | `view_products` | Count is non-cost. |
| `search_categories(...)` | `view_products` | (Used in product/category UI) |
| `search_suppliers(...)` | `view_suppliers` | |
| `search_variant_attributes(...)` | `view_products` | (Needed by POS to render labels — any product viewer) |
| `list_attribute_values(...)` | `view_products` | |
| `search_purchases(...)` | `view_purchases` | |
| `search_purchases_count(...)` | `view_purchases` | |
| `recent_purchase_products(...)` | `view_products` | Permission-conditional projection: body NULLs `avg_cost` when caller lacks `view_product_cost`. |
| `recent_suppliers(...)` | `view_suppliers` | |
| `recent_customers(...)` | `view_customers` | |
| `list_customers(...)` | `view_customers` | Permission-conditional projection: body NULLs `phone`/`address` when caller lacks `view_customer_contact`; NULLs `outstanding` when caller lacks `view_customer_outstanding`. |
| `search_khata_customers(...)` | `view_customer_khata` | |
| `search_khata_customers_count(...)` | `view_customer_khata` | |
| `batch_immutable_fields()` | TRIG | Per F-M-25: tighten EXECUTE grant to postgres/service_role |
| `batch_auto_deactivate_when_empty()` | TRIG | Per F-M-25: same |

**Total: 45 mapped + 6 helpers/onboarding = 51 (matches §3.2 + helpers).**

### B.5.2 Existing 6 restricted DEFINER trigger/cron functions

Unchanged from Rev 1: `handle_new_user`, `enforce_variant_default_invariants`,
`sync_product_id_from_variant`, `ledger_entries_update_balance`,
`products_normalize_trigger`, `expire_subscriptions`. EXECUTE grants
remain restricted to `postgres, service_role`. None require permission
checks (they run privileged from triggers / cron).

### B.5.3 Existing 4 SECURITY INVOKER functions

Unchanged: `financial_records_immutable`, `ledger_entries_immutable`,
`normalize_product_text`, `touch_updated_at`. None require permission
checks.

### B.5.4 NEW DEFINER RPCs (Rev 2 additions)

| Function | Required permission | Notes |
|---|---|---|
| `user_has_shop_access(uuid)` | (helper) | |
| `set_active_shop(uuid)` | AUTH (validates membership internally) | |
| `current_active_shop_id()` | (helper) | |
| `user_has_permission(uuid, text)` | (helper) | |
| `user_permissions_in_shop(uuid)` | (helper, but caller-facing: needs `view_team` if querying for non-self users; here it returns the caller's own set, no gate) | |
| `validate_permission_grant(uuid, text)` | (internal helper, no direct call) | |
| `validate_permission_revoke(uuid, text)` | (internal helper) | |
| `create_invitation(...)` | `invite_users` | |
| `cancel_invitation(uuid)` | `cancel_invitations` | |
| `accept_invitation(uuid, text)` | (AUTH — token-verified internally) | |
| `apply_preset_to_user(...)` | `modify_user_permissions` | |
| `modify_user_permission(...)` | `modify_user_permissions` | |
| `update_user_discount_limits(...)` | `modify_user_discount_limits` | |
| `revoke_user_access(...)` | `revoke_user_access` | |
| `create_customer_basic(...)` | `create_customer_basic` | |
| `create_customer_full(...)` | `create_customer_full` | (If p_tier_id non-null, also requires `assign_customer_tier`) |
| `create_expense(...)` | `create_expense` | |
| `update_expense(...)` | `edit_expense` | + creator + 24h-window in body |
| `update_shop_settings(...)` | `edit_shop_settings` | |
| `update_owner_details(...)` | `edit_owner_details` | |
| `upsert_monthly_target(...)` | `manage_monthly_targets` | |
| `get_user_shop_list()` | AUTH (returns only the caller's shops) | |
| `get_team_for_active_shop()` | `view_team` | |
| `get_user_permissions(uuid)` | `view_team` | |

**Count: 24 new RPCs in Rev 2.**

### B.5.5 Summary

- 45 existing RPC-callable DEFINER functions, each mapped to a single
  permission key (one was AUTH-only — `complete_onboarding`).
- 24 new RPCs in Rev 2.
- 6 restricted DEFINER trigger/cron — unchanged.
- 4 SECURITY INVOKER trigger helpers — unchanged.

**Total v2.9 function surface: 45 + 24 = 69 RPCs callable by
authenticated, 6 restricted DEFINER, 4 INVOKER = 79 functions.** Each
of the 69 maps to either AUTH (3: `complete_onboarding`,
`set_active_shop`, `accept_invitation`, `get_user_shop_list`) or to a
specific permission key from the catalog.

Helpers (`user_has_*`, `current_*`, `validate_*`,
`user_permissions_in_shop` for self) are also callable but have no
external behavior beyond what they expose. They're not "guarded" in
the permission sense — they're scaffolding for the policy/RPC layer.

### B.5.6 Grant pattern (every new or modified RPC)

```sql
revoke execute on function public.<name>(...) from public, anon;
grant execute on function public.<name>(...) to authenticated;
```

Re-applied after every `create or replace`. Phase D writes a sanity
audit query that lists any `public.*` function with `authenticated`
EXECUTE grant whose body does not contain `auth.uid()` or
`current_active_shop_id` or `user_has_permission` or
`user_has_shop_access` — should return zero rows for the 69
caller-facing RPCs.

---

## B.6 Invitation flow design (REVISED with preset + snapshot)

### B.6.1 Happy path

1. **Owner clicks "Invite employee"** at `/settings/team`. UI requires
   `view_team` (implicit at the page level — the route is in the team
   namespace). The Invite modal requires `invite_users`.
2. **Owner fills form:** email, preset (radio: `manager`/`salesperson`),
   permission overrides (a list of toggles seeded from the preset's
   defaults; owner can flip individual permissions before sending),
   discount-limit overrides (numeric fields seeded from preset values).
3. **Owner submits.** UI calls `create_invitation(p_email, p_preset,
   p_permission_overrides, p_discount_limit_overrides)`:
   - Validates `invite_users` permission.
   - Validates `p_preset ∈ {manager, salesperson}` — raises
     `cannot_invite_owner` if 'owner' passed.
   - Reads catalog defaults for the preset: baseline permissions =
     `{key: preset_<role>_default for each catalog row}`.
   - Final permissions = baseline + p_permission_overrides (overrides
     win; keys not in overrides keep baseline).
   - Validates dependency rules: for every permission in the final set
     where granted = true, the `requires` array must also be granted.
     Raises `permission_dependency_missing` with the missing key.
   - Final discount_limits = preset-default-discount-limits +
     p_discount_limit_overrides.
   - Generates random 4-digit `confirmation_code`.
   - Inserts `pending_invitations` row: `email = lower(trim(p_email))`,
     `preset_applied = p_preset`, `permissions = <final set>`,
     `discount_limits = <final>`, `confirmation_code = <generated>`,
     `expires_at = now() + interval '24 hours'`, `status = 'pending'`,
     `invited_by_user_id = auth.uid()`.
   - Calls Supabase Admin API via edge function `send_invitation_email`:
     `auth.admin.inviteUserByEmail(email, { data: { invitation_id,
     shop_id, shop_name } })`.
   - Returns `(invitation_id, confirmation_code)` to owner UI.
4. **Owner UI shows confirmation code** (30s modal + persistent on
   the team page): "Tell {name} to enter **3947** when they click the
   link."
5. **Invitee receives email + clicks magic link.** Supabase Auth
   handles redirect; if invitee is a new user, `auth.users` and
   `profiles` rows are created by `handle_new_user`. `auth.users.raw_user_meta_data`
   carries `invitation_id`.
6. **Invitee lands at `/invite/accept?invitation_id=<id>`.** UI:
   - Reads invitation_id from URL.
   - Optionally prompts for password (Supabase password-set flow for
     new users).
   - Asks: "Enter the 4-digit code your shop owner gave you."
   - "Accept" button.
7. **Invitee submits.** UI calls `accept_invitation(p_invitation_id,
   p_confirmation_code)`:
   - Locks the invitation row `FOR UPDATE` to prevent races.
   - Verifies `status = 'pending'`.
   - Verifies `expires_at > now()` — else raises `invitation_expired`.
   - Verifies `confirmation_code = p_confirmation_code` —
     else increments `failed_attempts`; if `failed_attempts >= 5` post-
     increment, sets `status = 'cancelled'` and raises
     `invitation_not_pending`; else raises `invalid_confirmation_code`.
   - Verifies `lower(email) = lower((select email from profiles where
     id = auth.uid()))` — else raises `invitation_email_mismatch`.
   - Validates dependencies on the snapshot's permissions JSONB
     (defense-in-depth; even if catalog `requires` changed between
     create and accept, the snapshot must still be self-consistent).
   - Inserts `user_shop_access (user_id = auth.uid(), shop_id,
     is_owner = false, preset_applied = invitation.preset_applied,
     discount_limits = invitation.discount_limits)`.
   - Iterates the snapshot's permissions JSONB; inserts
     `user_shop_permissions (user_shop_access_id, permission_key,
     granted, granted_by_user_id = invited_by_user_id, source =
     'preset')` for every catalog key.
   - Updates invitation: `status = 'accepted', accepted_at = now(),
     accepted_by_user_id = auth.uid()`.
   - Calls `set_active_shop(shop_id)`.
   - Inserts `user_shop_permission_audit` row with
     `action = 'access_granted'`, `actor_user_id = invited_by_user_id`,
     `new_value = invitation.permissions`.
   - Returns the new `user_shop_access.id`.
8. **Invitee lands at the new shop's dashboard.** Client routes there
   on success.

### B.6.2 The `pending_invitations` row lifecycle

Same as Rev 1 §B.6.2:

```
pending  ─── accept_invitation ──▶ accepted (terminal)
   │
   ├── cancel_invitation ──▶ cancelled (terminal)
   │
   ├── (expires_at passes + cron) ──▶ expired (terminal)
   │
   └── (5 wrong codes) ──▶ cancelled (auto, via accept_invitation)
```

Cleanup cron `cleanup_invitations()` runs daily at 00:30 UTC: marks
expired, hard-deletes terminal rows older than 30 days. Function
restricted to `postgres, service_role`.

### B.6.3 Edge cases (Rev 1's E1–E8 + Rev 2 additions)

All Rev-1 edge cases carry over unchanged. **NEW in Rev 2:**

**E9 — Catalog changes between invitation create and accept.**
- Scenario: owner creates invitation at 09:00 with current catalog.
  Anthropic ships a v2.9.1 migration at 10:00 that adds a new
  permission `view_X`. Invitee accepts at 11:00.
- Outcome: the snapshot in `pending_invitations.permissions` includes
  only the keys present at create time; the new `view_X` key is NOT
  in the snapshot. The invitee's `user_shop_permissions` rows are
  inserted only for the snapshot's keys; `view_X` has no row, so
  `user_has_permission(shop_id, 'view_X')` returns `false` — matching
  the design's "new permissions default OFF for staff."
- Mitigation: the v2.9.1 migration that adds `view_X` will also seed
  catalog `preset_<role>_default` for new invitations. Old pending
  invitations are unaffected.

**E10 — Owner changes the invitee's intended preset after creating
the invitation.**
- Scenario: owner created invitation as 'manager' preset; later wants
  to change to 'salesperson' but the invitee hasn't accepted yet.
- Mechanism: owner cancels the pending invitation and creates a new
  one. (No "edit pending invitation" RPC in v2.9 — keep it simple;
  cancel+recreate is one extra click and avoids race conditions on
  the snapshot.)
- Tested by Phase C T-INV-XX (added).

**E11 — Catalog row marked `is_active = false` while a pending
invitation references it.**
- Scenario: Anthropic deprecates a permission via `is_active = false`.
  A pending invitation has the key in its snapshot.
- Outcome: at accept time, the snapshot includes the deactivated
  key; `accept_invitation` inserts the `user_shop_permissions` row
  anyway. The runtime `user_has_permission` check still works — the
  catalog row exists (just inactive). The deactivated permission
  effectively becomes a no-op (no RPC references it).
- Mitigation: this is fine. Phase D can add a cleanup pass to remove
  inactive-key rows from `user_shop_permissions` periodically.

### B.6.4 Race conditions and atomicity

Unchanged from Rev 1 §B.6.4 plus:

- `accept_invitation` reads-and-locks the `pending_invitations` row
  via `FOR UPDATE`. The snapshot is read inside the lock.
- The dep validation at accept time runs against the snapshot, not
  against the (mutable) catalog. So even if Anthropic ships a
  conflicting catalog change, the snapshot is authoritative.
- The `uq_user_shop_access (user_id, shop_id)` constraint blocks
  parallel-accept races.
- The catalog's `requires` array is captured at create-time validation;
  if it changes between create and accept, the accept's defense-in-
  depth dep check might pass or fail. The pragmatic answer: snapshot
  the catalog deps too if Phase D finds this problematic. v2.9
  doesn't ship this; we expect catalog churn to be infrequent.

---

## B.7 Phase B Rev 2 summary

Permission-based pivot complete. Catalog locked at 50 permissions in
8 categories with 29 declared dependency rules. Three system presets
ship as starting templates; per-user overrides unlimited.

**File ready for Phase C revision** (`design/2026-05-13-rbac-attack-surface.md`).
Phase C revision must:

- Preserve the threat model, citation discipline, and reading-order
  structure (C.0.1, C.0.2, C.0.3).
- Preserve all cross-shop isolation attacks (independent of role
  model — they apply identically).
- Preserve all invitation-flow attacks and the audit query suite
  (mostly data integrity, not role-specific).
- Replace every "MGR-guarded" / "OWN-guarded" mitigation citation
  with the specific permission key from B.5.
- Restructure the test matrix to:
  - Permission boundary tests (every permission × {with, without} × test).
  - Preset application tests.
  - Override tests (grant/revoke beyond preset).
  - Audit boundary tests (every change writes a permission_audit row).
- Add new attack classes:
  - Permission grant tampering.
  - Stale permission cache.
  - Preset drift on feature ship.
  - Permission set enumeration.
  - Permission-based privilege escalation via social engineering.

Phase C revision starts ONLY after user acknowledgment of this Rev 2
Phase B.

---

*End of Phase B Rev 2. Document locked 2026-05-13.*
