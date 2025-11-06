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
import { queryClient } from 'src/utils/queryClient'
import { toTitleCase } from 'src/utils/stringUtils'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { SelectedUserType } from 'src/store/slices/team-management/selectedUserSlice'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'

export type Mode = 'unlink' | 'delete' | ''

interface ConfirmUserModalProps {
  open: boolean
  onClose: () => void
  member: SelectedUserType | null
  mode: Mode
  reRouteToMainPage: boolean
}

const DEFAULTS: any = {
  unlink: {
    icon: '/assets/unlink-modal-icon.svg',
    title: 'Unlink user from practice',
    confirmLabel: 'Unlink user',
    confirmColor: 'warning',
    bodyTemplate: (member: SelectedUserType, practiceName: string) => (
      <>
        <Typography variant='subtitle1'>
          Are you sure you want to unlink{' '}
          <strong>
            {member?.user_name} ({toTitleCase(member?.user_role)})
          </strong>{' '}
          from <strong>{practiceName}</strong>?
        </Typography>
        <Typography variant='subtitle1'>
          They will no longer have access to this practice’s data or dashboard,
          but will retain access to any other practices they belong to.
        </Typography>
      </>
    )
  },
  delete: {
    icon: '/assets/trash-modal-icon.svg',
    title: 'Delete user from Monai',
    confirmLabel: 'Delete user',
    confirmColor: 'error',
    bodyTemplate: (member: SelectedUserType, practiceName: string) => (
      <>
        <Typography variant='subtitle1'>
          Are you sure you want to remove{' '}
          <strong>
            {member?.user_name} ({toTitleCase(member?.user_role)})
          </strong>{' '}
          from <strong>{practiceName}</strong>?
        </Typography>
        <Typography variant='subtitle1'>
          They will lose access to this practice’s data, reports, and
          dashboards. Any role-based permissions or insights linked to this
          practice will also be revoked.
        </Typography>
      </>
    )
  }
}

const DeactivateUserModal: React.FC<ConfirmUserModalProps> = React.memo(
  ({ open, onClose, member, mode, reRouteToMainPage = false }) => {
    const { accessToken } = useAuth()
    const navigate = useNavigate()
    const { activePracticeId } = useActivePractice()
    const { data: practiceData } = useInitialData(!!accessToken)
    const [loading, setLoading] = useState(false)

    const config = useMemo(() => {
      const base = DEFAULTS[mode]
      return {
        icon: base?.icon,
        title: base?.title,
        confirmLabel: base?.confirmLabel,
        confirmColor: base?.confirmColor,
        bodyNode: base?.bodyTemplate(member, practiceData?.practice_name)
      }
    }, [mode, member, practiceData])

    const isDisabled = useMemo(
      () => loading || !member || !accessToken,
      [loading, member, accessToken]
    )

    const onConfirm = useCallback(async () => {
      if (!member) return
      await apiClient.put(
        endpoints.deactivateTeamMember(activePracticeId ?? '', member.user_id),
        { user_practice_status: 'INACTIVE' }
      )
      await queryClient.invalidateQueries({ queryKey: ['teamMembersListApi'] })
      if (reRouteToMainPage) {
        navigate(paths.teamManagement.root)
      }
    }, [member, activePracticeId])

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
    }, [onConfirm, member, onClose])

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

DeactivateUserModal.displayName = 'DeactivateUserModal'

export default DeactivateUserModal
