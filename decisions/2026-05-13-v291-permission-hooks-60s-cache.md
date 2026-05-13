# v2.9.1 — Permission hooks design + 60s cache window

**Status:** Draft (Phase C). Promoted to filed after C → D gate verification.
**Date:** 2026-05-13
**Related:** [[2026-05-13-rbac-client-cache-staleness-bounded]] (the original v2.9 ADR that locked the 60s bound)

## Context

Every page in v2.9.1 has at least one permission-conditional render point (hide on POS, grey-out on CRUD, hidden section on settings — per B.2). Doing one round-trip per `usePermission(key)` call would be ruinous. The natural pattern: one round-trip per session that returns the full permission map; then all `usePermission(...)` calls are cache reads.

The cache must:
- Refresh fast enough that an owner-driven revoke takes effect within "a reasonable window" but not so fast that staff burn round-trips. The v2.9 ADR locked **60 seconds**.
- Revalidate on window focus (already the project's TanStack default).
- Survive across components without prop drilling.

## Decision

`src/lib/permissions.ts` exports four hooks, all backed by a single TanStack query keyed on `['permissions', 'self', user_id]`:

- `useSelfPermissions()` — the canonical query. Fires once per user-session, refetches on focus or after 60s stale. Returns `Record<permission_key, { granted: boolean, source: string }>`.
- `usePermission(key)` — sync read from the cached result. Returns false while loading (safe default — render nothing, then re-render when data arrives).
- `usePermissions(keys[])` — bulk check; one memoized call regardless of N.
- `useIsOwner()` — checks `source === 'owner_implicit'` on any cached entry; owners get every permission via the server's short-circuit.

The 50 `PERMISSION_KEYS` constants live in the same module and exactly mirror migration 0068's catalog. `PermissionKey` is the TS union type — every `usePermission` call is statically typed against the real catalog.

## Alternatives considered

1. **Per-component `useQuery` calls keyed by permission** — N round-trips per render; obviously bad.
2. **Context provider holding the permission map** — requires the AppShell to fetch and pass it; deeper components must consume context. TanStack Query already memoizes; using it directly is simpler and works at any depth.
3. **Subscribe to permissions via Supabase Realtime** — would close the 60s window. Deferred to v2.10+ per [[v29-rbac-INDEX]] §"Deferred to v2.10+". The cost (Realtime channel per user, server-side row trigger plumbing) is high relative to the marginal benefit when stale-window UX is already surfaced to the owner via the success snackbar (B.6).
4. **Match the project's 5-minute default `staleTime`** — too long for a permission-gated UI. The B.6 snackbar caps perceived staleness at 60s; matching the snackbar to actual cache TTL is honest.

## Consequences

**Positive:**
- One fetch covers ~50 permission checks per page render. Cache resolves them all synchronously.
- Window-focus refetch means a staff member switching from another window to the app sees the new permission map within ~1 second.
- Type-safe: catalog drift between server and client surfaces as a TS error.

**Negative / accepted:**
- 60s window: an owner revokes a permission at T=0; the staff who still has the UI open from T=−10s sees the old UI until T=60s OR they switch windows. Surfaced via B.6 snackbar so the owner sets the right expectation.
- The "loading → render → re-render with permissions" flicker is visible on first paint. Each guard uses `<FullPageSpinner />` while `isLoading` is true; component-level `usePermission` calls return false during load (render the hidden state first, then transition). Acceptable since the load is fast (cached after first call).

## Revisability

Bumping the 60s TTL is a one-line change in `useSelfPermissions`. Adding Realtime would replace `refetchOnWindowFocus` with a Realtime channel subscription; the hook contract for callers doesn't change.
