import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface PageHeaderProps {
  /** Required page title — rendered as h1. */
  title: ReactNode
  /** Optional one-line subtitle / description below the title. */
  subtitle?: ReactNode
  /** Trailing action(s) — typically Buttons. Renders right of the title (LTR) / left (RTL). */
  actions?: ReactNode
  /** Render below the row (e.g. tabs, filters). */
  children?: ReactNode
}

/**
 * Page header (spec §5.1 / §13). Title + optional subtitle + trailing
 * action slot. Use at the top of every list / detail page.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  children
}: PageHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: { xs: 1.5, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' }
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant='display'
            component='h1'
            sx={{ color: 'var(--text-primary)' }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant='body1'
              sx={{ color: 'var(--text-secondary)', mt: 0.5 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexShrink: 0,
              alignSelf: { xs: 'stretch', sm: 'auto' }
            }}
          >
            {actions}
          </Box>
        )}
      </Box>
      {children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  )
}

export default PageHeader
