import React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { Box, Stack, TextField, Button, MenuItem } from '@mui/material'
import { LoadingButton } from '@mui/lab'
import PhoneField from 'src/components/phone-field'

// --- Zod schema ---
const profileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  role: z.string().optional(),
  phone: z.string().optional()
})

type ProfileForm = z.infer<typeof profileSchema>

type Props = {
  /** initial data to populate form (optional) */
  initialData?: Partial<ProfileForm>
  /** optional save handler from parent */
  onSave?: (values: ProfileForm) => Promise<void> | void
  /** optional cancel handler from parent */
  onCancel?: () => void
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' }
]

const ProfileInformation: React.FC<Props> = ({
  initialData = {},
  onSave,
  onCancel
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid, isSubmitting }
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: initialData.firstName ?? '',
      lastName: initialData.lastName ?? '',
      email: initialData.email ?? '',
      role: initialData.role ?? '',
      phone: initialData.phone ?? ''
    },
    mode: 'onChange'
  })

  const submit = async (values: ProfileForm) => {
    try {
      if (onSave) {
        await onSave(values)
      } else {
        // eslint-disable-next-line no-console
        console.log('values')
      }
      reset(values)
    } catch (err) {
      console.error('Failed to save profile', err)
    }
  }

  const handleCancel = () => {
    // revert to initialData (or empty values)
    reset({
      firstName: initialData.firstName ?? '',
      lastName: initialData.lastName ?? '',
      email: initialData.email ?? '',
      role: initialData.role ?? '',
      phone: initialData.phone ?? ''
    })
    if (onCancel) onCancel()
  }

  return (
    <Box>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack spacing={2}>
          {/* name fields: stacked on small screens, side-by-side on md+ */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box flex={1}>
              <Controller
                name='firstName'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label='First name'
                    fullWidth
                    required
                    error={!!errors.firstName}
                    helperText={errors.firstName?.message}
                    slotProps={{ htmlInput: { 'aria-label': 'first-name' } }}
                  />
                )}
              />
            </Box>

            <Box flex={1}>
              <Controller
                name='lastName'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label='Last name'
                    fullWidth
                    required
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message}
                    slotProps={{ htmlInput: { 'aria-label': 'last-name' } }}
                  />
                )}
              />
            </Box>
          </Stack>

          <Box>
            <Controller
              name='email'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label='Email'
                  fullWidth
                  required
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  slotProps={{ htmlInput: { 'aria-label': 'email' } }}
                />
              )}
            />
          </Box>

          <Box>
            <Controller
              name='role'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label='Role'
                  select
                  fullWidth
                  required
                  helperText={errors.role?.message}
                  slotProps={{ htmlInput: { 'aria-label': 'role' } }}
                >
                  <MenuItem value=''>Select role</MenuItem>
                  {ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Box>

          <Box>
            <PhoneField control={control} name={'phone'} label='Phone number' />
          </Box>

          <Stack direction={'row'} spacing={2.5} mt={2}>
            <Button variant='outlined' size='large' onClick={handleCancel}>
              Cancel
            </Button>

            <LoadingButton
              type='submit'
              variant='contained'
              size='large'
              loading={isSubmitting}
              disabled={!isDirty || !isValid || isSubmitting}
            >
              Save
            </LoadingButton>
          </Stack>
        </Stack>
      </form>
    </Box>
  )
}

export default ProfileInformation
