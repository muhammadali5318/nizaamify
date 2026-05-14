# v2.10 Contacts — Attack Surface

**Status:** Locked at end of Phase B (2026-05-14).
**Companion docs:** `2026-05-14-v210-contacts-model-design.md`,
`2026-05-14-v210-contacts-implementation-plan.md`.
**Audit basis:** `audit/2026-05-14-v210-contacts-pre-design-audit.md`.

This document covers the v2.10 security perimeter: permission catalog,
RLS policies, DEFINER views, column-grants, RPC permission gates, audit
fields, and the AQ suite that verifies all of the above.

---

## 1. Permission catalog redesign

### 1.1 Current state (12 keys to retire)

Per audit §5.1, these 12 keys touch v2.10 surfaces and need migration:

`view_customers`, `view_customer_contact`, `view_customer_outstanding`,
`view_customer_khata`, `create_customer_basic`, `create_customer_full`,
`edit_customer`, `assign_customer_tier`, `manage_customer_tiers`,
`view_suppliers`, `manage_suppliers`, plus `receive_payment` (kept by
name; rebound to new `requires`).

### 1.2 New v2.10 catalog (12 new keys + receive_payment unchanged)

Locked preset table per B.4 ("Strict, folded, owner-conservative"):

| Key | Category | Owner | Mgr | Sales | Requires |
|---|---|---|---|---|---|
| `view_contacts` | contacts | ✓ | ✓ | ✓ | `[]` |
| `view_contact_contact_info` | contacts | ✓ | ✓ | ✓ | `[view_contacts]` |
| `view_contact_customer_data` | contacts | ✓ | ✓ | ✗ | `[view_contacts]` |
| `view_contact_supplier_data` | contacts | ✓ | ✗ | ✗ | `[view_contacts]` |
| `view_contact_net_position` | contacts | ✓ | ✗ | ✗ | `[view_contact_customer_data, view_contact_supplier_data]` |
| `create_contact_basic` | contacts | ✓ | ✓ | ✓ | `[view_contacts]` |
| `create_contact_full` | contacts | ✓ | ✓ | ✗ | `[create_contact_basic, view_contact_contact_info]` |
| `edit_contact` | contacts | ✓ | ✓ | ✗ | `[view_contacts, view_contact_contact_info]` |
| `promote_contact` | contacts | ✓ | ✗ | ✗ | `[view_contacts, view_contact_contact_info]` |
| `assign_contact_tier` | contacts | ✓ | ✓ | ✗ | `[view_contacts]` |
| `manage_contact_tiers` | contacts | ✓ | ✗ | ✗ | `[]` |
| `pay_supplier` | financial | ✓ | ✓ | ✗ | `[view_contacts, view_contact_supplier_data]` |
| `receive_payment` (unchanged in name, requires updated) | financial | ✓ | ✓ | ✓ | `[view_contacts, view_contact_customer_data]` |

**Category change:** `suppliers` category retires; `customers` category
renames to `contacts`. Migration 0105 updates `permissions_catalog`
rows.

### 1.3 Migration mapping for existing `user_shop_permissions` rows (24 total)

Per audit §5.2, 24 rows need remap.

**Policy locked: Policy 2 — intersect (2026-05-14).** Where two old keys
fold into one new key, the migration grants the new key only if the user
held **both** old keys. Users with only one of the two old keys do not
get the new key — they must be explicitly re-granted post-v2.10 via the
team UI. This is the honest-downgrade path that matches the B.4
"strict, folded, owner-conservative" preset intent.

Mapping table:

| Old key | New key(s) | Notes |
|---|---|---|
| `view_customers` | `view_contacts` | 1:1 (no fold). v2.9 manager+sales already had this; v2.10 they continue to see contacts. |
| `view_customer_contact` | `view_contact_contact_info` | 1:1 |
| `view_customer_outstanding` **AND** `view_customer_khata` (both held) | `view_contact_customer_data` | **Intersect.** Users with only one of the two do not get the new key. |
| `view_suppliers` | `view_contact_supplier_data` | 1:1 (no fold). Manager loses preset default but keeps existing grant during migration; subsequent invitations get the strict default. |
| `create_customer_basic` | `create_contact_basic` | 1:1 |
| `create_customer_full` | `create_contact_full` | 1:1 |
| `edit_customer` | `edit_contact` | 1:1 |
| `manage_suppliers` | `edit_contact` + (suppress) | Suppress because old key conflated create + edit; new `create_contact_basic` is not granted here (existing users already had `create_customer_basic` if applicable, which migrates separately). Least-privilege migration choice. |
| `assign_customer_tier` | `assign_contact_tier` | 1:1 |
| `manage_customer_tiers` | `manage_contact_tiers` | 1:1 |
| `receive_payment` | `receive_payment` | unchanged key; `requires` array updated to point at new dependency keys |

**Consequence on production's 24 existing rows:**

- Owner row (12 perms) — migrates 1:1 except where intersect applies. Owner has all keys so intersect is satisfied → `view_contact_customer_data` granted.
- Salesperson preset row (manager rows have all of: `view_customer_outstanding ✓`, `view_customer_khata ✓` — intersect satisfied → `view_contact_customer_data` granted; legacy `view_suppliers ✓` → `view_contact_supplier_data` granted).
- Salesperson preset row (sales has `view_customer_outstanding ✓` only, `view_customer_khata ✗`) — intersect FAILS → `view_contact_customer_data` NOT granted. Salesperson loses outstanding visibility as expected per B.4.

Migration 0105 includes a verification SELECT at end-of-migration to
print the resulting permission row count per user; mismatch with
expected counts halts the migration via `RAISE EXCEPTION`.

### 1.4 Edge case: `manage_suppliers` migration

The old `manage_suppliers` key conflated create + edit + archive. In
v2.10, those split into `create_contact_basic` (which manager has by
default) + `edit_contact` (also default) + the `pay_supplier` (financial
side). The migration only adds `edit_contact` from `manage_suppliers`
because:

- The user already has `create_customer_basic` → `create_contact_basic`
  migration path (no extra work).
- `pay_supplier` is new; manager gets it via preset default, not via
  legacy permission migration.

If a user only had `manage_suppliers` (no customer permissions), they
still get only `edit_contact` from migration. To gain `create_contact_basic`,
they need the preset default applied, which the migration runs as part
of seeding new keys.

---

## 2. RLS policies

### 2.1 `contacts` table

```sql
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone with view_contacts in their active shop
CREATE POLICY v210_contacts_read ON contacts
  FOR SELECT
  USING (
    shop_id = (SELECT current_active_shop_id())
    AND (SELECT user_has_permission(shop_id, 'view_contacts'))
  );

-- INSERT: gated at RLS for permission holders (matches v29 supplier write)
-- Note: most writes go through RPC; this policy is for any direct INSERT
CREATE POLICY v210_contacts_write ON contacts
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT current_active_shop_id())
    AND (
      (SELECT user_has_permission(shop_id, 'create_contact_basic'))
      OR (SELECT user_has_permission(shop_id, 'create_contact_full'))
    )
  );

-- UPDATE: edit_contact OR promote_contact (the latter is RPC-only but
-- the policy permits the RPC's SECURITY DEFINER context to bypass)
CREATE POLICY v210_contacts_update ON contacts
  FOR UPDATE
  USING (
    shop_id = (SELECT current_active_shop_id())
    AND (SELECT user_has_permission(shop_id, 'edit_contact'))
  )
  WITH CHECK (
    shop_id = (SELECT current_active_shop_id())
    AND (SELECT user_has_permission(shop_id, 'edit_contact'))
  );
```

**No DELETE policy** — contacts are soft-deleted via `archive_contact`
RPC setting `is_active = false`.

### 2.2 `ledger_entries` (updated for direction)

```sql
-- v29_ledger_read replaced
DROP POLICY v29_ledger_read ON ledger_entries;

CREATE POLICY v210_ledger_read ON ledger_entries
  FOR SELECT
  USING (
    shop_id = (SELECT current_active_shop_id())
    AND (
      (direction = 'receivable'
       AND (SELECT user_has_permission(shop_id, 'view_contact_customer_data')))
      OR
      (direction = 'payable'
       AND (SELECT user_has_permission(shop_id, 'view_contact_supplier_data')))
    )
  );
```

**Asymmetry intended:** a manager with `view_contact_customer_data` but
not `view_contact_supplier_data` sees receivable rows only — payable
rows on the same contact are invisible at the RLS level. This is the
per-side permission split that L7 calls out.

### 2.3 `purchases`, `invoices`, `inventory_batches`

Minor edits for column rename only; permission gates unchanged
(`view_purchases`, `view_all_sales` + `view_sale_cost`, `view_batch_cost`).

### 2.4 `customer_tiers` (rename pending — see §1.2)

Per audit §3.1: `v29_tiers_members_read` policy stays; `customer_tiers`
table keeps its name (v2.10 doesn't rename it because tier is
customer-side semantic and the schema cost of renaming exceeds the
benefit). The new `manage_contact_tiers` permission name is the only
catalog-level change; the table name stays.

---

## 3. Column-grant pattern (v2.9.2 carryover)

### 3.1 `contacts` table

The cost-bearing columns are `customer_outstanding_balance` and
`supplier_outstanding_balance`. Per v2.9.2 lesson, both must be
**excluded from authenticated SELECT** at the table-level grant and
exposed only via `contacts_view`.

```sql
-- step 1: revoke table-level SELECT from authenticated
REVOKE SELECT ON TABLE contacts FROM authenticated;

-- step 2: re-grant SELECT on safe columns only (NOT outstanding columns)
GRANT SELECT (
  id, shop_id, name, phone, address, notes, contact_type,
  customer_tier_id,
  -- NOT customer_outstanding_balance, NOT supplier_outstanding_balance
  is_active, created_at, updated_at, created_by_user_id, updated_by_user_id,
  promoted_to_both_at, promoted_to_both_by_user_id
) ON contacts TO authenticated;
```

**v2.9.2 rule applies:** any future column added to `contacts` MUST be
explicitly added to the `GRANT SELECT` list, or it's invisible to the
application. This is the same trap v2.9.2 hit and documented.

### 3.2 `ledger_entries` table

Audit confirms `ledger_entries` does not currently have column-level
grants. After v2.10, `ledger_entries` itself is not cost-bearing (the
amount is the payable/receivable amount, not a unit cost), but the new
`direction` column gates per-side visibility via RLS. No column-grant
change needed here.

### 3.3 `purchases` table

`purchases.total_cost` and `purchases.items_subtotal` already exist and
are cost-bearing. v2.9 / v2.9.2 did not column-grant them — Phase C
should evaluate. Adding `purchases.amount_paid` and `purchases.outstanding`
brings two more cost-bearing columns. Recommend Phase C migration 0103
column-grant `purchases` consistent with the v2.9.2 pattern.

**This is a v2.9.3 follow-up surface** noted in the v2.9.2 ADR;
v2.10 inherits the same gap unless explicitly closed.

---

## 4. DEFINER vs INVOKER for new RPCs and views

All new RPCs are **DEFINER** (matches v2.9.x convention).
All new views are **`security_invoker = false`** (DEFINER) so that
conditional projection can apply uniformly regardless of caller's
table-level grants.

### 4.1 RPC permission gates (new functions)

| RPC | Gates |
|---|---|
| `create_contact_basic` | `create_contact_basic` |
| `create_contact_full` | `create_contact_full` |
| `update_contact` | `edit_contact`, plus `assign_contact_tier` if `customer_tier_id` changes |
| `archive_contact` | `edit_contact` |
| `promote_contact` | `promote_contact` |
| `pay_supplier` | `pay_supplier` + non-owner cap check (`shops.salesperson_supplier_payment_cap_pkr`) |
| `get_contact_unified_history` | `view_contacts`; receivable rows filtered out without `view_contact_customer_data`; payable rows filtered out without `view_contact_supplier_data` |

### 4.2 Modified RPC permission gates

| RPC | Changed gates |
|---|---|
| `record_sale` | Same as v2.9.x (`record_sale` permission). Inner contact lookup adds CHECK that contact's `contact_type IN ('customer','both')`. |
| `record_purchase` | Same as v2.9.x. Inner contact lookup adds CHECK that contact's `contact_type IN ('supplier','both')`. |
| `receive_payment` | Same as v2.9.x. Inner contact lookup adds CHECK that contact's `contact_type IN ('customer','both')`. |
| `reverse_ledger_entry` | Permission gate splits by `direction` of reversed entry: `receive_payment` for receivable, `pay_supplier` for payable. |

---

## 5. Audit fields

### 5.1 `contacts` table

| Field | Written by |
|---|---|
| `created_by_user_id` | `create_contact_basic` / `create_contact_full` (set to `auth.uid()`) |
| `updated_by_user_id` | `update_contact`, `archive_contact`, `promote_contact` |
| `promoted_to_both_by_user_id` | **Only** `promote_contact` (NOT direct-creation paths per B.1.2) |
| `promoted_to_both_at` | Same as above |

### 5.2 `ledger_entries` table

Existing v2.9 audit pattern carries through. `ledger_audit_at_insert`
trigger writes `_by_user_id` from `auth.uid()` at INSERT. No change.

### 5.3 `pay_supplier` RPC audit trail

Same shape as `receive_payment`. The ledger entry created carries
`_by_user_id` of the caller. The cap check happens before the entry is
written; if it fails, no entry is created. No partial state.

---

## 6. New AQ suite (queries verifying v2.10 invariants)

Run via `mcp__supabase__execute_sql` against the staging project. All
must return zero rows.

### AQ-25 — contact-type invariant

```sql
SELECT id, contact_type FROM contacts
WHERE contact_type NOT IN ('customer','supplier','both');
-- Expected: 0 rows (CHECK constraint also enforces)
```

### AQ-26 — phone uniqueness within shop

```sql
SELECT shop_id, phone, COUNT(*) AS dups
FROM contacts
GROUP BY shop_id, phone
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

### AQ-27 — FK integrity

```sql
SELECT 'invoice' AS source, i.id AS row_id, i.contact_id
FROM invoices i
WHERE i.contact_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = i.contact_id)
UNION ALL
SELECT 'ledger', le.id, le.contact_id
FROM ledger_entries le
WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = le.contact_id)
UNION ALL
SELECT 'purchase', p.id, p.contact_id
FROM purchases p
WHERE p.contact_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = p.contact_id)
UNION ALL
SELECT 'batch', b.id, b.contact_id
FROM inventory_batches b
WHERE b.contact_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = b.contact_id);
-- Expected: 0 rows
```

### AQ-28 — promotion audit fields populated when promoted

```sql
-- Per B.1.2: direct creation with 'both' leaves audit fields NULL;
-- only promote_contact RPC writes them. So a 'both' contact may have
-- NULL audit fields IF it was created directly. This AQ catches the
-- opposite: audit fields populated without contact_type being 'both'.
SELECT id, contact_type, promoted_to_both_at, promoted_to_both_by_user_id
FROM contacts
WHERE (promoted_to_both_at IS NOT NULL OR promoted_to_both_by_user_id IS NOT NULL)
  AND contact_type <> 'both';
-- Expected: 0 rows
```

### AQ-29 — tier only on customer-touching contacts

```sql
SELECT id, contact_type, customer_tier_id
FROM contacts
WHERE customer_tier_id IS NOT NULL
  AND contact_type NOT IN ('customer','both');
-- Expected: 0 rows (CHECK constraint also enforces)
```

### AQ-30 — ledger direction matches contact_type

```sql
-- Receivable rows reference customer-touching contacts only
SELECT le.id, le.direction, c.contact_type
FROM ledger_entries le
JOIN contacts c ON c.id = le.contact_id
WHERE (le.direction = 'receivable' AND c.contact_type NOT IN ('customer','both'))
   OR (le.direction = 'payable'    AND c.contact_type NOT IN ('supplier','both'));
-- Expected: 0 rows (trigger should also enforce on INSERT)
```

### AQ-31 — cached balance matches ledger sum (per direction)

```sql
-- Corrected 2026-05-14: the original SELECT list referenced non-existent
-- columns (side/stored/computed/drift); contact_balance_reconciliation
-- exposes customer_drift / supplier_drift.
SELECT contact_id, customer_drift, supplier_drift
FROM contact_balance_reconciliation
WHERE ABS(customer_drift) > 0.01 OR ABS(supplier_drift) > 0.01;
-- Expected: 0 rows
```

### AQ-32 — no NEW table/view leaks an anon/public SELECT grant

Added 2026-05-14 after the 0102 anon-grant gap (`contacts_view` +
`contact_balance_reconciliation` carried the Supabase auto-`anon` SELECT
grant; it slipped past all 24 AQs **and** 0102's own verification block —
the signal that a new bug class needs a *permanent* guard).

**Rewritten 2026-05-14 (0103 review).** The first cut hardcoded a 4-name
`table_name IN (...)` scan set — which re-created the exact blind spot
AQ-32 was created to eliminate: a hand-maintained scan list only guards
what was known when it was written, and every future migration has to
remember to extend it. This version uses the AQ-23 / AQ-24 shape — a
**blanket dynamic scan** of every `public` table and view, minus a
**frozen baseline allowlist** — so it needs *zero* per-migration edits: a
new object that leaks the anon grant is caught automatically; a legacy
object the v2.10 chain DROPs simply falls out of the scan (a stale
allowlist entry is a harmless no-op).

The allowlist is the **v2.10 anon-grant baseline frozen 2026-05-14**: the
43 pre-v2.10 objects (26 tables + 17 views) that already carried the
Supabase-default `anon` SELECT grant before the v2.10 chain. They are
RLS-gated, so functionally safe; the v1.8 ADR-0015 sweep did not
retro-revoke `anon` from them — eventual cleanup is the v2.9.x backlog
item in `docs/todos.md` ("audit v2.9 conditional-projection views for
stray anon SELECT grants"). AQ-32 is deliberately **SELECT-only**: SELECT
is the read-leak vector for DEFINER views; `anon` INSERT/UPDATE/DELETE
auto-grants are either RLS-gated (tables) or inert (complex views) and
are a separate, lower-priority surface.

```sql
SELECT c.relkind, g.table_name, lower(g.grantee) AS grantee
FROM information_schema.role_table_grants g
JOIN pg_class c ON c.relname = g.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = g.table_schema
WHERE g.table_schema = 'public'
  AND g.privilege_type = 'SELECT'
  AND lower(g.grantee) IN ('anon', 'public')
  AND c.relkind IN ('r','v','m','p')   -- tables, views, matviews, partitioned tables
  AND g.table_name NOT IN (
    -- ===== v2.10 anon-grant baseline (frozen 2026-05-14) =====
    -- pre-v2.10 objects carrying the Supabase-default anon SELECT grant.
    -- RLS-gated; v1.8 ADR-0015 did not retro-revoke. As the v2.10 chain
    -- drops some of these (suppliers @ 0106, customer_balance_reconciliation
    -- @ 0104, ...) their entries go stale-but-harmless — no edit needed.
    -- tables (26):
    'customer_tiers','expenses','invoices','ledger_entries','monthly_targets',
    'pending_invitations','permissions_catalog','product_categories','product_packs',
    'product_variant_attribute_values','product_variants','products','profiles',
    'purchase_items','purchase_overhead_items','purchases','shop_owner_details',
    'shops','subscriptions','suppliers','units_of_measure','user_shop_access',
    'user_shop_permission_audit','user_shop_permissions','variant_attribute_values',
    'variant_attributes',
    -- views (17):
    'batches_already_expired','batches_expiring_soon','batches_warranty_expiring_soon',
    'customer_balance_reconciliation','daily_sales_7','daily_sales_today',
    'expenses_by_category_mtd','invoice_financials','invoice_with_discount_detail',
    'ledger_entries_view','monthly_summary','product_stock_display',
    'product_variant_full','product_with_default_variant','purchase_item_financials',
    'sale_item_financials','subscription_effective'
  );
-- Expected: 0 rows. A non-zero row is a NEW object that leaked the anon
-- SELECT grant — REVOKE per ADR-0015 (revoke from public, anon).
```

### Existing AQ suite

AQ-01 through AQ-24 (the v2.9 + v2.9.1 baseline) must remain zero.
AQ-23 (DEFINER-wrapper shape-drift) and AQ-24 (legacy
`current_shop_id()` allowlist) extend to cover the new RPCs.

### AQ-23 / AQ-24 — no allowlist edits needed (flag F2)

AQ-23 and AQ-24 are written as **blanket `name NOT LIKE '%_v28'`
patterns**, not enumerated allowlists — so the v2.10 chain needs **zero**
per-migration allowlist edits:

- **AQ-23** (DEFINER-wrapper shape-drift): scans wrappers via the LIKE
  pattern. The new contact RPCs (0102's 7 + 0103's rewrites and fresh
  functions) all carry the P1/P2/P3 substrings AQ-23 checks for — order
  is irrelevant to a LIKE check, so `reverse_ledger_entry`'s
  fetch-then-gate ordering and `search_khata_contacts`' direction-split
  gate both pass. No exempt-list additions.
- **AQ-24** (legacy `current_shop_id()` callers): the blanket pattern
  means dropping a `_v28` shim automatically removes it from AQ-24's
  scope — no allowlist edit. Every new v2.10 function uses
  `current_active_shop_id()`. The only standing AQ-24 baseline entries
  are the 2 pre-v2.9 views (`daily_sales_7`, `expenses_by_category_mtd`),
  tracked for cleanup in `docs/todos.md` (v2.9.3).

---

## 7. Test plan summary (Phase E preview)

Three test surfaces:

1. **Owner smoke test** (per PRD E.1): every workflow exercised once
   with an owner account. Cash sale, credit sale, purchase, supplier
   payment, promotion flow, net position display.
2. **Synthetic non-owner tests** (per PRD E.2 + the [[feedback-synthetic-tests-real-role]] rule):
   `SET ROLE authenticated` against a real session JWT for manager and
   salesperson personas. NO `set_config('request.jwt.claims', ...)`
   shortcuts.
3. **Permission asymmetry test:** a manager with
   `view_contact_customer_data` but explicitly NOT
   `view_contact_supplier_data` sees only the customer-side projections
   on a `'both'` contact. Net position column is NULL.

Coverage matrix file: `audit/2026-05-XX-v210-phase-e-coverage-matrix.md`
(created in Phase E, modeled on v2.9.1's matrix).

---

## 8. Halt criteria during Phase E

Per PRD G.3, ANY of the following blocks v2.10 ship:

- Any AQ-25 through AQ-32 returning non-zero rows.
- Any AQ-01 through AQ-24 returning non-zero rows (regression).
- Owner smoke test failure on any locked use case from §A.5 of audit.
- Synthetic non-owner test failure: permission gate not enforced, OR
  permission gate too restrictive (legitimate path blocked).
- Production migration accidentally applied (should be impossible per
  branch discipline; flag immediately if observed).

---

**End of attack surface. See implementation-plan doc for migration
sequence and ADR cadence.**
