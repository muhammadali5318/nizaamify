# POS batch picker ships as v2.8.5 polish

**Date:** 2026-05-13 (v2.8.5)
**Status:** Accepted

## Context

v2.8 spec §4.4 described a "Pick batch" affordance on every batched cart
line in POS — a popover listing active batches FEFO-ordered with stock,
expiry, and an ⚠ EXPIRED indicator, letting the cashier manually
override the FEFO default per line. The picker was deferred from v2.8
because FEFO works correctly without it; the backend already accepted
an optional `batch_id` per item.

v2.8.4 then layered policy enforcement on top of the manual-override
path: `record_sale` and `preflight_expired_sale_check` both gate on
the chosen batch's `expiry_date` against the resolved
`expired_sale_policy`. The QA matrix for v2.8.4 §6.9 / §6.10 had to
fall back to direct SQL RPC calls because there was no POS UI to
trigger the manual-override branch.

## Decision

Ship the picker as v2.8.5 polish. Three deliverables:

1. **Schema surface** — `product_with_default_variant` view gains
   `has_batches`; `search_products` RETURNS TABLE gains `has_batches`
   and `default_variant_id`. The picker needs `has_batches` to know
   whether to render the link, and `default_variant_id` because
   single-variant cart lines today carry `variant_id = null` (server
   resolves) — the picker still needs the actual variant id to query
   `inventory_batches`.

2. **Cart model** — `CartItem` gains `has_batches`,
   `resolved_variant_id`, `batch_id`, `batch_no`,
   `batch_expiry_date`. Two new reducer actions: `set_batch` and
   `clear_batch`. `buildItemsPayload()` and the preflight items map
   both conditionally include `batch_id` when set; absent
   `batch_id` keeps FEFO.

3. **UI** — `PosBatchPicker.tsx` dialog. Lists batches from
   `useActiveBatchesForVariant` (already FEFO-ordered). Each row
   shows batch_no, expiry date, qty_remaining; expired rows get a
   red `Badge`; the currently-picked row gets a brand `Badge`;
   batches whose `qty_remaining < line.qty` are dimmed and not
   clickable. A "Reset to FEFO" action clears the override. The
   picker is opened from a "Pick batch" link on each batched cart
   line (visible only when `has_batches = true`); the link is
   disabled when `resolved_variant_id` is null (rare; product
   without an active default variant).

## Alternatives considered

1. **Inline popover instead of dialog.** Less screen real estate, but
   mobile-hostile and the v1.7 design system standardised dialogs as
   the modal-confirmation pattern. Reused.
2. **Auto-open the picker when the cart line spans multiple batches.**
   Rejected — FEFO is the right default for the 95% case; forcing the
   picker would slow down sales. The link is always available.
3. **Gate the picker on the policy** (e.g. hide expired rows when
   `policy = block`). Rejected — the backend already enforces the
   policy at submit time and surfaces the right dialog. Hiding rows
   in the picker would silently constrain the cashier without
   explanation.
4. **Add a separate POS-only RPC for batches.** Rejected — the
   existing `useActiveBatchesForVariant` hook covers it; the v2.8
   batch-picker hook was already built for the deferred UI.

## Consequences

- **Migration 0067** adds two fields to `search_products` and
  `product_with_default_variant`. View change uses CREATE OR REPLACE
  with the new column appended (Postgres views can only add columns,
  not insert mid-list — first attempt failed with `cannot change
  name of view column` when I tried to insert in the middle).
  Function uses DROP + CREATE because the RETURNS TABLE shape
  changed.
- **TypeScript regen** picked up both fields; `ProductSearchRow`
  widened. POSPage handles both ProductSearchRow paths (`handleAddProduct`,
  `handleAddVariant`, `handleAddProductById`) to populate the new
  cart-line fields.
- **Policy enforcement is unchanged.** The picker writes
  `cart.batch_id`; the existing `record_sale` and preflight handle
  the rest. No SQL change to `record_sale`.
- **i18n keys are already present** from v2.8: `pos:cart.batch_label`,
  `pos:cart.batch_oldest`, `pos:cart.batch_selected`,
  `pos:cart.pick_batch`, `pos:cart.reset_to_fefo`, plus
  `pos:cart.batch_expired_label` (added in v2.8.4) and the
  `batches:*` keys for the picker dialog itself.
- **v2.8.4 spec §6.9 / §6.10 can now be tested via the POS UI**
  instead of direct SQL. The QA matrix's RPC walkthrough still
  works as a backend smoke test.
- **Mobile cart-line layout** — the picker affordance row uses
  `flex-wrap` so it stays readable on narrow screens.
- **Deferred-but-now-unblocked:** with the picker shipped, the cart
  EXPIRED indicator (v2.8.4 spec §4.4 second half) is also live —
  the badge renders next to the picked batch_no whenever
  `batch_expiry_date < current_date`.
