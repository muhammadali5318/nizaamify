import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  Stack,
  Button,
  Checkbox,
  FormControlLabel,
  Typography
} from '@mui/material'
import FormHeader from '../FormHeader'
import PasswordField from 'src/components/common/PasswordField'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import {
  SignupStepThreeSchema as PasswordSchema,
  SignupStepThreeFormValues as FormValues
} from 'src/schema-validations/signupStepThreeValidations'
import { SignupStepThreeProps } from '../../types'

const SignupStepThree: React.FC<SignupStepThreeProps> = ({
  onBack,
  onSubmit,
  activeStep,
  setActiveStep
}) => {
  const {
    control,
    handleSubmit,
    watch,
    trigger,
    getValues,
    clearErrors,
    formState: { isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(PasswordSchema),
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: '',
      terms: false,
      privacy: false,
      disclaimer: false,
      gdpr: false
    }
  })

  const passwordValue = watch('password')
  useEffect(() => {
    const confirm = getValues('confirmPassword')
    // If confirmPassword is empty, skip (no need to trigger)
    if (!confirm) return

    if (passwordValue === confirm) {
      // passwords match -> clear confirm error (if any)
      clearErrors('confirmPassword')
    } else {
      // passwords don't match -> re-run validation to show correct error (or clear)
      // trigger returns a boolean but we don't need it here
      trigger('confirmPassword')
    }
  }, [passwordValue, getValues, trigger, clearErrors])

  const submit = (data: FormValues) => {
    if (onSubmit) onSubmit(data)
    setActiveStep(3)
  }

  return (
    <Box>
      <FormHeader activeStep={activeStep} />

      <Box
        component='form'
        onSubmit={handleSubmit(submit)}
        noValidate
        sx={{ mt: 2 }}
      >
        <Stack spacing={2.5}>
          <PasswordField
            helperText='Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.'
            name='password'
            label='Password'
            control={control}
          />
          <PasswordField
            name='confirmPassword'
            label='Confirm Password'
            control={control}
          />

          <Stack>
            <Controller
              name='terms'
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label={
                    <Typography variant='body1'>
                      I agree to the{' '}
                      <span className='info-main font-weight--700'>
                        Terms of Service
                      </span>
                    </Typography>
                  }
                />
              )}
            />
            <Controller
              name='privacy'
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label={
                    <Typography variant='body1'>
                      I agree to the{' '}
                      <span className='info-main font-weight--700'>
                        Privacy Policy
                      </span>
                    </Typography>
                  }
                />
              )}
            />
            <Controller
              name='disclaimer'
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label={
                    <Typography variant='body1'>
                      I acknowledge the{' '}
                      <span className='info-main font-weight--700'>
                        Financial Disclaimer
                      </span>
                    </Typography>
                  }
                />
              )}
            />
            <Controller
              name='gdpr'
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label={
                    <Typography variant='body1'>
                      I consent to data usage under{' '}
                      <span className='info-main font-weight--700'>GDPR</span>
                    </Typography>
                  }
                />
              )}
            />
          </Stack>

          <Stack direction='row' justifyContent='space-between'>
            <Button
              size='large'
              variant='outlined'
              color='primary'
              onClick={onBack}
              loadingPosition='end'
              startIcon={<ChevronLeft />}
            >
              Back
            </Button>

            <LoadingButton
              type='submit'
              size='large'
              variant='contained'
              color='primary'
              disabled={!isValid}
              loading={false}
              loadingPosition='end'
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

export default SignupStepThree
