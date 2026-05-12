# Expired stock as a separate dashboard section (not an extension of expiring-soon)

**Date:** 2026-05-13 (v2.8.3)
**Status:** Accepted

## Context

`batches_expiring_soon` (v2.8 §4.6) covers the preventative window — batches
whose `expiry_date - current_date <= alert_window_days AND expiry_date >= today`.
The day a batch's expiry date passes, it drops off the widget entirely. There
was no surface for "you missed the prevention window — deal with the expired
stock you have." That's a silent accumulation problem.

Two design options:

1. **Extend the expiring-soon widget** to include past-expiry batches (e.g.
   show negative days, group at the top).
2. **Separate dashboard section** for already-expired batches with distinct
   urgency styling and a dedicated bulk action.

## Decision

**Separate dashboard section.** Two reasons:

1. **Different urgency, different visual.** Expiring soon = amber, "be
   aware, plan." Already expired = red/danger, "fix now." Mixing them in
   one widget either washes out the urgency (everything looks amber) or
   makes the amber rows look worse than they are.
2. **Different action.** Expiring-soon = the user might still sell the
   stock before it expires. Already-expired = write off via v2.8.2's
   partial-writeoff flow. The widget's "Write off all..." bulk affordance
   only makes sense on the expired side.

The two views are mutually exclusive by definition (`expiry_date < today`
vs `expiry_date >= today`). Together they cover the lifecycle.

## Alternatives considered

1. **Single widget with negative-days rows at the top.** Visual signal is
   weaker; cashier might not register the urgency jump from "expires in 2 days"
   to "expired 1 day ago." Bulk action becomes mixed-mode (write off only
   the expired ones; act on the soon-to-expire ones differently).
2. **Push expired notifications somewhere else entirely (email / SMS).**
   Out of v2.8 scope; deferred to v2.10+. The dashboard surface is the v2.8.3
   minimum.

## Consequences

- `batches_already_expired` view is a complete analog of `batches_expiring_soon`
  — same column shape minus the alert_window_days field (no window — past
  expiry is past expiry). Both are `security_invoker = true` so the RLS chain
  through variant → product → shop applies automatically.
- The dashboard widget hides when there are zero expired-with-stock batches.
  No celebratory empty state.
- The widget links to a dedicated route `/inventory/expired` for the
  full-list view. Cap on the inline section is 5; the rest are reached via
  "View all" link.
- New audit query checks that the view's filter is in sync with what the
  CLAUDE.md gotcha promises — any future refactor that drifts the two
  is caught.
