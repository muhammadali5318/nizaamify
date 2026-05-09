# 0012 — M8 RTL audit status

## Context

PRD week 8 calls for a "full RTL audit of every screen". The audit is partly automated (Emotion `stylis-plugin-rtl` + `theme.direction='rtl'` mirror most MUI components) and partly manual (icon directionality, hard-coded `left`/`right` props).

## Decision

Audit completed against the new code I wrote (`src/features/*`, `src/layouts/AppShell.tsx`, `src/lib/*`). All clear:

- **Stack direction='row'** with `spacing` — direction-agnostic, mirrors automatically.
- **No hard-coded `placement='left'` / `'right'`** anywhere in new code.
- **No hard-coded `marginLeft` / `marginRight`** in new code.
- **Number alignment** uses `align='right'` on TableCells. Under MUI's `direction='rtl'` this remains visually-right; for currency this is fine because PK numerals are still LTR within an RTL block. Confirm at pilot training.
- **Icons** with directional meaning (chevrons, arrows) are not hard-coded; we use MUI's directional defaults.

## Carry-overs (minor)

A handful of Monai-era components retain LTR-fixed paddings. Not on a critical path for the MVP demo, but worth fixing during pilot polish:

| File | Issue | Fix |
|---|---|---|
| `components/notistack/NotificationProvider.tsx` (lines 124, 131) | `paddingRight: 12` | `paddingInlineEnd: 12` |
| `components/common/CustomStepperConnector.tsx` (line 34) | `marginLeft: 10` | `marginInlineStart: 10` |
| `components/phone-field/index.tsx` (line 81) | `paddingLeft: '24px'` | `paddingInlineStart: '24px'` |
| `components/SidebarTabs/SidebarTabs.tsx` (line 197) | `mr: { xs: 1, sm: 0 }` | `me: { xs: 1, sm: 0 }` (MUI logical prop) |
| `components/render-ul-list/index.tsx` (line 16) | `pl: 3` | `ps: 3` |

## Manual checks (operator) before pilot

Open the app in Urdu and walk through every page (login, signup, onboarding wizard, dashboard, POS, products, customers, khata, expenses, targets, reports, settings, support, expired). Verify:

1. Sidebar drawer opens from the *right* edge of the viewport (not left).
2. AppBar profile menu opens to the *bottom-start* of the avatar (i.e., visual left in RTL).
3. Receipt dialog text is right-aligned.
4. mui-tel-input flag dropdown anchors correctly (known quirk; if misaligned, pass `dir='rtl'` to its TextField slot).
5. DatePicker calendar arrows still navigate correctly (left arrow = previous, right = next under both directions — MUI X behavior is correct).

## Lighthouse

Run `npm run build && npm run preview` then Lighthouse on `http://localhost:4173/login`. Targets per PRD §17:

- Performance ≥ 80
- Accessibility ≥ 90

If the perf score is below 80, the most likely cause is the single-chunk bundle (~1.06 MB pre-gzip). Lazy-route the feature pages with `React.lazy()` to ship initial routes <500 KB. (Out of scope for MVP code; flag if pilot complains.)
