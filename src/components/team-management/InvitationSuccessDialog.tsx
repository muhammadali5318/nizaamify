import React, { useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack
} from '@mui/material'
import { getRoleLabel, type UserRole } from './common/team-management'

interface InvitationSuccessDialogProps {
  open: boolean
  onClose: () => void
  invitedEmail: string
  role: UserRole
  practiceName?: string
}

const InvitationSuccessDialog: React.FC<InvitationSuccessDialogProps> =
  React.memo(({ open, onClose, invitedEmail, role, practiceName }) => {
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
              gap: 1
            }}
          >
            <img
              src='/assets/success-check.svg'
              alt='invitation successfully sent'
              style={{ width: 88, height: 88 }}
            />
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, pt: 1 }}>
          <Stack spacing={1}>
            <Typography variant='h4' fontWeight={700}>
              Invitation sent!
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              An invitation has been sent to{' '}
              <Typography
                component='span'
                color='text.primary'
                fontWeight={700}
              >
                {invitedEmail}
              </Typography>{' '}
              to join{' '}
              <Typography
                component='span'
                color='text.primary'
                fontWeight={700}
              >
                {practiceName}
              </Typography>{' '}
              as a{' '}
              <Typography
                component='span'
                color='text.primary'
                fontWeight={700}
              >
                {getRoleLabel(role)}
              </Typography>
              .
            </Typography>

            <Typography variant='body2' color='text.secondary'>
              They&apos;ll receive an email with instructions to set up their
              account.
            </Typography>
          </Stack>
        </DialogContent>

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

InvitationSuccessDialog.displayName = 'InvitationSuccessDialog'

export default InvitationSuccessDialog
