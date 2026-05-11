# 0020 — Product detail: full route in `/products`, drawer in POS

**Date:** 2026-05-11
**Ticket:** v2.5
**Status:** Accepted

## Context

Before v2.5, `/products/:id` rendered `ProductFormPage` in edit mode — the
list, the URL, and the edit form were all the same surface. The spec calls
for a proper detail view with the product's fields, packs, and a recent
activity feed, plus an "Edit" affordance.

POS has a different problem. Cashiers tap a product to look at it (check
stock, verify the price the customer is questioning) mid-sale. Navigating
away from the POS page would lose cart state — a serious UX regression.

## Decision

Two surfaces, two patterns:

| Where | Pattern | Why |
|---|---|---|
| `/products` (admin context) | Full page route at `/products/:id`. Browser back works. Deep-linkable. | Owner is in admin context, not transacting. Navigation away is fine. |
| POS module | Right-side drawer (bottom sheet on mobile). | Cart state must survive. Drawer is presentational; the POS page never unmounts. |

The detail body itself is one component (`ProductDetailBody`) so both
surfaces render identically — header card (name, category badge, status,
scan-only badge), fields card (name, category, sell price, stock + pack
compound, avg cost, last purchase, scan-only, description, created, last
updated), an optional packs management section, and a recent-activity feed
of the last 10 stock-ins and sales merged in date-descending order.

Editing on `/products/:id` opens a `ProductEditDialog` modal — modal over
inline-swap because (a) the spec recommended modal for the full-page surface,
(b) the modal contains the v1.5 fields and v2.1's `is_scan_only` toggle plus
v1.5's archive (`is_active`), so it's a focused task and the surrounding
detail context is still visible behind it.

Editing in the POS drawer opens the same `ProductEditDialog` stacked on top
— the drawer doesn't navigate; the modal handles the focused edit; cart is
unchanged when the modal closes.

The drawer's "+ Add to cart" footer button adds one base unit at the catalog
price and closes. Stop-propagation on the product table's actions cell
ensures the existing primary [+] and pack quick-add chips do not also open
the drawer.

## Alternatives considered

1. **Inline form swap on the detail page** (transition the view into edit
   mode in place). Considered per spec, rejected because (a) the modal is
   already the pattern across the app for focused edits, (b) the underlying
   form module already exists and slotting it into a modal is cheaper than
   building a stateful view transition.
2. **A second route `/products/:id/edit`** for the edit form. Rejected:
   adds a route and a back-button surprise (browser back from edit lands on
   detail, then back again lands on list). Modal is one cleaner level.
3. **Use the same right-drawer pattern on `/products`**. Rejected: there is
   no surrounding state to protect, deep-linking to a drawer is awkward,
   and full pages on admin surfaces match the rest of the app
   (`/customers/:id`, `/purchases/:id`).
4. **POS uses a full-screen modal instead of a drawer**. Rejected: drawer +
   sticky footer is the established mobile-friendly pattern; sheet anchors
   `bottom` on mobile and `end` on desktop.

## Consequences

- `paths.productDetail` now renders `ProductDetailPage`, not the form.
- `ProductDetailBody` is reusable; `PosProductDrawer` mounts it with
  `showPacksSection={false}` (the slimmer POS view).
- Cart state lives in `POSPage` reducer; the drawer does not touch it. The
  "+ Add to cart" footer button takes a `productId` and calls back into the
  POS handler — bypassing the drawer's local state entirely.
- The list page's old edit-icon column was dropped along with this change;
  archiving moves into the edit modal's existing `is_active` toggle. See ADR
  0021 for the actions-column rationale.
