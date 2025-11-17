// File: UserConfirmatinoModal.tsx
import React, { useCallback, useMemo, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography
} from '@mui/material'

export type UserConfirmationTypes =
  | 'REJECTED'
  | 'ACTIVE'
  | 'CHOOSE_PACKAGE_LATER'
  | ''

interface ConfirmUserModalProps {
  open: boolean
  onClose: () => void
  mode: UserConfirmationTypes
  onConfirm?: (opts: { mode: UserConfirmationTypes }) => Promise<void>
  confirmDisabled?: boolean
}

const DEFAULTS: any = {
  REJECTED: {
    icon: '/assets/error-circle.svg',
    title: 'Reject access request',
    confirmLabel: 'Reject request',
    cancelLabel: 'Cancel',
    variant: 'h5',
    confirmColor: 'error',
    bodyTemplate: () => (
      <>
        <Typography variant='subtitle1'>
          Are you sure you want to reject this request?
        </Typography>
        <Typography variant='subtitle1' color='text.primary'>
          The requester will be notified that their access request to your
          practice has been declined.
        </Typography>
      </>
    )
  },
  ACTIVE: {
    icon: '/assets/success-check.svg',
    title: 'Approve access request',
    cancelLabel: 'Cancel',
    variant: 'h5',
    confirmLabel: 'Approve request',
    confirmColor: 'primary',
    bodyTemplate: () => (
      <>
        <Typography variant='subtitle1' color='text.secondary'>
          Are you sure you want to approve this request?
        </Typography>
        <Typography variant='subtitle1' color='text.secondary'>
          Once approved, the user will gain access to your practice workspace
          and its financial data based on their assigned role.
        </Typography>
      </>
    )
  },
  CHOOSE_PACKAGE_LATER: {
    icon: '/assets/warning.svg',
    title: 'Choose Your Plan Later?',
    confirmLabel: 'Choose a plan now',
    cancelLabel: 'Continue without selecting a plan',
    variant: 'h4',
    confirmColor: 'primary',
    bodyTemplate: () => (
      <>
        <Typography variant='subtitle1' color='text.primary'>
          Selecting a subscription plan is required to unlock Monai’s full
          features, including financial insights, document uploads, and
          benchmarking.
        </Typography>
        <Typography variant='subtitle1' color='text.primary'>
          If you skip this step now, you’ll have{' '}
          <strong> limited access</strong> to the platform until a plan is
          selected.
        </Typography>
      </>
    )
  }
}

const UserConfirmationModal: React.FC<ConfirmUserModalProps> = React.memo(
  ({ open, onClose, mode, onConfirm, confirmDisabled = false }) => {
    const [loading, setLoading] = useState(false)

    const config = useMemo(() => {
      const base = DEFAULTS[mode]
      return {
        icon: base?.icon,
        title: base?.title,
        confirmLabel: base?.confirmLabel,
        confirmColor: base?.confirmColor,
        bodyNode: base?.bodyTemplate(),
        cancelLabel: base?.cancelLabel,
        titleVariant: base?.variant
      }
    }, [mode])

    const isDisabled = useMemo(
      () => loading || confirmDisabled || !onConfirm,
      [loading, confirmDisabled, onConfirm]
    )

    const handleConfirm = useCallback(async () => {
      if (!onConfirm) return
      setLoading(true)
      try {
        await onConfirm({
          mode
        })
      } catch (err: any) {
        console.error('ConfirmUserModal action error', err)
      } finally {
        setLoading(false)
      }
    }, [onConfirm, mode])

    return (
      <Dialog
        open={open}
        onClose={mode === 'CHOOSE_PACKAGE_LATER' ? undefined : onClose}
        maxWidth='sm'
        fullWidth
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
              src={config.icon}
              alt=''
              sx={{ width: { xs: 48, sm: 64 }, height: { xs: 48, sm: 64 } }}
            />
            <Typography
              className='font-weight--700'
              sx={{ typography: { xs: 'h6', sm: config?.titleVariant } }}
            >
              {config.title}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, pt: 1 }}>{config.bodyNode}</DialogContent>

        <DialogActions
          sx={{
            p: 0,
            mt: 2.5,
            display: 'flex',
            flexDirection: 'row',
            gap: 0
          }}
        >
          <Button
            onClick={onClose}
            variant='outlined'
            size='large'
            sx={{ flex: 1, padding: '7px 8px' }}
            disabled={loading}
          >
            {config.cancelLabel}
          </Button>

          <Button
            sx={{ flex: 1 }}
            variant='contained'
            color={config.confirmColor}
            size='large'
            onClick={handleConfirm}
            disabled={isDisabled}
            loading={loading}
          >
            {config.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
)

UserConfirmationModal.displayName = 'UserConfirmationModal'

export default UserConfirmationModal
