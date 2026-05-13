# v2.9.1 — AQ-24 baseline allowlist for legacy `current_shop_id()` callers

**Status:** Draft (Phase C). Promoted to filed after C → D gate verification.
**Date:** 2026-05-13
**Related:** migration 0078 (alias), migration 0087 (Phase C), [[2026-05-13-rbac-set-active-shop-fallback-path]]

## Context

v2.9 migration 0078 created a permanent `current_shop_id()` → `current_active_shop_id()` alias to keep pre-v2.9 callers working (the v2.8.5 frontend, all `_v28` inner functions, several pre-v2.9 views). The alias is documented in [[2026-05-13-rbac-set-active-shop-fallback-path]] as a stabilization-window compatibility shim.

v2.9.1 commits to a discipline rule: **new code must call `current_active_shop_id()` directly**. The legacy alias is grandfathered, not encouraged. To enforce this, Phase A.2 proposed AQ-24: an audit query that flags any SQL object referencing `current_shop_id()` outside the alias itself.

When AQ-24 was first run post-migration 0087, it returned 40 rows. Investigation: all 40 are legitimate pre-v2.9 callers. The query as drafted was too strict.

## Decision

Refine AQ-24 with a baseline allowlist that grandfathers the existing legitimate callers:

```sql
-- AQ-24 (refined): legacy current_shop_id() callers outside the baseline.
SELECT name, kind FROM (
  SELECT p.proname AS name, 'function' AS kind, pg_get_functiondef(p.oid) AS body
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
  UNION ALL
  SELECT v.viewname AS name, 'view' AS kind, pg_get_viewdef(v.viewname::regclass) AS body
    FROM pg_views v WHERE v.schemaname='public'
) x
 WHERE body ~ 'current_shop_id\s*\(\s*\)'
   AND name <> 'current_shop_id'
   AND body !~ 'current_active_shop_id'
   -- Permanent allowlist: _v28 inner functions (ADR: don't touch)
   AND name NOT LIKE '%\_v28' ESCAPE '\'
   -- v2.10 cleanup allowlist: 2 pre-v2.9 views
   AND name NOT IN ('daily_sales_7', 'expenses_by_category_mtd');
-- Should return 0 rows.
```

Two categories of allowlist entries:

1. **Permanent: 38 `_v28` inner functions.** v2.9's wrap-and-rename ADR forbids touching `_v28` bodies. The alias resolves their `current_shop_id()` calls correctly. Allowlisted forever.
2. **v2.10 cleanup: 2 pre-v2.9 views (`daily_sales_7`, `expenses_by_category_mtd`).** Pre-v2.9 dashboard widgets that work via the alias. Tracked in `docs/todos.md`'s "Legacy column / parameter cleanups" section with a v2.10 target: rewrite to use `current_active_shop_id()` directly, then drop from the allowlist.

The refined query lives in `design/2026-05-13-rbac-attack-surface.md` §C.3 alongside AQ-01..AQ-23. New SQL objects that reference `current_shop_id()` will fail the audit.

## Alternatives considered

1. **Mass-rewrite the 38 `_v28` bodies to use `current_active_shop_id()`.** Violates v2.9's wrap-and-rename ADR. Every edit re-opens the conformance audit and risks v2.8-era semantics drift. Hard no.
2. **Drop AQ-24 entirely; rely on social discipline.** Discipline-without-automation rots fast. The audit catches accidental regression in 1 query.
3. **File-based grep CI rule on migration files only.** Catches the diff but not committed code that lived elsewhere (e.g., functions edited via the Supabase UI). The pg_proc / pg_views check sees actual deployed state.

## Consequences

**Positive:**
- New SQL objects that drift from the discipline rule fail the audit immediately.
- The two cleanup-eligible views are documented in `docs/todos.md` so they don't slip.
- The `_v28` permanence is explicit, not implicit; future maintainers don't need to puzzle out why those calls "look broken."

**Negative / accepted:**
- The allowlist is hardcoded. A future cleanup pass that rewrites `daily_sales_7` (per the todos.md entry) requires editing both the migration that rewrites it AND this audit query. Acceptable — the audit query lives in a single source of truth (`design/2026-05-13-rbac-attack-surface.md` §C.3) and the maintainer touching it has the context.

## Revisability

When the 2 view cleanups land (v2.10+), drop those names from the allowlist. The `_v28` allowlist is permanent unless the wrap-and-rename ADR is itself revisited (very unlikely).
