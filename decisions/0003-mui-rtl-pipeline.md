# 0003 — MUI RTL pipeline (replaces PRD's Tailwind logical properties)

## Context

PRD §8 prescribes Tailwind logical-property classes (`ms-*`, `me-*`, `ps-*`, `pe-*`) for RTL mirroring. We're using MUI v7 (ADR-0001), so that prescription doesn't apply. MUI mirrors components when `theme.direction === 'rtl'` and stylesheets are processed by `stylis-plugin-rtl`.

## Decision

The RTL pipeline:

1. **Per-direction Emotion caches** — create two `createCache` instances (`ltrCache`, `rtlCache`) at app boot. The RTL cache uses `stylis-plugin-rtl` and `prepend: true`. Swap `<CacheProvider>` based on `i18n.language`. Do NOT rebuild caches on every render — duplicates stylesheets and leaks memory.
2. **Theme as a factory** — `getTheme(direction: 'ltr' | 'rtl')` returns a fresh theme. Re-feed `<ThemeProvider>` on language change.
3. **`<html dir>` and `<html lang>`** — set on the `<html>` element (not `<body>`) for native input alignment and `:dir()` selectors.
4. **MUI X DatePicker** — wrap with `LocalizationProvider`; pass `adapterLocale='ur'` (importing `dayjs/locale/ur`) when language is Urdu. Pickers mirror automatically via `theme.direction`; calendar arrow icons stay visually-anchored (correct for the writing direction).
5. **Placement strings** — use `start`/`end` everywhere (Tooltip, Menu, Drawer, Popover anchor props). Never `left`/`right`.
6. **mui-tel-input flag dropdown** — known anchor quirk in RTL; pass `dir="rtl"` to the TextField slot if it surfaces during the M8 audit.

## Alternatives considered

- **Single Emotion cache, toggle plugins** — Emotion does not support runtime plugin reconfiguration cleanly. Rejected.
- **CSS logical properties (`margin-inline-start`)** by hand — works but leaves MUI's internal `marginLeft`/`marginRight` styles unmirrored. Rejected.
- **Server-side direction (one bundle per language)** — overkill for an SPA on Vercel. Rejected.

## Consequences

- App boot cost: two Emotion caches. Negligible.
- `theme/muiTheme.ts` becomes a factory — every theme consumer must accept that the theme object identity changes on language toggle.
- M8 audit must verify: Drawer side, Menu/Popover anchor, Tooltip placement, DatePicker, mui-tel-input dropdown, dialog action button order.
- All new code uses MUI `sx` with `start`/`end` semantics or relies on MUI's automatic mirroring; no `marginLeft` literals.
