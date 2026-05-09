import { forwardRef } from 'react'
import Chip, { type ChipProps } from '@mui/material/Chip'

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'brand'
  | 'neutral'

export interface BadgeProps extends Omit<ChipProps, 'color' | 'variant'> {
  variant?: BadgeVariant
}

const VARIANT_TOKENS: Record<BadgeVariant, { bg: string; fg: string }> = {
  success: { bg: 'var(--status-success-bg)', fg: 'var(--status-success-text)' },
  warning: { bg: 'var(--status-warning-bg)', fg: 'var(--status-warning-text)' },
  error: { bg: 'var(--status-error-bg)', fg: 'var(--status-error-text)' },
  info: { bg: 'var(--status-info-bg)', fg: 'var(--status-info-text)' },
  brand: { bg: 'var(--status-brand-bg)', fg: 'var(--status-brand-text)' },
  neutral: { bg: 'var(--surface-muted)', fg: 'var(--text-secondary)' }
}

/** Compact status pill (spec §6). 22px height, text-caption. */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { variant = 'neutral', sx, ...rest },
  ref
) {
  const { bg, fg } = VARIANT_TOKENS[variant]
  return (
    <Chip
      ref={ref}
      size='small'
      sx={[
        { backgroundColor: bg, color: fg, fontWeight: 500 },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...rest}
    />
  )
})

export default Badge
