import { type ReactNode } from 'react'
import MuiDialog, {
  type DialogProps as MuiDialogProps
} from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import CloseIcon from '@mui/icons-material/Close'
import { Button } from './Button'

export interface DialogProps extends Omit<MuiDialogProps, 'title'> {
  title?: ReactNode
  /** Optional leading icon shown next to the title. */
  icon?: ReactNode
  /** Close button in the top-right (top-trailing in RTL). Default true. */
  showCloseButton?: boolean
  /** Action buttons rendered in the footer. Pass <Button> children. */
  actions?: ReactNode
}

/**
 * Modal dialog wrapper (spec §6). Use for confirmations, forms, and
 * focused tasks. On mobile, callers should generally prefer <Drawer />
 * (bottom sheet) — see spec §9.
 */
export function Dialog({
  title,
  icon,
  showCloseButton = true,
  actions,
  children,
  onClose,
  ...rest
}: DialogProps) {
  return (
    <MuiDialog onClose={onClose} maxWidth='xs' fullWidth {...rest}>
      {(title || showCloseButton) && (
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            pr: showCloseButton ? 6 : 3
          }}
        >
          {icon && (
            <Box sx={{ flexShrink: 0, color: 'var(--text-brand)' }}>{icon}</Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>{title}</Box>
          {showCloseButton && (
            <IconButton
              aria-label='Close'
              onClick={(e) => onClose?.(e, 'escapeKeyDown')}
              size='small'
              sx={{
                position: 'absolute',
                top: 12,
                insetInlineEnd: 12,
                color: 'var(--text-muted)'
              }}
            >
              <CloseIcon fontSize='small' />
            </IconButton>
          )}
        </DialogTitle>
      )}
      <DialogContent sx={{ pt: title ? 0 : 3 }}>{children}</DialogContent>
      {actions && (
        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>{actions}</DialogActions>
      )}
    </MuiDialog>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  loading?: boolean
  /** Use for destructive confirmations (delete, suspend, etc.). */
  destructive?: boolean
}

/** Common confirmation prompt built on top of <Dialog>. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  icon,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading,
  destructive
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      icon={icon}
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description}
    </Dialog>
  )
}

export default Dialog
