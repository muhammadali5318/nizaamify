import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Alert
} from '@mui/material'

type SaveAndExitDialogueProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

const SaveAndExitDialogue: React.FC<SaveAndExitDialogueProps> = ({
  open,
  onClose,
  onConfirm
}) => {
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
            Want to finish this later?{' '}
          </Typography>
          <Typography variant='subtitle1' color='var(--color-text-primary)'>
            Your progress will be saved, and you can return anytime to continue.
          </Typography>
          <Typography variant='subtitle1' color='var(--color-text-primary)'>
            ⚠️ Practice setup is essential without completing onboarding, monai
            won’t work properly for your team.
          </Typography>
          <Typography variant='subtitle1' color='var(--color-text-primary)'>
            You can also nominate a Practice Manager later to finish the setup
            on your behalf by clicking{' '}
            <span className='color-info--dark font-weight--700 text-decoration--underline'>
              here
            </span>
            .
          </Typography>

          <Alert severity='info' className='alert-info-container'>
            <Typography
              className='alert-info-text font-weight--500'
              component='div'
              sx={{ margin: 0 }}
            >
              As Practice Owner, you always keep full control and can step back
              in anytime.
            </Typography>
          </Alert>
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
          <Button
            onClick={onConfirm}
            color='primary'
            variant='contained'
            fullWidth
          >
            Save & exit
          </Button>
        </Stack>

        <Typography
          mt={2.5}
          variant='subtitle1'
          color='var(--color-text-secondary)'
        >
          Having trouble? Please{' '}
          <span className='info-main font-weight--700'>Contact Support.</span>
        </Typography>
      </DialogActions>
    </Dialog>
  )
}

export default SaveAndExitDialogue
