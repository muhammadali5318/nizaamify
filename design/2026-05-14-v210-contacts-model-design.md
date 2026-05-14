# v2.10 Contacts — Model Design (Locked Schema)

**Status:** Locked at end of Phase B (2026-05-14). Source of truth for
Phase C migrations 0096–0105.
**Companion docs:** `2026-05-14-v210-contacts-attack-surface.md`,
`2026-05-14-v210-contacts-implementation-plan.md`.
**Audit basis:** `audit/2026-05-14-v210-contacts-pre-design-audit.md`.

This document is the locked schema after Phase B. Decisions trace to the
B.0–B.6 sub-decisions listed in §0.

---

## 0. Decisions locked in Phase B

| # | Decision | Locked value |
|---|---|---|
| B.0.1 | Supplier-side ledger structure | Unified `ledger_entries` table with `direction` enum |
| B.0.2 | Payable ledger entries created by | `record_purchase` gaining `p_amount_paid` |
| B.0.3 | Non-owner control for supplier payments | New `pay_supplier` permission + `shops.salesperson_supplier_payment_cap_pkr` (default 0) |
| B.0.4 | Credit limit columns | Skipped in v2.10 (defer to future version) |
| B.1.1 | `contacts` schema | See §1 |
| B.1.2 | Promotion audit on direct creation with `'both'` | Fields stay NULL (only flips populate them) |
| B.1.3 | Collateral schema changes | See §2 |
| B.2 | Net position computation | View-computed from cached sides; no third cached column |
| B.3 | Promotion modal copy | Draft 2 ("more explicit"); en + ur; mirror form for opposite-direction promotion |
| B.4 | Permission preset defaults | "Strict (folded, owner-conservative)"; 12 new keys (see attack-surface doc) |
| B.5 | `/contacts` filters and `/khata` location | Defaults Type=All / Active=Active / Outstanding=All; `/khata` becomes unified with customer/supplier toggle |
| B.6 | `_v28` shim retirement scope | Narrow (14 customer/supplier-touching shims only); broad cleanup queued for v2.11 |

Three rules cover most v2.10 decisions:

1. **Unified ledger, unified contacts, unified history.** One table per
   concept; the `direction`/`contact_type` columns carry the asymmetry.
2. **Cached on the row, computed in the view.** Each side caches its own
   outstanding balance; net position and projections happen at read time.
3. **Owner-conservative defaults.** Supplier-side cost data and
   financial-scope-changing operations default to owner-only;
   admin can opt non-owners in per-shop.

---

## 1. `contacts` table

```sql
CREATE TABLE contacts (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                       uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,

  -- Identity
  name                          text NOT NULL,
  phone                         text NOT NULL,
  address                       text,
  notes                         text,

  -- Type
  contact_type                  text NOT NULL
                                  CHECK (contact_type IN ('customer','supplier','both')),

  -- Customer side
  customer_tier_id              uuid REFERENCES customer_tiers(id),
  customer_outstanding_balance  numeric(12,2) NOT NULL DEFAULT 0,

  -- Supplier side
  supplier_outstanding_balance  numeric(12,2) NOT NULL DEFAULT 0,

  -- Lifecycle
  is_active                     boolean NOT NULL DEFAULT true,

  -- Audit (v2.9.1 _by_user_id pattern)
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  created_by_user_id            uuid,
  updated_by_user_id            uuid,
  promoted_to_both_at           timestamptz,
  promoted_to_both_by_user_id   uuid,

  -- Invariants
  CONSTRAINT contacts_phone_unique_per_shop UNIQUE (shop_id, phone),

  CONSTRAINT customer_tier_only_for_customers CHECK (
    customer_tier_id IS NULL OR contact_type IN ('customer','both')
  ),

  CONSTRAINT promotion_audit_paired CHECK (
    (promoted_to_both_at IS NULL    AND promoted_to_both_by_user_id IS NULL)
    OR
    (promoted_to_both_at IS NOT NULL AND promoted_to_both_by_user_id IS NOT NULL)
  )
);

CREATE INDEX idx_contacts_shop_type
  ON contacts (shop_id, contact_type)
  WHERE is_active;

CREATE INDEX idx_contacts_shop_outstanding_customer
  ON contacts (shop_id)
  WHERE customer_outstanding_balance > 0 AND is_active;

CREATE INDEX idx_contacts_shop_outstanding_supplier
  ON contacts (shop_id)
  WHERE supplier_outstanding_balance > 0 AND is_active;
```

### 1.1 Field rationale (non-obvious)

- `phone` is **NOT NULL** (was nullable on `suppliers.contact`). The L1
  unique key requires presence; in practice every Pakistani SMB contact
  has a phone.
- `customer_outstanding_balance` and `supplier_outstanding_balance` are
  **both NOT NULL DEFAULT 0** regardless of `contact_type`. The unused
  side of a single-role contact carries 0. Simplifies trigger logic
  (always update the row's relevant column without conditional INSERT).
- `customer_tier_id` is NULLable and FK-constrained; the CHECK on
  contact_type prevents supplier-only contacts from holding a tier.
- `promotion_audit_paired` CHECK ensures the two audit fields move
  together — protects against partial updates.
- Three indexes:
  - `idx_contacts_shop_type` — drives the `/contacts` page's type-filter
    chips.
  - `idx_contacts_shop_outstanding_customer` — drives the `/khata`
    customer-side toggle.
  - `idx_contacts_shop_outstanding_supplier` — drives the `/khata`
    supplier-side toggle.

### 1.2 Triggers on `contacts`

```sql
-- touch updated_at
CREATE TRIGGER contacts_touch
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- tier_change_gate: ported from check_customer_tier_change_gate, but
-- applies only when contact_type touches customer
CREATE TRIGGER v210_contacts_tier_change_gate
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  WHEN (OLD.customer_tier_id IS DISTINCT FROM NEW.customer_tier_id)
  EXECUTE FUNCTION check_contact_tier_change_gate();

-- promotion audit guard: when contact_type flips to 'both', ensure
-- audit fields are populated. promote_contact RPC writes them; this
-- trigger blocks bare UPDATEs that flip contact_type without the audit.
CREATE TRIGGER v210_contacts_promotion_audit_required
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  WHEN (OLD.contact_type <> 'both' AND NEW.contact_type = 'both')
  EXECUTE FUNCTION enforce_promotion_audit_populated();
```

---

## 2. Collateral schema changes

**Column lifecycle (corrected 2026-05-14 — ADR
`2026-05-14-v210-contact-id-add-not-rename`).** `contact_id` on the four
dependent tables is a **new column added by migration 0098**, NOT a
rename of `customer_id` / `supplier_id`. The 0099 backfill creates
`contacts` rows with fresh ids and merges a supplier into an existing
customer's contact row on phone collision, so the legacy UUIDs do not
map 1:1 to `contacts.id` — a rename would orphan the column. The legacy
`customer_id` / `supplier_id` columns (with their indexes + FKs) are
dropped in migration 0104, before the legacy tables are dropped in 0106.
The SQL in §2.1–§2.5 below reflects what migration **0100** (collateral
changes) does — it assumes 0098's `contact_id` columns exist and 0099 has
backfilled them.

### 2.1 `ledger_entries` — unified ledger

```sql
-- contact_id already added (nullable, FK -> contacts) by migration 0098;
-- 0099 has backfilled it. 0100 does the rest:

ALTER TABLE ledger_entries ADD COLUMN direction text NOT NULL
  DEFAULT 'receivable'
  CHECK (direction IN ('receivable','payable'));

-- existing 5 ledger rows (all customer-side) backfilled by DEFAULT
ALTER TABLE ledger_entries ALTER COLUMN direction DROP DEFAULT;

-- The NOT NULL constraint SWAP is split across two migrations:
--   0100 adds NOT NULL to contact_id (every row is backfilled by 0099).
--   0101 drops NOT NULL from the legacy customer_id — a 'payable' ledger
--        entry is supplier-side and has no customer, so customer_id must
--        become nullable before payable entries can be created (0102/0103).
ALTER TABLE ledger_entries ALTER COLUMN contact_id SET NOT NULL;        -- 0100
-- ALTER TABLE ledger_entries ALTER COLUMN customer_id DROP NOT NULL;   -- 0101

-- contact_id indexes, parallel to the legacy customer_id indexes
-- (the legacy indexes are dropped with the legacy column in 0104)
CREATE INDEX idx_ledger_entries_contact_created
  ON ledger_entries (contact_id, created_at DESC);
CREATE INDEX idx_ledger_entries_contact_occurred
  ON ledger_entries (contact_id, occurred_at DESC);
CREATE INDEX ledger_shop_contact_idx
  ON ledger_entries (shop_id, contact_id);

-- direction-filtered partial indexes for the two khata toggles
CREATE INDEX idx_ledger_entries_receivable
  ON ledger_entries (contact_id, occurred_at DESC)
  WHERE direction = 'receivable';

CREATE INDEX idx_ledger_entries_payable
  ON ledger_entries (contact_id, occurred_at DESC)
  WHERE direction = 'payable';
```

**Trigger update (migration 0101).** `ledger_entries_update_balance` is
rebuilt to be **direction-aware with a dual-write on the receivable
side**. The `v_delta` arithmetic is unchanged (`debit` raises the owed
amount, `credit` lowers it — same convention both sides); `direction`
selects the target(s):

```
v_delta := CASE WHEN NEW.type = 'debit' THEN NEW.amount ELSE -NEW.amount END;

IF NEW.direction = 'receivable' THEN
  -- new target
  UPDATE contacts  SET customer_outstanding_balance = ... + v_delta WHERE id = NEW.contact_id;
  -- legacy dual-write: keeps customers.outstanding_balance (and therefore
  -- customer_balance_reconciliation / AQ-12) in lockstep through the
  -- 0101->0104 window. Guarded on NEW.customer_id IS NOT NULL.
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers SET outstanding_balance = ... + v_delta WHERE id = NEW.customer_id;
  END IF;
ELSE  -- 'payable'
  -- supplier side only — suppliers never had an outstanding_balance
  -- column, so there is no legacy dual-write target.
  UPDATE contacts SET supplier_outstanding_balance = ... + v_delta WHERE id = NEW.contact_id;
END IF;
```

`ledger_entries_immutable` needs **no change**. It is a blanket
`UPDATE`/`DELETE` block (no column inspection), so the `direction`
column added above is already immutable the moment it exists — unlike
`batch_immutable_fields`, which is column-by-column and did need an
explicit `contact_id` line in 0100.

### 2.2 `purchases` — credit purchases support

```sql
-- contact_id already added (nullable, FK -> contacts, ON DELETE RESTRICT)
-- by migration 0098; 0099 has backfilled it. 0100 does the rest:

ALTER TABLE purchases ADD COLUMN amount_paid numeric(12,2)
  NOT NULL DEFAULT 0;

-- Backfill amount_paid = total_cost for every pre-v2.10 purchase (all
-- v1.x/v2.9 purchases had no amount_paid concept — treated as fully
-- paid). This is the ONLY DML in 0100 and is a real UPDATE, so it runs
-- inside a tight purchases_no_modify DISABLE -> UPDATE -> ENABLE window
-- (the trigger blanket-blocks UPDATE). It must run BEFORE the generated
-- `outstanding` column is added, so `outstanding` is born = 0 for legacy
-- rows. (NOTE: this backfill cannot be in 0099 — the amount_paid column
-- does not exist until this migration creates it.)
ALTER TABLE purchases DISABLE TRIGGER purchases_no_modify;
UPDATE purchases SET amount_paid = total_cost;
ALTER TABLE purchases ENABLE TRIGGER purchases_no_modify;

ALTER TABLE purchases ADD COLUMN outstanding numeric(12,2)
  GENERATED ALWAYS AS (GREATEST(0::numeric, total_cost - amount_paid)) STORED;

-- contact_id index, parallel to the legacy idx_purchases_supplier
-- (the legacy index is dropped with the legacy column in 0104)
CREATE INDEX idx_purchases_contact
  ON purchases (contact_id)
  WHERE contact_id IS NOT NULL;
```

### 2.3 `shops` — non-owner supplier payment cap

```sql
ALTER TABLE shops ADD COLUMN salesperson_supplier_payment_cap_pkr
  numeric(12,2) NOT NULL DEFAULT 0;
```

### 2.4 `invoices` — passthrough column

```sql
-- contact_id already added (nullable, FK -> contacts) by migration 0098;
-- 0099 has backfilled it. 0100 adds the index:

-- contact_id index, parallel to the legacy idx_invoices_customer_created
-- (the legacy index is dropped with the legacy column in 0104)
CREATE INDEX idx_invoices_contact_created
  ON invoices (contact_id, created_at DESC);
```

### 2.5 `inventory_batches` — passthrough column

```sql
-- contact_id already added (nullable, FK -> contacts) by migration 0098;
-- 0099 has backfilled it. 0100 does the rest:

-- batch_immutable_fields trigger body updated: the immutable-field list
-- gains contact_id. Legacy supplier_id stays in the list until it is
-- dropped in 0104.

-- contact_id index. inventory_batches.supplier_id never had a covering
-- index (audit §1.6), so there is no legacy index to parallel here.
CREATE INDEX idx_inventory_batches_contact
  ON inventory_batches (contact_id)
  WHERE contact_id IS NOT NULL;
```

### 2.6 `customer_balance_reconciliation` view → `contact_balance_reconciliation`

**Sequencing (corrected 2026-05-14, 0100 design review).** This view
transition is **NOT** part of migration 0100. Migration 0100 touches no
views at all — it stays purely additive (columns + indexes + one trigger
function body). Reasons:

- `customer_balance_reconciliation` is queried by name by **AQ-12**.
  Dropping it in 0100 would make AQ-12 error (`relation does not exist`)
  — a halt criterion under "AQ-01..AQ-24 stay green after every
  migration."
- The old view still functions correctly after 0100 (it reads
  `customers` + `ledger_entries.customer_id`, both still present until
  0104).

Split:

- **0102** creates the new `contact_balance_reconciliation` view, grouped
  with the other new views (`contacts_view`, `customer_outstanding`
  rebuild, `supplier_outstanding`). It needs the `direction` column,
  which 0100 adds.
- **0104** drops `customer_balance_reconciliation` as part of the
  legacy-column cleanup, at which point AQ-12 migrates to its v2.10 form.

The new view shape:

```sql
-- created in migration 0102, not 0100
CREATE VIEW contact_balance_reconciliation AS
SELECT
  c.id AS contact_id,
  c.shop_id,
  c.customer_outstanding_balance AS stored_customer_balance,
  c.supplier_outstanding_balance AS stored_supplier_balance,
  COALESCE((SELECT SUM(CASE WHEN type='debit' THEN amount ELSE -amount END)
            FROM ledger_entries le
            WHERE le.contact_id = c.id AND le.direction = 'receivable'), 0)::numeric(12,2)
    AS computed_customer_balance,
  COALESCE((SELECT SUM(CASE WHEN type='debit' THEN amount ELSE -amount END)
            FROM ledger_entries le
            WHERE le.contact_id = c.id AND le.direction = 'payable'), 0)::numeric(12,2)
    AS computed_supplier_balance,
  -- drift columns
  (c.customer_outstanding_balance - <subquery>)::numeric(12,2) AS customer_drift,
  (c.supplier_outstanding_balance - <subquery>)::numeric(12,2) AS supplier_drift
FROM contacts c;
```

---

## 3. New views

**0102 scope (corrected 2026-05-14, Round 1 review).** Migration 0102
creates only **two** of the views below — §3.1 `contacts_view` and the
§2.6 `contact_balance_reconciliation`. The §3.2 `customer_outstanding`
rebuild and §3.3 `supplier_outstanding` are **deferred out of 0102**:
rebuilding `customer_outstanding` requires `DROP … CASCADE`
(`total_outstanding` depends on it, `list_customers` reads it), which is
legacy-teardown work — their placement (0103 with the khata RPCs, or
0104 cleanup) is decided at the 0103 design checkpoint. §3.4
`purchases_view` extension also lands later (with the 0103 RPC work).

### 3.1 `contacts_view` — conditional-projection per v2.9.2 (migration 0102)

Replaces `customers_view`. It is also the *first* projection view for
the supplier side — `suppliers_view` never existed in v2.9. Single view;
permission projection per side.

```sql
CREATE VIEW contacts_view
WITH (security_invoker = false) AS
WITH caller_perms AS MATERIALIZED (
  SELECT
    (SELECT current_active_shop_id()) AS active_shop_id,
    (SELECT user_has_permission((SELECT current_active_shop_id()),
      'view_contacts')) AS can_view,
    (SELECT user_has_permission((SELECT current_active_shop_id()),
      'view_contact_contact_info')) AS can_see_contact_info,
    (SELECT user_has_permission((SELECT current_active_shop_id()),
      'view_contact_customer_data')) AS can_see_customer_data,
    (SELECT user_has_permission((SELECT current_active_shop_id()),
      'view_contact_supplier_data')) AS can_see_supplier_data,
    (SELECT user_has_permission((SELECT current_active_shop_id()),
      'view_contact_net_position')) AS can_see_net
)
SELECT
  c.id,
  c.shop_id,
  c.name,
  c.contact_type,
  -- Contact info (phone/address) conditionally projected
  CASE WHEN cp.can_see_contact_info THEN c.phone    ELSE NULL END AS phone,
  CASE WHEN cp.can_see_contact_info THEN c.address  ELSE NULL END AS address,
  c.customer_tier_id,
  -- Customer side. The has_* existence booleans are GATED too (0102
  -- Round-1 decision): an ungated has_supplier_payable would leak the
  -- existence of a supplier relationship to a caller without
  -- view_contact_supplier_data — undermining the L7 per-side split.
  -- Tighter than v2.9's ungated customers_view.has_khata, consistent
  -- with v2.9.2's direction.
  CASE WHEN cp.can_see_customer_data THEN c.customer_outstanding_balance ELSE NULL END
    AS customer_outstanding_balance,
  CASE WHEN cp.can_see_customer_data THEN (c.customer_outstanding_balance > 0) ELSE NULL END
    AS has_customer_khata,
  -- Supplier side
  CASE WHEN cp.can_see_supplier_data THEN c.supplier_outstanding_balance ELSE NULL END
    AS supplier_outstanding_balance,
  CASE WHEN cp.can_see_supplier_data THEN (c.supplier_outstanding_balance > 0) ELSE NULL END
    AS has_supplier_payable,
  -- Net position: requires both, conditional projection of the arithmetic
  CASE
    WHEN cp.can_see_net
    THEN (c.customer_outstanding_balance - c.supplier_outstanding_balance)::numeric(12,2)
    ELSE NULL
  END AS net_outstanding,
  c.is_active,
  c.notes,
  c.created_at,
  c.updated_at,
  c.created_by_user_id,
  c.promoted_to_both_at,
  c.promoted_to_both_by_user_id
FROM contacts c
CROSS JOIN caller_perms cp
WHERE c.shop_id = cp.active_shop_id AND cp.can_view;
```

### 3.2 `customer_outstanding` (rebuilt for direction='receivable') — DEFERRED out of 0102

> **Not in migration 0102.** See the §3 scope note — the rebuild needs
> `DROP … CASCADE` (legacy-teardown); placement decided at 0103 design.
> The shape below is the target form.

```sql
CREATE OR REPLACE VIEW customer_outstanding AS
WITH caller_perms AS MATERIALIZED (
  SELECT (SELECT current_active_shop_id()) AS active_shop_id,
         (SELECT user_has_permission((SELECT current_active_shop_id()),
           'view_contact_customer_data')) AS can_see
)
SELECT
  c.shop_id,
  c.id AS contact_id,
  c.name,
  c.phone,
  CASE WHEN cp.can_see THEN
    (COALESCE(SUM(CASE WHEN le.type='debit'  THEN le.amount ELSE 0 END), 0)
   - COALESCE(SUM(CASE WHEN le.type='credit' THEN le.amount ELSE 0 END), 0))::numeric(12,2)
  ELSE NULL END AS outstanding,
  MAX(le.created_at) AS last_activity_at
FROM contacts c
LEFT JOIN ledger_entries le
  ON le.contact_id = c.id AND le.direction = 'receivable'
CROSS JOIN caller_perms cp
WHERE c.shop_id = cp.active_shop_id
  AND c.contact_type IN ('customer','both')
GROUP BY c.shop_id, c.id, c.name, c.phone, cp.can_see;
```

### 3.3 `supplier_outstanding` (new — mirror of customer_outstanding) — DEFERRED out of 0102

> **Not in migration 0102.** See the §3 scope note — deferred to pair
> with `customer_outstanding` (0103/0104). The shape below is the target.

```sql
CREATE VIEW supplier_outstanding AS
WITH caller_perms AS MATERIALIZED (
  SELECT (SELECT current_active_shop_id()) AS active_shop_id,
         (SELECT user_has_permission((SELECT current_active_shop_id()),
           'view_contact_supplier_data')) AS can_see
)
SELECT
  c.shop_id,
  c.id AS contact_id,
  c.name,
  c.phone,
  CASE WHEN cp.can_see THEN
    (COALESCE(SUM(CASE WHEN le.type='debit'  THEN le.amount ELSE 0 END), 0)
   - COALESCE(SUM(CASE WHEN le.type='credit' THEN le.amount ELSE 0 END), 0))::numeric(12,2)
  ELSE NULL END AS outstanding,
  MAX(le.created_at) AS last_activity_at
FROM contacts c
LEFT JOIN ledger_entries le
  ON le.contact_id = c.id AND le.direction = 'payable'
CROSS JOIN caller_perms cp
WHERE c.shop_id = cp.active_shop_id
  AND c.contact_type IN ('supplier','both')
GROUP BY c.shop_id, c.id, c.name, c.phone, cp.can_see;
```

### 3.4 `purchases_view` — extended

Update `purchases_view` to project `amount_paid`, `outstanding`,
`contact_id`, `contact_name`. Permission still `view_purchases`.

### 3.5 `invoices_view`, `invoice_financials`, `invoice_with_discount_detail`

Mechanical rename: `customer_id` → `contact_id` throughout. No projection
logic change.

### 3.6 `inventory_batches_view`

Mechanical rename: `supplier_id` → `contact_id`. Same conditional cost
projection.

### 3.7 `batches_warranty_expiring_soon`

Update LEFT JOIN target from `suppliers` to `contacts`. The
`supplier_name` exposed column becomes `contact_name`.

---

## 4. RPC catalog after v2.10

### 4.1 New RPCs

| RPC | DEFINER | Permission gate | Purpose |
|---|---|---|---|
| `create_contact_basic(p_name, p_phone, p_contact_type)` | DEFINER | `create_contact_basic` + contact_type-specific gates | Returns new contact_id; phone-collision returns specific error code (see promotion flow) |
| `create_contact_full(p_name, p_phone, p_address, p_notes, p_contact_type, p_customer_tier_id)` | DEFINER | `create_contact_full` | Full creation including tier |
| `update_contact(p_id, p_name, p_phone, p_address, p_notes, p_customer_tier_id)` | DEFINER | `edit_contact` (+ `assign_contact_tier` if tier changes) | Update non-type fields |
| `archive_contact(p_id)` | DEFINER | `edit_contact` | Set `is_active = false` |
| `promote_contact(p_id, p_target_type)` | DEFINER | `promote_contact` | Flip type from single-side → `'both'` and write audit fields. Source side and target side validation |
| `pay_supplier(p_contact_id, p_amount, p_notes)` | DEFINER | `pay_supplier` + cap check | Posts payable credit entry; same shape as `receive_payment` |
| `get_contact_unified_history(p_contact_id, p_from, p_to, p_filter)` | DEFINER | `view_contacts` + side-specific gates | Returns sales / purchases / payments interleaved by date |

### 4.2 Modified RPCs

| RPC | Change |
|---|---|
| `record_sale` | `p_customer_id` → `p_contact_id` |
| `record_purchase` | `p_supplier_id` → `p_contact_id`; new `p_amount_paid` param |
| `receive_payment` | `p_customer_id` → `p_contact_id` |
| `reverse_ledger_entry` | No signature change; permission gate splits by `direction` of reversed entry |
| `list_customers` → `list_contacts` | Adds `p_contact_type` filter |
| `recent_customers` + `recent_suppliers` → `recent_contacts` | Single RPC; `p_contact_type` filter |
| `search_suppliers` → folded into `list_contacts` filter | Deprecated |
| `search_purchases` | `p_supplier_id` → `p_contact_id` |
| `search_khata_customers` → `search_khata_contacts` | `p_direction` parameter ('receivable' / 'payable') |
| `search_khata_customers_count` → `search_khata_contacts_count` | Same |

### 4.3 Retired RPCs (and their `_v28` shims per B.6 narrow scope)

| Retired | Reason |
|---|---|
| `create_customer_basic`, `create_customer_full` + `_v28` shims (if exist) | Folded into `create_contact_basic`/`_full` |
| `update_customer` | Folded into `update_contact` |
| `create_supplier_inline` + `_v28` | Folded into `create_contact_basic` |
| `update_supplier` | Folded into `update_contact` |
| `archive_supplier` | Folded into `archive_contact` |
| `recent_customers` + `_v28`, `recent_suppliers` + `_v28` | Folded into `recent_contacts` |
| `list_customers` + `_v28`, `search_suppliers` + `_v28` | Folded into `list_contacts` |
| `search_khata_customers` + `_v28`, `search_khata_customers_count` + `_v28` | Renamed (direction param added) |
| `receive_payment_v28`, `record_sale_v28`, `record_purchase_v28`, `search_purchases_v28`, `search_purchases_count_v28` | Inner shims become dead pointers when `customers`/`suppliers` are dropped; retired per B.6 |

Total `_v28` shims retired in v2.10: **14** (per audit §2.2 + tier-side
`define_tier_v28` / `update_tier_v28` / `deactivate_tier_v28` /
`set_default_tier_v28` if the contact-touching path warrants it —
finalized in Phase C migration 0103). Remaining 27 unrelated `_v28`
shims stay; v2.11 cleanup migration handles them per the queued ADR.

---

## 5. Trigger inventory after v2.10

| Trigger | Table | Purpose |
|---|---|---|
| `contacts_touch` | `contacts` | Sets `updated_at` |
| `v210_contacts_tier_change_gate` | `contacts` | Per-row CHECK on tier-change permission |
| `v210_contacts_promotion_audit_required` | `contacts` | Blocks bare flips to `'both'` without promote_contact path |
| `ledger_entries_update_balance` | `ledger_entries` | Direction-aware cache update |
| `ledger_entries_immutable` | `ledger_entries` | Append-only invariant (extended to cover `direction`) |
| `ledger_audit_at_insert` | `ledger_entries` | Audit `_by_user_id` write at INSERT |
| `batch_immutable_fields` | `inventory_batches` | Updated to reference `contact_id` |
| `purchases_touch` | `purchases` | Existing |

---

## 6. Open items deferred to Phase C

These are implementation-level details that don't need pre-decision but
will surface during Phase C migration drafting:

1. Exact migration-time conflict policy if production already holds
   data (the production data wipe per Finding 1 makes this moot for the
   v2.10+v2.11 ship moment, but the migration script must still handle
   the staging environment which may seed test data).
2. Whether `inventory_batches.contact_id` should become NOT NULL after
   migration (currently NULLable on `supplier_id`). Defer to Phase C.
3. Whether `define_tier` / `update_tier` / `deactivate_tier` /
   `set_default_tier` `_v28` shims fall under the B.6 narrow retirement
   scope. They touch `customer_tiers` but not `customers` or
   `suppliers` — likely stay until v2.11 broad cleanup.

---

**End of model design. See attack-surface and implementation-plan docs
for security perimeter and migration sequence.**
