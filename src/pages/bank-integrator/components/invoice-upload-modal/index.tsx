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

interface InvoiceUploadModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

const InvoiceUploadModal: React.FC<InvoiceUploadModalProps> = ({
  open,
  onClose,
  onConfirm
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
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box
            component='img'
            src='/assets/warning.svg'
            alt=''
            sx={{ width: { xs: 48, sm: 64 }, height: { xs: 48, sm: 64 } }}
          />

          <Typography
            className='font-weight--700'
            sx={{ typography: { xs: 'h6', sm: 'h5' } }}
          >
            Confirm accounting entry
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, pt: 1 }}>
        <>
          <Typography variant='subtitle1'>
            Are you sure you want to record this as an accounting entry?
          </Typography>

          <Typography variant='subtitle1'>
            The date of payment was made will be used as the date it was due.
          </Typography>
        </>
      </DialogContent>

      <DialogActions
        sx={{
          p: 0,
          mt: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}
      >
        <Button onClick={onClose} variant='outlined' size='large' fullWidth>
          Cancel
        </Button>

        <Button
          variant='contained'
          color='warning'
          size='large'
          onClick={onConfirm}
          fullWidth
        >
          Confirm{' '}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default React.memo(InvoiceUploadModal)
