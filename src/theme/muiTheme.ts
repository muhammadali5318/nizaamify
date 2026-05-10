import { createTheme, type Theme } from '@mui/material/styles'
import type { CSSProperties } from 'react'

declare module '@mui/material/styles' {
  interface TypographyVariants {
    displayLg: CSSProperties
    display: CSSProperties
    bodyLg: CSSProperties
    bodySm: CSSProperties
  }
  interface TypographyVariantsOptions {
    displayLg?: CSSProperties
    display?: CSSProperties
    bodyLg?: CSSProperties
    bodySm?: CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    displayLg: true
    display: true
    bodyLg: true
    bodySm: true
  }
}

const v = (token: string) => `var(${token})`

// Palette values must be literal (#hex / rgb / hsl) because MUI runs
// `alpha()` and `decomposeColor()` on them when computing hover, focus,
// and disabled states (e.g. inside MuiIconButtonRoot). CSS variables fail
// at runtime there. These constants mirror tokens.css 1:1 and must be
// kept in sync if a token's value changes. Component-level styleOverrides
// and any `sx` styling can still consume `var(--token)` freely — those are
// just CSS strings, never parsed.
const HEX = {
  // v2.4: amber brand scale (mirrors tokens.css). Component-level styling
  // uses var(--brand-*) directly; these literals are only for MUI palette
  // values that go through alpha()/decomposeColor().
  brand300: '#FCD34D',
  brand400: '#FBBF24',
  brand500: '#F59E0B',
  brand600: '#D97706',
  brand700: '#B45309',
  brand800: '#92400E',
  brand900: '#78350F',
  brand950: '#451A03',
  neutral0: '#FFFFFF',
  neutral50: '#FAFAF9',
  neutral200: '#E5E5E2',
  neutral400: '#9CA0A0',
  neutral700: '#353A3D',
  neutral900: '#13171A',
  success100: '#DCFCE7',
  success500: '#16A34A',
  success700: '#166534',
  warning100: '#FEF3C7',
  warning500: '#F59E0B',
  warning700: '#B45309',
  error100: '#FEE2E2',
  error500: '#DC2626',
  error700: '#991B1B',
  info100: '#DBEAFE',
  info500: '#2563EB',
  info700: '#1E40AF'
} as const

export type ColorMode = 'light' | 'dark'

export function getTheme(
  direction: 'ltr' | 'rtl',
  mode: ColorMode = 'light'
): Theme {
  const isDark = mode === 'dark'
  // Background + text need different literal values for MUI's `alpha()` calcs
  // (raw hex, not CSS variables). Token-driven CSS still flips automatically
  // via [data-theme="dark"] in tokens.css; this map is only for MUI internals.
  const bgDefault = isDark ? '#0F1112' : HEX.neutral50
  const bgPaper = isDark ? '#171A1C' : HEX.neutral0
  const textPrimary = isDark ? '#F4F5F6' : HEX.neutral900
  const textSecondary = isDark ? '#C7CDD0' : HEX.neutral700
  const textDisabled = isDark ? '#6B7479' : HEX.neutral400
  const divider = isDark ? 'rgba(255,255,255,0.10)' : HEX.neutral200
  return createTheme({
    direction,
    breakpoints: {
      values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 }
    },
    palette: {
      mode,
      // Bright amber (brand-500) is the primary CTA in BOTH modes — the
      // light-mode brand-700 was too brown and muddied highlighted text.
      // Contrast text is dark in both modes so the on-amber label reads
      // against the bright bg. `dark` (MUI's hover/active variant) goes
      // deeper in light mode and brighter in dark mode, since hover on a
      // bright bg should *intensify* rather than darken.
      primary: {
        main: HEX.brand500,
        dark: isDark ? HEX.brand400 : HEX.brand600,
        light: isDark ? HEX.brand300 : HEX.brand400,
        contrastText: '#1A1308'
      },
      secondary: {
        main: HEX.brand400,
        dark: HEX.brand500,
        light: HEX.brand300,
        contrastText: '#1A1308'
      },
      error: {
        main: HEX.error500,
        dark: HEX.error700,
        light: HEX.error100,
        contrastText: HEX.neutral0
      },
      warning: {
        main: HEX.warning500,
        dark: HEX.warning700,
        light: HEX.warning100,
        contrastText: HEX.neutral900
      },
      success: {
        main: HEX.success500,
        dark: HEX.success700,
        light: HEX.success100,
        contrastText: HEX.neutral0
      },
      info: {
        main: HEX.info500,
        dark: HEX.info700,
        light: HEX.info100,
        contrastText: HEX.neutral0
      },
      background: {
        default: bgDefault,
        paper: bgPaper
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
        disabled: textDisabled
      },
      divider,
      common: { black: '#000', white: HEX.neutral0 }
    },
    shape: { borderRadius: 8 },
    typography: {
      // 'inherit' lets html[lang="ur"]/[lang="en"] CSS scoping pick the right font family.
      fontFamily: 'inherit',
      fontSize: 15,
      htmlFontSize: 16,
      fontWeightLight: 400,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 600,
      // Spec §3.2 scale — MUI variants mapped to design-system tokens.
      displayLg: { fontSize: '2rem', lineHeight: 1.2, fontWeight: 600 },
      display: { fontSize: '1.75rem', lineHeight: 1.25, fontWeight: 600 },
      h1: { fontSize: '1.5rem', lineHeight: 1.3, fontWeight: 600 },
      h2: { fontSize: '1.25rem', lineHeight: 1.35, fontWeight: 600 },
      h3: { fontSize: '1.125rem', lineHeight: 1.4, fontWeight: 600 },
      h4: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 600 },
      h5: { fontSize: '0.9375rem', lineHeight: 1.5, fontWeight: 600 },
      h6: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 600 },
      subtitle1: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 500 },
      subtitle2: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 500 },
      bodyLg: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 400 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.5, fontWeight: 400 },
      body2: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 400 },
      bodySm: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 400 },
      caption: { fontSize: '0.8125rem', lineHeight: 1.4, fontWeight: 500 },
      overline: {
        fontSize: '0.75rem',
        lineHeight: 1.3,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      },
      button: { fontSize: '0.9375rem', fontWeight: 500, textTransform: 'none' }
    },
    shadows: [
      'none',
      'var(--shadow-xs)',
      'var(--shadow-sm)',
      'var(--shadow-sm)',
      'var(--shadow-md)',
      'var(--shadow-md)',
      'var(--shadow-md)',
      'var(--shadow-md)',
      'var(--shadow-lg)',
      'var(--shadow-lg)',
      'var(--shadow-lg)',
      'var(--shadow-lg)',
      'var(--shadow-lg)',
      'var(--shadow-lg)',
      'var(--shadow-lg)',
      'var(--shadow-lg)',
      'var(--shadow-xl)',
      'var(--shadow-xl)',
      'var(--shadow-xl)',
      'var(--shadow-xl)',
      'var(--shadow-xl)',
      'var(--shadow-xl)',
      'var(--shadow-xl)',
      'var(--shadow-xl)',
      'var(--shadow-xl)'
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: v('--surface-subtle'),
            color: v('--text-primary')
          }
        }
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
            minHeight: 40,
            transition: `all var(--duration-fast) var(--ease-out)`,
            '&:focus-visible': { boxShadow: v('--focus-ring') }
          },
          sizeSmall: { minHeight: 32, paddingInline: 12 },
          sizeLarge: { minHeight: 44, paddingInline: 20 }
        }
      },
      MuiTextField: {
        styleOverrides: { root: { borderRadius: 8 } }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: v('--surface-base'),
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: v('--border-focus')
            }
          },
          notchedOutline: { borderColor: v('--border-default') }
        }
      },
      MuiInputBase: {
        styleOverrides: { root: { borderRadius: 8 } }
      },
      MuiSelect: {
        styleOverrides: { outlined: { borderRadius: 8 } }
      },
      // ---------- Dropdown / popover container ----------
      // Shared styling for every popup: Select dropdowns, MenuList,
      // profile menu Popper, etc. Larger radius matches the card
      // language; amber-tinted shadow ties the popup to the page glow.
      // Inner padding gives items room to breathe and rounded item
      // pills land nicely against the edge.
      MuiMenu: {
        defaultProps: { transitionDuration: 160 },
        styleOverrides: {
          paper: {
            borderRadius: v('--radius-lg'),
            border: `1px solid ${v('--border-default')}`,
            boxShadow: v('--shadow-card'),
            backgroundColor: v('--surface-card'),
            backgroundImage: 'none',
            paddingBlock: 6,
            paddingInline: 6,
            backdropFilter: 'saturate(160%)'
          },
          list: {
            paddingBlock: 0
          }
        }
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: v('--radius'),
            paddingBlock: 8,
            paddingInline: 12,
            marginBlock: 2,
            fontSize: '0.9375rem',
            transition:
              'background-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
            '&:hover': {
              backgroundColor: v('--surface-muted')
            },
            '&.Mui-selected': {
              backgroundColor: v('--status-brand-bg'),
              color: v('--text-brand'),
              '&:hover': { backgroundColor: v('--status-brand-bg') },
              '& .MuiListItemIcon-root, & .MuiSvgIcon-root': {
                color: v('--text-brand')
              }
            },
            '&.Mui-focusVisible': {
              backgroundColor: v('--surface-muted')
            }
          }
        }
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            borderRadius: v('--radius-lg'),
            border: `1px solid ${v('--border-default')}`,
            boxShadow: v('--shadow-card'),
            backgroundColor: v('--surface-card'),
            backgroundImage: 'none',
            marginBlockStart: 6,
            overflow: 'hidden'
          },
          listbox: {
            paddingBlock: 6,
            paddingInline: 6,
            // Custom scrollbar — translucent thumb, no track, only shown
            // on hover. Reads cleanly against the warm surface in both
            // modes.
            scrollbarWidth: 'thin',
            scrollbarColor: `${v('--border-strong')} transparent`,
            '&::-webkit-scrollbar': { width: 8 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: v('--border-default'),
              borderRadius: 4
            },
            '&:hover::-webkit-scrollbar-thumb': {
              backgroundColor: v('--border-strong')
            }
          },
          option: {
            borderRadius: v('--radius'),
            marginBlock: 2,
            paddingBlock: 8,
            paddingInline: 12,
            fontSize: '0.9375rem',
            transition: 'background-color var(--duration-fast) var(--ease-out)',
            // MUI uses two states for Autocomplete options:
            //   data-focus="true" while keyboard / mouse traversal,
            //   aria-selected="true" once chosen. Style both.
            '&[data-focus="true"]': {
              backgroundColor: v('--surface-muted')
            },
            '&[aria-selected="true"]': {
              backgroundColor: v('--status-brand-bg'),
              color: v('--text-brand'),
              '&[data-focus="true"]': {
                backgroundColor: v('--status-brand-bg')
              }
            }
          },
          noOptions: {
            color: v('--text-muted'),
            fontSize: '0.875rem',
            paddingBlock: 14,
            textAlign: 'center'
          },
          loading: {
            color: v('--text-muted'),
            fontSize: '0.875rem',
            paddingBlock: 14,
            textAlign: 'center'
          }
        }
      },
      MuiPopover: {
        // The TopBar profile menu and a few one-off popups use Popover
        // directly. Inherit the same surface/shadow as MuiMenu so they
        // don't drift visually.
        styleOverrides: {
          paper: {
            borderRadius: v('--radius-lg'),
            border: `1px solid ${v('--border-default')}`,
            boxShadow: v('--shadow-card'),
            backgroundColor: v('--surface-card'),
            backgroundImage: 'none'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${v('--border-default')}`,
            boxShadow: 'none'
          }
        }
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: v('--surface-inverse'),
            color: v('--text-inverse')
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: v('--surface-base'),
            borderColor: v('--border-default')
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 12, boxShadow: v('--shadow-lg') }
        }
      },
      MuiTableHead: {
        styleOverrides: {
          root: { backgroundColor: v('--surface-subtle') }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottomColor: v('--border-subtle'),
            fontSize: '0.9375rem'
          },
          head: {
            color: v('--text-muted'),
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }
        }
      },
      MuiTooltip: {
        defaultProps: { enterDelay: 200 },
        styleOverrides: {
          // surface-inverse + text-inverse flip with theme so the tooltip
          // always contrasts cleanly with the page (dark on light, light
          // on dark).
          tooltip: {
            backgroundColor: v('--surface-inverse'),
            color: v('--text-inverse'),
            fontSize: '0.8125rem',
            borderRadius: 6,
            paddingInline: 8,
            paddingBlock: 4
          },
          arrow: {
            color: v('--surface-inverse')
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 9999,
            height: 22,
            fontSize: '0.8125rem',
            fontWeight: 500
          }
        }
      }
    }
  })
}

export default getTheme('ltr', 'light')
