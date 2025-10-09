// src/components/team-management/InviteTeamMember.tsx
import { useState, useCallback } from 'react'
import { Button } from '@mui/material'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'
import {
  InvitedUserData,
  InviteUserFormData
} from 'src/components/team-management/common/team-management'
import InvitationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import InviteUserDialog from 'src/components/team-management/InviteUserDialog'

const InviteTeamMember: React.FC = () => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [invitedUserData, setInvitedUserData] =
    useState<InvitedUserData | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const handleInviteUser = useCallback(
    async (data: InviteUserFormData): Promise<void> => {
      try {
        setInviteLoading(true)
        setInviteError(null)

        // TODO: Replace this with real API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setInvitedUserData({ email: data.email, role: data.role })
        setSuccessDialogOpen(true)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send invitation'
        setInviteError(errorMessage)
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
        Invite team members
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
        <InvitationSuccessDialog
          open={successDialogOpen}
          onClose={handleCloseSuccessDialog}
          invitedEmail={invitedUserData.email}
          role={invitedUserData.role}
          practiceName='Greyford Dental Practice'
        />
      )}
    </>
  )
}

export default InviteTeamMember
