# 0028 — Stock-in: expanding-line fallback chosen over full matrix UX

**Date:** 2026-05-12
**Ticket:** v2.7
**Status:** Accepted

## Context

v2.7 §7 spec describes a stock-in matrix mode: picking a multi-variant
product on a line opens a 2D (or 3D-tabbed) grid; the user fills per-cell
quantity inputs; "Apply matrix" collapses the cells into N stock-in lines
fed to `record_purchase`. §7.6 explicitly authorizes a fallback if the
design system primitives can't carry the matrix cleanly.

The fallback path: "expanding-line pattern" — when a line picks a
multi-variant product, the line expands into a vertical list of variants
with per-variant qty inputs. Same data outcome on submit.

For v2.7 MVP, the fallback delivers the value (per-variant stock-in works)
without the considerable UI complexity of the matrix grid (3D tabs, inline
"+ Add Color value" with `add_variant_value` + `add_variant_to_product`
side effects, per-cell pack unit selection).

## Decision

Implement the v2.7 §7.6 expanding-line fallback. Each multi-variant product
line shows a variant `<Select>` between the product combobox and the unit
selector. The cashier picks one variant per line; for N variants of one
product they add N lines. `record_purchase` accepts `variant_id` per item
(v2.6 ADR-0025).

The full matrix UX is deferred to a follow-up:

- Per-cell qty grid layout
- Per-unit cost vs. per-cell pricing toggle
- Inline `+ Add Color value` that creates the value + the per-row/column
  variants on the spot
- 3-attribute case with tabbed third dimension
- Per-cell unit selector for variants-with-packs (the "tape rolls" case)

## Alternatives considered

1. **Ship the full matrix.** Rejected for v2.7 — the UI scope alone is
   roughly equivalent to the entirety of the rest of v2.7; risks shipping
   a half-baked matrix when the simpler fallback is fully functional.
2. **No stock-in support for multi-variant products in v2.7.** Rejected —
   creating multi-variant products from §6 without a way to receive stock
   for them is a useless feature. The expanding-line pattern makes the
   end-to-end flow work.
3. **Single-variant-only stock-in form, separate flow for multi-variant.**
   Rejected — splits the codebase. The unified line model with an
   optional `variant_id` column is simpler.

## Consequences

- The stock-in form has minimal UI changes: one new dropdown that's
  hidden when the product is single-variant.
- v2.3 largest-remainder overhead allocation works unchanged across the
  resulting lines (one purchase_items row per cell-with-qty is the same
  shape as one line per variant).
- The matrix mode is on the open-todo list. When implemented, it can emit
  the same purchase_items shape — no backend changes needed.
- Documented in CLAUDE.md as a v2.7 polish item.

## References

- `MVP_v2.7_VARIANT_UI.md` §7
- ADR-0025 (RPC contract — variant_id or product_id)
- `LineVariantPicker.tsx`, `NewPurchasePage.tsx` (line state changes)
