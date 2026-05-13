# 2026-05-12 — Migration 0084: `current_active_shop_id()` grouping bug fix

**Status:** Filed. Immediately superseded by 0085 — captured for the forensic trail.
**Date:** 2026-05-12

## Context

Migration 0070 installed `current_active_shop_id()` as the single runtime resolver for the per-call shop ID. The function first reads the `app-shop-id` HTTP header (the v2.9.1 customFetch path, see [[2026-05-13-v291-customfetch-app-shop-id-header]]); if no header is present, it falls back to a single-shop heuristic: return the user's only shop iff they have exactly one.

The 0070 implementation of the fallback path was:

```sql
return (
  select shop_id from public.user_shop_access
   where user_id = auth.uid()
   group by user_id
  having count(*) = 1
  limit 1
);
```

Postgres rejected this with `42803: column user_shop_access.shop_id must appear in the GROUP BY clause or be used in an aggregate function`. The query groups by `user_id` but selects `shop_id`, which is neither grouped nor aggregated.

The fallback path fires whenever the client does not send `app-shop-id`. That includes:
- All v2.8.5 client code (predates the header).
- All v2.9.1 frontend code before the `customFetch` wrapper lands.
- Any RPC invoked from psql / Studio without a request-headers GUC.

Effect: every RPC that calls `current_active_shop_id()` crashed for the new owner during post-wipe onboarding. The error masked itself behind the wrapper RPC's generic exception path.

## Decision

Patch the fallback to aggregate `shop_id` with `min()` under the same `HAVING count(*) = 1` guard. When the user has exactly one row in `user_shop_access`, `min(shop_id)` returns that single shop ID; otherwise the HAVING filters out the group and the query returns NULL (which the caller already handles as "no shop").

See `supabase/migrations/0084_fix_current_active_shop_id_fallback.sql` for the verbatim DDL.

## Alternatives considered

1. **Switch off the fallback path entirely; require the header on every call.** Rejected. Single-shop owners (the entire v2.9.1 pilot demographic) would never resolve a shop ID until the customFetch wrapper landed. That sequencing would have re-introduced the same kind of breakage the audit pass aims to prevent.
2. **Use `array_agg(shop_id)` from the start instead of `min`.** Considered but not chosen at the time. The reviewer felt `min` was the simpler aggregate. Turned out to be wrong — see Consequences.
3. **Replace the fallback with an explicit `IF (count = 1) THEN SELECT ... LIMIT 1`.** Rejected as more verbose for the same outcome.

## Consequences

**Positive:**
- The grouping syntax error resolves; the function compiles.

**Negative — surfaced immediately:**
- `min(uuid)` is **not** a Postgres built-in aggregate. The function compiled but raised `function min(uuid) does not exist` at first invocation. Migration 0084 fixed the grouping bug but introduced a new runtime error. Hot-patched in the same session by migration 0085.
- This is the final stable form's predecessor only — the live function ends up shaped per [[2026-05-12-mig-0085-current-active-shop-id-array-agg]].

## Discipline lesson

When emergency-patching DEFINER helpers under live traffic, verify the patch end-to-end (not just `CREATE OR REPLACE`'s success). Postgres accepts function bodies whose subexpressions only fail at execution time. `min(uuid)` is a known gap in the built-in aggregate set; the patch author had recall on it once `min(uuid) does not exist` raised but not at write time. Memorialized as a precaution in the hot-patch workflow.

## Bookkeeping

- `supabase/migrations/0084_fix_current_active_shop_id_fallback.sql` — the DDL.
- Predecessor in hot-patch chain: [[2026-05-12-mig-0083-drop-profiles-team-read]].
- Successor (final stable form): [[2026-05-12-mig-0085-current-active-shop-id-array-agg]].
- Bundle context: `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Bookkeeping (lines ~140) lists 0084 + 0085 as part of the four backend hot-patches.
