import React, { useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Alert
} from '@mui/material'
import { useAuth0 } from '@auth0/auth0-react'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useNominateExistingManager } from 'src/hooks/useNominateExistingManager'
import RenderUlList from 'src/components/render-ul-list'

interface NominateExistingPracticeManagerProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  name: string
  userId: string
}

const NominateExistingPracticeManager: React.FC<NominateExistingPracticeManagerProps> =
  React.memo(({ open, onClose, onSuccess, name, userId }) => {
    const { user } = useAuth0()
    const orgUuid = getUserOrgUuid(user)

    const { mutate: nominateManager, isPending } = useNominateExistingManager({
      orgUuid,
      userId,
      onSuccess: () => {
        onClose()
        if (onSuccess) onSuccess()
      }
    })

    const handleConfirm = useCallback(() => {
      nominateManager()
    }, [nominateManager])

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
        <DialogTitle sx={{ p: 0, mb: 2.5 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 1
            }}
          >
            <img src='/assets/blue-flag-outlined.svg' alt='Blue flag' />
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant='h5' fontWeight={700}>
                Nominate for practice onboarding
              </Typography>
              <Typography variant='subtitle1'>
                You’re about to nominate <strong>{name}</strong> to complete the
                practice onboarding process on behalf of your practice.
              </Typography>
              <Typography variant='subtitle1'>
                They’ll receive full access to the onboarding form and will be
                responsible for completing the setup.
              </Typography>
            </Box>
            <Box>
              <Typography variant='h6' fontWeight={700}>
                What happens next:
              </Typography>
              <RenderUlList
                items={[
                  'The nominated team member will receive an invitation email.',
                  'You’ll retain full administratieve access as the practice owner.',
                  'You can monitor progress and step in any time.'
                ]}
              />
            </Box>
            <Alert severity='info'>
              <Typography component='div' variant='body2' sx={{ margin: 0 }}>
                Onboarding is essential. Without it, Monai cannot provide
                financial insights, benchmarking, or reporting.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 0, mt: 2.5, display: 'flex', gap: 2.5 }}>
          <Button
            onClick={onClose}
            variant='outlined'
            fullWidth
            size='large'
            disabled={isPending}
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirm}
            variant='contained'
            fullWidth
            size='large'
            disabled={isPending}
            sx={{
              margin: '0px !important',
              bgcolor: 'black',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.9)'
              }
            }}
          >
            {isPending ? 'Sending...' : 'Confirm nominate'}
          </Button>
        </DialogActions>
      </Dialog>
    )
  })

NominateExistingPracticeManager.displayName = 'NominateExistingPracticeManager'

export default NominateExistingPracticeManager
