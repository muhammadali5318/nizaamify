# v2.9.1 — Invitation accept flow: deferred features (password-set, magic-link)

**Status:** Filed. Two-step invitee flow shipped 2026-05-13 in Phase D cluster 4. Programmatic password-set deferred to v2.10.
**Date:** 2026-05-13

## Context

PRD section D.1 + the B.4 layout ASCII mockup ([[2026-05-13-v291-b4-invite-layout-two-column]]) implied an end-to-end "single page accept" flow where the invitee:

1. Lands on `/invite/accept/:invitation_id`.
2. Enters the 4-digit verbal code shared by the owner.
3. Enters a new password (the B.4 mockup included "Set your password" + "Confirm password" fields).
4. Clicks Accept → an account is created (or activated) at the invited email with the chosen password, and the user is logged in to the new shop.

Implementation hit a Supabase reality during Phase D: **programmatic password-set requires the admin API.** The admin API uses the `service_role` key, which is server-side only and must never reach the browser. There is no client-side Supabase method that sets a password for a different user (or even for the current user before they've authenticated).

The available client-side primitives are:

- `supabase.auth.signUp({ email, password })` — creates a new account; sends a verification email; requires the user to have access to that email inbox.
- `supabase.auth.signInWithPassword(...)` — signs in an existing account.
- `supabase.auth.updateUser({ password })` — sets the password of the *currently logged-in* user.

The accept flow needs to either (a) create an account at the invited email and set its password, or (b) match an existing account at the invited email. Option (a) requires admin API. Option (b) requires the invitee to have signed up out-of-band first.

## Decision

**Ship the two-step invitee flow for v2.9.1.** The accept page is code-entry only — no password fields. The owner instructs the invitee:

1. Go to `/signup` with the invited email address; create an account; verify via the standard Supabase email link.
2. Log in at `/login`.
3. Visit `/invite/accept/<invitation_id>` (the URL the owner shared) and enter the 4-digit code.

The accept page (`src/features/team/AcceptInvitationPage.tsx`) requires `useSession()` to return a user. If not authenticated, it redirects to `/login` with a return-URL parameter. After a successful `accept_invitation` RPC, the page self-updates `profiles.onboarding_completed = true` (the `profiles_self_update` RLS policy admits this) so the invitee bypasses the owner onboarding wizard (`RequireOnboarded` would otherwise redirect them).

The two-step sequence is documented in the page's header comment (lines 7-17, see `src/features/team/AcceptInvitationPage.tsx`) and surfaces a "You need to sign up first" inline message + link if the page detects an unauthenticated visitor.

## Alternatives considered

1. **Supabase Edge Function with `service_role` admin API.** Deferred to v2.10. The shape: a `POST /functions/v1/accept-invitation` edge function that runs server-side with `service_role`, accepts the invitation ID + code + new password, calls `supabase.auth.admin.createUser({ email, password, email_confirm: true })` for new accounts (or `auth.admin.updateUser({ password })` for existing), and then calls `accept_invitation` to flip the invitation row. Deferred because (a) edge functions add a deployment surface the v2.9.1 ticket didn't budget for; (b) `service_role` key handling deserves rigor (secret rotation, IP allowlist, audit logging); (c) the two-step workaround is acceptable for the 1-2 shop pilot. This is the v2.10 candidate.
2. **Magic-link email** — Supabase supports `supabase.auth.signInWithOtp({ email })` which sends a magic-link to the invited email. Rejected for v2.9.1. Magic-link flows require an email service infrastructure (custom SMTP or Supabase's bundled email — the latter has rate limits incompatible with onboarding multiple staff per day). The mistyped-email mitigation in [[2026-05-13-rbac-4-digit-code-mistyped-email-mitigation]] explicitly chose verbal-code-over-email to dodge the email-delivery dependency; reintroducing email here would invalidate that decision.
3. **Pre-create the auth account at invitation time** — at the moment the owner sends the invitation, server-side create an unverified account at the invited email with a randomly generated password, then have the invitee reset that password on accept. Rejected. Creating an auth account at invitation time leaks "is this email registered with Nizaamify?" — an enumeration attack. Also: password-reset emails would still require email infrastructure.

## Consequences

**Positive:**
- Ships with the v2.9.1 release. No new infrastructure dependency on edge functions or email service.
- The flow uses primitives every Supabase client supports — `signUp` + `signInWithPassword` + `accept_invitation` RPC. Future Supabase changes to admin API surface won't break the v2.9.1 path.
- The two-step sequence is verbally communicable: owner says "go to nizaamify.com/signup, use this email, then come back and click the invitation link" — a flow most users can follow.

**Negative / accepted:**
- Two-step UX is worse than one-step. The pilot owner must verbally walk the invitee through the sequence (signup first, then accept). Documented in the page header as a known limitation.
- "Sign up at /signup with the invited email" requires the invitee to be told what email to use. The owner already knows; the invitee gets told verbally. Acceptable for pilot scale.
- The invitee gets two emails from Supabase: one verification email at signup, one Welcome/whatever at first login. Cannot suppress without admin API.

## Revisability

The migration path to v2.10's edge-function-based single-page flow is clean:

- Server: add an edge function that calls `auth.admin.createUser` + `accept_invitation` in one transaction.
- Client: `AcceptInvitationPage.tsx` adds password fields back and routes the submit through `fetch('/functions/v1/accept-invitation', ...)` instead of the current `useAcceptInvitation` RPC hook.
- Migration: the RPC stays for backward compat (single-shop users who don't go through the edge function); the edge function wraps it.

No data model change required.

## Bookkeeping

- Source: `src/features/team/AcceptInvitationPage.tsx` header comment lines 1-17 documents this decision inline.
- v2.10 candidate: programmatic password-set via edge function.
- Cross-refs: [[2026-05-13-v291-b4-invite-layout-two-column]] (the layout ADR — the layout still ships even though one column's form is now code-only), [[2026-05-13-rbac-4-digit-code-mistyped-email-mitigation]] (the verbal-code design that this flow inherits), [[2026-05-13-rbac-invitation-snapshot-not-resolved-at-accept]] (the snapshot semantics the `accept_invitation` RPC implements).
- Migration 0088 (`v291_get_invitation_for_acceptance`) is the metadata-read RPC the accept page uses to render shop branding pre-accept.
