import { forwardRef } from 'react'
import MuiButton, {
  type ButtonProps as MuiButtonProps
} from '@mui/material/Button'
import type { SxProps, Theme } from '@mui/material/styles'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'ghost'
  | 'destructive'
  | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<
  MuiButtonProps,
  'variant' | 'size' | 'color'
> {
  variant?: ButtonVariant
  size?: ButtonSize
}

// Maps a design-system variant to MUI variant + color + per-variant sx overlay.
// Only the values that can't be expressed via the global theme component
// overrides live here — most styling already comes from getTheme(direction).
function variantStyles(variant: ButtonVariant): {
  muiVariant: MuiButtonProps['variant']
  muiColor: MuiButtonProps['color']
  sx: SxProps<Theme>
} {
  switch (variant) {
    case 'primary':
      return {
        muiVariant: 'contained',
        muiColor: 'primary',
        sx: {
          '&:hover': { boxShadow: 'var(--shadow-brand)' }
        }
      }
    case 'secondary':
      return {
        muiVariant: 'outlined',
        muiColor: 'primary',
        sx: {
          backgroundColor: 'var(--action-secondary)',
          borderColor: 'var(--action-secondary-border)',
          color: 'var(--action-secondary-text)',
          '&:hover': {
            backgroundColor: 'var(--action-secondary-hover)',
            borderColor: 'var(--action-secondary-border)'
          }
        }
      }
    case 'accent':
      return {
        muiVariant: 'contained',
        muiColor: 'secondary',
        sx: {
          backgroundColor: 'var(--action-accent)',
          color: 'var(--action-accent-text)',
          '&:hover': { backgroundColor: 'var(--action-accent-hover)' }
        }
      }
    case 'ghost':
      return {
        muiVariant: 'text',
        muiColor: 'primary',
        sx: {
          color: 'var(--text-primary)',
          '&:hover': { backgroundColor: 'var(--surface-muted)' }
        }
      }
    case 'destructive':
      return {
        muiVariant: 'contained',
        muiColor: 'error',
        sx: {
          backgroundColor: 'var(--action-destructive)',
          color: 'var(--action-destructive-text)',
          '&:hover': { backgroundColor: 'var(--action-destructive-hover)' }
        }
      }
    case 'link':
      return {
        muiVariant: 'text',
        muiColor: 'primary',
        sx: {
          minHeight: 0,
          paddingInline: 0,
          color: 'var(--text-brand)',
          textDecoration: 'underline',
          textUnderlineOffset: 4,
          '&:hover': {
            backgroundColor: 'transparent',
            textDecoration: 'underline'
          }
        }
      }
  }
}

const SIZE_TO_MUI: Record<ButtonSize, MuiButtonProps['size']> = {
  sm: 'small',
  md: 'medium',
  lg: 'large'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = 'primary', size = 'md', sx, ...rest }, ref) {
    const { muiVariant, muiColor, sx: variantSx } = variantStyles(variant)
    return (
      <MuiButton
        ref={ref}
        variant={muiVariant}
        color={muiColor}
        size={SIZE_TO_MUI[size]}
        sx={[variantSx, ...(Array.isArray(sx) ? sx : [sx])]}
        {...rest}
      />
    )
  }
)

export default Button
