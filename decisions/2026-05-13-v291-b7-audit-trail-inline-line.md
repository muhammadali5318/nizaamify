# v2.9.1 B.7 — Audit trail surfacing: inline "Recorded by" line

**Status:** Locked in Phase B AskUserQuestion round; shipped in Phase D detail pages.
**Date:** 2026-05-13

## Context

Migration 0080 (`v29_audit_by_user_id_writes`) — and the audit-at-INSERT split per [[2026-05-12-mig-0086-ledger-audit-at-insert]] — populates `created_by_user_id` columns on every financial table. The audit data exists; the question for v2.9.1 is how to surface it on detail pages (invoice detail, purchase detail, ledger entry detail, expense detail).

The audit data available in v2.9.1 is creation-only: who created the row and when. There is no edit history, no field-level diff log, no per-update audit — those are v2.10+ work. The UI must not over-promise.

Phase B surfaced three candidates via AskUserQuestion:

1. **Inline line under the header** — "Recorded by {full_name} on {formatted date}" as a single line of plain text, placed directly below the invoice/purchase/etc. header. No interaction.
2. **Collapsible "History" section** — a `<Accordion>` or similar disclosure widget labeled "History" that expands to show a structured timeline. Designed to scale to per-update audit when it lands.
3. **Hover tooltip on the header** — the user's name appears only when hovering the page title; otherwise the audit data is invisible.

## Decision

**Inline line under the header (option 1).** Exact format: `Recorded by {profile.full_name} on {formatDate(created_at)}`. Renders as a single `Typography variant="caption"` line under the page H1, in muted color (`--text-secondary`). Hidden when the audit columns are NULL (rows recorded before migration 0080 / 0086).

Shipped on all v2.9.1 detail pages that have audit columns: invoice detail, purchase detail, expense detail, ledger entry detail, and the team-page invitation detail. Not yet shipped on product / customer detail pages — those are read-mostly surfaces where the audit data is less load-bearing for the pilot; deferred to v2.10.

## Alternatives considered

1. **Collapsible History section (option 2).** Rejected for v2.9.1. The collapsible disclosure widget implies "expand to see more" — but in v2.9.1 there *is* no more. The audit data is creation-only. Building the disclosure UI now would either (a) ship empty disclosure with one line inside (worse UX than the inline line, more chrome), or (b) front-run v2.10's per-update audit pattern with a UI commitment we'd then have to redesign. The collapsible idiom is the right design for the v2.10 timeline view; landing it prematurely commits design space.
2. **Hover tooltip (option 3).** Rejected. Low discoverability. The audit data is genuinely useful — a manager scanning a list of invoices wants to know at a glance who recorded each one. Hiding it behind a hover gesture means most users will never discover it. Mobile devices don't have hover at all; the tooltip would be invisible on touch screens.

## Consequences

**Positive:**
- Audit data is visible at a glance on every detail page. Owner workflows ("who recorded this sale?") are answerable without leaving the page.
- The inline format degrades gracefully when audit columns are NULL — the line simply does not render. No conditional layout chrome.
- The single-line idiom is RTL-safe: `Recorded by {name} on {date}` flips to `{date} پر {name} کے ذریعے ریکارڈ کیا گیا` via the `team` namespace's localized string per [[2026-05-13-v291-b10-i18n-per-feature-namespaces]] (text under the `team_audit` sub-namespace, deferred until needed).
- Easy to extend in v2.10 — when per-update audit lands, the inline line stays and a "View history" link appears next to it, opening the collapsible timeline.

**Negative / accepted:**
- No interaction. The user cannot click the recorder's name to see other rows they recorded. Deferred — would require a list filter the v2.9.1 list pages don't expose.
- The `full_name` lookup requires joining `profiles` from the detail-page query. v2.9.1 detail-page RPCs (`get_invoice_detail`, etc.) join via the `get_team_member_profiles` DEFINER helper (migration 0087) so the join doesn't trip the [[2026-05-12-mig-0083-drop-profiles-team-read]] policy drop.

## Bookkeeping

- Source: each detail page renders the inline line via a shared `<AuditLine recordedByUserId={...} createdAt={...} />` component (location: `src/components/ui/AuditLine.tsx` or equivalent).
- i18n: text lives in the `team` namespace; the deferred `team_audit` sub-namespace per [[2026-05-13-v291-b10-i18n-per-feature-namespaces]] is reserved for the v2.10 timeline view.
- Cross-refs: migration 0080 (the audit pattern), [[2026-05-12-mig-0086-ledger-audit-at-insert]] (the split pattern for append-only tables), [[2026-05-12-mig-0083-drop-profiles-team-read]] (why profiles joins need the DEFINER helper).
