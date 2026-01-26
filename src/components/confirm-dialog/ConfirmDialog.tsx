import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  icon?: React.ReactNode
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  confirmColor?:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
}

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  icon,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
  confirmColor = 'primary'
}: ConfirmDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogContent sx={{ textAlign: 'left', p: 3 }}>
        {icon && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            {icon}
          </Box>
        )}

        <Typography variant='h6' fontWeight={600} gutterBottom>
          {title}
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          {description}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 3, justifyContent: 'center', gap: 2 }}>
        <Button
          onClick={onClose}
          variant='outlined'
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            px: 3
          }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant='contained'
          color={confirmColor}
          disabled={loading}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            px: 3
          }}
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDialog
