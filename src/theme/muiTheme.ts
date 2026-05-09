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

export function getTheme(direction: 'ltr' | 'rtl'): Theme {
  return createTheme({
    direction,
    breakpoints: {
      values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 }
    },
    palette: {
      mode: 'light',
      primary: {
        main: v('--action-primary'),
        dark: v('--action-primary-hover'),
        light: v('--brand-500'),
        contrastText: v('--action-primary-text')
      },
      secondary: {
        main: v('--action-accent'),
        dark: v('--action-accent-hover'),
        light: v('--brand-300'),
        contrastText: v('--action-accent-text')
      },
      error: {
        main: v('--error-500'),
        dark: v('--error-700'),
        light: v('--error-100'),
        contrastText: v('--neutral-0')
      },
      warning: {
        main: v('--warning-500'),
        dark: v('--warning-700'),
        light: v('--warning-100'),
        contrastText: v('--neutral-900')
      },
      success: {
        main: v('--success-500'),
        dark: v('--success-700'),
        light: v('--success-100'),
        contrastText: v('--neutral-0')
      },
      info: {
        main: v('--info-500'),
        dark: v('--info-700'),
        light: v('--info-100'),
        contrastText: v('--neutral-0')
      },
      background: {
        default: v('--surface-subtle'),
        paper: v('--surface-base')
      },
      text: {
        primary: v('--text-primary'),
        secondary: v('--text-secondary'),
        disabled: v('--text-disabled')
      },
      divider: v('--border-default'),
      common: { black: '#000', white: v('--neutral-0') }
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

export default getTheme('ltr')
