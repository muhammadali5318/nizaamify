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
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useAuth } from 'src/context/AuthProvider'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { useAuth0 } from '@auth0/auth0-react'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { queryClient } from 'src/utils/queryClient'

export type ApproveOrReject = 'REJECTED' | 'ACTIVE' | ''

interface ConfirmUserModalProps {
  open: boolean
  onClose: () => void
  mode: ApproveOrReject
  userId: string
}

const DEFAULTS: any = {
  REJECTED: {
    icon: '/assets/error-circle.svg',
    title: 'Reject access request',
    confirmLabel: 'Reject request',
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
  }
}

const ApproveOrRejectRequest: React.FC<ConfirmUserModalProps> = React.memo(
  ({ open, onClose, mode, userId }) => {
    const { accessToken } = useAuth()
    const { data: practiceData } = useInitialData(!!accessToken)
    const { user } = useAuth0()
    const [loading, setLoading] = useState(false)

    const config = useMemo(() => {
      const base = DEFAULTS[mode]
      return {
        icon: base?.icon,
        title: base?.title,
        confirmLabel: base?.confirmLabel,
        confirmColor: base?.confirmColor,
        bodyNode: base?.bodyTemplate()
      }
    }, [mode, userId, practiceData])

    const isDisabled = useMemo(
      () => loading || !accessToken,
      [loading, userId, accessToken]
    )

    const onConfirm = useCallback(async () => {
      if (!userId) return
      await apiClient.put(
        endpoints.approveOrRejectTeamMember(getUserOrgUuid(user), userId),
        { user_practice_status: mode }
      )
      await queryClient.invalidateQueries({ queryKey: ['teamMembersListApi'] })
    }, [user, userId, mode])

    const handleConfirm = useCallback(async () => {
      setLoading(true)
      try {
        await onConfirm()
        onClose()
      } catch (err: any) {
        console.error('ConfirmUserModal action error', err)
      } finally {
        setLoading(false)
      }
    }, [onConfirm, userId, onClose, mode])

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
              src={config.icon}
              alt=''
              sx={{ width: { xs: 48, sm: 64 }, height: { xs: 48, sm: 64 } }}
            />
            <Typography
              className='font-weight--700'
              sx={{ typography: { xs: 'h6', sm: 'h5' } }}
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
            gap: 2
          }}
        >
          <Button
            onClick={onClose}
            variant='outlined'
            size='large'
            sx={{ flex: 1 }}
            disabled={loading}
          >
            Cancel
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

ApproveOrRejectRequest.displayName = 'ApproveOrRejectRequest'

export default ApproveOrRejectRequest
