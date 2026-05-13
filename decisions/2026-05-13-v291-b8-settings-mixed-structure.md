# v2.9.1 B.8 — Settings page structure: mixed (shop vs. team defaults)

**Status:** Locked in Phase B AskUserQuestion round; shipped in Phase D cluster 5.
**Date:** 2026-05-13

## Context

v2.9 introduced shop-wide configuration concerns that did not exist in v2.8.5:

- Per-preset default discount limits (the starting per-line / per-invoice discount caps for the Manager / Salesperson presets) — see [[2026-05-13-rbac-discount-limits-on-user-shop-access]].
- Per-preset default payment cap (the maximum a non-owner can receive in a single `receive_payment` call) — see [[2026-05-13-rbac-receive-payment-cap-applies-to-all-non-owners]].

These are *shop defaults that affect staff*. They are distinct from the existing v2.8 shop-wide settings (alert defaults, expired-sale policy, receipt disclaimer) which affect the shop's data and behavior uniformly regardless of who acts.

The B.8 question: where do these new "staff defaults" live in the Settings IA?

Phase B candidates via AskUserQuestion:

1. **All-in-Settings → Shop** — fold the new staff-default fields into the existing Settings → Shop tab alongside alert defaults / expired-sale policy. One destination for all shop-wide configuration.
2. **All-in-Settings → Team** — surface every shop-wide setting that affects staff (including the v2.8 ones) under a new Settings → Team page. Re-IA the existing fields.
3. **Mixed approach** — keep existing shop-wide settings under Settings → Shop. Add a new Settings → Team destination that houses *only the staff-default fields* (per-preset discount limits, payment cap) under a "Shop defaults" tab inside the Team page.

## Decision

**Option 3 — mixed.** Existing shop-wide settings (alert defaults, expired-sale policy, receipt disclaimer) stay under Settings → Shop, unchanged from v2.8.5. The new staff-default fields live under Settings → Team → "Shop defaults" tab. Team management (invitations, per-user permissions, per-user overrides of the defaults) lives under the same Team page's other tabs ("Members", "Invitations").

## Alternatives considered

1. **All-in-Settings → Shop (option 1).** Rejected. Bundling per-preset discount limits + per-preset payment cap with alert defaults conflates two distinct mental models. An owner asking "what are my shop's alert thresholds?" is in a different mode than "what can my salespeople do?" — co-locating them increases search cost. Also: the discount-limit defaults *interact* with the per-user override UI on the Team → Members page; making the owner navigate from Settings → Shop to Settings → Team to manage related concerns is bad IA.
2. **All-in-Settings → Team (option 2).** Rejected. Re-homing alert defaults / expired-sale policy under "Team" misrepresents what they control. The expired-sale policy applies to *every* sale recorded in the shop, including sales the owner records personally. Calling that a "team setting" is technically wrong and would require future ADR-bookkeeping to justify when staff-vs-shop distinctions matter for other features.

## Consequences

**Positive:**
- Discoverability: the owner navigating to Team finds the staff-default fields adjacent to the team-member management. The mental model "I'm configuring staff" matches the location.
- Shop-wide settings retain v2.8.5 IA — no migration friction for existing owners.
- The "Shop defaults" tab inside Team is a clean home for per-user overrides UX in v2.9.1+: each tab shows the default, then per-user override pills below.
- Forward-compatible with v2.10's "department" or "cashier-shift" concepts — those would live under Team as sibling tabs without affecting Settings → Shop.

**Negative / accepted:**
- Two destinations for "shop-wide configuration" requires two breadcrumbs in support docs. Acceptable — the conceptual separation justifies the IA cost.
- The "Shop defaults" tab inside Team is the page that, conceptually, an owner might first look for under Settings → Shop. Mitigation: Settings → Shop has a brief link/tooltip pointing to "Staff defaults? → Settings → Team → Shop defaults" for the first few weeks of pilot.

## Bookkeeping

- Source: route definitions in `src/router/index.tsx` (the `/settings/team` route with nested tab structure), `src/features/settings/SettingsTeamPage.tsx` (the page).
- Cross-refs: [[2026-05-13-rbac-discount-limits-on-user-shop-access]] (the discount-limit data model), [[2026-05-13-rbac-receive-payment-cap-applies-to-all-non-owners]] (the cap rule), [[2026-05-13-v291-b10-i18n-per-feature-namespaces]] (i18n namespaces for the new Team page strings).
