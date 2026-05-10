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
  brand300: '#86E0A4',
  brand400: '#67C090',
  brand500: '#4A9D88',
  brand700: '#215B63',
  brand800: '#184E68',
  brand900: '#124170',
  brand950: '#0A2A4A',
  neutral0: '#FFFFFF',
  neutral50: '#F8FAFA',
  neutral200: '#E2E7E8',
  neutral400: '#9AA4A8',
  neutral700: '#363D40',
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
      primary: {
        main: HEX.brand700,
        dark: HEX.brand800,
        light: HEX.brand500,
        contrastText: HEX.neutral0
      },
      secondary: {
        main: HEX.brand400,
        dark: HEX.brand500,
        light: HEX.brand300,
        contrastText: HEX.brand900
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
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            boxShadow: v('--shadow-md'),
            border: `1px solid ${v('--border-default')}`
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
          tooltip: {
            backgroundColor: v('--neutral-900'),
            color: v('--neutral-0'),
            fontSize: '0.8125rem',
            borderRadius: 6
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
