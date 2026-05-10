import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CloseIcon from '@mui/icons-material/Close'

export type BannerVariant = 'info' | 'warning' | 'error' | 'brand' | 'success'

export interface BannerProps {
  variant?: BannerVariant
  /** Optional bold lead. */
  title?: ReactNode
  /** Body text. */
  children: ReactNode
  /** Action slot (e.g. a Link or Button). Renders at the trailing edge. */
  action?: ReactNode
  /** Allow user to dismiss. Only meaningful for `info` per spec §6. */
  dismissible?: boolean
}

// status-* tokens flip with theme via tokens.css; using them keeps banners
// legible on both light and dark surfaces. Border = bg so the seam stays
// soft (the bg already has appropriate alpha in dark mode).
const VARIANTS: Record<
  BannerVariant,
  { bg: string; fg: string; Icon: typeof InfoOutlinedIcon }
> = {
  info: {
    bg: 'var(--status-info-bg)',
    fg: 'var(--status-info-text)',
    Icon: InfoOutlinedIcon
  },
  warning: {
    bg: 'var(--status-warning-bg)',
    fg: 'var(--status-warning-text)',
    Icon: WarningAmberIcon
  },
  error: {
    bg: 'var(--status-error-bg)',
    fg: 'var(--status-error-text)',
    Icon: ErrorOutlineIcon
  },
  brand: {
    bg: 'var(--status-brand-bg)',
    fg: 'var(--status-brand-text)',
    Icon: InfoOutlinedIcon
  },
  success: {
    bg: 'var(--status-success-bg)',
    fg: 'var(--status-success-text)',
    Icon: CheckCircleOutlineIcon
  }
}

/**
 * Page-level banner (spec §6). Used at the top of a screen or above a
 * block to communicate state. Replaces the bespoke NotificationBanner.
 * Per spec, only `info` should be dismissible.
 */
export function Banner({
  variant = 'info',
  title,
  children,
  action,
  dismissible
}: BannerProps) {
  const [open, setOpen] = useState(true)
  if (!open) return null

  const { bg, fg, Icon } = VARIANTS[variant]

  return (
    <Box
      role={variant === 'error' ? 'alert' : 'status'}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        p: 1.5,
        borderRadius: 'var(--radius)',
        backgroundColor: bg,
        color: fg
      }}
    >
      <Icon sx={{ fontSize: 20, flexShrink: 0, mt: 0.25 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {title && (
          <Typography
            variant='body2'
            sx={{ fontWeight: 600, color: 'inherit' }}
          >
            {title}
          </Typography>
        )}
        <Typography variant='body2' sx={{ color: 'inherit' }}>
          {children}
        </Typography>
      </Box>
      {action && (
        <Box sx={{ marginInlineStart: 'auto', flexShrink: 0 }}>{action}</Box>
      )}
      {dismissible && variant === 'info' && (
        <IconButton
          aria-label='Dismiss'
          size='small'
          onClick={() => setOpen(false)}
          sx={{ color: 'inherit', marginInlineStart: 0.5 }}
        >
          <CloseIcon fontSize='small' />
        </IconButton>
      )}
    </Box>
  )
}

export default Banner
