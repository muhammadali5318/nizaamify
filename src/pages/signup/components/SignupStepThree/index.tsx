// FILE: src/pages/SignUp/components/SignupStepThree.tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import {
  Box,
  Stack,
  FormControlLabel,
  Checkbox,
  Typography,
  Button
} from '@mui/material'
import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import PasswordField from 'src/components/common/PasswordField'
import {
  SignupStepThreeSchema as PasswordSchema,
  SignupStepThreeFormValues as FormValues
} from 'src/schema-validations/signupStepThreeValidations'
import FormHeader from '../FormHeader'
import { StepPropsBase } from '../../types'
import { notify } from 'src/components/notistack/NotificationProvider'

type Props = Pick<
  StepPropsBase,
  'formData' | 'setFormData' | 'onBack' | 'onSubmit' | 'activeStep'
> & {
  isSubmitting?: boolean
  serverErrors?: Record<string, string>
}

const SignupStepThree: React.FC<Props> = ({
  formData,
  setFormData,
  onBack,
  onSubmit,
  activeStep,
  isSubmitting = false,
  serverErrors = {}
}) => {
  const {
    control,
    handleSubmit,
    watch,
    trigger,
    getValues,
    clearErrors,
    reset,
    formState: { isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(PasswordSchema),
    mode: 'onChange',
    defaultValues: {
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      terms: formData.terms,
      privacy: formData.privacy,
      disclaimer: formData.disclaimer,
      gdpr: formData.gdpr
    }
  })

  useEffect(() => {
    reset({
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      terms: formData.terms,
      privacy: formData.privacy,
      disclaimer: formData.disclaimer,
      gdpr: formData.gdpr
    })
  }, [formData, reset])

  const passwordValue = watch('password')
  useEffect(() => {
    const confirm = getValues('confirmPassword')
    if (!confirm) return

    if (passwordValue === confirm) {
      clearErrors('confirmPassword')
    } else {
      trigger('confirmPassword')
    }
  }, [passwordValue, getValues, trigger, clearErrors])

  const submit = (data: FormValues) => {
    // Push step 3 values to parent and call parent's final submit handler
    const patch = {
      password: data.password,
      confirmPassword: data.confirmPassword,
      terms: data.terms,
      privacy: data.privacy,
      disclaimer: data.disclaimer,
      gdpr: data.gdpr
    }

    setFormData(patch)
    onSubmit?.(patch)
  }

  const hasBlockingServerErrors =
    Boolean(serverErrors?.email) || Boolean(serverErrors?.practice)

  useEffect(() => {
    if (serverErrors?.email) {
      notify.error(serverErrors.email)
    }

    if (serverErrors?.practice) {
      notify.error(serverErrors.practice)
    }

    if (serverErrors?.general) {
      notify.error(serverErrors.general)
    }
  }, [serverErrors])

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
              startIcon={<ChevronLeft />}
            >
              Back
            </Button>

            <LoadingButton
              type='submit'
              size='large'
              variant='contained'
              color='primary'
              loading={isSubmitting}
              disabled={!isValid || hasBlockingServerErrors}
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
