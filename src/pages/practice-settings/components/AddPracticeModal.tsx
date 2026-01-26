// AddPracticeModal.tsx
import React, { useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Stack,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Checkbox,
  FormHelperText
} from '@mui/material'
import { useForm, Controller, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ukPostcodeRegex, OWNER_ROLES } from 'src/const'
import useUserDetails from 'src/hooks/useUserDetails'
import { endpoints } from 'src/services/backendUrl'
import apiClient from 'src/services/api-client'
import { notify } from 'src/components/notistack/NotificationProvider'
import { queryClient } from 'src/utils/queryClient'
import { z } from 'zod'
import { useAuth0 } from '@auth0/auth0-react'

const SignupStepTwoSchema = z.object({
  practiceName: z
    .string()
    .trim()
    .min(1, 'Practice name is required')
    .max(40, 'Practice name must not exceed 40 characters'),

  role: z.string().min(1, 'Role is required'),

  isPracticeOwnerOrDirector: z.boolean().refine((v) => v === true, {
    message: 'You must confirm you are a Practice Owner and/or Company Director'
  }),

  street: z.string().trim().min(1, 'Street is required'),

  city: z.string().trim().min(1, 'City is required'),

  postcode: z
    .string()
    .trim()
    .min(1, 'Postcode is required')
    .refine((v) => ukPostcodeRegex.test(v), {
      message: 'Enter a valid UK postcode'
    }),

  practiceEmail: z
    .string()
    .trim()
    .min(1, 'Practice email is required')
    .email('Please enter a valid email')
})

export type SignupFormValues = z.infer<typeof SignupStepTwoSchema>

interface PracticeApiPayload {
  practice_name: string
  address: string
  postcode: string
  email: string
  user_role: string
}

const buildPracticePayload = (data: SignupFormValues): PracticeApiPayload => {
  const practice_name = data.practiceName.trim()
  const postcode = data.postcode
  const email = data.practiceEmail.trim()
  const address = `${data.street.trim()}, ${data.city.trim()}`
  const user_role = data.role

  return {
    practice_name,
    address,
    postcode,
    email,
    user_role
  }
}

interface AddPracticeDialogProps {
  open: boolean
  onClose: () => void
}

const AddPracticeModal: React.FC<AddPracticeDialogProps> = ({
  open,
  onClose
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting }
  } = useForm<SignupFormValues>({
    resolver: zodResolver(SignupStepTwoSchema),
    defaultValues: {
      practiceName: '',
      role: '',
      isPracticeOwnerOrDirector: false,
      street: '',
      city: '',
      postcode: '',
      practiceEmail: ''
    },
    mode: 'onChange',
    reValidateMode: 'onChange'
  })

  const { userId } = useUserDetails()
  const { getAccessTokenSilently } = useAuth0()

  const handleClose = useCallback(() => {
    if (isSubmitting) return
    reset()
    onClose()
  }, [isSubmitting, reset, onClose])

  const onSubmit: SubmitHandler<SignupFormValues> = useCallback(
    async (data) => {
      const payload = buildPracticePayload(data)
      try {
        await apiClient.post(endpoints.listAllPractices(userId ?? ''), payload)
        await queryClient.invalidateQueries({
          queryKey: ['listAllPracticesData']
        })
        const token = await getAccessTokenSilently({
          cacheMode: 'off'
        })
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`

        reset()
        onClose()
        notify.success('practice has been created successfully')
      } catch (error: any) {
        notify.error(error?.error?.non_field_errors?.[0])
      }
    },
    []
  )

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth='sm'
      aria-labelledby='add-practice-dialog-title'
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
      <DialogTitle sx={{ p: 0, mb: '12px' }} id='add-practice-dialog-title'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <img
            src='/assets/practice-selector-rounded.svg'
            alt='practice icon'
            style={{ width: 80, height: 80 }}
          />
          <Box>
            <Typography
              className='font-weight--700'
              sx={{ typography: { xs: 'h6', sm: 'h5' } }}
            >
              Add new practice
            </Typography>
            <Typography variant='subtitle1' color='text.secondary'>
              Basic practice details
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ p: 0 }}>
          <Stack mt={1} spacing={2}>
            <Box display='flex' gap={1}>
              <Controller
                name='practiceName'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    id='practiceName'
                    label='Practice name'
                    fullWidth
                    required
                    inputProps={{ maxLength: 40, autoComplete: 'organization' }}
                    error={!!errors.practiceName}
                    helperText={errors.practiceName?.message}
                    aria-invalid={!!errors.practiceName}
                    aria-describedby={
                      errors.practiceName ? 'practiceName-error' : undefined
                    }
                  />
                )}
              />

              <Controller
                name='role'
                control={control}
                render={({ field, fieldState }) => (
                  <FormControl
                    fullWidth
                    required
                    error={!!fieldState.error}
                    size='medium'
                  >
                    <InputLabel id='role-label'>Role</InputLabel>
                    <Select
                      {...field}
                      labelId='role-label'
                      id='role'
                      label='Role'
                      inputProps={{
                        'aria-describedby': fieldState.error
                          ? 'role-error'
                          : undefined
                      }}
                    >
                      {OWNER_ROLES.map((role) => (
                        <MenuItem key={role.value} value={role.value}>
                          {role.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error && (
                      <FormHelperText id='role-error'>
                        {fieldState.error.message}
                      </FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Box>

            <Controller
              name='isPracticeOwnerOrDirector'
              control={control}
              render={({ field, fieldState }) => (
                <FormControl
                  error={!!fieldState.error}
                  component='fieldset'
                  variant='standard'
                >
                  <Stack direction='row' alignItems='center' spacing={1}>
                    <Checkbox
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      onBlur={field.onBlur}
                      name={field.name}
                      inputProps={{
                        'aria-label': 'Confirm practice owner or director'
                      }}
                    />
                    <Typography variant='body1'>
                      I am{' '}
                      <span className='info-main font-weight--700'>
                        Practice Owner
                      </span>{' '}
                      and/or{' '}
                      <span className='info-main font-weight--700'>
                        Company Director
                      </span>{' '}
                      *
                    </Typography>
                  </Stack>
                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />

            <Stack spacing={2}>
              <Typography
                variant='h6'
                color='var(--color-primary-black)'
                fontWeight={700}
              >
                Practice address
              </Typography>

              <Controller
                name='street'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    id='street'
                    label='Street'
                    fullWidth
                    required
                    inputProps={{ autoComplete: 'street-address' }}
                    error={!!errors.street}
                    helperText={errors.street?.message}
                    aria-invalid={!!errors.street}
                  />
                )}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Controller
                  name='city'
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      id='city'
                      label='City'
                      fullWidth
                      required
                      inputProps={{ autoComplete: 'address-level2' }}
                      error={!!errors.city}
                      helperText={errors.city?.message}
                      aria-invalid={!!errors.city}
                    />
                  )}
                />
              </Stack>

              <Controller
                name='postcode'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    id='postcode'
                    label='Postcode'
                    fullWidth
                    required
                    inputProps={{ autoComplete: 'postal-code' }}
                    error={!!errors.postcode}
                    helperText={errors.postcode?.message}
                    aria-invalid={!!errors.postcode}
                  />
                )}
              />

              <Controller
                name='practiceEmail'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    id='practiceEmail'
                    label='Practice email address'
                    type='email'
                    fullWidth
                    required
                    inputProps={{ autoComplete: 'email' }}
                    error={!!errors.practiceEmail}
                    helperText={errors.practiceEmail?.message}
                    aria-invalid={!!errors.practiceEmail}
                  />
                )}
              />
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 0, mt: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            <Button
              variant='outlined'
              onClick={handleClose}
              disabled={isSubmitting}
              fullWidth
              size='large'
            >
              Cancel
            </Button>

            <Button
              type='submit'
              variant='contained'
              disabled={isSubmitting || !isValid}
              fullWidth
              size='large'
              startIcon={
                isSubmitting ? <CircularProgress size={16} /> : undefined
              }
              sx={{
                textTransform: 'none'
              }}
            >
              {isSubmitting ? 'Saving...' : 'Add practice'}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default React.memo(AddPracticeModal)
