import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack
} from '@mui/material'
import RenderUlList from 'src/components/render-ul-list'
import { notify } from 'src/components/notistack/NotificationProvider'
import { useLogout } from 'src/hooks/useLogout'
import useUserDetails from 'src/hooks/useUserDetails'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

const items = [
  'If you click to reset you’ll be logged out.',
  'You’ll need to login and then be asked to recreate a new 2FA before you can continue.'
]

type SwitchAccountingModalProps = {
  open: boolean
  onClose: () => void
  onSave?: () => void
}

const ResetMfaModal: React.FC<SwitchAccountingModalProps> = ({
  open,
  onClose
}) => {
  const [loading, setLoading] = useState(false)
  const { userId } = useUserDetails()
  const { handleLogout } = useLogout()
  const handleReset = async () => {
    setLoading(true)
    try {
      const response = await apiClient.delete(endpoints.resetMFA(userId ?? ''))

      if (response.status === 200) {
        handleLogout()
      } else {
        console.error('Unexpected response:', response)
      }
    } catch {
      notify.error('Failed to reset MFA. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth='sm'
      slotProps={{
        paper: {
          sx: {
            py: '36px',
            px: { xs: 2, sm: 5 },
            borderRadius: '24px'
          }
        }
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box
            component='img'
            src='/assets/error-grey-bg.svg'
            alt=''
            sx={{ width: { xs: 48, sm: 64 }, height: { xs: 48, sm: 64 } }}
          />

          <Typography
            className='font-weight--700'
            sx={{ typography: { xs: 'h6', sm: 'h5' } }}
          >
            Confirm Reset of 2-Factor Authentication
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, mt: 2 }}>
        <Stack spacing={'14px'}>
          <Box>
            <Typography variant='subtitle2'>
              Are you sure you want to reset your 2-Factor Authentication? By
              resetting your 2-Factor Authentication (2FA) settings, you will
              not be able to access secure areas until you re-enable 2FA.
            </Typography>
            <RenderUlList items={items} />
          </Box>
        </Stack>
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
        <Button
          onClick={onClose}
          variant='outlined'
          size='large'
          fullWidth
          sx={{ flex: 1 }}
        >
          Cancel
        </Button>

        <Button
          sx={{ flex: 1 }}
          variant='contained'
          size='large'
          color='error'
          fullWidth
          loading={loading}
          onClick={handleReset}
        >
          Reset
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ResetMfaModal
