# 2026-05-14 — v2.10 permission catalog redesign (B.4 + the 0105 checkpoint rulings)

**Status:** Accepted 2026-05-14. Implemented by migration
`0105_v210_permission_catalog_redesign.sql`.
**Scope:** the B.4 Phase-B lock, Policy 2, and the three judgment calls
the implementation plan routed to the 0105 design checkpoint.
**Design package:** `design/2026-05-14-v210-0105-decisions.md` (Part 1),
`design/2026-05-14-v210-0105-row-migration.md` (Part 2).

## Context

v2.10 unifies `customers` + `suppliers` into `contacts`. The v2.9
permission catalog had 9 `customers`-category keys + 2 `suppliers`-category
keys + `receive_payment` (financial) — all customer/supplier-shaped.
Phase B (B.4) locked a 12-key replacement set ("strict, folded,
owner-conservative") and Policy 2 ("intersect" — where two old keys fold
into one, grant the new key only if the user held both). The
implementation plan deferred three questions to the 0105 design
checkpoint; the live-state pull surfaced two more.

The live pull also corrected the working assumption about *where* the
migration runs: staging `iamqibcdpeovwavgzswq` (0105's first target)
holds **0 `user_shop_permissions` rows** — one owner seed, and owners
hold no permission rows. The audited "24 rows" live on production. 0105's
row migration is therefore a no-op over an empty set on staging and does
its real work only at the combined v2.10+v2.11 production deploy.

## Decision

**Catalog shape.** Insert the 12 B.4 keys (11 `contacts`-category +
`pay_supplier` in `financial`); retire the 11 legacy customer/supplier
keys; keep `receive_payment` by name. The `customers` and `suppliers`
category labels disappear emergently with their last keys (`category` is
a plain text column — no separate DDL).

**Policy 2 — intersect.** Fold mappings grant the new key only on the
*intersection* of the old keys; 1:1 and union maps copy the legacy
grant. The migrated grant comes from the *legacy grant*, not the new
preset — so a user can end up more permissive than the strict B.4
default (e.g. a manager who held `view_suppliers` keeps
`view_contact_supplier_data` though the new manager preset withholds it);
subsequent invitations get the strict default.

**Policy 3 — net-new keys migrate `false`.** The three new keys with no
v2.9 analog — `view_contact_net_position`, `promote_contact`,
`pay_supplier` — migrate to `false` for every existing non-owner. The
B.4 preset default for these keys seeds *new invitations* only; it is
never applied retroactively to migrating users. This is the same
principle as Policy 2 and the attack-surface §1.3 `view_suppliers` rule:
**a migration preserves what was demonstrably held, it never grants.**
The practical effect is one row — `pay_supplier` is `M✓` in the new
preset, so a preset-default seeding would have silently granted *every
existing manager* a brand-new financial capability (v2.9 had no supplier
payables at all — no manager "had" or "expected" it); under Policy 3 an
owner grants it explicitly, post-migration, as a visible audited action.
`view_contact_net_position` and `promote_contact` are `M✗ S✗` and so
land `false` for non-owners under any policy. **Process note:** Policy 3
was originally written into the design package as a *mechanical fact*
("net-new keys take the preset default"), not surfaced as a decision. It
was caught at the 0105 file review and corrected to a named, explicitly
ruled policy — recorded here alongside Policy 2.

**Ruling D1 — `reverse_ledger_entry`: keep as a base gate.** The v2.9 key
is kept (not retired). Its `requires` rebinds `[view_customer_khata]` →
`[view_contacts]`; preset unchanged (O✓ M✓ S✗). Migration 0105 rewrites
the `reverse_ledger_entry` function to check the key as an up-front base
gate *before* the entry fetch; the C2 direction-split (`receive_payment`
/ `pay_supplier` per the reversed entry's direction) stays as the second
gate.

**Ruling D2 — `deactivate_tier` dependency: catalog `requires`, not a
wrapper gate.** `manage_contact_tiers.requires = ['assign_contact_tier']`.
The dependency engine then guarantees any holder of `manage_contact_tiers`
also holds `assign_contact_tier`, so the data-dependent gating in
`deactivate_tier` (the bulk re-point fires `v210_contacts_tier_change_gate`
only when the tier has members) becomes unobservable. The 4 surviving
tier wrappers get only the mechanical `manage_customer_tiers` →
`manage_contact_tiers` key-string swap — no explicit `assign_contact_tier`
check is added to any wrapper body.

**Ruling FA — `receive_payment.requires` = `[view_contacts]`.** Not
`[view_contacts, view_contact_customer_data]` as attack-surface §1.2
drafted: that value is incoherent with the locked salesperson preset
(S holds `receive_payment` ✓ but not `view_contact_customer_data` ✗), and
under Policy 2 production's salesperson migrates to exactly that
violating state. `receive_payment` does not need balance *visibility* to
post a credit — visibility stays a `contacts_view` projection concern.

**Two scope corrections folded into 0105** (implementation-plan §1.0
under-described the migration):

- 0105 carries the `v29_ledger_read` → `v210_ledger_read` RLS swap on the
  live `ledger_entries` table. `v29_ledger_read` gated on
  `view_customer_khata` (a retired key); attack-surface §2.2 specified
  the replacement but assigned it no migration number and 0096–0104b
  never built it. Without the swap, dropping `view_customer_khata` kills
  all non-owner ledger reads.
- `record_purchase.requires` carried a dangling `view_suppliers`
  (`requires` is `text[]`, not FK-enforced); 0105 rebinds it to
  `view_contact_supplier_data`.

## Alternatives

**D1 — retire the key.** 0103 already made the function ignore it, so
retiring is "free". Rejected: it silently widens salespeople (who hold
`receive_payment` by preset) to reverse receivable entries — a capability
v2.9 deliberately withheld — and leaves the `entry_not_in_shop`
fetch-before-authz disclosure open. A redesign migration should not
re-grant a capability as a side effect, per the same discipline 0104b's
header invoked.

**D2 — explicit wrapper gate** (add `assign_contact_tier` to
`deactivate_tier`'s body). Rejected: a real behaviour change vs v2.9 — it
over-gates the empty-tier case (deactivating a tier with no members
reassigns nobody) — and duplicates the `v210_contacts_tier_change_gate`
trigger, which is already the single runtime enforcement point for every
`customer_tier_id` re-point path. **D2 — leave bare transitive.**
Rejected: faithful, but leaves the discoverability gap (an owner who
grants `manage_contact_tiers` without `assign_contact_tier` sees it
"work" on an empty tier, then fail on a populated one).

**FA — flip the salesperson `view_contact_customer_data` preset to ✓.**
Rejected: contradicts B.4 "owner-conservative" and attack-surface §1.3
("salesperson loses outstanding visibility as expected"). **FA — flip
the salesperson `receive_payment` preset to ✗.** Rejected: strips a core
POS capability salespeople have today.

**Policy 3 — seed net-new keys from the preset default** (the design
package's original mechanical assumption). Rejected: it inverts the
migration principle every other 0105 rule follows. For
`view_suppliers → view_contact_supplier_data` the migration uses the
legacy grant and deliberately *ignores* the stricter new preset; seeding
net-new keys *from* the preset does the opposite — ignores the (empty)
legacy grant and applies the preset — silently granting existing
managers `pay_supplier`. B.4 already encodes "new managers get
`pay_supplier`"; 0105 is not deciding the preset, only whether the
migration retro-grants. It should not. The cost — a one-capability
"day-1 gap" closed by one explicit, audited owner action — is the
conservative-by-default posture B.4 itself calls for.

## Consequences

- Catalog goes 50 → **51** keys (11 retired, 12 added; `receive_payment`
  / `reverse_ledger_entry` kept). Each pre-existing non-owner access
  loses its in-scope legacy rows and gains exactly 12 — on the
  verified-dense production shape that is 11 lost → net +1; 0105's
  verification *derives* the per-access delta from a pre-migration
  snapshot (`pre_count`, `legacy_in_scope_count`) rather than assuming a
  dense row-per-key shape, closing the 0104-class "verification
  hardcodes a row-shape" trap. On staging both the catalog and the row
  migration apply, the latter over an empty set.
- Existing managers do **not** receive `pay_supplier` on migration
  (Policy 3). On v2.10 day 1 an owner must explicitly grant it to any
  non-owner who should have it — one visible, audited action rather than
  a silent catalog-default fallout. `view_contact_net_position` and
  `promote_contact` are owner-only by preset, so no non-owner gains them
  under either policy.
- The `requires` graph stays coherent: 0105's end-of-migration
  verification includes a `requires`-coherence check scoped to the 15
  keys it touches — the check that would have caught the incoherent
  attack-surface §1.2 `receive_payment.requires` value.
- `reverse_ledger_entry` now has a two-tier gate: base key + direction
  sub-gate. AQ-23 (LIKE-based, order-independent) still passes.
- `manage_contact_tiers` cannot be granted without `assign_contact_tier`
  — a nonsensical override combination is now ungrantable. No O/M/S
  preset violates the new dependency, so seeding is unaffected.
- **Known inert danglers, NOT 0105's job — 0106 agenda:** the
  `customers` / `suppliers` RLS policies and the
  `check_customer_tier_change_gate` trigger function keep dangling
  references to retired keys. Those objects are frozen-dead post-0104
  (AQ-33: no surviving function writes the legacy tables) and are dropped
  with the tables at 0106 — except `check_customer_tier_change_gate`,
  which 0106 must `DROP FUNCTION` explicitly after dropping `customers`
  (it is a function, not table-owned, so `DROP TABLE … CASCADE` will not
  take it).
- Implementation-plan §1.0's "drop 12 retired keys" was off by one — it
  presumed D1 = retire. With D1 = keep, 0105 drops **11**.
- Frontend (Phase D.1) must replace the 12 retired keys in
  `src/lib/permissions.ts` with the 12 new keys before any non-owner
  traffic hits a pilot shop.
