import { useState, useCallback } from 'react'
import { Button, Typography } from '@mui/material'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'
import {
  InvitedUserData,
  InviteUserFormData,
  getRoleLabel
} from 'src/components/team-management/common/team-management'
import InviteUserDialog from 'src/components/team-management/InviteUserDialog'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useAuth0 } from '@auth0/auth0-react'
import { notify } from 'src/components/notistack/NotificationProvider'
import { useAuth } from 'src/context/AuthProvider'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { queryClient } from 'src/utils/queryClient'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'

const InviteTeamMember: React.FC = () => {
  const { user } = useAuth0()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [invitedUserData, setInvitedUserData] =
    useState<InvitedUserData | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const { accessToken } = useAuth()
  const { data: practiceData } = useInitialData(!!accessToken)

  const handleInviteUser = useCallback(
    async (data: InviteUserFormData): Promise<void> => {
      try {
        setInviteLoading(true)
        setInviteError(null)

        const response = await apiClient.post(
          endpoints.userInvitation(getUserOrgUuid(user)),
          {
            invited_user_email: data.email,
            invited_user_role: data.role,
            is_nominated: false
          }
        )

        if (response.status === 200) {
          notify.success('Invitation sent successfully!')
          setInvitedUserData({ email: data.email, role: data.role })
          setSuccessDialogOpen(true)
          await queryClient.invalidateQueries({
            queryKey: ['teamMembersListApi']
          })
        }
      } catch (error: unknown) {
        let errorMessage = 'Failed to send invitation'

        if (error instanceof Error) {
          errorMessage = error.message
        } else if (
          typeof error === 'object' &&
          error !== null &&
          'message' in error
        ) {
          errorMessage = (error as { message: string }).message
        }

        notify.error(errorMessage)
        throw error
      } finally {
        setInviteLoading(false)
      }
    },
    []
  )

  const handleOpenInviteDialog = useCallback(() => {
    setInviteDialogOpen(true)
  }, [])

  const handleCloseInviteDialog = useCallback(() => {
    setInviteDialogOpen(false)
    setInviteError(null)
  }, [])

  const handleCloseSuccessDialog = useCallback(() => {
    setSuccessDialogOpen(false)
    setInvitedUserData(null)
  }, [])

  return (
    <>
      <Button
        variant='contained'
        sx={{
          background: '#000'
        }}
        startIcon={<PersonAddIcon />}
        onClick={handleOpenInviteDialog}
      >
        Invite team member
      </Button>

      {/* Invite dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onClose={handleCloseInviteDialog}
        onInvite={handleInviteUser}
        loading={inviteLoading}
        error={inviteError}
      />

      {/* Success dialog */}
      {invitedUserData && (
        <ConfirmationSuccessDialog
          open={successDialogOpen}
          onClose={handleCloseSuccessDialog}
          onSubmit={handleCloseSuccessDialog}
          title='Invitation sent!'
        >
          <Typography variant='body2' color='text.secondary'>
            An invitation has been sent to{' '}
            <Typography component='span' color='text.primary' fontWeight={700}>
              {invitedUserData.email}
            </Typography>{' '}
            to join{' '}
            <Typography component='span' color='text.primary' fontWeight={700}>
              {practiceData?.practice_name}
            </Typography>{' '}
            as a{' '}
            <Typography component='span' color='text.primary' fontWeight={700}>
              {getRoleLabel(invitedUserData.role)}
            </Typography>
            .
          </Typography>

          <Typography variant='body2' color='text.secondary' mt={1}>
            They’ll receive an email with instructions to set up their account.
          </Typography>
        </ConfirmationSuccessDialog>
      )}
    </>
  )
}

export default InviteTeamMember
