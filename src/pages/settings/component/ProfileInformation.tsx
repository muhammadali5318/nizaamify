// src/components/ProfileInformation.tsx
import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller, Control, Path } from 'react-hook-form'
import { z } from 'zod'
import { Box, Stack, TextField, MenuItem, Button } from '@mui/material'
import PhoneField from 'src/components/phone-field'
import { capitalizeFirstLetter } from 'src/utils/stringUtils'
import { mapUserApiToForm, mapUserFormToApi } from '../setting-config'
import { useUpdateUserProfile, useUserProfile } from '../hooks/useUserProfile'
import parsePhoneNumberFromString from 'libphonenumber-js'
import { notify } from 'src/components/notistack/NotificationProvider'
import { queryClient } from 'src/utils/queryClient'
import useUserDetails from 'src/hooks/useUserDetails'

const profileSchema = z.object({
  firstName: z
    .string()
    .nonempty('First name is required')
    .max(148, 'Last name must be less than 149 characters'),
  lastName: z
    .string()
    .nonempty('Last name is required')
    .max(148, 'Last name must be less than 149 characters'),
  email: z
    .string()
    .nonempty('Email is required')
    .pipe(z.email('Please enter a valid email')),
  role: z.string().optional(),
  phone: z
    .string()
    .nonempty('Phone is required')
    .refine(
      (val) => {
        const phoneNumber = parsePhoneNumberFromString(val || '')
        return phoneNumber?.isValid() ?? false
      },
      {
        message: 'Please enter a valid phone number'
      }
    )
})

type ProfileForm = z.infer<typeof profileSchema>

const ProfileInformation = () => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid, isSubmitting }
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      phone: ''
    },
    mode: 'onChange'
  })

  const { data: apiProfile, isLoading: isFetching } = useUserProfile()

  const { mutateAsync: updateProfile, isPending: isUpdating } =
    useUpdateUserProfile()

  const { userRole } = useUserDetails()

  useEffect(() => {
    if (!apiProfile && !userRole) return

    const mapped = apiProfile ? mapUserApiToForm(apiProfile) : {}

    const roleValue = userRole

    reset({
      ...mapped,
      role: roleValue ?? undefined
    })
  }, [apiProfile, userRole])

  const submit = async (values: ProfileForm) => {
    const payload = mapUserFormToApi(values)
    await updateProfile(payload)
    await queryClient.invalidateQueries({
      queryKey: ['UserWithActivePracticeData']
    })
    notify.success('Your profile has been updated successfully.')
    reset(values)
  }

  return (
    <Box>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box flex={1}>
              <Controller
                name='firstName'
                control={control as unknown as Control<ProfileForm>}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label='First name'
                    fullWidth
                    required
                    error={!!errors.firstName}
                    helperText={errors.firstName?.message}
                    slotProps={{
                      input: {
                        'aria-label': 'first-name'
                      }
                    }}
                  />
                )}
              />
            </Box>

            <Box flex={1}>
              <Controller
                name='lastName'
                control={control as unknown as Control<ProfileForm>}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label='Last name'
                    fullWidth
                    required
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message}
                    slotProps={{
                      input: {
                        'aria-label': 'last-name'
                      }
                    }}
                  />
                )}
              />
            </Box>
          </Stack>

          <Box>
            <Controller
              name='email'
              control={control as unknown as Control<ProfileForm>}
              render={({ field }) => (
                <TextField
                  {...field}
                  label='Email'
                  fullWidth
                  required
                  disabled
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  slotProps={{
                    input: {
                      'aria-label': 'email'
                    }
                  }}
                />
              )}
            />
          </Box>

          <Box>
            <Controller
              name='role'
              control={control as unknown as Control<ProfileForm>}
              render={({ field }) => (
                <TextField
                  {...field}
                  label='Role'
                  select
                  fullWidth
                  helperText={errors.role?.message}
                  slotProps={{
                    input: {
                      'aria-label': 'role'
                    }
                  }}
                  disabled
                >
                  {userRole ? (
                    <MenuItem value={userRole}>
                      {capitalizeFirstLetter(userRole)}
                    </MenuItem>
                  ) : (
                    <MenuItem value='' disabled>
                      No role available
                    </MenuItem>
                  )}
                </TextField>
              )}
            />
          </Box>

          <Box>
            <PhoneField
              control={control as unknown as Control<ProfileForm>}
              name={'phone' as Path<ProfileForm>}
              label='Phone number'
            />
          </Box>

          <Stack direction={'row'} spacing={2.5} mt={2}>
            <Button
              type='submit'
              variant='contained'
              size='large'
              loading={isSubmitting || isFetching || isUpdating}
              disabled={
                !isDirty || !isValid || isSubmitting || isFetching || isUpdating
              }
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </form>
    </Box>
  )
}

export default ProfileInformation
