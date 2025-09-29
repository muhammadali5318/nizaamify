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
  MenuItem,
  FormHelperText
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import RenderUlList from '../render-ul-list'
import { LoadingButton } from '@mui/lab'
import { useSendInvite } from 'src/hooks/useSendInvite'
import { useAuth0 } from '@auth0/auth0-react'
import { paths } from 'src/paths'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useNavigate } from 'react-router'

type Props = {
  open: boolean
  onClose: () => void
  onSend?: (payload: { email: string; role: string }) => void
  isLoading?: boolean
}

const ALLOWED_ROLES = ['PRACTICE MANAGER', 'PRACTICE OWNER'] as const

const schema = z.object({
  email: z
    .string()
    .nonempty('Email is required')
    .refine((val) => /\S+@\S+\.\S+/.test(val), {
      message: 'Enter a valid email address'
    }),
  role: z
    .string()
    .nonempty('Role is required')
    .refine((val) => (ALLOWED_ROLES as readonly string[]).includes(val), {
      message: 'Select a valid role'
    })
})

type FormValues = z.infer<typeof schema>

export default function NominatePracticeManagerDialog({
  open,
  onClose
}: Props) {
  const { user } = useAuth0()
  const orgUuid = getUserOrgUuid(user)
  const { mutate: sendInvite, isPending } = useSendInvite(orgUuid)
  const navigate = useNavigate()

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      role: 'PRACTICE MANAGER'
    }
  })

  useEffect(() => {
    if (!open) {
      reset({
        email: '',
        role: 'PRACTICE MANAGER'
      })
    }
  }, [open, reset])

  const onSubmit = (data: FormValues) => {
    sendInvite(
      { ...data, isNominated: true },
      {
        onSuccess: () => {
          onClose()
          navigate(
            `${paths.practiceOnboarding}?step=INVITATION_SENT&email=${encodeURIComponent(
              data.email
            )}&role=${encodeURIComponent(data.role)}`
          )
        },
        onError: (err: any) => {
          const msg = err?.message

          const looksLikeAlreadyExists = /invited|already/i.test(String(msg))

          if (looksLikeAlreadyExists) {
            setError('email', {
              type: 'server',
              message: 'This email has already been invited to this practice.'
            })
            return
          }
        }
      }
    )
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
                  onChange={(e) => {
                    field.onChange(e)
                    if (errors.email?.type === 'server') {
                      clearErrors('email')
                    }
                  }}
                />
              )}
            />

            {/* Role Dropdown */}
            <Controller
              name='role'
              control={control}
              render={({ field }) => (
                <FormControl fullWidth required error={!!errors.role}>
                  <InputLabel id='role-select-label'>Role</InputLabel>
                  <Select
                    {...field}
                    labelId='role-select-label'
                    label='Role'
                    value={field.value ?? 'PRACTICE MANAGER'}
                    disabled
                  >
                    <MenuItem value='PRACTICE MANAGER'>
                      Practice Manager
                    </MenuItem>
                  </Select>
                  {errors.role && (
                    <FormHelperText>{errors.role.message}</FormHelperText>
                  )}
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
            <LoadingButton
              fullWidth
              variant='contained'
              type='submit'
              // disable if form invalid, pending, or email has an error
              disabled={!isValid || isPending || !!errors.email}
              aria-label='send-invitation'
              loading={isPending}
            >
              Send invitation
            </LoadingButton>
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  )
}
