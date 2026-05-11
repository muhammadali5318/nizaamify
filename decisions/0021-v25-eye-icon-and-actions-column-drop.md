# 0021 — Eye icon as primary row action; "Actions" column dropped on /products

**Date:** 2026-05-11
**Ticket:** v2.5
**Status:** Accepted

## Context

The product list and POS picker have always made the row's primary action
implicit (clicking the row navigated somewhere different on each surface) or
hidden behind icons crammed into a trailing column. v2.5 moves to a clearer
"view-then-edit" flow: clicking a row opens the detail (full page or
drawer), and edits happen from there.

The spec asks two related questions:
1. What's the explicit row affordance for "open detail"?
2. With edit moved off the list, what does the trailing column on
   `/products` even contain?

## Decision

**Eye icon, leading column.** Every row in `/products` and the POS picker
gets a Lucide-style eye icon (`@mui/icons-material/Visibility`) in a narrow
56 px leading column. Hover shows a "View details" tooltip. Clicking the
icon does the same as clicking the row.

**Actions column dropped on `/products`.** The trailing column on the
products list previously held edit + archive icons. v2.5 removes both:
- Edit is on the detail page (`Edit` button → `ProductEditDialog`).
- Archive happens via the edit modal's `is_active` toggle (which has always
  been the underlying control — only the entry point changes).

The spec offered two options for the trailing column: keep a header-only
placeholder or drop the column entirely. We chose to drop it: less visual
noise, less mystery about what an empty header means, easy to add back when
a real row-level action (e.g. bulk re-categorize) lands.

**Actions column preserved on POS.** POS still uses the trailing column for
the primary [+] add-to-cart button (now center-aligned) and pack quick-add
chips. The column header is "Add to cart". The action cell stops click
propagation so [+] doesn't also open the drawer.

## Alternatives considered

1. **Kebab menu in a trailing "Actions" column on `/products`**. Rejected:
   the only row action would have been "Archive", which is now reachable
   from the edit modal. A kebab for one item is noise.
2. **Empty "Actions" header on `/products`**. The spec's option (a).
   Rejected for the noise reason above.
3. **Eye icon as a trailing affordance**. Rejected: leading position
   matches the "view → row content → row actions" reading flow and gives
   the icon a predictable home regardless of which optional columns are
   visible.
4. **Make the entire row clickable without an explicit icon**. Rejected
   per spec — the icon is an explicit visual hint that the row is
   interactive (otherwise hover styles are the only clue, which fails on
   touch).

## Consequences

- `ProductTable` gains `showViewIcon` + `onView` props. When set, a narrow
  eye-icon column is rendered first; the row's `onRowClick` is wired to
  `onView`.
- The `renderActions` prop is now optional. Omit it (the `/products` page
  does) and the trailing column disappears entirely. POS still passes it.
- POS gains `actionsAlign='center'` and an `onClick={e => e.stopPropagation()}`
  guard inside its `renderActions` Stack so the eye-icon row click and the
  [+] button click stay independent.
- The `products:badges.default_type_warning` "General-type warning" badge
  from v1.5's migration is no longer rendered — it depended on a freetext
  comparison that's meaningless once categories are entities. The key is
  retired from both i18n files.
