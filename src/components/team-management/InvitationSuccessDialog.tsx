import React, { useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography
} from '@mui/material'

interface ConfirmationSuccessDialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

const ConfirmationSuccessDialog: React.FC<ConfirmationSuccessDialogProps> =
  React.memo(({ open, onClose, title, children }) => {
    const handleClose = useCallback(() => {
      onClose()
    }, [onClose])

    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth='sm'
        fullWidth
        slotProps={{
          paper: {
            sx: {
              py: '36px',
              px: 6
            }
          }
        }}
      >
        <DialogTitle sx={{ p: 0, mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0
            }}
          >
            <img
              src='/assets/success-check.svg'
              alt='success'
              style={{ width: 88, height: 88 }}
            />
            <Typography variant='h4' fontWeight={700}>
              {title}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, pt: 1 }}>{children}</DialogContent>

        <DialogActions sx={{ p: 0, mt: 2.5 }}>
          <Button
            onClick={handleClose}
            variant='contained'
            fullWidth
            size='large'
            sx={{
              bgcolor: 'black',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.9)'
              }
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    )
  })

ConfirmationSuccessDialog.displayName = 'ConfirmationSuccessDialog'

export default ConfirmationSuccessDialog
