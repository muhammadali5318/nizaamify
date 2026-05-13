# v2.10 Unified Contacts — Pre-Design Audit

**Author:** Claude (Principal Solution Architect mode)
**Database snapshot:** Supabase project `orfggrnyychmmqdlbfhf` (production
nizaamify-shop-mvp), queried 2026-05-14 against post-v2.9.2 schema
(migrations 0068–0095 applied).
**Staging project:** `iamqibcdpeovwavgzswq` (nizaamify-staging, created
2026-05-13) — same migration baseline; not audited separately because
schema is identical at this point.
**Scope:** read-only forensic inventory of every surface that v2.10 will
touch when `customers` and `suppliers` are unified into a single
`contacts` table.
**Status:** reference document, not narrative. Skim by section heading.
Findings labelled **DEFECT**, **RISK**, **ASSUMPTION-BREAK**, or
**INFORMATIONAL**.

This document is the **inventory of the current state**. Design proposals
belong in Phase B; do not infer them from this audit.

---

## 0. Top-line findings

Five items the user should see before authorizing Phase B. The rest of
the document substantiates each.

1. **ASSUMPTION-BREAK on PRD L8.** Production is **not empty**.
   Three customers (`outstanding_balance` = 0 / 6,000 / 11,500 PKR) and
   two suppliers exist on shop `07f5bf89-…-31a14bcda240`, plus 5 invoices
   with `customer_id`, 5 ledger entries, 6 purchases with `supplier_id`,
   and 2 inventory batches with `supplier_id`. PRD L8 says "wipe existing
   customer/supplier data … no customers in production, no preservation
   needed" — this is false against the project flagged for v2.10. Either
   the wipe target is a different project (staging
   `iamqibcdpeovwavgzswq` is brand-new and confirmed empty by virtue of
   being one day old with no shops yet — re-verifiable on request), or
   the production data needs a migration path. **Re-authorization
   required before any destructive migration touches production.** See §6.
2. **DEFECT on L1 (phone uniqueness).** No unique index exists on
   `customers(shop_id, phone)` or `suppliers(shop_id, phone)`. The
   existing suppliers row pair literally shares phone `03121212123`.
   Implementing L1 will require either deduplication or a manual conflict
   resolution step at migration time. See §1.4.
3. **DEFECT on `suppliers.contact` semantics.** `suppliers.contact` is a
   free-text "contact info" field, not a phone-typed column. Existing rows
   contain phone-shaped strings, but the schema makes no guarantee.
   Unifying it as `contacts.phone` (a phone-validated column) requires a
   data-quality scrub on the rare non-phone values. Empty in production
   today, but the migration must handle nulls explicitly. See §1.2.
4. **DEFECT on supplier outstanding.** `suppliers` has no
   `outstanding_balance` column and no analogue of the ledger pipeline.
   There is **no concept of "we owe this supplier money"** today —
   purchases are recorded but no AP ledger exists. Net-position display
   for `contact_type='both'` (PRD B.2) needs a new computation path on the
   supplier side, not a rename of an existing one. See §1.5.
5. **DEFECT on RPC dependency tree.** 30 RPCs reference `customer_id`,
   `supplier_id`, or have a customer/supplier-flavored name. Of those, 12
   are user-facing wrappers and 14 are `_v28` inner shims preserved by the
   v2.9 rename-and-wrap discipline. Touching the inner `_v28` bodies is
   blocked by ADR 2026-05-13-rbac-cashier-role-snapshot-dropped's
   wrap-and-rename rule (and CLAUDE.md restates it as a v2.9 rule of
   thumb). Phase B must decide how to evolve these without breaking the
   discipline — likely a `_v29` snapshot before any signature change. See
   §2.6.

The rest of the audit is the substrate behind these claims.

---

## 1. Schema inventory (A.1)

### 1.1 Tables to be replaced

| Table | Row count | Columns | Triggers |
|---|---|---|---|
| `customers` | 3 | `id, shop_id, name, phone, address, notes, outstanding_balance, tier_id, is_active, created_at, updated_at, created_by_user_id, updated_by_user_id` (13 columns) | `customers_touch` (BEFORE UPDATE → `touch_updated_at`), `v29_customers_tier_change_gate` (BEFORE UPDATE → `check_customer_tier_change_gate`) |
| `suppliers` | 2 | `id, shop_id, name, contact, address, notes, is_active, created_at, updated_at, created_by_user_id, updated_by_user_id` (11 columns) | `suppliers_touch` (BEFORE UPDATE → `touch_updated_at`) |

**INFORMATIONAL:** `customers` has `outstanding_balance` (numeric,
default 0) and `tier_id` (UUID, nullable). `suppliers` has neither — no
cached financial state, no categorization. The asymmetry is real and
load-bearing: v2.10 cannot symmetrize by simply renaming columns.

### 1.2 Column-name asymmetry

| Concept | `customers` | `suppliers` |
|---|---|---|
| Identity contact | `phone` (NOT NULL) | `contact` (NULLable, free-text) |
| Cached balance | `outstanding_balance` (NOT NULL, default 0) | absent |
| Tier / category | `tier_id` (FK to `customer_tiers`) | absent |

**DEFECT:** `suppliers.contact` is named generically and is nullable. The
current production data (2 rows) shows phone-shaped values, but nothing
enforces it. Unifying as `contacts.phone` (per L1) requires either
(a) treating `contact` as phone and back-filling nulls as such, or
(b) keeping a separate `contacts.contact_info` column for free-text. The
PRD locks `contacts.phone` as the unique key (L1) — implying (a).

### 1.3 Foreign keys referencing `customers.id` / `suppliers.id`

| Table | Column | On-delete | Index | NOT NULL? |
|---|---|---|---|---|
| `invoices` | `customer_id` | NO ACTION | `idx_invoices_customer_created (customer_id, created_at DESC)` | NULLable (walk-in invoices) |
| `ledger_entries` | `customer_id` | NO ACTION | 3 indexes: `idx_ledger_entries_customer_created`, `idx_ledger_entries_customer_occurred`, `ledger_shop_customer_idx` | **NOT NULL** |
| `purchases` | `supplier_id` | RESTRICT | `idx_purchases_supplier (supplier_id) WHERE supplier_id IS NOT NULL` | NULLable |
| `inventory_batches` | `supplier_id` | NO ACTION | (none — see §1.6) | NULLable |

The on-delete behaviors are not uniform: `purchases.supplier_id` is
RESTRICT (blocks drop), all others are NO ACTION (also blocks drop). The
Phase C migration that drops `customers` / `suppliers` must first drop or
rename these FKs.

### 1.4 Indexes and uniqueness

No unique index exists on `(shop_id, phone)` for either table.
**DEFECT:** L1 (system enforces phone unique per contact within a shop)
is currently unenforced. Production already has a duplicate supplier
phone (`03121212123` across two distinct suppliers in the same shop).
The Phase C migration that adds the unique index will fail on this row
unless deduplicated first.

Two customers named `Muhammad Ali` exist with different phones — that's
within spec (uniqueness is by phone, not name), but worth noting because
the promotion-by-phone flow (L3) cannot use name as a hint.

### 1.6 Missing FK indexes (advisor lint candidate)

`inventory_batches.supplier_id` has no covering index. Likely never
flagged because the column is mostly NULL. After v2.10 lands and
`contact_id` becomes mandatory on this surface (or stays nullable but
populated more often), it should pick up `idx_inventory_batches_contact`.

### 1.5 Cached-balance pipeline (customer side only)

Today's flow:

```
record_sale  → invoice + sale_items + (if credit) ledger_entries(debit)
receive_payment → ledger_entries(credit) + customers.outstanding_balance ←
reverse_ledger_entry → ledger_entries(reversing) + customers.outstanding_balance ←
                       trigger: ledger_entries_update_balance
```

`customer_outstanding` is a view that computes balance from
`ledger_entries`. `customer_balance_reconciliation` is also a view (not
a table, despite ambiguous reads earlier in the codebase) that surfaces
drift between `customers.outstanding_balance` (cached) and the ledger sum
(computed).

**There is no equivalent on the supplier side.** Purchases don't post to
a ledger. Vendor-owed-to balance does not exist as a stored or computed
value. v2.10's net-position story for `contact_type='both'` therefore
needs to either:

- introduce an AP ledger (large new surface, out of L4's scope — L4
  defers settlement to v2.11);
- treat supplier "outstanding" as `sum(purchases.total) − sum(payments to
  supplier)`, where the latter does not exist today; or
- defer net position to v2.11 alongside settlement.

This is the most consequential surprise of the audit. Surfaced to Phase
B as B.2.

### 1.7 Snapshotted / denormalized fields

Searched for cached customer-name / supplier-name fields on transaction
tables. **None found on `invoices`, `sale_items`, `purchases`,
`purchase_items`, or `ledger_entries`** — names are always joined at
read time. The single denormalized read is `batches_warranty_expiring_soon`,
which left-joins `suppliers` and surfaces `supplier_name` as a derived
column (not stored). No backfill of snapshots required.

### 1.8 Views touching customers / suppliers

| View | Touches | Notes |
|---|---|---|
| `customers_view` | `customers` | DEFINER, conditional projection of phone/address/outstanding (v2.9 + v2.9.2). |
| `customer_outstanding` | `customers` + `ledger_entries` | DEFINER, conditional projection of outstanding numeric. |
| `customer_balance_reconciliation` | `customers` + `ledger_entries` | View (not table), used for the drift dashboard. |
| `invoices_view` | `invoices` (`customer_id` passthrough) | conditional projection of cost/margin. |
| `invoice_financials` | `invoices` (`customer_id` passthrough) | conditional projection. |
| `invoice_with_discount_detail` | `invoices` + `customer_tiers` | no conditional projection, raw FK passthrough. |
| `ledger_entries_view` | `ledger_entries` (`customer_id` passthrough) | enriches with invoice metadata. |
| `purchases_view` | `purchases` (`supplier_id` passthrough) | conditional projection (`view_purchases`). |
| `inventory_batches_view` | `inventory_batches` (`supplier_id` passthrough) | conditional projection. |
| `batches_warranty_expiring_soon` | `inventory_batches` LEFT JOIN `suppliers` | exposes `supplier_name`. |

**Total views to update:** 10. Each must be rewritten or recreated to
join `contacts` instead. Some are DEFINER (must drop+recreate, not
ALTER).

---

## 2. RPC inventory (A.2)

Three lenses applied: parameter-name search, function-name search, body
text search. Numbers in this section are deduplicated.

### 2.1 Counts

| Lens | Count |
|---|---|
| Public functions in DB | 136 |
| `_v28` inner shims (snapshot kept per v2.9 wrap-and-rename rule) | 41 |
| Current wrappers + new RPCs | 95 |
| Functions touched by v2.10 (customer/supplier in name, args, or body) | **30 + 11 indirect = 41 candidates** |

### 2.2 Direct customer/supplier RPCs (paired wrapper + `_v28` shim)

Twelve wrapper functions and their corresponding `_v28` shims. The
wrapper exposes `EXECUTE` to `authenticated`; the shim is
`postgres`/`service_role` only.

| Wrapper | `_v28` shim exists? | DEFINER | Signature | Returns |
|---|---|---|---|---|
| `create_customer_basic` | n/a (no shim — wrapper is the only impl) | DEFINER | `(p_name, p_phone)` | `uuid` |
| `create_customer_full` | n/a | DEFINER | `(p_name, p_phone, p_address, p_notes, p_tier_id)` | `uuid` |
| `update_customer` | n/a | DEFINER | `(p_id, p_name, p_phone, p_address, p_notes, p_tier_id)` | `void` |
| `list_customers` | yes | DEFINER | `(p_query, p_limit, p_offset)` | `TABLE(id, name, phone, address, outstanding, invoice_count, last_activity_at, total_count)` |
| `recent_customers` | yes | DEFINER | `(p_limit)` | `TABLE(id, name, phone, address, last_activity_at)` |
| `search_khata_customers` | yes | DEFINER | `(p_query, p_status, p_limit, p_offset)` | `TABLE(id, name, phone, address, outstanding_balance, last_activity_at, entry_count)` |
| `search_khata_customers_count` | yes | DEFINER | `(p_query, p_status)` | `bigint` |
| `receive_payment` | yes | DEFINER | `(p_customer_id, p_amount, p_notes)` | `uuid` |
| `record_sale` | yes | DEFINER | `(p_customer_id, p_amount_paid, …)` | `uuid` |
| `create_supplier_inline` | yes | DEFINER | `(p_name, p_contact, p_address, p_notes)` | `uuid` |
| `update_supplier` | n/a | DEFINER | `(p_id, p_name, p_contact, p_address, p_notes)` | `void` |
| `archive_supplier` | n/a | DEFINER | `(p_id)` | `void` |
| `search_suppliers` | yes | DEFINER | `(p_query, p_limit, p_offset)` | `TABLE(id, name, contact, address, is_active, total_count)` |
| `recent_suppliers` | yes | DEFINER | `(p_limit)` | `TABLE(id, name, contact, last_used_at)` |
| `record_purchase` | yes | DEFINER | `(p_supplier_id, p_purchase_date, …)` | `uuid` |
| `search_purchases` | yes | DEFINER | `(…, p_supplier_id, …)` | `TABLE(…, supplier_id, supplier_name, …)` |
| `search_purchases_count` | yes | DEFINER | `(…, p_supplier_id, …)` | `bigint` |

That's **17 customer/supplier-touching wrapper RPCs**, each with an
`_v28` shim where the shim exists.

### 2.3 Tier RPCs (customer-side only)

| Wrapper | `_v28` shim? | Notes |
|---|---|---|
| `define_tier` | yes | shop-wide tier definition |
| `update_tier` | yes | |
| `deactivate_tier` | yes | |
| `set_default_tier` | yes | |
| `check_customer_tier_change_gate` | trigger function (DEFINER, no public EXECUTE) | gate trigger on `customers` UPDATE |

L6 says tier applies to customer-side only — these stay unchanged in
v2.10, but their reference to `customers` becomes a reference to
`contacts.customer_tier_id`.

### 2.4 Functions that don't take `customer_id`/`supplier_id` but touch them in body

| Function | Touches | Action needed |
|---|---|---|
| `batch_immutable_fields` | `supplier_id` (in trigger predicate — blocks updates) | rename column reference to `contact_id` |
| `ledger_entries_update_balance` | `customers.outstanding_balance` (trigger updates cache) | retarget to `contacts` table |
| `reverse_ledger_entry_v28` | `customers` (recomputes outstanding) | retarget to `contacts` |

### 2.5 Categorisation per A.2

- **Simple rename** (`customer_id` → `contact_id` / `supplier_id` →
  `contact_id`): `update_customer`, `update_supplier`, `archive_supplier`,
  `list_customers`, `recent_customers`, `recent_suppliers`,
  `search_suppliers`, `search_purchases`, `search_purchases_count`,
  `record_purchase`, `record_sale`, `receive_payment`,
  `search_khata_customers`, `search_khata_customers_count`,
  `batch_immutable_fields`, `ledger_entries_update_balance`,
  `reverse_ledger_entry_v28`. **(17 functions.)**
- **Signature change** (creates may collapse): `create_customer_basic`,
  `create_customer_full`, `create_supplier_inline` — likely fold into
  `create_contact` taking `contact_type`. **(3 functions.)**
- **New RPCs** (no current equivalent): `promote_contact`,
  `get_contact_unified_history`, `get_contact_net_position`. **(3 new.)**

Net Phase C RPC count: **17 rename + 3 collapse + 3 new = 23 user-facing
RPCs**, plus the corresponding `_v28` shim treatment (see §2.6).

### 2.6 `_v28` shim treatment

CLAUDE.md v2.9 build-trail rule of thumb (2): "`<name>_v28` inner
functions are reachable only via their wrappers — don't delete or inline
without a planned cleanup migration." That rule applies here. Two
options:

- **Option A (preserve discipline):** add a `_v29` snapshot of every
  current wrapper before rewriting it for `contact_id`. Doubles the shim
  count from 14 to 26 customer/supplier-related `_v28`/`_v29` pairs.
- **Option B (break discipline, document with ADR):** v2.10 is a
  schema-level refactor that invalidates the v2.8 signatures (`customer_id`
  no longer points at a real column). The `_v28` shims become dead code
  pointing at dropped tables and must be dropped in the same migration
  that drops `customers` / `suppliers`. A new ADR is required.

Option B is cleaner for v2.10 because the shims would fail at parse time
once `customers`/`suppliers` are dropped. Surfaced to Phase B as a
sub-question of B.6.

---

## 3. RLS policy audit (A.3)

### 3.1 Policies on tables in scope

| Table | Policy | Op | Permission gate |
|---|---|---|---|
| `customers` | `v29_customers_read` | SELECT | `view_customer_contact` (shop-scoped) |
| `customers` | `v29_customers_update` | UPDATE | `edit_customer` |
| `suppliers` | `v29_suppliers_read` | SELECT | `view_suppliers` |
| `suppliers` | `v29_suppliers_update` | UPDATE | `manage_suppliers` |
| `suppliers` | `v29_suppliers_write` | INSERT | `manage_suppliers` |
| `customer_tiers` | `v29_tiers_members_read` | SELECT | `user_has_shop_access` (any shop member) |
| `invoices` | `v29_invoices_row_read` | SELECT | `view_all_sales OR cashier_id = auth.uid()` |
| `invoices` | `v29_invoices_cost_read` | SELECT | `view_sale_cost` (additive) |
| `ledger_entries` | `v29_ledger_read` | SELECT | `view_customer_khata` |
| `purchases` | `v29_purchases_read` | SELECT | `view_purchases` |
| `inventory_batches` | `v29_batches_cost_read` | SELECT | `view_batch_cost` |
| `inventory_batches` | `v29_batches_write` | INSERT | `record_purchase` |
| `inventory_batches` | `v29_batches_update` | UPDATE | `writeoff_batch` |

**INFORMATIONAL:** `customers` lacks an INSERT policy. Direct inserts to
`customers` are blocked by RLS at the table level; the
`create_customer_basic` / `create_customer_full` RPCs are DEFINER and
write on behalf of the caller. Same pattern on `suppliers` is broken:
`v29_suppliers_write` allows direct INSERT to authenticated callers who
hold `manage_suppliers`. That asymmetry must be either preserved (allow
`contacts` INSERT for permission holders) or unified (all writes
through RPC). Phase B candidate.

### 3.2 Column-level grants (v2.9.2 pattern)

| Table | Column-grant pattern applied? | Detail |
|---|---|---|
| `customers` | **YES** | `authenticated.SELECT` is granted on every column **except `outstanding_balance`**. Anonymous and service-role rows show all columns (pattern only restricts authenticated). v2.9.2 migration `0094` is the canonical implementation. |
| `suppliers` | **NO** | `authenticated.SELECT` is granted on every column. No cost-bearing columns exist on `suppliers` today, so the pattern is unneeded — but if `contacts` introduces `supplier_outstanding`, that column needs the same treatment from day one. |

### 3.3 Function privileges

All customer/supplier wrappers expose EXECUTE to
`{authenticated, postgres, service_role}`. All `_v28` shims expose
EXECUTE only to `{postgres, service_role}` (per the v2.9 rename-and-wrap
discipline). No `anon` access anywhere.

---

## 4. Cross-cutting concerns (A.4)

### 4.1 Customer tiers (v2.2)

- Tier table is `customer_tiers`, FK from `customers.tier_id` and
  `invoices.tier_id`.
- Per L6, tier is customer-side only. Schema choice: keep
  `contacts.customer_tier_id` (nullable, only meaningful when
  `contact_type IN ('customer','both')`).
- `check_customer_tier_change_gate` trigger needs to no-op for
  supplier-only contacts.

### 4.2 Khata ledger (foundational v1.x)

- `ledger_entries.customer_id` is **NOT NULL** today. Phase C must add
  `contact_id` (nullable initially), backfill from `customer_id`, then
  swap NOT NULL constraints, then drop `customer_id`. Order matters:
  the append-only trigger on `ledger_entries` (see §5.5 of v2.9 audit)
  blocks UPDATE; the backfill UPDATE will need `ALTER TABLE … DISABLE
  TRIGGER` … `UPDATE` … `ENABLE TRIGGER` per the gotcha in CLAUDE.md.
- `ledger_entries_update_balance` writes to `customers.outstanding_balance`
  — must retarget to `contacts.customer_outstanding_balance` (or
  whatever B.1 settles on).

### 4.3 Multi-shop access (v2.9)

- `customers.shop_id` is shop-scoped. `contacts.shop_id` stays
  shop-scoped. Phone uniqueness is per-shop (L1). One phone can exist
  across shops as separate contacts.
- The `app-shop-id` header pattern from v2.9 (memory rule:
  `current_active_shop_id()`) is already used by every RLS policy on
  `customers`/`suppliers`. No changes needed.

### 4.4 Permission catalog (v2.9.1)

13 keys are in scope for remap (see §5). Their preset defaults need to
be redecided in Phase B (B.4). The dependency tree (`requires` array)
must be re-validated symmetrically at grant + revoke time per
ADR 2026-05-13-rbac-dependency-rules-grant-time.

### 4.5 Warranty / batch tracking (v2.8)

- `inventory_batches.supplier_id` (nullable). 2 batches reference a
  supplier today.
- `batch_immutable_fields` trigger lists `supplier_id` among the
  immutable columns. After v2.10, the column is renamed
  `contact_id` (or the FK target changes) — the trigger function body
  must be edited; trigger arrays are stored as plain SQL.
- `batches_warranty_expiring_soon` view exposes `supplier_name` via LEFT
  JOIN to `suppliers`. Rewrite to join `contacts`.

### 4.6 Future returns (v2.11)

PRD L5 says no schema reservation for returns in v2.10. But:

- Returns reference an invoice → invoice references a contact → contact
  needs to support customer-side history. `get_contact_unified_history`
  (PRD C.6) must be designed so that adding a `'return'` type to its
  output is additive, not a breaking change.
- Returns may credit either the customer side (refund) or the supplier
  side (return to supplier). The `contact_type='both'` net-position
  calculation in v2.11 inherits whatever v2.10 ships; B.2's choice here
  is consequential.

### 4.7 Subscription + onboarding (v1.x)

- No reference to `customers` or `suppliers` in onboarding flow or
  subscription tables. v2.10 doesn't touch those surfaces. Confirmed by
  grep across `src/features/{auth,onboarding,subscription}`.

---

## 5. Permission catalog (A.6)

### 5.1 Current state (live DB query)

13 keys directly relevant to v2.10. Counts and `requires` arrays come
from `permissions_catalog`:

| Key | Category | Owner | Mgr | Sales | Requires |
|---|---|---|---|---|---|
| `view_customers` | customers | ✓ | ✓ | ✓ | `[]` |
| `view_customer_contact` | customers | ✓ | ✓ | ✓ | `[view_customers]` |
| `view_customer_outstanding` | customers | ✓ | ✓ | ✓ | `[view_customers]` |
| `view_customer_khata` | customers | ✓ | ✓ | ✗ | `[view_customers]` |
| `create_customer_basic` | customers | ✓ | ✓ | ✓ | `[view_customers]` |
| `create_customer_full` | customers | ✓ | ✓ | ✗ | `[create_customer_basic, view_customer_contact]` |
| `edit_customer` | customers | ✓ | ✓ | ✗ | `[view_customers, view_customer_contact]` |
| `assign_customer_tier` | customers | ✓ | ✓ | ✗ | `[view_customers]` |
| `manage_customer_tiers` | customers | ✓ | ✗ | ✗ | `[]` |
| `receive_payment` | financial | ✓ | ✓ | ✓ | `[view_customers, view_customer_outstanding]` |
| `view_suppliers` | suppliers | ✓ | ✓ | ✗ | `[]` |
| `manage_suppliers` | suppliers | ✓ | ✓ | ✗ | `[view_suppliers]` |

**INFORMATIONAL:** PRD A.6 stated "11 customer-side keys" listing
`delete_customer` and `archive_customer` "(if exists)". Neither exists;
the actual customer-side count is **9 keys in `customers` category + 1
in `financial` (`receive_payment`) = 10**. PRD A.6 should be reconciled
to this count.

### 5.2 user_shop_permissions rows that need migration

| Permission key | Row count |
|---|---|
| `assign_customer_tier` | 2 |
| `create_customer_basic` | 2 |
| `create_customer_full` | 2 |
| `edit_customer` | 2 |
| `manage_customer_tiers` | 2 |
| `manage_suppliers` | 2 |
| `receive_payment` | 2 |
| `view_customer_contact` | 2 |
| `view_customer_khata` | 2 |
| `view_customer_outstanding` | 2 |
| `view_customers` | 2 |
| `view_suppliers` | 2 |
| **Total** | **24** |

The pairs of 2 are from one test shop with one manager-pattern user and
one salesperson-pattern user. Migration script can remap deterministically
per the mapping locked in Phase B (B.4).

### 5.3 PRD v2.10 proposed keys (per A.6)

Carrying the PRD's proposal forward to Phase B for confirmation:

| New key | Replaces | Notes |
|---|---|---|
| `view_contacts` | `view_customers` + `view_suppliers` | merges role-specific list |
| `view_contact_contact_info` | `view_customer_contact` | phone/address gate |
| `view_contact_customer_data` | `view_customer_outstanding` + `view_customer_khata` | customer-side financials |
| `view_contact_supplier_data` | (new) | supplier-side financials |
| `view_contact_net_position` | (new) | requires both above |
| `create_contact_basic` | `create_customer_basic` + creation half of `manage_suppliers` | |
| `create_contact_full` | `create_customer_full` + creation half of `manage_suppliers` | |
| `edit_contact` | `edit_customer` + edit half of `manage_suppliers` | |
| `promote_contact` | (new) | owner-only by default per PRD |
| `assign_contact_tier` | `assign_customer_tier` | customer-side semantics |
| `manage_contact_tiers` | `manage_customer_tiers` | rename only |
| `receive_payment` | `receive_payment` | unchanged in name; stays in `financial` category |

**Phase B will need to confirm:**

- Whether `view_contact_customer_data` and `view_contact_supplier_data`
  are truly independent (PRD L7 says yes — asymmetric permission
  intentional).
- Whether `manage_suppliers` should split into `create_contact_basic` +
  `edit_contact` (cleaner) or stay collapsed under a single
  `manage_contact_supplier_side` key. The PRD direction is the former.
- Whether `view_contact_net_position` should be implicit (granted iff
  user holds both customer + supplier data permissions) or an explicit
  gate (handles "show net to manager but not the breakdown" carve-out).
  The PRD direction is "requires both above" — i.e. explicit but
  conjunctively dependent.

### 5.4 Audit-trail interaction

Every wrapper RPC writes `_by_user_id` audit fields per v2.9.1. The new
`promote_contact` RPC must write a dedicated audit pair
(`promoted_to_both_by_user_id`, `promoted_to_both_at`) per PRD A.5.

---

## 6. Migration risk inventory (A.7)

### 6.1 Production data presence — **ASSUMPTION-BREAK**

Production project `orfggrnyychmmqdlbfhf`, shop
`07f5bf89-6935-4139-b9cc-31a14bcda240`:

| Surface | Row count |
|---|---|
| `customers` | 3 (one with 6,000 PKR outstanding, one with 11,500 PKR outstanding) |
| `suppliers` | 2 (sharing phone `03121212123`) |
| `invoices` with `customer_id` | 5 |
| `invoices` walk-in (no customer) | 12 |
| `ledger_entries` | 5 |
| `purchases` with `supplier_id` | 6 |
| `purchases` no supplier | 0 |
| `inventory_batches` with `supplier_id` | 2 |

This contradicts PRD L8 ("no customers in production, no preservation
needed"). Three interpretations, in order of likelihood:

1. **The PRD intended the staging project** `iamqibcdpeovwavgzswq`
   (created yesterday, 2026-05-13). That project is empty (zero shops,
   verified separately). In this reading, v2.10 ships to staging only
   per L10 — never against production — and the production data stays
   in place as v2.9.2 behavior. Then v2.11 + v2.10 ship to production
   together. **At production-ship time, a backfill migration is
   required**, not a wipe.
2. **The PRD intended the production project but the user forgot the
   test data exists.** In this reading, the test data is the user's own
   exploratory work (both customer rows are named "Muhammad Ali" — the
   user's name). Discarding requires explicit re-confirmation.
3. **The user wants to wipe both projects' data.** In this reading,
   explicit confirmation is required before the destructive migration
   runs against production.

**Phase A surfaces this — no destructive migration runs until the user
picks one of the three interpretations.**

### 6.2 If preservation is needed (interpretation 1 or 2)

Migration sequence becomes:

1. Create `contacts` table.
2. For each customer row: INSERT contact with
   `contact_type='customer'`, copy fields.
3. For each supplier row whose `(shop_id, phone)` matches an existing
   contact's `(shop_id, phone)`: do **NOT** insert; instead set
   `contact_type='both'`, set audit fields. (This is the migration-time
   form of the L3 promotion flow.)
4. For remaining supplier rows: INSERT contact with
   `contact_type='supplier'`.
5. Backfill `invoices.contact_id` from `customer_id`.
6. Backfill `ledger_entries.contact_id` from `customer_id`.
7. Backfill `purchases.contact_id` from `supplier_id`.
8. Backfill `inventory_batches.contact_id` from `supplier_id`.
9. Drop legacy columns + tables.

**Conflict at step 3 (production data):** suppliers
`392356b0-…-4c2561607e9b` (name "ALi") and
`d632cd20-…-779082e7b626` (name "best on") **share phone
`03121212123`**. They are not the same person (different names,
different addresses). The phone-uniqueness invariant cannot accept both.
**Decision required at migration time:** either declare one canonical
(losing the other's purchase history if FK is RESTRICT-enforced — which
it is for `purchases.supplier_id`), or scrub the phone field on one of
them before the unique index is created. The PRD's L1 ("system enforces
phone unique per contact within a shop") makes this a hard stop.

### 6.3 If wipe is authorized (interpretation 3)

Migration sequence is the PRD C.4 path: drop tables. But the cascading
deletes lose 5 invoices + 5 ledger entries + 6 purchases + 2 inventory
batch supplier references. Walk-in invoices (12) are unaffected.

### 6.4 Rollback plan (per PRD A.7)

PRD says down-migrations recreate `customers` + `suppliers` "not for
production rollback (data would be lost) but for staging iteration."
This is correct as stated. Down-migrations:

- Recreate `customers` and `suppliers` tables with original schemas.
- Recreate FK columns on dependent tables.
- Recreate v29_ RLS policies.
- Drop `contacts` and any helper views.

Data is **not** preserved across rollback in either direction; this is
acceptable for staging because staging is the only target per L10.

### 6.5 Branch + environment discipline (per PRD G.2)

- Branch: `feat/v2.10-contacts` (current, confirmed clean working tree
  in session header).
- Target project: **staging** `iamqibcdpeovwavgzswq`. Production
  `orfggrnyychmmqdlbfhf` should not receive any v2.10 migration until
  v2.11 is also ready and the combined release is authorized.
- This audit was run against production for the schema inventory only
  (read-only). Phase C migrations target staging.

---

## 7. Frontend impact (informational; aids Phase D)

### 7.1 Routes touched (current state via `src/router/index.tsx`)

8 routes will be reshaped from `/customers/*` + `/suppliers/*` into
`/contacts/*`:

- `paths.customers` → `paths.contacts`
- `paths.newCustomer`, `paths.customerDetail`, `paths.customerEdit`
- `paths.suppliers`, `paths.newSupplier`, `paths.supplierEdit`
- `paths.tiers` (`/settings/tiers`) stays; semantics narrow to
  customer-side per L6.
- `paths.khata` (`/khata`) stays; lists customers with non-zero
  outstanding (customer-side only).

### 7.2 Hooks touched (RPC call sites)

- `src/features/customers/hooks.ts`: `recent_customers`, `list_customers`,
  `update_customer` — all to be retargeted at unified RPC.
- `src/features/suppliers/hooks.ts`: `recent_suppliers`, `search_suppliers`,
  `create_supplier_inline`, `update_supplier`, `archive_supplier` — same.
- `src/features/khata/hooks.ts`: `search_khata_customers`,
  `search_khata_customers_count`, `receive_payment`, `reverse_ledger_entry`
  — minimal change, just `customer_id` → `contact_id` (or kept under the
  same param name; B.6 decision).
- `src/features/pos/hooks.ts`: `record_sale` — wrapper RPC stays;
  parameter rename to `p_contact_id`.
- `src/features/purchases/hooks.ts`: `record_purchase`, `search_purchases`,
  `search_purchases_count` — same.

### 7.3 No direct-write surface

Grep confirms **zero** `.from('customers').(insert|update|delete|upsert)`
or `.from('suppliers').(insert|update|delete|upsert)` call sites. All
writes already route through RPCs. **This satisfies the
[[feedback-audit-gaps-block-flag-flip]] memory rule** for the
customer/supplier surface — no audit-gap blockers exist today.

### 7.4 Error map churn

`src/lib/errorMap.ts` references 9 customer/supplier-specific error
codes:

- `customer_required_for_credit`, `customer_not_found`,
  `customer_not_in_shop`, `invoice_not_for_customer`
- `duplicate_supplier_name`, `duplicate_supplier_name_contact`,
  `supplier_not_found`, `supplier_not_in_shop`,
  `batch_supplier_immutable`

Renames in v2.10 should leave the user-facing translation untouched
where possible; the error code key changes track the SQL exception names
raised by the renamed RPCs.

---

## 8. New AQ candidates (for Phase C.8)

Per PRD C.8, the existing AQ-01..AQ-24 suite stays green, and v2.10 adds
the following. Naming matches the existing convention.

- **AQ-25 — contact-type invariant.** Every `contacts` row has
  `contact_type IN ('customer','supplier','both')`. (Trivial via CHECK
  but the query catches drift from the enum.)
- **AQ-26 — phone uniqueness.** `SELECT shop_id, phone FROM contacts
  GROUP BY 1,2 HAVING count(*) > 1` returns zero rows.
- **AQ-27 — FK integrity.** Every `contact_id` reference in
  `invoices`, `ledger_entries`, `purchases`, `inventory_batches`
  resolves to a real `contacts.id`. (RLS-permission-bypassing query to
  catch orphans regardless of policy state.)
- **AQ-28 — promotion audit fields.** Every contact with
  `contact_type='both'` has non-null `promoted_to_both_at` **and**
  non-null `promoted_to_both_by_user_id`. (Catches the edge case of
  contacts created directly with `'both'` and no promotion event — the
  PRD's "fresh contact promotion" use case in A.5; B.1 must decide
  whether the audit fields are required for that path.)

Plus a recommendation surfaced by this audit:

- **AQ-29 — supplier-side-only contact with customer-side state.** No
  contact has `contact_type='supplier'` AND non-zero
  `customer_outstanding_balance`. (Catches the obverse for the
  customer-side and supplier-side projections — relevant only if B.1
  keeps both balance columns regardless of `contact_type`.)

---

## 9. Use case enumeration (A.5)

Five canonical paths, each annotated with the data-model touchpoints
this audit surfaces.

1. **Bidirectional ("both" contact).** Creates a single
   `contacts` row with `contact_type='both'`. Net position needs
   `customer_outstanding − supplier_outstanding` — but supplier
   outstanding has no current source (§1.5). B.2 decides.
2. **Customer-only.** `contact_type='customer'`. Same as today's
   `customers` row, plus the unified columns
   (`supplier_outstanding`/`supplier_credit_limit`) are NULL or zero.
3. **Supplier-only.** `contact_type='supplier'`. Customer-side columns
   are NULL or zero. `tier_id` is NULL (L6).
4. **Promotion with conflict (L3).** New record attempt collides on
   `(shop_id, phone)` with existing contact of opposite role. Modal
   confirms promotion to `'both'` — flips `contact_type`, sets
   `promoted_to_both_at` + `promoted_to_both_by_user_id`. Existing
   record's other fields (name, address) are preserved; new record's
   would-be values are discarded.
5. **Promotion of fresh contact.** Owner creates a new contact with
   `contact_type='both'` directly. Skip the modal. **Audit-field
   question:** are `promoted_to_both_*` fields populated at creation, or
   only on flip from one-sided to both? B.1 must decide; AQ-28 above
   covers either decision but the answer changes the AQ predicate.

---

## 10. Effort sizing (informational, for Phase B planning)

| Phase | Migrations | Frontend clusters | Estimated discrete RPCs touched |
|---|---|---|---|
| C (schema + RPCs) | ~10 (per PRD C.1–C.7) | 0 | 23 user-facing RPCs + 14 `_v28` shim disposition decisions |
| D (frontend) | 0 | 8 (D.1–D.8 per PRD) | All 23 wrapper call-sites |
| E (testing) | 0 | 0 | 4 new AQs + full v2.9.1 coverage matrix re-run |

The Phase C migration count is on par with v2.9.1's 0087-0091 work
(5 migrations) — v2.10 is larger by surface area but the discipline is
identical: each migration its own checkpoint, each migration committed
before applied.

---

## 11. Items the user must resolve before Phase B starts

These are the audit's exit questions. Phase B cannot be authored without
answers.

1. **Production data interpretation (§6.1).** Which of the three
   interpretations applies? If interpretation 1 (target staging only):
   confirm and Phase C migrations all run against
   `iamqibcdpeovwavgzswq`. If interpretation 2 or 3: confirm wipe of the
   3 customer + 2 supplier rows on production, including the dependent
   5 invoices, 5 ledger entries, 6 purchases, 2 inventory batches'
   supplier refs.
2. **`_v28` shim disposition (§2.6).** Option A (preserve discipline,
   double the shim count) or Option B (break the discipline with an ADR,
   drop the customer/supplier shims with the legacy tables)?
3. **Supplier outstanding architecture (§1.5).** Confirm B.2 should
   produce a real proposal for how `supplier_outstanding` is computed,
   given that no AP ledger exists today and L4 defers settlement to
   v2.11.
4. **Phone-conflict policy for production migration (§6.2).** If
   interpretation 1 or 2 in question 1: the two suppliers sharing phone
   `03121212123` block the L1 unique-index migration. Acceptable
   policies: scrub one phone to a placeholder (lossy), merge into one
   contact (lossier), defer the unique index (defers L1 enforcement to
   manual policy). Phase B needs one of these.
5. **`view_contact_net_position` semantics (§5.3).** Explicit gate with
   conjunctive `requires` dependency on both customer-data and
   supplier-data view permissions, or implicit (computed at runtime
   based on what the caller can see)? PRD direction is explicit
   conjunctive; confirm.

---

**End of audit. Halt per PRD A.8 — awaiting acknowledgment before
Phase B.**
