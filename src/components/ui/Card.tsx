import { forwardRef } from 'react'
import Paper, { type PaperProps } from '@mui/material/Paper'

export type CardVariant = 'default' | 'muted' | 'elevated'

export interface CardProps extends Omit<PaperProps, 'variant' | 'elevation'> {
  variant?: CardVariant
  /** Disables the default responsive padding (mobile p-4 / desktop p-6). */
  noPadding?: boolean
}

// `surface-card` is a hair warmer than `surface-base` (amber undertone) so
// cards register as warm volumes against the cool slate page in dark mode.
// In light mode the difference is barely perceptible (#FFFCF7 vs #FFFFFF).
//
// Default cards stay shadowless (dashboard/list pages get visual rhythm
// from the warm surface alone — extra shadows make those pages feel
// noisy). The 'elevated' variant carries the amber-bloom shadow for
// surfaces that need to lift off the page (POS cart panel, modals).
const VARIANT_SX: Record<CardVariant, object> = {
  default: {
    backgroundColor: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    boxShadow: 'none'
  },
  muted: {
    backgroundColor: 'var(--surface-muted)',
    border: '1px solid var(--border-default)',
    boxShadow: 'none'
  },
  elevated: {
    backgroundColor: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-card)'
  }
}

/**
 * Surface primitive (spec §6). Default = white surface with subtle border;
 * muted = subtle bg; elevated = adds shadow-md. Padding p-4 mobile / p-6
 * desktop unless noPadding.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', noPadding, sx, ...rest },
  ref
) {
  return (
    <Paper
      ref={ref}
      sx={[
        VARIANT_SX[variant],
        {
          borderRadius: 'var(--radius-lg)',
          // Subtle motion on hover for default/elevated cards. Skipped for
          // 'muted' since that's typically a passive container.
          transition:
            variant === 'muted'
              ? undefined
              : 'box-shadow var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out)'
        },
        !noPadding && { p: { xs: 2, md: 3 } },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...rest}
    />
  )
})

export default Card
