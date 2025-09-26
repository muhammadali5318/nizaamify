// ------------------------------
// FILE: src/pages/SignUp/components/SignupStepOne.tsx
import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoadingButton } from '@mui/lab'
import { ChevronRight } from '@mui/icons-material'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import FormHeader from '../FormHeader'
import {
  SignupStepOneSchema,
  SignupStepOneFormValues as FormValues
} from 'src/schema-validations/signupStupOneValidations'
import { StepPropsBase } from '../../types'
import {
  Box,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert,
  Typography,
  FormControlLabel,
  Checkbox
} from '@mui/material'
import PhoneField from 'src/components/phone-field'

type Props = Pick<
  StepPropsBase,
  'formData' | 'setFormData' | 'onNext' | 'activeStep'
>

const SignupStepOne: React.FC<Props> = ({
  formData,
  setFormData,
  onNext,
  activeStep
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(SignupStepOneSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: formData.firstName,
      lastName: formData.lastName,
      role: formData.role,
      email: formData.email,
      phone: formData.phone,
      isPracticeOwnerOrDirector: formData.isPracticeOwnerOrDirector
    }
  })

  // When parent formData changes (e.g. user navigates back), reset local form to those values
  React.useEffect(() => {
    reset({
      firstName: formData.firstName,
      lastName: formData.lastName,
      role: formData.role,
      email: formData.email,
      phone: formData.phone,
      isPracticeOwnerOrDirector: formData.isPracticeOwnerOrDirector
    })
  }, [formData, reset])

  const onSubmit = (data: FormValues) => {
    const parsed = parsePhoneNumberFromString(data.phone || '')
    const normalizedPhone = parsed ? parsed.number : data.phone

    // update parent with values from this step (only on step submit)
    setFormData({
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      email: data.email,
      phone: normalizedPhone,
      isPracticeOwnerOrDirector: data.isPracticeOwnerOrDirector
    })

    onNext?.()
  }

  return (
    <Box component='section'>
      <FormHeader activeStep={activeStep} />

      <Box
        component='form'
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ mt: 2 }}
      >
        <Stack spacing={2.5}>
          {/* First & Last Name */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name='firstName'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='First name'
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name='lastName'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='Last name'
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>

          <Box>
            {/* Role Select */}
            <FormControl fullWidth error={!!errors.role}>
              <InputLabel id='role-label'>Role *</InputLabel>
              <Controller
                name='role'
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    labelId='role-label'
                    label='Role *'
                    variant='outlined'
                  >
                    <MenuItem value='COMPANY DIRECTOR'>
                      Company Director
                    </MenuItem>
                    <MenuItem value='PRACTICE OWNER'>
                      Practice Owner/Principal
                    </MenuItem>
                  </Select>
                )}
              />
              <FormHelperText>{errors.role?.message}</FormHelperText>
            </FormControl>

            <Alert severity='info' className='alert-info-container'>
              <Typography
                className='alert-info-text font-weight--700'
                component='div'
                sx={{ margin: 0 }}
              >
                Only Practice Owners or Company Directors can register. If you
                have another role, please ask your Practice Owner to invite you.
              </Typography>
            </Alert>

            <Controller
              name='isPracticeOwnerOrDirector'
              control={control}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label={
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
                    }
                  />
                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ marginTop: '14px !important' }}
          >
            <Controller
              name='email'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='Email'
                  required
                  type='email'
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <PhoneField control={control} name='phone' />
          </Stack>

          {/* Submit */}
          <Stack direction='row' justifyContent='flex-end'>
            <LoadingButton
              type='submit'
              size='large'
              variant='contained'
              color='primary'
              disabled={!isValid}
              endIcon={<ChevronRight />}
            >
              Next
            </LoadingButton>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

export default SignupStepOne
