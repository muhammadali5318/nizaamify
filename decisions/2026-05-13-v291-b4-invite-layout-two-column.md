# v2.9.1 B.4 — Invitation accept page: two-column with shop branding

**Status:** Locked in Phase B AskUserQuestion round; shipped in Phase D cluster 4.
**Date:** 2026-05-13

## Context

`/invite/accept/:invitation_id` is the page an invited staff member lands on after their owner shares the invitation URL + 4-digit verbal code (see [[2026-05-13-rbac-4-digit-code-mistyped-email-mitigation]]). It is the first surface the new staff member sees in the app, before they ever see the dashboard. The page must:

- Communicate *what they are joining*: shop name, who invited them, what preset (Manager / Salesperson) was selected.
- Communicate *how to proceed*: 4-digit code entry, accept button, error messaging on mistyped code / expired invite / 5-strike auto-cancel.
- Work for both LTR (English) and RTL (Urdu) without layout breakage.
- Carry shop-branding signal so the invitee trusts the URL is legitimate — phishing concerns exist when an owner shares a raw URL outside the app.

Phase B surfaced three layout candidates via AskUserQuestion:

1. **Two-column with shop branding** — left column shows shop name + inviter + preset badge against the standard ambient amber surface; right column shows the code form + accept button.
2. **Single-column mobile-first** — vertical stack: shop branding header, then code form below. Works equally on mobile and desktop.
3. **Modal overlay on top of a backdrop** — the page mounts an `/login`-style backdrop with the accept form in a centered card; treats accept as a "system intervention" surface.

## Decision

**Two-column with shop branding (option 1).** Left column = shop identity (name, inviter, preset). Right column = code entry + accept button.

Implemented in `src/features/team/AcceptInvitationPage.tsx` (header comment lines 1-17 records the decision rationale inline). On mobile, the two columns collapse to a vertical stack via MUI's `Stack` direction-responsive prop; the visual hierarchy (identity first, action second) is preserved on small screens.

## Alternatives considered

1. **Single-column mobile-first.** Rejected. The page is overwhelmingly desktop-first traffic — owners share the URL with staff who type it into a desktop browser at the shop. The desktop variant of single-column wastes the horizontal real estate that would otherwise surface the shop branding prominently. The mobile fallback for the two-column layout already collapses to a single stack, so this option's only real advantage (mobile UX) is covered.
2. **Modal overlay on a backdrop.** Rejected. Modal framing implies "you're already inside the app and this is a system intervention." For an invitee whose first contact with the app is this page, the modal idiom is wrong — there's nothing to overlay on top of. The backdrop adds visual chrome without communicating "you are joining a shop." Also: modal patterns conflict with the body amber-glow design language (the backdrop kills the glow per the design system rules in `CLAUDE.md`).

## Consequences

**Positive:**
- The invitee sees the shop they are joining before they take any action. Reduces the phishing risk identified in [[2026-05-13-rbac-4-digit-code-mistyped-email-mitigation]].
- Two-column visual hierarchy maps cleanly to "context → action" — a familiar pattern from `/onboarding` and `/login`, which share visual idiom.
- The shop-branding column accommodates a future shop-logo upload (deferred to v2.10+) without layout change.

**Negative / accepted:**
- Slightly more layout code than the single-column variant. Two `Stack`s + a responsive direction prop vs. a single vertical stack. Cost is small.
- The two-column layout requires that `get_invitation_for_acceptance` returns the shop name + inviter name + preset *before* the invitee enters the code. Migration 0088 (`v291_get_invitation_for_acceptance`) was shaped to return this metadata on email match (the email-match gate prevents leakage of shop identity to attackers who guess the URL).

## Revisability

The layout is local to `AcceptInvitationPage.tsx`. Swapping to single-column or modal is a one-file change. The decision is locked for v2.9.1 pilot; if pilot UX feedback signals a different idiom, v2.10 can swap without contract impact.

## Bookkeeping

- Source: `src/features/team/AcceptInvitationPage.tsx` lines 1-17 (header comment) and the JSX layout below.
- Related: [[2026-05-13-rbac-4-digit-code-mistyped-email-mitigation]] (the 4-digit verbal code mechanism); [[2026-05-13-v291-invite-accept-deferred-features]] (the password-set deferral that shaped what the page can/can't do); migration 0088 `v291_get_invitation_for_acceptance` (the metadata read RPC).
