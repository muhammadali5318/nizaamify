import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Alert,
  Box
} from '@mui/material'
import { isPracticeOwner } from 'src/utils/helper'
import { useAuth0 } from '@auth0/auth0-react'
import { LoadingButton } from '@mui/lab'
import HavingTrouble from 'src/components/contact-support/HavingTrouble'

type SaveAndExitDialogueProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  onOpenNominate: () => void
  confirmLoading?: boolean
}

const SaveAndExitDialogue: React.FC<SaveAndExitDialogueProps> = ({
  open,
  onClose,
  onConfirm,
  onOpenNominate,
  confirmLoading
}) => {
  const { user } = useAuth0()
  const handleOnNominate = () => {
    onOpenNominate()
    onClose()
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
            width: '636px',
            maxWidth: '636px'
          }
        }
      }}
      aria-labelledby='nominate-dialog-title'
    >
      <DialogTitle
        id='nominate-dialog-title'
        sx={{
          padding: '36px 48px 0px 48px'
        }}
      >
        <img src='/assets/warning.svg' alt='warning icon' />
      </DialogTitle>

      <DialogContent sx={{ padding: '0px 48px 0px 48px' }}>
        <Stack spacing={1}>
          <Typography variant='h4' className='font-weight--700'>
            Want to finish this later?
          </Typography>
          <Typography variant='subtitle1' color='var(--color-text-primary)'>
            Your progress will be saved, and you can return anytime to continue.
          </Typography>
          <Typography variant='subtitle1' color='var(--color-text-primary)'>
            ⚠️ Practice setup is essential — without completing onboarding,
            Monai tech won’t work properly for your team.
          </Typography>
          {isPracticeOwner(user) && (
            <Typography variant='subtitle1' color='var(--color-text-primary)'>
              You can also nominate a Practice Manager later to finish the setup
              on your behalf by clicking{' '}
              <Button
                variant='text'
                onClick={handleOnNominate}
                sx={{
                  padding: 0,
                  minWidth: 'auto',
                  textDecoration: 'underline',
                  fontWeight: 700,
                  color: 'var(--color-info-dark)'
                }}
              >
                here
              </Button>
              .
            </Typography>
          )}

          {isPracticeOwner(user) && (
            <Alert severity='info' className='alert-info-container'>
              <Typography
                className='alert-info-text font-weight--500'
                component='div'
                sx={{ margin: 0 }}
              >
                As Practice Owner, you always keep full control and can step
                back in anytime.
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 6,
          pb: 4.5,
          pt: 2.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}
      >
        <Stack direction={'row'} spacing={2.5} width={'100%'}>
          <Button onClick={onClose} variant='outlined' fullWidth>
            Continue onboarding
          </Button>
          <LoadingButton
            onClick={onConfirm}
            color='primary'
            variant='contained'
            fullWidth
            loading={confirmLoading}
          >
            Save & exit
          </LoadingButton>
        </Stack>

        <Box mt={2.5}>
          <HavingTrouble />
        </Box>
      </DialogActions>
    </Dialog>
  )
}

export default SaveAndExitDialogue
