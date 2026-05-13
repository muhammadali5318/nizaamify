# v2.9.1 B.5 — Permission-error surfacing: toast snackbar

**Status:** Locked in Phase B AskUserQuestion round; shipped in Phase C/D.
**Date:** 2026-05-13

## Context

Runtime `insufficient_permissions` errors (raised as `P0001` by `_v28` wrappers — see `2026-05-13-rbac-permission-model-over-roles.md` for the runtime gate) need a UX surface. The v2.9.1 pilot is single-owner shops; the owner has every permission via the implicit shortcut (see [[2026-05-13-rbac-owner-implicit-shortcut]]), so in practice this error fires only when:

- A non-owner staff member (post-pilot) attempts an action their preset doesn't grant.
- A misconfigured permission set leaves the owner without something they should have (data-integrity bug — should not happen, but should surface clearly if it does).
- A v2.9.1 client bug where the UI shows an action button that the server permission gate doesn't admit (visibility hooks should hide the button; if they don't, the toast catches it).

The error message is i18n-keyed via `mapErrorToI18nKey()` (see [[2026-05-13-v291-error-dispatch-message-text]] for the message-text decision). The question for B.5 is *what kind of UX surface displays it*.

Phase B surfaced three candidates via AskUserQuestion:

1. **Toast snackbar** — non-blocking notification at the bottom of the screen, auto-dismisses after 6 seconds, text: "Ask your shop owner to grant you this permission" (or equivalent localized variant).
2. **Modal dialog** — blocking surface that forces acknowledgment with an OK button. Idiom matches "you cannot proceed" outcomes.
3. **Inline-on-button** — render the error text directly under the action button that raised it (e.g. "You don't have permission to record sales" under the disabled-after-attempt button).

## Decision

**Toast snackbar (option 1).** Routed via the existing `NotificationProvider` infrastructure (`src/lib/notifications.tsx`). The toast is dispatched from the central error mapping in `src/lib/errorMap.ts` — any RPC that raises `insufficient_permissions` lands here, regardless of which hook called it.

Message text per locale: english body `Ask your shop owner to grant you this permission.` plus an action chip ("Got it") that dismisses. Urdu equivalent in the `team` i18n namespace per [[2026-05-13-v291-b10-i18n-per-feature-namespaces]].

## Alternatives considered

1. **Modal dialog.** Rejected. Blocking modal for an error the user can do nothing about (they need to ask their owner out-of-band) wastes the user's time. Modals are appropriate for "you can resolve this here" decisions; permission errors are not such.
2. **Inline-on-button.** Rejected. The visibility hooks in v2.9.1 already hide action buttons the user lacks permission for (see [[2026-05-13-v291-permission-hooks-60s-cache]]). If the inline-on-button case ever fires, it indicates a visibility-cache staleness bug — the button shouldn't have been visible. Surfacing the error inline next to the button reinforces "you see this button but can't use it," which is exactly the message the visibility-hook design rules out. The toast is the right surface for the rare misalignment case because it pulls the user's attention to the central notification stack rather than tying the message to the button that should never have been there.

## Consequences

**Positive:**
- Single dispatch point in `errorMap.ts` — every RPC's `insufficient_permissions` lands as a toast without per-hook plumbing.
- Non-blocking. The user can navigate away to ask their owner without dismissing a modal first.
- Locale-correct: the toast surface inherits the i18n + RTL handling from `NotificationProvider`.

**Negative / accepted:**
- A toast that dismisses after 6 seconds may be missed by a user not looking at the screen. Acceptable — the action they attempted didn't succeed, and the next time they try, the toast fires again.
- Multiple rapid permission errors (e.g. a buggy client that retries) would stack toasts. `NotificationProvider` already dedupes by key; permission errors share the same key so only one toast surfaces per error type per dismissal window.

## Bookkeeping

- Source: `src/lib/errorMap.ts` (the central `insufficient_permissions` → toast dispatch), `src/lib/notifications.tsx` (the notification provider).
- Related: [[2026-05-13-v291-error-dispatch-message-text]] (the text), [[2026-05-13-v291-permission-hooks-60s-cache]] (visibility hooks that prevent the toast firing in the common case), [[2026-05-13-v291-b10-i18n-per-feature-namespaces]] (the i18n namespace that holds the message).
- Original RBAC reference: `2026-05-13-rbac-permission-model-over-roles.md` (the `user_has_permission` runtime gate that raises `insufficient_permissions`).
