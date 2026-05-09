# 0014 — v1.7 design system acceptance

**Date:** 2026-05-09
**Branch:** `UI-revamp` (43 commits, branched off `dev`)
**Spec:** `MVP_DESIGN_SYSTEM_v1.7.md`

## Context

Closes the v1.7 UI revamp. This ADR walks the spec §16 acceptance criteria line by line against the actual diff, records measured numbers, and lists what's deferred to v1.8.

## Acceptance — spec §16, line by line

| Criterion | Status | Notes |
|---|---|---|
| Skills install status documented | n/a | Spec said proceed without if install fails. Plan adopted that fallback up-front; the optional `frontend-design` / `ui-ux-pro-max` skills were never installed in this round. |
| All color/surface/text/status tokens defined as CSS variables, exposed through MUI, consumed by components | ✅ | `src/styles/tokens.css` (B1). Theme palette literals mirror tokens.css (`HEX` const in `muiTheme.ts`, B2 + post-D4 fix) because MUI's `alpha()` can't parse `var()`. Component sx + styleOverrides consume `var(--token)` directly. |
| No raw hex codes in component files | ✅ (with documented exceptions) | Total hex in code files: **73**. In `tokens.css`: **42** (definitions). In `muiTheme.ts`: **26** (the HEX const mirror — required for MUI palette, see `0013-v17-rtl-residuals.md` rationale). Outside those two: **5 instances across 3 files** — `radio-card/index.tsx` (3), `page-loader.tsx` (1), `global.scss` (1, a comment reference). All five tracked for v1.8 token sweep. |
| Inter loaded for English; Noto Naskh Arabic for Urdu UI; Noto Nastaliq Urdu for Urdu headings | ✅ | `index.html` (B3). `html[lang='ur']` cascading wires the body font (Naskh) and `html[lang='ur'] h1, h2, .display` wires the display font (Nastaliq) per spec §3.1 (B4). |
| Body / table text 15px minimum | ✅ | Theme `body1: 0.9375rem`, `MuiTableCell` font-size override `0.9375rem`. |
| No `text-xs` outside badges and micro-labels | ✅ | One residual 0.75rem use in `POSPage.tsx:410` — the cart-count pill on the mobile bottom bar, which IS a micro-label. Compliant. |
| `<DataTable>` is the single table primitive | ✅ | Used by `/products` (via ProductTable shell), `/sales`, `/customers` list + detail (ledger), `/purchases` list + detail (items + inventory effect), `/expenses`, `/khata`, `/pos` (via ProductTable + Receipt items), `/reports` (4 sections), and `/sales/:id` ledger pane. Mobile collapses to stacked Cards via `mobileVariant='cards'` (default). |
| All forms use `<Field>` with labels, hint, error | ✅ | Customer form, Product form (create + edit), Auth (Login/Signup/Forgot/Reset), Onboarding (2 steps), Targets, Expenses dialog, Khata dialogs (Receive payment, Reverse), Purchases form, POS service-charge / amount-paid / notes. |
| Buttons hit 40×40 minimum touch targets; lg = 44 | ✅ | Theme `MuiButton.root.minHeight: 40`, `sizeLarge.minHeight: 44`. ui/Button(size='lg') used for primary CTAs on auth + POS submit. |
| All interactive elements have visible focus ring using `--focus-ring` | ✅ | Theme MuiButton override applies `boxShadow: var(--focus-ring)` on `&:focus-visible`. Same pattern applied to other interactive primitives via theme. |
| All `ml/mr/pl/pr/left/right` utilities replaced with logical properties | ✅ | E1 + E2 audit. Final greps return **0** for `(margin\|padding)(Left\|Right)`, **0** for positional `(left\|right):`, **0** for literal `anchorOrigin.horizontal: 'left'\|'right'`, **0** for `textAlign: 'left'\|'right'`. |
| axe-core: zero AA failures | ⏳ Deferred | Runtime check; documented in `0013-v17-rtl-residuals.md`. Token contrast pre-verified for primary surfaces (brand-700 on white = ~9.5:1 AAA per spec §2.5). |
| No RPC, route, query-key, or business-logic change | ✅ | Verified: zero changes to `src/lib/`, no edits in `*/hooks.ts` (only consumers updated), no `paths.ts` modifications, no schema changes. |
| All flows from PRD §6 still pass end-to-end | ⏳ Deferred | Runtime check; manual walkthrough required against a Supabase env. |
| Both languages tested visually | ⏳ Deferred | Static RTL audit complete (E1 + E2 + ADR-0013). Visual verification on `lang='ur' dir='rtl'` listed in 0013 for v1.8. |

## Diff stats

- 43 commits on `UI-revamp`.
- New files: `src/styles/tokens.css`, full `src/components/ui/` library (17 primitives + barrel + README), `src/components/layout/` (TopBar, Sidebar, PageHeader + barrel), 2 ADRs (0013, 0014).
- Refactored: `src/theme/muiTheme.ts`, `src/styles/{global.scss,_variables.scss}`, `index.html`, `src/App.tsx`, `src/layouts/AppShell.tsx`, all 14 feature areas under `src/features/`.
- Deleted: `src/components/{NotificationBanner,confirm-dialog/,page-header/,tabs/,SidebarTabs/}` (5 obsolete components, all token-aware replacements landed in `ui/`).
- Build: 1259 modules, 1.22 MB JS bundle (357 KB gzipped). Type-check, lint, and `vitest run` (15/15 tests) all green.

## Deviations from spec

| Area | Spec | We did | Reason |
|---|---|---|---|
| Stack | Tailwind + shadcn/ui | MUI v7 + Emotion + SCSS, ui/ primitives wrapping MUI | Codebase is MUI per ADR-0001 (Tailwind explicitly rejected). Approved up-front in plan. Tokens land via CSS variables exactly as spec describes; only the consuming layer differs. |
| MUI palette | CSS variables | Hex literals (mirrored from tokens.css via a `HEX` constant) | MUI's `alpha()` and `decomposeColor()` choke on `var()`. Component sx + style overrides still use `var(--token)`. Documented in this ADR + comment in `muiTheme.ts`. |
| `Stepper` primitive | Mentioned in spec §6 (no detailed contract) | Used MUI `Stepper` directly inside `OnboardingPage` | Spec gave no shape; the only consumer was Onboarding, so a wrapper would have been overkill. Theme tokens already drive its colors. |
| `Select` primitive | Mentioned in §6 (Radix Select) | Used MUI `TextField select` directly where needed (Sales filters, Expenses category, Khata status, Purchase line-item product) | Spec scope keeps `Combobox` (Autocomplete) but does not commit to a separate Select. Theme drives Select styling already. Tracked for v1.8 if a stronger contract is wanted. |
| `Toast` icons | Spec doesn't prescribe | Kept the existing notistack `iconVariant` SVGs | No-change path; only wrapped in dir-aware `paddingInlineEnd`. |

## Pre-existing copy / behavior tracked for v1.8

These were left alone per spec §12 ("If a current bug is uncovered during migration, file it as v1.8 — do not fix it in this PR"):

- `SettingsPage` title `"actions.edit — Settings"` and `"Settings placeholder — expanded in later milestones."` (hardcoded EN).
- `ReportsPage` outstanding section: `"Customer"` and `"Outstanding"` headers (hardcoded EN; no i18n keys exist yet).
- `error-boundary.tsx` toggle text `"Show details" / "Hide details"` (hardcoded EN).
- LocalizationProvider does not yet pass `adapterLocale='ur'` for DatePicker — Urdu month/day labels will fall back to English.
- mui-tel-input flag dropdown — RTL anchor quirk per spec §3 noted but not visually verified.
- 5 component-internal hex literals (radio-card×3, page-loader×1, the ProductFormPage/MUI palette mirror in muiTheme.ts).
- 7 visually-verifiable RTL items in `0013-v17-rtl-residuals.md`.

## Decision

**v1.7 is acceptance-ready, modulo runtime visual + a11y QA listed under deferred items.** The static foundation is complete: every screen consumes the new design system, no hard-rule violations (RPC/route/query-key/i18n preserved), and the type/lint/build/test pipeline is green.

## Next steps (v1.8 ticket — handed off, not started)

1. Visual QA pass at `<html lang='ur' dir='rtl'>` against the 7 items in `0013-v17-rtl-residuals.md`.
2. axe-core scan on every migrated screen — fix any AA failures.
3. End-to-end PRD §6 acceptance flows on a real Supabase env.
4. Tokenize the 5 residual hex literals.
5. Add i18n keys for the four pre-existing hardcoded EN strings.
6. Set `adapterLocale='ur'` on `LocalizationProvider` when `i18n.language === 'ur'`.
7. Optional: Code-split the 1.22 MB bundle (`build.rollupOptions.output.manualChunks`) — Vite's warning, not a blocker for the design system itself.

## Consequences

- The design-token layer (`tokens.css` + theme integration) becomes the contract for any future v1.8+ visual work. Adding colors / sizes goes via tokens, never via hex.
- The `ui/` library is the entry point for new screens. New components prefer composing existing primitives (`Card + Field + DataTable + Button`) over hand-rolled MUI markup.
- Dir-aware patterns (`useTheme().direction` for anchorOrigin, logical CSS properties for everything else) are the new default — established as a coding rule in `0013-v17-rtl-residuals.md`.
- Dark mode is intentionally out of scope (spec §14). The token layer is forward-compatible: a future `:root[data-theme='dark']` block in `tokens.css` would flip the surface/text tokens without touching components.
