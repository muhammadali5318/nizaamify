# v2.9.1 — Migration 0089: `update_product` extension + archive separation

**Status:** Filed. Closes task #23. Last functional blocker before `RBAC_TEAM_UI_ENABLED` flip.
**Date:** 2026-05-13

## Context

Phase D cluster 6 of the v2.9.1 frontend sweep had to migrate `useUpdateProduct` from a direct `from('products').update(...)` call to a DEFINER-wrapper RPC, the same way every other v2.9.1 write hook has migrated (see [[2026-05-13-v291-list-rpcs-vs-rls-loosening]] for the broader pattern). The base `update_product` RPC was introduced in migration 0087 (Phase C of v2.9.1) but covered only:

- `name`
- `description`
- `category_id`
- `price_for_default_variant`

The `useUpdateProduct` hook in `src/features/products/hooks.ts` writes additional fields directly that the 0087 RPC doesn't cover:

1. `is_scan_only` — barcode-scan-only flag on products.
2. `has_batches` — toggle for batch tracking (with `cannot_enable_with_stock` / `cannot_disable_with_active_batches` guard rails per v2.8 ADRs).
3. The legacy `products.type` snapshot column (ADR-0019), which must stay in sync with `product_categories.name` for legacy read paths.
4. `is_active` — the archive toggle.
5. Expiry / warranty / expired-sale-policy overrides — gated by a distinct permission (`edit_product_expiry_overrides`).

The cluster-6 migration was deferred at the time per `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Discipline lesson because the 0087 RPC was insufficient. Leaving the hook as a direct-write through the pilot would have silently lost audit-column writes on the first non-owner product edit — exactly the kind of gap that motivated [[feedback-audit-gaps-block-flag-flip]] (recorded in `docs/gotchas.md`).

The audit gap had to close before the `RBAC_TEAM_UI_ENABLED` flag flips per [[2026-05-13-v291-b9-feature-flag-per-shop-manual]] §Bookkeeping.

## Decision

Extend `update_product` RPC to cover concerns 1, 2, 3, and 5 above — **but drop `is_active` from its scope (concern 4)**.

`is_active` changes route to the existing `archive_product` RPC, which (a) carries the `archive_product` permission gate per [[2026-05-13-rbac-archive-product-trigger-gate]], and (b) cascades the active flag to all variants of the product via the trigger pattern. Inlining the cascade into `update_product` would duplicate `archive_product` semantically.

Migration 0089 (`v291_update_product_extended`) implements:

- Drops the 0087-form signature (8 args) and recreates with the extended 10-arg signature.
- Per-row locking via `SELECT ... FOR UPDATE` on the products row at the start.
- Inline guard for `multi_variant_price_split` (multi-variant products write prices via `update_variant_inline`, not `update_product`).
- Inline guard for `edit_product_expiry_overrides` permission when any expiry/policy override changes.
- Stamps `updated_by_user_id = auth.uid()` inside the function (audit-at-INSERT-or-UPDATE per [[2026-05-12-mig-0086-ledger-audit-at-insert]]).
- AQ-23 conformance preserved (P1 `not_authenticated`, P2 `no_shop_for_user`, P3 `user_has_permission('edit_product')`).

The frontend half (Phase D cluster 6) refactors:

- `useUpdateProduct` hook in `src/features/products/hooks.ts` → routes through the extended `update_product` RPC.
- `ProductEditDialog.tsx` → drops the `is_active` field from its form; archive moves to a separate action.
- `ProductFormPage.tsx` → same form-field cleanup.

See `supabase/migrations/0089_v291_update_product_extended.sql` for the full RPC body.

## Alternatives considered

1. **Keep `is_active` in `update_product` and cascade to variants inside the body.** Rejected. Duplicates `archive_product` semantically. Two RPCs that both flip the active flag with cascade would be confusing for future maintainers reading the catalog, and the `archive_product` permission key would have to be re-checked inside `update_product` — same permission, two enforcement points. Cleaner to delegate.
2. **Leave the `useUpdateProduct` hook as a direct-write through the pilot, file audit-gap as v2.10 follow-up.** Rejected. The first non-owner product edit during the pilot would silently lose audit column writes. The [[feedback-audit-gaps-block-flag-flip]] rule (recorded in `docs/gotchas.md` after the original `2026-05-12-v2-9-0-1-frontend-sweep` §Discipline lesson) explicitly blocks the flag-flip on outstanding audit gaps. Letting cluster 6 ship without the RPC would have either pushed the flip indefinitely or accepted the audit gap — both worse than the half-day to extend the RPC.
3. **Split `update_product` into multiple narrow RPCs (`set_product_name`, `set_product_category`, `toggle_scan_only`, ...).** Rejected. Frontend would still need to issue multiple round-trips for a single form submit. The atomic update of `name + category + price + flags` in one transaction is what the edit dialog needs to commit-or-rollback as a unit.

## Consequences

**Positive:**
- The `useUpdateProduct` hook gains audit-column population on every owner + non-owner edit. AQ-23 (the DEFINER-wrapper shape-drift detector) stays clean.
- Archive semantics are separated from edit semantics. An owner archiving a product is doing a distinct action from editing its name; the permissions reflect this (`archive_product` ≠ `edit_product`).
- The expiry / warranty / expired-sale-policy override fields are gated by `edit_product_expiry_overrides` — a separate permission from `edit_product`. Owners can grant staff "edit product details" without granting "override expiry policies" on a per-user basis.
- Half-day implementation estimate hit.

**Negative / accepted:**
- The frontend form had to lose its `is_active` toggle. Mitigation: a separate "Archive" action surface (a danger-tone button + confirmation) ships alongside the edit form in the product detail page. Users clicking "Archive" route to `archive_product`; users clicking "Save" route to `update_product`.
- The 0087-form signature of `update_product` is gone — any caller still passing the 8-arg version will fail. No such caller exists outside the v2.9.1 frontend; verified pre-migration.

## Bookkeeping

- `supabase/migrations/0089_v291_update_product_extended.sql` — the DDL.
- Closes task #23 (in `tasks.md`).
- Last functional blocker cleared for `RBAC_TEAM_UI_ENABLED` flag-flip per [[2026-05-13-v291-b9-feature-flag-per-shop-manual]] §Bookkeeping.
- Cross-refs: [[2026-05-13-rbac-archive-product-trigger-gate]] (the archive-permission ADR), [[2026-05-12-mig-0086-ledger-audit-at-insert]] (the audit-pattern split), ADR-0019 (legacy `products.type` snapshot), [[2026-05-13-v291-list-rpcs-vs-rls-loosening]] (the broader pattern).
- Memory rule trace: [[feedback-audit-gaps-block-flag-flip]] — the rule that made this migration non-deferrable.
