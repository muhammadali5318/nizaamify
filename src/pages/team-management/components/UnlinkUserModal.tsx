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

interface DeleteUserProps {
  open: boolean
  onClose: () => void
}

const UnlinkUserModal: React.FC<DeleteUserProps> = React.memo(
  ({ open, onClose }) => {
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
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5
            }}
          >
            <Box
              component='img'
              src='/assets/unlink-modal-icon.svg'
              alt='success'
              sx={{
                width: { xs: 48, sm: 64 },
                height: { xs: 48, sm: 64 }
              }}
            />
            <Typography
              className='font-weight--700'
              sx={{
                typography: { xs: 'h6', sm: 'h5' }
              }}
            >
              Unlink user from practice
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, pt: 1 }}>
          <Typography variant='subtitle1'>
            Are you sure you want to unlink{' '}
            <strong> Hannah Baker (Manager)</strong> from{' '}
            <strong> Greyford Practice?</strong>
          </Typography>
          <Typography variant='subtitle1'>
            They will no longer have access to this practice’s data or
            dashboard, but will retain access to any other practices they belong
            to.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            p: 0,
            mt: 2.5,
            display: 'flex',
            flexDirection: 'row',
            gap: 2
          }}
        >
          <Button
            onClick={onClose}
            variant='outlined'
            size='large'
            sx={{ flex: 1 }}
          >
            Cancel
          </Button>

          <Button
            sx={{ flex: 1 }}
            variant='contained'
            color='warning'
            size='large'
          >
            Unlink user
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
)

UnlinkUserModal.displayName = 'UnlinkUserModal'

export default UnlinkUserModal
