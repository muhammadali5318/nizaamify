# 2026-05-12 — Migration 0085: `current_active_shop_id()` array_agg fallback (final stable form)

**Status:** Filed. Final stable form of `current_active_shop_id()` shipped to live.
**Date:** 2026-05-12

## Context

Migration 0084 attempted to fix the grouping bug in `current_active_shop_id()`'s single-shop fallback by aggregating `shop_id` with `min()` (see [[2026-05-12-mig-0084-current-active-shop-id-grouping-fix]]). The grouping syntax error resolved, but the function then raised `function min(uuid) does not exist` at first invocation. Postgres does not ship a built-in `min(uuid)` aggregate.

The chain so far:
- 0070 installed the fallback with a SQL grouping error (`42803`).
- 0084 fixed the grouping bug but used a non-existent aggregate.
- The function still crashed every RPC call for new owners with no `app-shop-id` header.

A type-agnostic aggregate that works for `uuid` without extension installs is `array_agg`. Combined with a `count(*) = 1` guard in the same select, it returns the sole shop ID iff the user has exactly one shop access row.

## Decision

Replace the fallback path with:

```sql
return (
  select case when count(*) = 1 then (array_agg(shop_id))[1] end
    from public.user_shop_access
   where user_id = auth.uid()
);
```

This works for any column type (no `min`-equivalent dependency), uses an implicit single-group aggregation (no GROUP BY needed since both `count(*)` and `array_agg(shop_id)` are aggregates), and returns NULL when the user has zero or 2+ shops — the same semantics the caller expects.

See `supabase/migrations/0085_fix_current_active_shop_id_fallback_v2.sql` for the verbatim DDL.

## Alternatives considered

1. **Cast `shop_id` to text and `min()` it.** Rejected. UUIDs compare lexically as text in ways that don't always match canonical UUID ordering; fragile. Also obscures intent.
2. **Add a custom `uuid_min` aggregate via `CREATE AGGREGATE`.** Rejected. Heavyweight for a single use site. Adds an extension-like surface that future migrations would have to know about.
3. **Use `(select shop_id from user_shop_access where user_id = auth.uid() limit 1)` with a separate count guard.** Rejected. Two scans instead of one; the aggregate path is simpler.
4. **`distinct on (user_id) shop_id ... order by ...` form.** Rejected. Indirect way to express "exactly one"; needs an additional count check anyway.

## Consequences

**Positive:**
- Final stable form. The function compiles and executes successfully for both header path (multi-shop users via customFetch) and fallback path (single-shop owners with no header sent).
- Header-path semantics unchanged from 0070 — the header read, header validation, and `user_has_shop_access` check remain intact (see source file lines 18-37).
- Type-agnostic: if `user_shop_access.shop_id` is ever retyped, the aggregate continues to work without further patching.

**Negative / accepted:**
- Three migrations (0070 → 0084 → 0085) to reach the stable form. The forensic trail is preserved deliberately rather than squashed; future-Claude reading the migration log can see the failure sequence and the [[feedback-synthetic-tests-real-role]] lesson it embodies.
- `array_agg` allocates a single-element array on every fallback invocation. Negligible cost; the fallback is the cold path.

## Discipline lesson

The 0070 → 0084 → 0085 sequence is the canonical example of "synthetic tests don't exercise real planner paths" for v2.9. The 0070 query passed every synthetic test (the test harness was set up to mock the header read, which short-circuited the fallback path). Only live `authenticated`-role traffic with no `app-shop-id` header exercised the bug. This is the lesson recorded in `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Discipline lesson.

For future helper DEFINER functions that have multiple internal branches, write at least one real-role test per branch (not per function). The fallback branch in particular requires a real role with no header in the GUC.

## Bookkeeping

- `supabase/migrations/0085_fix_current_active_shop_id_fallback_v2.sql` — the DDL (final stable form).
- Predecessors in hot-patch chain: [[2026-05-12-mig-0084-current-active-shop-id-grouping-fix]] → [[2026-05-12-mig-0083-drop-profiles-team-read]] → [[2026-05-12-mig-0082-revert-profiles-policy-recursion]].
- Successor: [[2026-05-12-mig-0086-ledger-audit-at-insert]] (closes the same-session four-migration hot-patch chain).
- Bundle context: `decisions/2026-05-12-v2-9-0-1-frontend-sweep.md` §Bookkeeping (lines ~140) groups 0082-0085 as the four backend hot-patches.
- Related: [[2026-05-13-rbac-set-active-shop-fallback-path]] — original ADR establishing the per-call header read pattern.
