# v2.9.1 — Error dispatch by message text + central errorMap

**Status:** Draft (Phase C). Promoted to filed after C → D gate verification.
**Date:** 2026-05-13
**Related:** task #14 / Phase A.5 ask 2(b)

## Context

The v2.9 RPCs raise 144 distinct controlled error strings across 60 wrappers + 31 `_v28` inner bodies. Every raise uses Postgres SQLSTATE `P0001` (the plpgsql default), regardless of error category — either explicitly via `using errcode = 'P0001'` (60 wrappers, 244 raises) or by omission of the `using` clause (31 `_v28` bodies, 144 raises). The frontend therefore cannot dispatch on SQLSTATE — every controlled error reports as P0001.

The Phase A.5 ask was: "add errcode to every wrapper RPC's RAISE statements so the frontend matches on SQLSTATE." Investigation revealed:
- All 60 outer wrappers already have `using errcode`. They're not the offenders.
- The 144 raises without errcode all live in `_v28` inner bodies. Touching them violates the v2.9 ADR rule that `_v28` bodies are preserved unchanged.

The user, surfaced with this trade-off, chose: status quo + central message-text map + ESLint discipline rule.

## Decision

Frontend dispatches on the **message text** of caught Supabase errors, not SQLSTATE. The dispatch lives in `src/lib/errorMap.ts`:

1. A `ERROR_KEY_MAP: Record<string, string>` containing all 144 server message strings → i18n key strings (under the `common` namespace).
2. `mapErrorToI18nKey(err)` — central dispatcher. Strategy:
   - Try direct match of `err.message`.
   - Strip optional `P0001:` prefix; retry.
   - Fall back to `errors.unknown`.
3. Helper predicates: `isPermissionError(err)`, `isShopAccessError(err)`, `isAuthError(err)`, `getErrorDetail(err)`.
4. EN translations for all 144 keys in `locales/en/common.json`. UR translations for the ~20 most critical (universal + high-traffic POS errors); the rest fall back to EN via i18next's missing-key handler. UR completion is a Phase F polish task.

Hooks that call RPCs catch errors and route the i18n key to the appropriate UX surface (toast per B.5 for `insufficient_permissions`; modal/inline for other categories).

## Alternatives considered

1. **Diversify SQLSTATEs in wrappers only.** Catch the inner P0001 in each wrapper and re-raise with a category-specific custom code (e.g., '45001' for permissions, '45002' for not-found). Cost: ~30 wrappers × ~6 raises = ~180 catch-and-rethrow blocks; each wrapper edit re-opens AQ-23 conformance audit; v2.9 ADR rule says wrappers should be thin around `_v28` bodies — adding rethrow logic breaks that.
2. **Diversify SQLSTATEs everywhere.** Touch all 31 `_v28` bodies + all wrappers. ~388 raises to assign codes to. Violates the `_v28`-preservation ADR; risk of v2.8-era semantics drift in each edit. Rejected.
3. **Drop i18n; surface message-id strings directly.** Faster to ship; loses localization. Pilot is Pakistani shops where UR matters — not acceptable.

## Consequences

**Positive:**
- `_v28` bodies untouched, ADR rule respected.
- One central place to refine wording, add translations, or reorganize categories.
- TypeScript-safe `PermissionKey` union + the central map keep server and client in lockstep: if a new RPC adds an error string, the unknown-fallback path catches it; the discipline is to add an entry to the map at the same time.
- The Revisability path below is real and tested: if maintenance burden grows, we can promote a category to its own SQLSTATE without rewriting frontend dispatch.

**Negative / accepted:**
- A typo or renamed server message silently degrades to `errors.unknown`. Mitigated by the Phase F ESLint rule (TODO — deferred to Phase F since the rule is nice-to-have, not load-bearing for the C → D gate). Until then, manual audit of `errorMap.ts` against `grep -rEoh "raise exception '[a-z_]+'" supabase/migrations/`.
- UR coverage incomplete on day-one ship (~20 / 144 keys). Pilot is owner-only; owners pilot in EN. UR roll-out follows once the team UI ships.

## Revisability

**This decision is explicitly reversible.** If maintenance burden becomes real in v2.9.2 or later, the alternative path remains available:

1. Add `using errcode = '<distinct_code>'` to the 144 `_v28`-body raises in a single migration. Use the Postgres custom SQLSTATE range (e.g., 'P0002'..'P0099') or the user-defined range (45000-45999). Allocate codes per category (permissions, validation, not-found, etc.).
2. Update `mapErrorToI18nKey` to dispatch on SQLSTATE first, falling back to message text for any unmapped code.
3. Drop `ERROR_KEY_MAP` entries that no longer need disambiguation.
4. File the migration ADR; deprecate this ADR.

The central map is the **single point of update** for message-wording / translation changes. We chose status-quo for v2.9.1; we did **not** foreclose the alternative.
