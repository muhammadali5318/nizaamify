# v2.9.1 B.9 — Feature flag rollout: per-shop manual flip

**Status:** Locked in Phase B AskUserQuestion round; ships gated for pilot.
**Date:** 2026-05-13

## Context

The v2.9.1 frontend (team page, invitation accept page, permission-conditional UI, customFetch + `app-shop-id` header) is a meaningful UX shift even for single-owner shops who never use the multi-staff features. The pilot rollout needs to:

- Limit exposure to the first 1–2 shops while the team / invitation flows get real-world traction.
- Allow rapid rollback if a regression appears.
- Avoid coupling the v2.9.1 frontend release to a long-tail "release everywhere" commitment that's harder to reverse than to repeat.

The `RBAC_TEAM_UI_ENABLED` flag was introduced for exactly this purpose. The question for B.9: how is the flag operated?

Phase B candidates via AskUserQuestion:

1. **Deploy-time-for-all** — `RBAC_TEAM_UI_ENABLED=true` in the production environment from the v2.9.1 release moment onwards. Everyone gets the new UI on first reload.
2. **Per-shop manual flip via env var** — `VITE_RBAC_TEAM_UI_ENABLED=true` set per-shop manually via a deploy-only env var. The flag flips for the first 1-2 pilot shops; remove the flag entirely after 30 days stable.
3. **Shop-ID whitelist** — store a list of enabled shop IDs in a runtime config table; check on session start. Allows per-shop flips without redeploys.

## Decision

**Option 2 — per-shop manual flip via build-time env var.** `VITE_RBAC_TEAM_UI_ENABLED=true` is set on the build that ships to the pilot shop. The flag is consumed in `src/lib/featureFlags.ts` (or equivalent module) and read at module-load time. Components import a `isRbacTeamUiEnabled()` boolean and gate the new routes / nav items / hooks behind it.

After 30 consecutive days with no v2.9.1-attributable regressions, the flag is removed entirely (the gated code paths become unconditional). The removal is itself a small ADR-worthy moment to be filed if/when it happens.

## Alternatives considered

1. **Deploy-time-for-all (option 1).** Rejected. The blast radius of an undiscovered v2.9.1 frontend regression includes every active shop. The hot-patch chain documented in [[2026-05-12-mig-0082-revert-profiles-policy-recursion]] through [[2026-05-12-mig-0086-ledger-audit-at-insert]] is exactly the kind of session we don't want to repeat under broader load. Pilot-first rollout limits exposure to a known shop the team has direct rapport with.
2. **Shop-ID whitelist (option 3).** Rejected as overkill for v2.9.1. The whitelist requires:
   - A new config table or env var that's a list (or comma-separated value).
   - Runtime lookup logic with caching considerations.
   - An admin surface to add/remove shops from the list.
   - Decisions about what happens for shops not on the list once v2.9.1 is "stable."

   For the 1-2 shop pilot horizon, build-time env var is simpler — each shop runs its own deployment instance during the pilot anyway. When v2.10 introduces multi-tenant runtime config, the whitelist pattern can be revisited.
3. **Per-user opt-in toggle inside settings.** Rejected. Owners are not in a position to evaluate whether v2.9.1 frontend is "stable enough for them" — they don't have visibility into our regression history. The decision to flip belongs with the development team.

## Consequences

**Positive:**
- The pilot can flip the flag and gather real-world UX feedback in isolation.
- Rollback is simple: rebuild with `VITE_RBAC_TEAM_UI_ENABLED=false` and redeploy. No data migration, no schema change.
- The flag is a build-time constant — no runtime cost, no cache invalidation concerns.

**Negative / accepted:**
- Each pilot shop runs its own build artifact. For 1-2 shops this is fine; for 10+ shops it would become operationally burdensome — which is exactly when the flag should be removed entirely (option 1 by default, with the regressions accumulated and addressed).
- "After 30 days stable" is a vague trigger. Tightened to: 30 consecutive days with zero v2.9.1-attributable regression reports + the pilot owner running >50 invitation-accept and >100 permission-conditional UI events.
- The flag is consumed at module-load time, not per-render. Components added during the pilot must remember to gate behind the flag; the team page lives at `/team` which is route-gated, so the surface area is small.

## Revisability

**Removal milestone:** When the flag is removed (target: 30 days post-pilot start), a follow-up ADR is filed noting the removal date, the regression count over the window, and any UX lessons that didn't make it back into the design system. The flag-removal commit is the only commit that touches `featureFlags.ts` after the pilot starts — it's a one-line change.

## Bookkeeping

- Source: `src/lib/featureFlags.ts` (the flag definition), env var `VITE_RBAC_TEAM_UI_ENABLED`.
- Tracked in `tasks.md` under the v2.9.1 readiness checklist (referenced in [[2026-05-13-v291-mig-0089-update-product-extension]] §Bookkeeping as the "last functional blocker before flag flip").
- Original v2.9 phase-out plan: `decisions/2026-05-13-rbac-deployment-phasing.md` §Stabilization.
- CLAUDE.md "Open ToDos / Known gaps" section notes "RBAC_TEAM_UI_ENABLED stays OFF until v2.9.1" — gets updated to "ON, pilot mode" once flipped.
