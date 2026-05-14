# v2.10 Contacts — Implementation Plan

**Status:** Locked at end of Phase B (2026-05-14).
**Companion docs:** `2026-05-14-v210-contacts-model-design.md`,
`2026-05-14-v210-contacts-attack-surface.md`.
**Audit basis:** `audit/2026-05-14-v210-contacts-pre-design-audit.md`.

This document is the operational plan for Phase C (schema +
infrastructure), Phase D (frontend), Phase E (testing), and Phase F
(documentation + v2.11 handoff).

---

## 0. Cadence and authorization

Per PRD G.1 (and locked by B.6):

- **Each Phase C migration is its own authorization checkpoint.**
  No batch authorization unless the user explicitly grants it for a
  named scope.
- **Commit-before-apply.** Every migration committed to git BEFORE
  applied to staging.
- **ADRs filed inline**, not batched at end.
- **Target project:** staging `iamqibcdpeovwavgzswq`. Production
  `orfggrnyychmmqdlbfhf` does not receive any v2.10 migration until
  v2.11 is also ready and the combined production-deploy moment is
  authorized.
- **Branch:** `feat/v2.10-contacts` (current).

ADR scaffolding for each significant decision:

```
decisions/
  2026-05-14-v210-supplier-side-ledger-architecture.md       (B.0)
  2026-05-14-v210-contacts-table-unification.md              (B.1)
  2026-05-14-v210-net-position-view-computed.md              (B.2)
  2026-05-14-v210-promotion-modal-copy.md                    (B.3)
  2026-05-14-v210-permission-catalog-redesign.md             (B.4)
  2026-05-14-v210-unified-khata-with-toggle.md               (B.5)
  2026-05-14-v210-v28-shim-retirement-narrow-scope.md        (B.6, plus queued v2.11 cleanup)
  2026-05-14-v210-record-purchase-amount-paid.md             (B.0.2)
  2026-05-14-v210-pay-supplier-permission-and-cap.md         (B.0.3)
  2026-05-14-v210-skip-credit-limit-columns.md               (B.0.4)
  2026-05-14-v210-promotion-audit-fields-fresh-creation.md   (B.1.2)
  2026-05-14-v210-contact-id-add-not-rename.md               (impl-sequence correction, found during 0098)
```

12 ADRs filed during Phase C: 11 for the locked B.0–B.6 decisions, plus
one implementation-sequence correction (`contact-id-add-not-rename`)
surfaced while writing migration 0098.

---

## 1. Phase C — migration sequence

Migration files in `supabase/migrations/`. Numbering continues after
v2.9.2's 0095.

### 1.0 Column lifecycle for `contact_id` (corrected 2026-05-14)

`contact_id` on the four dependent tables (`invoices`, `ledger_entries`,
`purchases`, `inventory_batches`) is a **new column**, not a rename of
`customer_id` / `supplier_id`. Reasoning (full ADR:
`decisions/2026-05-14-v210-contact-id-add-not-rename.md`): the 0099
backfill creates `contacts` rows with fresh `gen_random_uuid()` ids, and
merges a supplier into an existing customer's contact row on phone
collision (the migration-time form of the L3 promotion flow). The legacy
`customer_id` / `supplier_id` UUIDs therefore do not equal the resolved
`contacts.id` in the merge case — an in-place `RENAME COLUMN` would leave
the column pointing at ids that no longer exist once the legacy tables
drop. Lifecycle:

| Stage | Migration | Action |
|---|---|---|
| Add | 0098 | `ADD COLUMN contact_id` (new, nullable, FK → contacts) |
| Backfill | 0099 | populate `contact_id` by resolving legacy ids → unified contact |
| Collateral | 0100 | `direction`, `amount_paid`, cap column, `contact_id` indexes, `NOT NULL` swap onto `ledger_entries.contact_id` |
| Drop legacy | 0104 | drop `customer_id` / `supplier_id` columns + indexes + FKs |

| File | Purpose | Authorization |
|---|---|---|
| `0096_v210_create_contacts_table.sql` | `contacts` table + indexes + RLS policies + column-grants | Pre-auth required |
| `0097_v210_create_contact_helper_functions.sql` | `is_contact_customer`, `is_contact_supplier`, `check_contact_tier_change_gate`, `enforce_promotion_audit_populated` | Pre-auth required |
| `0098_v210_add_contact_id_to_dependent_tables.sql` | `ALTER TABLE invoices/ledger_entries/purchases/inventory_batches ADD COLUMN contact_id` — a **new** nullable column with FK → `contacts` (NOT a rename of `customer_id`/`supplier_id`; see §1.0). No renames, no drops, no indexes. | Pre-auth required |
| `0099_v210_backfill_contact_id.sql` | For each customer + supplier row, create matching `contacts` row (or merge on phone collision); backfill `contact_id` on every dependent table | Pre-auth required — **also requires user re-confirmation of the data-wipe-or-preserve interpretation** since this migration also handles the case where production data still exists at apply-time |
| `0100_v210_collateral_schema_changes.sql` | `ledger_entries` add `direction` + swap the `NOT NULL` constraint onto `contact_id`; `purchases` add `amount_paid` + `outstanding`; `shops` add cap column; `contact_id` indexes on all four dependent tables; `customer_balance_reconciliation` → `contact_balance_reconciliation` view rebuild. **No column renames.** | Pre-auth required |
| `0101_v210_unified_ledger_trigger.sql` | `ledger_entries_update_balance` rebuilt for direction-aware cache update; `ledger_entries_immutable` extended to cover `direction` | Pre-auth required |
| `0102_v210_create_contact_rpcs.sql` | New RPCs: `create_contact_basic`, `create_contact_full`, `update_contact`, `archive_contact`, `promote_contact`, `pay_supplier`, `get_contact_unified_history`; new helper views (`contacts_view`, `customer_outstanding` rebuilt, `supplier_outstanding` new) | Pre-auth required |
| `0103_v210_modify_existing_rpcs.sql` | `record_sale` / `record_purchase` / `receive_payment` / `reverse_ledger_entry` / `list_contacts` / `recent_contacts` / `search_khata_contacts` / `search_purchases` rewritten for `contact_id` | Pre-auth required |
| `0104_v210_retire_legacy_rpcs_and_v28_shims.sql` | DROP retired RPCs and 14 `_v28` shims per B.6 narrow scope. Drop `customers_view`, `suppliers_view`, `customer_outstanding` (rebuilt in 0102). **Drop the legacy `customer_id` / `supplier_id` columns + their indexes + FKs** from `invoices` / `ledger_entries` / `purchases` / `inventory_batches` — must precede the 0106 table drop. | Pre-auth required |
| `0105_v210_permission_catalog_redesign.sql` | Insert 12 new keys; migrate 24 `user_shop_permissions` rows per §1.3 of attack-surface doc; drop 12 retired keys; update `permissions_catalog` category from `customers` → `contacts` and drop `suppliers` category | Pre-auth required |
| `0106_v210_drop_legacy_tables.sql` | `DROP TABLE customers CASCADE; DROP TABLE suppliers CASCADE;` — runs last because every reference must be migrated first | Pre-auth required — **second confirmation point: this migration commits the data drop** |

**Total: 11 migrations.** Each its own authorization checkpoint.

### 1.1 Migration risk register

| Risk | Mitigation |
|---|---|
| `0099` backfill UPDATE blocked by `ledger_entries_immutable` append-only trigger | `ALTER TABLE ledger_entries DISABLE TRIGGER ledger_entries_immutable; UPDATE …; ENABLE TRIGGER` — documented in CLAUDE.md gotchas. Re-enable BEFORE end of migration. |
| `0099` phone collision on `(shop_id, phone)` blocks UNIQUE index creation | Pre-check during 0096 catches existing duplicates; migration aborts with clear error. Production currently has one collision (`03121212123` shared by two suppliers); the Finding 1 wipe eliminates this, but the migration script must still handle it for any staging environment with seeded test data. |
| `0103` rewriting `record_sale` / `record_purchase` while v2.9.x clients still exist | Staging-only at this stage. Frontend D.1 cluster updates client calls before any non-test load hits the new RPCs. |
| `0104` dropping `_v28` shims that some path still calls | AQ-24 baseline allowlist verified BEFORE 0104 runs; any non-customer `_v28` still on the allowlist stays. |
| `0106` dropping tables in the middle of v2.10 work | This migration is **the last C migration**. After 0106 there is no rollback path other than restoring from snapshot. The implementation plan explicitly halts after 0105 for owner re-confirmation before 0106 runs. |

### 1.2 Down-migration policy

Per PRD A.7 / G.3:

- 0096 → 0105 each have a down-migration that reverses the change.
  These are for staging iteration only — they don't preserve data
  across the round-trip and are not viable as production-rollback
  paths.
- 0106 (table drop) has **no down-migration**. Once tables are dropped,
  data is gone. This is intentional: v2.10 is forward-only on the
  contacts unification.

### 1.3 Phase C halt checkpoints

After each migration applies cleanly:

1. Run AQ-01..AQ-24 (existing baseline). All zero.
2. After 0102+: run AQ-25..AQ-31 (new). All zero.
3. After 0105: verify `permissions_catalog` row counts match the locked
   table in attack-surface §1.2.
4. After 0106: verify `customers` and `suppliers` no longer exist in
   `pg_class`.

If any halt fires, the corresponding migration's down-migration runs and
the user is notified.

---

## 2. Phase D — frontend implementation

Cluster sequence per PRD D.9, refined with the locked decisions:

### D.1 — Types + hooks (no UI change)

- Regenerate `src/types/database.ts` from staging schema (per CLAUDE.md
  Supabase data layer rule).
- Build:
  - `src/features/contacts/hooks.ts`: `useContacts`, `useContact`,
    `useUnifiedContactHistory`, `useCreateContact`, `useUpdateContact`,
    `useArchiveContact`, `usePromoteContact`.
  - `src/features/khata/hooks.ts`: add `usePaySupplier` mirroring
    `useReceivePayment`; existing `useSearchKhata*` hooks accept new
    `direction` param.
- Update `src/lib/permissions.ts`: replace 12 retired keys with 12 new
  keys.
- Update `src/lib/errorMap.ts`: rename customer/supplier-specific error
  codes (~10 entries per audit §7.4).

### D.2 — `/contacts` list page

- New folder `src/features/contacts/` (alongside, then replacing
  `customers/` and `suppliers/`).
- `ContactsListPage.tsx`:
  - Filter chips: Type (All / Customers / Suppliers / Both),
    Active / Archived, With outstanding / Settled. Defaults per B.5.
  - Type indicator on each row (chip showing role(s)).
  - Net outstanding column when contact_type='both' AND caller has
    `view_contact_net_position`.
- New routes in `src/paths.ts`: `contacts`, `newContact`, `contactDetail`,
  `contactEdit`. Retire `customers` / `suppliers` paths.
- Router wires `RequirePermission permission='view_contacts'`.

### D.3 — Contact detail page

- `ContactDetailPage.tsx`:
  - Identity section.
  - Type badge prominent.
  - Net position card (gated on `view_contact_net_position`).
  - Unified history table (`get_contact_unified_history`) with
    filters: All / Sales / Purchases / Payments; date range.
  - Edit button (gated on `edit_contact`).
  - Promote button (visible only when `contact_type IN ('customer','supplier')`,
    gated on `promote_contact`).
  - Audit trail line: "Promoted to customer+supplier by {user} on
    {date}" rendered only when `promoted_to_both_at IS NOT NULL`.

### D.4 — POS contact picker

- `src/features/pos/POSPage.tsx`: contact picker filters
  `contact_type IN ('customer','both')`. Suppliers-only contacts hidden.
- If picker search matches a supplier-only contact:
  surface inline hint "{name} is a supplier-only contact. Promote to
  customer+supplier?" linked to the promotion modal.

### D.5 — Stock-in contact picker

- `src/features/purchases/NewPurchasePage.tsx`: contact picker filters
  `contact_type IN ('supplier','both')`. Customers-only contacts hidden.
- Promotion-modal link mirrors D.4 in reverse.
- `record_purchase` form gains an optional "Amount paid now" field.
  Default = total cost (legacy behavior). If < total, ledger gets a
  payable entry; UI surfaces "Outstanding: X PKR" beneath the line.

### D.6 — Promotion modal

- Shared component `src/features/contacts/PromotionModal.tsx`.
- Copy: en + ur per B.3 Draft 2. Mirror form swaps role words.
- Calls `promote_contact(p_id, p_target_type)` RPC. On success,
  invalidates contact + list queries.
- Cancel path aborts the create flow that triggered the modal.

### D.7 — Settings impact

- `/settings/tiers` route stays; rename internal references from
  "customer tiers" to "contact tiers" in copy. Functionality unchanged
  per L6.
- `pay_supplier` cap column surfaces in shop settings (Phase D.7 minor —
  one new numeric field in settings page).

### D.8 — Reports + dashboard

- `src/features/dashboard/DashboardPage.tsx`:
  - "Customers owe us" widget reads `customer_outstanding` view total.
  - "We owe suppliers" widget (new) reads `supplier_outstanding` view
    total.
  - "Net owed" widget (new, owner-only) = customers − suppliers.
- Reports widgets that filtered by `customer_id` / `supplier_id` rewrite
  for `contact_id`.

### D.9 — Cluster authorization

Each D.X cluster is authorized as it starts (per PRD D.10). Owner
regression test after each cluster.

---

## 3. Phase E — testing

### 3.1 Owner smoke test (per PRD E.1)

Sequence (owner account on staging):

1. Cash sale to a customer-only contact.
2. Credit sale to a customer-only contact (verify ledger receivable
   entry posted, balance cached).
3. Cash receive_payment (verify ledger receivable credit entry,
   balance decremented).
4. Stock-in from a supplier-only contact, fully paid (verify no ledger
   entry, balance unchanged).
5. Stock-in from a supplier-only contact, partially paid (verify ledger
   payable entry, balance cached).
6. pay_supplier (verify ledger payable credit entry, balance
   decremented).
7. Create `'both'` contact directly (verify promote_to_both_at NULL per
   B.1.2).
8. Create customer-only contact; later promote via modal (verify audit
   fields populated, contact_type='both').
9. Net position card displays correctly on a `'both'` contact with
   activity on both sides.
10. Phone-collision modal triggers on supplier creation with existing
    customer's phone.

### 3.2 Synthetic non-owner test (per PRD E.2)

`SET ROLE authenticated` against real session JWTs (NOT
`set_config('request.jwt.claims', ...)` per
[[feedback-synthetic-tests-real-role]]).

Three personas:

| Persona | Permissions |
|---|---|
| Manager (default) | All 12 new keys default ✓ except `view_contact_supplier_data`, `view_contact_net_position`, `promote_contact`, `manage_contact_tiers` |
| Manager (with supplier visibility) | Default + explicit `view_contact_supplier_data` grant + `view_contact_net_position` |
| Salesperson (default) | `view_contacts`, `view_contact_contact_info`, `create_contact_basic`, `receive_payment` |

Test cases per persona:

- Read `/contacts` — verify visible rows match contact_type filter.
- Read contact detail — verify outstanding columns project correctly
  per permission.
- POS sale — verify customer-side flow works.
- Stock-in — manager-with-supplier-visibility succeeds; default manager
  blocked on supplier-side ledger updates.
- pay_supplier — verify cap enforcement when non-zero cap is set.

### 3.3 Permission asymmetry test (per L7)

Specifically: a manager who has `view_contact_customer_data` AND
`view_contact_supplier_data` BUT NOT `view_contact_net_position`. The
contact_with_outstanding view's `net_outstanding` column projects NULL
for this caller. Frontend hides the net position card.

### 3.4 Coverage matrix

File: `audit/2026-05-XX-v210-phase-e-coverage-matrix.md` (created in
Phase E, modeled on v2.9.1's matrix from
`audit/2026-05-13-v291-phase-e-coverage-matrix.md`).

Format: row per use case × column per persona × halt criterion when any
cell fails.

### 3.5 Pre-handoff readiness checklist

Per PRD F.5. All gates must pass before v2.10 declares Phase E green:

- AQ-01..AQ-31 all zero.
- Owner smoke test green (10 cases).
- Synthetic non-owner test green (all personas).
- Permission asymmetry test green.
- Coverage matrix has no failed cells.
- `_v28` shim retirement complete; AQ-24 allowlist updated.
- All 11 ADRs filed in `decisions/`.

---

## 4. Phase F — documentation and v2.11 handoff

### 4.1 Docs to update (per PRD F.1)

- `CLAUDE.md` v2.10 build trail entry (after the v2.9.2 entry).
- `docs/build-trail.md`.
- `docs/gotchas.md` — likely new gotchas around the direction column +
  cross-side validation triggers + the column-grant pattern extension.
- `docs/todos.md` — close v2.10 items, queue v2.11 returns/refunds +
  broad `_v28` shim cleanup.

### 4.2 ADRs filed

11 ADRs per §0. Each filed inline with the corresponding migration or
cluster work, not batched.

### 4.3 v2.11 prep

Create `design/2026-XX-XX-v211-returns-outline.md` (date set when
Phase F runs).

Open questions for v2.11 surfaced during v2.10 work:

- **Settlement workflow.** L4 deferred contra entries. v2.11 must
  decide: explicit `settle_contact` RPC that posts a paired
  receivable+payable ledger pair, or a UI-level netting that doesn't
  touch ledger.
- **Returns ledger interaction.** A customer return → does it post a
  receivable credit (reduces what they owe) or a payable debit (we owe
  them a refund)? Schema choices in v2.10 (`direction` enum,
  `reverses_entry_id`) are forward-compatible with either.
- **Warranty + supplier_id-now-contact_id.** Warranty alerts join
  `inventory_batches.contact_id` to `contacts`. v2.11 returns flow may
  reference batch + contact + warranty period.
- **Broad `_v28` cleanup migration.** Per B.6 queued ADR. 27 remaining
  `_v28` shims to retire; verification pass needed before migration is
  written.

### 4.4 Production deployment moment

Per PRD L10 + F.4:

- v2.10 stays on staging through its full Phase E.
- v2.11 develops on a sibling branch (or same branch after v2.10's
  Phase D closes, TBD by v2.11 PRD).
- When both are green on staging, **production deploy is a single
  authorization moment** that:
  1. Wipes production customer/supplier test data per Finding 1
     authorization.
  2. Applies migrations 0096..0106 (v2.10) + v2.11 migrations in
     sequence.
  3. Deploys v2.10+v2.11 frontend together.
- Per Phase A.7 / CLAUDE.md authorization rule: production migration
  application is a CHECKPOINT, not covered by any staging
  authorization. User must explicitly authorize the production wipe at
  ship time.

---

## 5. Effort sizing reality check

Per Finding 3 acknowledgment ("adds 1-2 weeks to v2.10 timeline"):

| Phase | Original estimate | Updated estimate |
|---|---|---|
| C (migrations) | 5–7 days | **7–10 days** (1 added migration: collateral ledger changes; 1 added migration: pay_supplier RPC + cap; AQ-30..AQ-31 added) |
| D (frontend) | 7–10 days | **9–12 days** (added pay_supplier UI on /khata supplier toggle; added "amount paid now" field on stock-in) |
| E (testing) | 3–5 days | **4–6 days** (supplier-ledger smoke + persona matrix grows) |
| F (docs + v2.11 prep) | 2 days | 2 days |
| **Total** | **2–3 weeks** | **3–4 weeks** |

v2.11 (returns) then follows, with its own scope, before the combined
production deploy.

---

## 6. Process discipline reminders (carried from v2.9)

Three rules to enforce throughout v2.10:

1. **Synthetic tests use real `SET ROLE authenticated`** with real
   session JWTs. NEVER
   `set_config('request.jwt.claims', ...)` shortcuts (per
   [[feedback-synthetic-tests-real-role]]).
2. **Audit gaps block flag flips.** Any frontend hook still using
   `.from('contacts').(insert|update|delete)` instead of going through
   an RPC is release-blocking. Audit confirms zero current direct-write
   surface; verify after Phase D that no new ones snuck in (per
   [[feedback-audit-gaps-block-flag-flip]]).
3. **Column-grant pattern for any new cost-bearing column.** Any future
   column added to `contacts`, `ledger_entries`, or `purchases` MUST
   either be explicitly safe (then add to the GRANT SELECT list) or
   sensitive (then exclude from the list and route reads through a
   DEFINER view). Verified by reviewer at PR time.

---

**End of implementation plan. Phase B halt complete. Awaiting
acknowledgment before Phase C begins.**
