# 2026-05-13 — TanStack Query bounded staleness for permission caches

## Context

The client app uses TanStack Query (`@tanstack/react-query`) for
data fetching. Permission state — what the user can / cannot do —
must be cached for responsiveness but invalidated when the owner
changes the user's grants.

Three shapes were offered: (a) real-time invalidation via Supabase
Realtime; (b) bounded staleness (TTL + revalidate-on-focus); (c)
invalidate-on-mutation.

## Decision

**Option (b) — bounded staleness.** TanStack Query config for
permission queries:

```typescript
queryKey: ['permissions', shop_id, target_user_id],
staleTime: 60_000,           // 60 seconds
refetchOnWindowFocus: true,  // catches tab-resume after lunch
refetchInterval: false,      // no polling
```

Owner's session: after a successful `modify_user_permission` /
`apply_preset_to_user` / `update_user_discount_limits` /
`revoke_user_access` / `accept_invitation` / `cancel_invitation` call,
explicitly invalidate `['permissions', shop_id, target_user_id]` AND
`['team', shop_id]`.

Affected user's session (typically different browser tab / device):
no direct invalidation signal. The 60s `staleTime` + window-focus
refetch gives at most 60s of stale "I can do X" UX before the next
fetch reflects the revoked permission. The DB layer enforces
immediately (every RPC re-queries `user_has_permission`), so the
worst case is a UX glitch (enabled button → click returns
`insufficient_permissions`), not a security gap.

## Alternatives considered

1. **Real-time via Supabase Realtime subscription.** Strongest. Cost:
   one WebSocket per active session; per-shop user count (1–10) makes
   this affordable but unnecessary at SMB scale. Upgrade path for
   v2.10 if SMB feedback demands tighter posture.
2. **Invalidate-on-mutation broadcast.** Modifying session
   invalidates its own cache, but the affected user's separate
   session has no signal until window-focus or `staleTime` expiry.
   Same effective behavior as bounded staleness; rejected for added
   complexity.

## Consequences

- 60-second window where UI may show stale "you can do X" between
  permission revoke and next refetch.
- DB enforces immediately; user click on enabled-but-revoked button
  returns the proper `insufficient_permissions` error.
- For SMB threat model (fired salesperson with valid credentials, not
  APT), 60s lag is negligible vs. the dominant Supabase JWT lifetime
  (1h default).
- Phase E UI work implements the `staleTime` + invalidation pattern in
  a `usePermissions` hook.

Related: [[2026-05-13-rbac-permission-model-over-roles]].
