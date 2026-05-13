# v2.9.1 B.10 — i18n: per-feature namespaces

**Status:** Locked in Phase B AskUserQuestion round; shipped in Phase D (with deferred sub-namespaces).
**Date:** 2026-05-13

## Context

v2.8.5 ships with 14 i18n namespaces (see `CLAUDE.md` §i18n), one per feature domain. v2.9.1 introduces meaningful surface area in three new domains:

- The team management page (Settings → Team) — invitation list, member list, permission editors, per-user override pills.
- The invitation accept page (`/invite/accept/:invitation_id`).
- The TopBar shop switcher (the dropdown for multi-shop users; single-shop owners during pilot don't see it, but the namespace is needed for the chrome).

Plus two domains that don't ship strings in v2.9.1 but are reserved space:

- `permissions` — the 50-permission catalog's human-readable labels for the per-user editor UI. Deferred to a later v2.9.x.
- `team_audit` — the timeline view of per-update audit data (deferred to v2.10 per [[2026-05-13-v291-b7-audit-trail-inline-line]] §Alternatives).

Phase B candidates via AskUserQuestion:

1. **Monolithic `team` namespace** — pile everything (team management UI, invitation accept, shop switcher, audit lines, permission labels) under one big namespace.
2. **Per-feature namespaces** — split into 5 namespaces matching the existing v2.8.5 convention: `team`, `invitation`, `shop_switcher` ship in v2.9.1; `permissions` and `team_audit` are reserved.
3. **Hybrid** — split shippable namespaces (`team`, `invitation`) but pile deferred ones under `team` as sub-keys until they're needed.

## Decision

**Option 2 — per-feature namespaces.** v2.9.1 introduces 5 new namespaces (raising the total from 14 to 19): `team`, `invitation`, `shop_switcher` ship with strings; `permissions` and `team_audit` are created empty (registered in `i18n.ts`'s namespace list) for future use.

Each namespace gets paired `en/<ns>.json` + `ur/<ns>.json` files in `src/locales/`. Empty namespaces ship as `{}` placeholder JSONs so the i18n loader doesn't fail.

## Alternatives considered

1. **Monolithic `team` namespace (option 1).** Rejected. Bundling the invitation accept page strings (which are seen by an unauthenticated invitee before they ever reach the team page) under the same namespace as the team management UI (seen only by authenticated owners) couples two different load contexts. The invitation page would need to load the full `team` namespace bundle including permission editor strings the invitee will never see. Bundle-size concern is small but real; conceptual coupling is bigger.
2. **Hybrid (option 3).** Rejected. The "park deferred strings under `team` until needed" approach kicks the conceptual split down the road. When `permissions` strings land, they'd need a migration from `team.permission_*` keys to `permissions.*` — that's a string-key refactor across every consumer. Better to declare the namespace empty now and populate it later without a key migration.
3. **Add only the 3 shipped namespaces; declare `permissions` and `team_audit` when needed.** Considered. Rejected because declaring them empty now anchors the design intent — future-Claude reading `i18n.ts`'s namespace list sees the full v2.9 i18n footprint, including the deferred surfaces. The cost (5 JSON files of `{}`) is trivial.

## Consequences

**Positive:**
- Follows the v2.8.5 convention: one feature ≈ one namespace. Adding a new feature means adding a new namespace, not extending an existing one.
- The invitation accept page (`src/features/team/AcceptInvitationPage.tsx`) calls `useTranslation('invitation')` (line 45) — bundle-scoped to just the strings it needs.
- The team management page calls `useTranslation('team')` — same scoping.
- The deferred `permissions` and `team_audit` namespaces are declared empty; when the catalog editor UI or audit timeline lands, strings go there directly without a key migration.

**Negative / accepted:**
- Namespace count grows from 14 to 19. Manageable. Each namespace is a JSON file pair (en/ur), and the existing convention scales fine.
- Maintainers must remember to add strings to the right namespace. The convention is sufficiently mechanical (namespace = feature folder name) that this is a low-cognitive-cost decision per string.
- Two empty namespaces in the tree feel like clutter. Acceptable — they're documented placeholders, not orphans.

## Bookkeeping

- Source: `src/lib/i18n.ts` (namespace registration), `src/locales/en/{team,invitation,shop_switcher,permissions,team_audit}.json` + Urdu counterparts.
- Cross-refs: [[2026-05-13-v291-b4-invite-layout-two-column]] (uses `invitation` namespace), [[2026-05-13-v291-b5-error-pattern-toast]] (uses `team` for permission-error strings), [[2026-05-13-v291-b6-cache-stale-window-surfaced]] (uses `team` for stale-window disclosure), [[2026-05-13-v291-b7-audit-trail-inline-line]] (uses `team`; `team_audit` reserved for v2.10 timeline).
- CLAUDE.md §i18n: the 14-namespace count there will need an update when v2.9.1 ships — bookkeeping note recorded.
