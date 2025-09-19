import { useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import RenderUlList from '../render-ul-list'

type Props = {
  open: boolean
  onClose: () => void
  onSend?: (payload: { email: string; role: string }) => void
}

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.enum(['Practice Manager', 'Practice Owner/Principal'])
})

type FormValues = z.infer<typeof schema>

export default function NominatePracticeManagerDialog({
  open,
  onClose,
  onSend
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      role: 'Practice Manager'
    }
  })

  useEffect(() => {
    if (!open) {
      reset({
        email: '',
        role: 'Practice Manager'
      })
    }
  }, [open, reset])

  const onSubmit = (data: FormValues) => {
    onSend?.({ email: data.email.trim(), role: data.role })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth='sm'
      aria-labelledby='nominate-dialog-title'
    >
      <DialogTitle
        id='nominate-dialog-title'
        sx={{
          padding: '36px 48px 0px 37px'
        }}
      >
        <img src='/assets/nominate.svg' alt='nominate icon' />
        <Stack direction='row' spacing={2} alignItems='center' mt={2}>
          <Box>
            <Typography variant='h6' component='div'>
              Nominate your practice manager
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Enter your practice manager’s email below. They’ll receive an
              invitation to complete the onboarding process on your behalf.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ padding: '20px 37px 0px 37px' }}>
          <Stack spacing={2}>
            {/* Email Field */}
            <Controller
              name='email'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Practice manager's email"
                  type='email'
                  fullWidth
                  required
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  placeholder='name@example.com'
                />
              )}
            />

            {/* Role Dropdown */}
            <Controller
              name='role'
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel id='role-select-label'>Role</InputLabel>
                  <Select {...field} labelId='role-select-label' label='Role'>
                    <MenuItem value='Practice Manager'>
                      Practice Manager
                    </MenuItem>
                    <MenuItem value='Practice Owner/Principal'>
                      Practice Owner/Principal
                    </MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Stack>

          {/* Info List */}
          <Box mt={2.5}>
            <Typography
              variant='h6'
              color='var(--color-text-primary)'
              className='font-weight--700'
            >
              What happens next:
            </Typography>
            <RenderUlList
              items={[
                'Your practice manager will receive an invitation email.',
                'They’ll be able to create their account and complete the practice setup.',
                'You’ll retain full administrative access as the practice owner.',
                'You can monitor progress and step in any time.'
              ]}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 4.5, pt: 2.5, pb: 4.5 }}>
          <Stack direction={'row'} spacing={2.5} width={'100%'}>
            <Button
              fullWidth
              variant='outlined'
              onClick={onClose}
              aria-label='cancel'
            >
              Cancel
            </Button>
            <Button
              fullWidth
              variant='contained'
              type='submit'
              disabled={!isValid}
              aria-label='send-invitation'
            >
              Send invitation
            </Button>
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  )
}
