# v2.9.1 B.6 — Owner permission-revoke: surface the cache-stale window

**Status:** Locked in Phase B AskUserQuestion round; shipped in Phase D cluster 3.
**Date:** 2026-05-13

## Context

[[2026-05-13-rbac-client-cache-staleness-bounded]] establishes that the client permission cache has a bounded staleness window: TanStack Query's 60-second `staleTime` plus `refetchOnWindowFocus: true`. When an owner revokes a permission from a staff member, the staff member's open browser tab continues to show the revoked permission's UI affordances until the next refetch — at most ~60 seconds after the next focus event.

This is intentional. Real-time invalidation (Supabase Realtime + per-user JWT refresh) is deferred to v2.10. The bounded-staleness compromise was chosen because the server-side permission gate is the authoritative line of defense: even if the staff member's UI still shows the action button, clicking it raises `insufficient_permissions` server-side and the toast (see [[2026-05-13-v291-b5-error-pattern-toast]]) surfaces. The UI is cosmetically stale, never functionally bypassed.

The B.6 question: when the owner revokes a permission, what UX feedback do they see *about the staleness*?

Phase B candidates via AskUserQuestion:

1. **Silent success** — show "Permission revoked" snackbar, say nothing about staleness. The owner doesn't think about timing.
2. **Success + staleness warning** — show success snackbar with appended text: "Affected staff may see stale UI for up to 60 seconds."
3. **Modal confirmation with timing detail** — pre-revoke modal that says "Revoking this permission. Staff currently logged in may see the old UI for up to 60 seconds before refresh. Continue?"

## Decision

**Option 2 — success snackbar with staleness disclosure.** The exact text shipped: "Permission revoked. Affected staff may see stale UI for up to 60 seconds."

The disclosure is appended to the success notification, not gating the action. The owner's revoke succeeds immediately on click; the message educates them about what the affected staff member will experience.

## Alternatives considered

1. **Silent success (option 1).** Rejected. The first time the owner revokes a permission and the staff member doesn't immediately see the change, the owner will think the system is broken. Surfacing the staleness window proactively heads off that confusion. Owner trust in the system matters more than message-stack noise.
2. **Pre-revoke modal confirmation (option 3).** Rejected. Modal-gating every permission revoke is heavy — owners may revoke multiple permissions in one sitting during onboarding-a-new-employee or off-boarding workflows. Forcing a modal per revoke would make the team-management surface feel hostile. The post-action disclosure carries the same information without the friction.
3. **Inline-on-row staleness indicator** (rejected during Phase B brainstorm). Rendering a "stale up to 60s" badge on the permission row itself was considered. Rejected because the staleness applies to the staff member's session, not the row's state — placing the badge on the owner's view of the row was conceptually wrong.

## Consequences

**Positive:**
- The owner is informed about the staleness window without being gated by a modal.
- The disclosure text doubles as documentation: future owners who read it learn "permission changes are not real-time" without needing to consult a help article.
- The "60 seconds" number is the same magic constant the cache uses (see [[2026-05-13-v291-permission-hooks-60s-cache]]) — if the cache TTL ever changes, this string and the hook constant must update in lockstep. Recorded as a `docs/gotchas.md` note.

**Negative / accepted:**
- The snackbar text is longer than a pure-success message. Acceptable; the disclosure is load-bearing.
- The disclosure does not distinguish "staff is online right now" from "staff is offline." A staff member who is offline will see the new permissions instantly on next login; the snackbar still says "up to 60 seconds." Acceptable simplification — over-specifying the timing creates more confusion than it resolves.

## Revisability

When v2.10 ships real-time permission invalidation (Supabase Realtime + JWT refresh), this disclosure becomes obsolete. The snackbar should switch back to silent success. The disclosure text is in the `team` i18n namespace per [[2026-05-13-v291-b10-i18n-per-feature-namespaces]] and can be removed by deleting the key.

## Bookkeeping

- Source: the owner-side revoke hook in `src/features/team/hooks.ts` (the mutation's `onSuccess` handler dispatches the snackbar).
- Cross-refs: [[2026-05-13-rbac-client-cache-staleness-bounded]] (the underlying staleness ADR), [[2026-05-13-v291-permission-hooks-60s-cache]] (the cache TTL), [[2026-05-13-v291-b5-error-pattern-toast]] (the related permission-error pattern).
- i18n key: lives in the `team` namespace (see [[2026-05-13-v291-b10-i18n-per-feature-namespaces]]).
