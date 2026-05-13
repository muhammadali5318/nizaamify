# v2.9.1 — customFetch wrapper + `app-shop-id` header transport

**Status:** Draft (Phase C). Promoted to filed after C → D gate verification.
**Date:** 2026-05-13

## Context

v2.9 server-side resolves the active shop per-call via `current_active_shop_id()`, which reads the `app-shop-id` HTTP header out of the `request.headers` GUC. The original v2.9 plan called for a Supabase "Pre-request hook" to inject the header automatically, but the Pre-request hook is a Pro-plan feature; this project is on Free. The fallback path (migration 0085) resolves the shop when the user has exactly one, but does NOT cover multi-shop users.

v2.9.1 needs a client-side transport for the header so multi-shop users can switch shops in the future. v2.9.0.1 surfaced a related concern: real authenticated traffic to the new RPCs uncovered four planner-path bugs (see [[2026-05-12-v2-9-0-1-frontend-sweep]]). Real client traffic from v2.9.1 forward must exercise the header path the same way prod will.

## Decision

Two new tiny modules:

1. `src/lib/activeShop.ts` — localStorage transport (`nizaamify.active_shop_id` key) with getter/setter that swallow exceptions (private-browsing, disabled storage).
2. `src/lib/customFetch.ts` — wraps the default `fetch`, reads the active shop ID from `activeShop.ts`, and adds `app-shop-id: <uuid>` to outgoing request headers. When localStorage is empty, no header is sent and the server falls back to the migration-0085 single-shop path.

The Supabase client is configured with `global: { fetch: customFetch }` so EVERY request — REST, RPC, auth — routes through it.

Switching shops (Phase D.2) writes the new ID via `setActiveShopId()`, invalidates the entire query cache, and redirects to `/dashboard` per B.3.

## Alternatives considered

1. **Supabase Pre-request hook** — Pro-plan only; not available.
2. **Header injection per-call at every hook site** — repetitive, easy to forget, no central enforcement.
3. **Store active shop in React Context only (no localStorage)** — would reset on every page reload; bad UX for the multi-shop owner. Plus the header injection must happen synchronously inside fetch, before React renders.
4. **Use a cookie instead of header** — cookies hit every endpoint including auth, harder to scope. The header is request-scoped and matches the server-side `current_setting('request.headers', true)` read.

## Consequences

**Positive:**
- Every Supabase request automatically carries the active shop. No per-hook plumbing.
- Backward-compatible: single-shop owners (the v2.9.1 pilot) can leave localStorage empty and the server fallback handles them.
- Real client traffic via `customFetch` exercises the same planner path that future multi-shop users will hit. Avoids the v2.9 lesson of "synthetic test passed; real traffic exposed regressions."

**Negative / accepted:**
- The `getActiveShopId()` call runs on every fetch (synchronous localStorage read). Microbench-trivial but technically non-zero.
- Switching shops invalidates the entire query cache. For single-shop users this never fires; for multi-shop users it's the right behavior (cached reads are scoped to the previous shop).
- localStorage is per-origin and per-browser. A user opening the app in two tabs at different shops will see the second tab's localStorage win on focus refetch. Documented; per-tab session state is a Phase D.2 decision (likely: tabs share state via the storage event).

## Revisability

If multi-shop UX needs per-tab isolation, the storage key can swap to `sessionStorage` (per-tab) without touching the customFetch contract. The `app-shop-id` header is the stable wire format; transport can evolve.
