import { type ReactNode } from 'react'
import MuiDrawer, {
  type DrawerProps as MuiDrawerProps
} from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CloseIcon from '@mui/icons-material/Close'

export interface DrawerProps extends Omit<MuiDrawerProps, 'anchor' | 'title'> {
  /** Drawer anchor — defaults to 'bottom' (mobile bottom sheet per spec §9). */
  anchor?: MuiDrawerProps['anchor']
  title?: ReactNode
  /** Header trailing slot (e.g. an action button). */
  headerAction?: ReactNode
  /** Show a close button. Default true. */
  showCloseButton?: boolean
}

/**
 * Mobile-first sheet (spec §9). Defaults to anchor='bottom' (bottom sheet)
 * which is the right pattern on small viewports. For desktop side panels,
 * pass anchor='end' (logical, mirrors automatically in RTL).
 */
export function Drawer({
  anchor = 'bottom',
  title,
  headerAction,
  showCloseButton = true,
  children,
  onClose,
  ...rest
}: DrawerProps) {
  const isBottom = anchor === 'bottom' || anchor === 'top'
  return (
    <MuiDrawer
      anchor={anchor}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            borderRadius: isBottom ? '16px 16px 0 0' : 0,
            maxHeight: isBottom ? 'calc(100vh - 48px)' : undefined,
            width: !isBottom ? 320 : undefined,
            backgroundColor: 'var(--surface-base)'
          }
        }
      }}
      {...rest}
    >
      {(title || showCloseButton || headerAction) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.75,
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {typeof title === 'string' ? (
              <Typography variant='h3'>{title}</Typography>
            ) : (
              title
            )}
          </Box>
          {headerAction}
          {showCloseButton && (
            <IconButton
              aria-label='Close'
              onClick={(e) => onClose?.(e, 'escapeKeyDown')}
              size='small'
              sx={{ color: 'var(--text-muted)' }}
            >
              <CloseIcon fontSize='small' />
            </IconButton>
          )}
        </Box>
      )}
      <Box sx={{ overflow: 'auto', flex: 1 }}>{children}</Box>
    </MuiDrawer>
  )
}

export default Drawer
