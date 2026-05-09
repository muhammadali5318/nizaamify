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

const VARIANTS: Record<
  BannerVariant,
  { bg: string; border: string; fg: string; Icon: typeof InfoOutlinedIcon }
> = {
  info: {
    bg: 'var(--info-50)',
    border: 'var(--info-100)',
    fg: 'var(--info-700)',
    Icon: InfoOutlinedIcon
  },
  warning: {
    bg: 'var(--warning-50)',
    border: 'var(--warning-100)',
    fg: 'var(--warning-700)',
    Icon: WarningAmberIcon
  },
  error: {
    bg: 'var(--error-50)',
    border: 'var(--error-100)',
    fg: 'var(--error-700)',
    Icon: ErrorOutlineIcon
  },
  brand: {
    bg: 'var(--brand-50)',
    border: 'var(--brand-100)',
    fg: 'var(--brand-800)',
    Icon: InfoOutlinedIcon
  },
  success: {
    bg: 'var(--success-50)',
    border: 'var(--success-100)',
    fg: 'var(--success-700)',
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

  const { bg, border, fg, Icon } = VARIANTS[variant]

  return (
    <Box
      role={variant === 'error' ? 'alert' : 'status'}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        p: 1.5,
        borderRadius: 'var(--radius)',
        border: `1px solid ${border}`,
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
