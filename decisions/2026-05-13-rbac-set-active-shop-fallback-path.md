# 2026-05-13 — `set_active_shop` deployed via fallback path (no pre-request hook)

## Context

Phase B §B.2.0a hybrid mechanism specified that multi-shop users
select an active shop via a per-request HTTP header `app-shop-id`.
Two implementations of "header → session state" were possible:

1. **Pre-request hook (Phase B preference):** a Supabase PostgREST
   pre-request function `pre_request_set_active_shop()` runs before
   every request, reads the header, validates membership, and sets
   the `app.shop_id` session variable via `set_config`. RLS policies
   and helper functions read `current_setting('app.shop_id')` once.
2. **Fallback (Phase C §D.3.2.1):** `current_active_shop_id()` reads
   the header directly via `current_setting('request.headers', true)
   ::jsonb ->> 'app-shop-id'` per call. No session variable; no
   pre-request hook config needed. Membership validation inside the
   helper body.

Phase D §D.3.2 required a tier-availability check of the Pre-request
hook capability before migration 0068.

## Decision

Deploy the **fallback path** (option 2) for v2.9.

Reasoning:
- The Supabase project is on Free tier (verified via MCP
  `get_organization`: plan = "free"). Pre-request hook availability on
  Free tier is plausible per Supabase documentation but not
  empirically verifiable through the available MCP tool surface
  (no Management API tool exposed; dashboard access not available
  from automation).
- The fallback is functionally equivalent for security: header is
  read on every PostgREST request; membership is validated; invalid
  states raise the same errors (`invalid_app_shop_id_header`,
  `no_access_to_shop`).
- The fallback eliminates the manual deploy step (configuring the
  Supabase project's "Pre-request function" setting) that Phase D
  flagged as the only out-of-migration action item.
- Cost: ~1ms extra per call (one JSONB parse). At SMB scale (100–500
  shops × 1–10 users × tens of RPC calls per session-minute) the
  cost is negligible.
- Upgrade path: v2.10+ can switch to the pre-request hook by
  replacing `current_active_shop_id()` body with a session-variable
  reader and adding the `pre_request_set_active_shop` function +
  configuration. No client changes needed; the header injection
  stays identical.

## Alternatives considered

1. **Pre-request hook (original Phase B plan).** Functionally
   preferred for the call-count optimization. Rejected for v2.9
   because the tier-verification step is non-automatable; deploying
   the fallback is the conservative choice that needs no
   verification gate.
2. **Pass shop_id as explicit RPC parameter.** Considered. Bloats
   every signature with `p_shop_id uuid`. Defers shop-membership
   validation to every RPC body. Rejected: more error-prone and
   verbose than reading a header.
3. **Per-request session-variable set via inline RPC.** Considered.
   The client would call `set_active_shop(uuid)` before every
   functional call. Doubles round-trips; the variable lifetime
   across PostgREST connection-pool boundaries is unreliable.
   Rejected.

## Consequences

- Migration 0070 creates `current_active_shop_id()` with the
  fallback body (per-call header read + validation + single-shop
  fallback). Does NOT create `pre_request_set_active_shop()`.
- No manual Supabase dashboard step on Deploy Day.
- Phase D §D.3.2 pre-deployment checklist item "configure
  pre-request" is REMOVED.
- Client side unchanged: customFetch wrapper writes `app-shop-id`
  header from localStorage on every request.
- `set_active_shop(uuid)` RPC retained as the explicit "validate
  this shop is mine" call from the client's shop-switcher UI. It
  validates membership but does NOT persist (the localStorage is
  the durable side; the header is the per-request transport).
- Per-call cost: one `current_setting('request.headers', true)::jsonb
  ->> 'app-shop-id'` per RLS evaluation and per RPC invocation.
  Postgres caches the JSONB parse within a query plan via the
  STABLE attribute.
- Phase B §B.2.0a helper (3) and (4) bodies updated to reflect the
  fallback path. The `current_shop_id()` v2.8.5 body remains
  preserved per [[2026-05-13-rbac-permission-model-over-roles]]
  deny-wins safety.

Related: §D.3.2.1 in `design/2026-05-13-rbac-implementation-plan.md`
defines the fallback SQL. Supersedes the original
`2026-05-14-rbac-set-active-shop-header-pattern.md` slot in the
v29-rbac-INDEX.
