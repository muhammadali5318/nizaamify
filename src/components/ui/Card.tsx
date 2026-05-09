import { forwardRef } from 'react'
import Paper, { type PaperProps } from '@mui/material/Paper'

export type CardVariant = 'default' | 'muted' | 'elevated'

export interface CardProps extends Omit<PaperProps, 'variant' | 'elevation'> {
  variant?: CardVariant
  /** Disables the default responsive padding (mobile p-4 / desktop p-6). */
  noPadding?: boolean
}

const VARIANT_SX: Record<CardVariant, object> = {
  default: {
    backgroundColor: 'var(--surface-base)',
    border: '1px solid var(--border-default)',
    boxShadow: 'none'
  },
  muted: {
    backgroundColor: 'var(--surface-muted)',
    border: '1px solid var(--border-default)',
    boxShadow: 'none'
  },
  elevated: {
    backgroundColor: 'var(--surface-base)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-md)'
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
        { borderRadius: 'var(--radius-lg)' },
        !noPadding && { p: { xs: 2, md: 3 } },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...rest}
    />
  )
})

export default Card
