import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'

export interface EmptyStateProps {
  /** Lucide / MUI icon component. Defaults to InboxOutlined. */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Optional CTA element (Button, Link, etc.). */
  action?: ReactNode
}

/**
 * Empty list / table placeholder (spec §6). Centered icon + title + optional
 * description + optional CTA. Used wherever a list might be empty.
 */
export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1.5,
        py: 6,
        px: 3,
        color: 'var(--text-muted)'
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: 'var(--surface-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)'
        }}
      >
        {icon ?? <InboxOutlinedIcon sx={{ fontSize: 28 }} />}
      </Box>
      <Typography variant='h3' sx={{ color: 'var(--text-primary)' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant='body2' sx={{ maxWidth: 'min(420px, 100%)' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}

export default EmptyState
