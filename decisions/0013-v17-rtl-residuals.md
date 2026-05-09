# 0013 — v1.7 RTL audit residuals

## Context

`MVP_DESIGN_SYSTEM_v1.7.md` §10 mandates that every screen render correctly in `<html lang="ur" dir="rtl">`. The v1.7 revamp tightens the RTL pipeline (logical CSS properties, dir-aware anchors). This ADR records what's been **statically verified**, what's been **fixed**, and what genuinely requires **runtime visual verification** that the code-only revamp couldn't cover.

## What's verified static

Final greps across `src/` after Phase E1 (logical-property sweep) + E2 (RTL audit) return:

- `(margin|padding)(Left|Right):` — **0 instances**
- `(left|right):` positional CSS — **0 instances** (all converted to `inset` / `insetInline*`)
- `anchorOrigin/transformOrigin` with literal physical `horizontal: 'left'|'right'` — **0 instances** (all dir-aware via `useTheme().direction` or `i18n.dir()`)
- `textAlign: 'left'|'right'` — **0 instances** (all replaced with `'start'`)
- `Drawer anchor=` — only `'bottom'` (POS mobile cart) and the default in `ui/Drawer` (also bottom). MUI Drawer with `anchor='left'/'right'` does NOT auto-flip in RTL; ours sticks to logical anchors.

The MUI theme factory `getTheme(direction)` is fed `i18n.language === 'ur' ? 'rtl' : 'ltr'` from `App.tsx`. Emotion cache is rebuilt per direction (`stylis-plugin-rtl` for RTL). `<html lang>` and `<html dir>` are set by `applyHtmlLangDir` in `src/lib/i18n.ts` and re-applied on every language change.

## Components fixed during E1 + E2

| File | Issue | Fix |
|---|---|---|
| `phone-field/index.tsx` | `paddingLeft: '24px'` for flag chip clearance | `paddingInlineStart: '24px'` |
| `notistack/NotificationProvider.tsx` | `paddingRight: 12` on toast icon imgs | `paddingInlineEnd: 12` |
| `notistack/NotificationProvider.tsx` | `anchorOrigin.horizontal: 'right'` (literal) | dir-aware via `i18n.dir()` |
| `common/CustomStepperConnector.tsx` | `marginLeft: 10` (vertical orientation) | `marginInlineStart: 10` |
| `common/SplashScreen.tsx` | `right: 0 / bottom: 0 / width: 1 / height: 1` | `inset: 0` |
| `common/page-loader.tsx` | `top: 0 / left: 0 / width: 100% / height: 100%` | `inset: 0` |
| `features/pos/POSPage.tsx` | mobile bottom-bar `left: 0 / right: 0` | `insetInline: 0` |
| `date-range-selector/index.tsx` | 4× `left:`/`right:` for range-fill pseudo-elements | `insetInlineStart` / `insetInlineEnd` |
| `date-range-selector/index.tsx` | `anchorOrigin.horizontal: 'left'` (Popover) | dir-aware via `useTheme().direction` |
| `ui/DataTable.tsx` | row-actions Menu `anchorOrigin.horizontal: 'right'` | dir-aware via `useTheme().direction` |
| `common/error-boundary.tsx` | `textAlign: 'left'` on error log | `textAlign: 'start'` |
| `radio-card/index.tsx` | `textAlign: 'left'` | `textAlign: 'start'` |
| `features/products/ProductFormPage.tsx` | `<Divider textAlign='left'>` (MUI's `textAlign` doesn't accept `'start'`) | replaced with `Typography(textAlign:'start')` + plain `<Divider>` |

## Residuals — need runtime visual QA on `<html lang="ur" dir="rtl">`

The code is RTL-clean per static analysis, but these patterns are **only verifiable visually**. None of them block the v1.7 design-system landing; they are tracked here for v1.8 sweep-up.

1. **Directional icons.** Spec §10 says "Mirror directional icons (chevrons, arrows, 'back') in RTL." Audit list — verify each renders correctly mirrored (or at all):
   - `<ExpandMoreIcon>` / `<ExpandLessIcon>` in `CustomerForm.tsx` (Show more fields toggle) — non-directional, no mirroring needed.
   - `<ArrowDropDown>` in `phone-field/index.tsx` — non-directional.
   - `<UndoIcon>` in `CustomerDetailPage.tsx` (reverse ledger entry) — directional curl; some RTL designs mirror, others don't. Verify.
   - `<RefreshIcon>` in `SubscriptionExpiredPage.tsx` — circular, non-directional.
   - `<MoreVertIcon>` (kebab) — non-directional.
   - "Back" buttons across detail pages: currently use `<Button variant='ghost'>` with text only ("Back"). No physical icon; safe.

2. **mui-tel-input flag dropdown anchor.** Spec §3 RTL note: "mui-tel-input flag dropdown — known anchor quirk in RTL; pass `dir='rtl'` to the TextField slot if it surfaces during the M8 audit." Not yet verified on `lang='ur'`.

3. **MUI X DateCalendar / DatePicker.** Picker mirrors automatically via `theme.direction`, but month-navigation arrows and week-start need a quick eyeball. The `LocalizationProvider` does not currently set `adapterLocale='ur'` when language is Urdu — a separate gap (spec §3 RTL): tracked for v1.8.

4. **Bottom-sheet Drawer dismissal direction.** `ui/Drawer` `anchor='bottom'` is physical-vertical so it's dir-agnostic. The mobile POS cart drawer should still be visually verified for Urdu — its inner content uses logical CSS but the title row's close button alignment relies on flex which is auto-flipping in RTL.

5. **Sidebar 3px leading accent bar.** `Sidebar.tsx` uses `insetInlineStart: 0` for the active-route bar. This should appear on the right edge in RTL — verify.

6. **TopBar Avatar + LanguageSelector** sit at `marginInlineStart: 'auto'` (logical). Avatar mint-on-navy contrast already token-driven; LanguageSelector inherits text + border color from the dark TopBar via the `color: 'inherit'` styling added in D17.

7. **DataTable row hover & active states.** `borderInlineStart: '3px solid var(--brand-700)'` on the active row's first cell. In RTL the first DOM cell is on the visual right — the bar should still appear at the leading visual edge, but verify (this depends on whether MUI flips the table cell ordering or just the alignment).

8. **Pre-existing hardcoded English copy** (out of scope for v1.7, file for v1.8 i18n cleanup):
   - `SettingsPage.tsx` — `"Settings placeholder — expanded in later milestones."` and `"— Settings"` suffix.
   - `ReportsPage.tsx` — `Customer` and `Outstanding` headers in the outstanding-balances section.
   - `error-boundary.tsx` — `"Hide details"` / `"Show details"`.

## Decision

Ship v1.7 with the static-clean RTL state above. Open a v1.8 ticket "RTL visual sweep" that walks all 14 migrated screens at `<html lang='ur' dir='rtl'>` and verifies items 1–7 in this list visually, plus the pre-existing copy (item 8) and the LocalizationProvider Urdu locale.

## Consequences

- Anyone touching `anchorOrigin` / `transformOrigin` / `Drawer anchor` props from now on must use a dir-aware value, not a literal physical one. Helper pattern: `const { direction } = useTheme(); const horizontal = direction === 'rtl' ? <flip> : <orig>`.
- New CSS that needs to mirror should use `insetInlineStart/End`, `marginInlineStart/End`, `paddingInlineStart/End`, `borderInlineStart/End`, `textAlign: 'start'/'end'`. Never literal `left`/`right`.
- The v1.8 RTL pass shouldn't surprise — the static foundation is strong; only visual subjective items remain.
