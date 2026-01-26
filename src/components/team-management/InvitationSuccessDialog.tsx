import React from 'react'
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
  onSubmit: () => void
  title: string
  buttonTitle?: string
  showCancelBtn?: boolean
  children: React.ReactNode
  titleVariant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

const ConfirmationSuccessDialog: React.FC<ConfirmationSuccessDialogProps> =
  React.memo(
    ({
      open,
      onClose,
      title,
      children,
      titleVariant,
      buttonTitle = 'Done',
      showCancelBtn,
      onSubmit
    }) => {
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
                px: { xs: 2, sm: 6 },
                borderRadius: '24px'
              }
            }
          }}
        >
          <DialogTitle sx={{ p: 0, mb: 0 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0
              }}
            >
              <Box
                component='img'
                src='/assets/success-check.svg'
                alt='success'
                sx={{
                  width: { xs: 64, sm: 88 },
                  height: { xs: 64, sm: 88 }
                }}
              />
              <Typography
                className='font-weight--700'
                sx={{
                  typography: { xs: 'h6', sm: titleVariant ?? 'h4' }
                }}
              >
                {title}
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ p: 0, pt: 1 }}>{children}</DialogContent>

          <DialogActions sx={{ p: 0, mt: 2.5 }}>
            {showCancelBtn && (
              <Button
                onClick={onClose}
                variant='outlined'
                fullWidth
                size='large'
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={onSubmit}
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
              {buttonTitle}
            </Button>
          </DialogActions>
        </Dialog>
      )
    }
  )

ConfirmationSuccessDialog.displayName = 'ConfirmationSuccessDialog'

export default ConfirmationSuccessDialog
