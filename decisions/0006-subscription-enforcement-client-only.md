# 0006 — Subscription enforcement in client only (MVP); RLS check in Phase 2

## Context

PRD §11 footnote says: enforce subscription status in the client guard and admin actions only — *not* in RLS — for v1. RLS-based subscription checks add a subquery to every domain write and complicate policy SQL.

## Decision

Accept the gap for MVP. The `<RequireActiveSubscription>` guard is the only enforcement point, plus admin-side flips of `subscriptions.status`.

The realistic abuse vectors:

- **A.** A motivated user with the publishable key and project URL bypasses the React guard (e.g., via devtools) and writes after expiry. Likelihood very low — paying offline implies non-technical user.
- **B.** A logged-in session continues to write between expiry tick and next `useEffectiveSubscription` refetch. Mitigation: `staleTime: 5 minutes` + refetch on window focus.

Defense-in-depth deferred: **Phase 2** adds a `check_subscription_active()` SQL function used in `with check` of every domain table's `for insert`/`for update` policy.

## Alternatives considered

- **Add the RLS check now** — extra subquery on every domain write; ~5–20ms overhead per write times every shop; unnecessary complexity for the MVP threat model. Rejected.
- **Service worker that revokes session on expiry** — fights the existing AuthProvider lifecycle; brittle. Rejected.

## Consequences

- A determined user *can* keep writing for the rest of their session after expiry. Mitigated by the session-bound 5-minute staleness window and the next-route redirect.
- The decision is reversible: adding the RLS check is a single migration in Phase 2.
- Document this trade-off in the admin runbook so support knows the abuse profile.
