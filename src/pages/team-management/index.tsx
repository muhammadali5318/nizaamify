import { useState, useCallback } from 'react'
import { Box, Container, Button, Alert, Snackbar } from '@mui/material'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'
import InviteUserDialog from 'src/components/team-management/InviteUserDialog'
import InvitationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import type {
  InviteUserFormData,
  InvitedUserData
} from 'src/components/team-management/common/team-management'

const TeamManagement: React.FC = () => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState<boolean>(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState<boolean>(false)
  const [invitedUserData, setInvitedUserData] =
    useState<InvitedUserData | null>(null)
  const [inviteLoading, setInviteLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleInviteUser = useCallback(
    async (data: InviteUserFormData): Promise<void> => {
      try {
        setInviteLoading(true)
        setInviteError(null)

        // TODO: Replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setInvitedUserData({ email: data.email, role: data.role })
        setSuccessDialogOpen(true)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send invitation'
        setInviteError(errorMessage)
        throw error // Re-throw to prevent dialog from closing
      } finally {
        setInviteLoading(false)
      }
    },
    []
  )

  const handleCloseSnackbar = useCallback((): void => {
    setSuccessMessage(null)
    setError(null)
  }, [])

  const handleCloseInviteDialog = useCallback((): void => {
    setInviteDialogOpen(false)
    setInviteError(null)
  }, [])

  const handleCloseSuccessDialog = useCallback((): void => {
    setSuccessDialogOpen(false)
    setInvitedUserData(null)
  }, [])

  const handleOpenInviteDialog = useCallback((): void => {
    setInviteDialogOpen(true)
  }, [])

  return (
    <Container maxWidth='lg' sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2
          }}
        >
          <Button
            variant='contained'
            startIcon={<PersonAddIcon />}
            onClick={handleOpenInviteDialog}
          >
            Invite Team Members
          </Button>
        </Box>

        {error && (
          <Alert severity='error' sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
      </Box>

      <InviteUserDialog
        open={inviteDialogOpen}
        onClose={handleCloseInviteDialog}
        onInvite={handleInviteUser}
        loading={inviteLoading}
        error={inviteError}
      />

      {invitedUserData && (
        <InvitationSuccessDialog
          open={successDialogOpen}
          onClose={handleCloseSuccessDialog}
          invitedEmail={invitedUserData.email}
          role={invitedUserData.role}
          practiceName='Greyford Dental Practice'
        />
      )}

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message={successMessage}
      />
    </Container>
  )
}

export default TeamManagement
