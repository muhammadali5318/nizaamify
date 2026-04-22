import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { StepProps } from '../../type'
import PasswordField from 'src/components/common/PasswordField'
import { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import styles from './switchSteps.module.scss'
import PageHeader from 'src/components/page-header'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { notify } from 'src/components/notistack/NotificationProvider'

export const ChangePasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  currentPassword: z.string().min(1, 'Current password is required')
})

export type ChangePasswordFormValues = z.infer<typeof ChangePasswordSchema>

const StepTwo: React.FC<StepProps> = ({ onNext, onBack }) => {
  const { activePracticeId } = useActivePractice()
  const [apiError, setApiError] = useState('')

  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { isValid, isDirty, isSubmitting, errors }
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(ChangePasswordSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      currentPassword: ''
    }
  })

  const email = watch('email')
  const currentPassword = watch('currentPassword')

  useEffect(() => {
    if (apiError) {
      setApiError('')
      clearErrors('root')
    }
  }, [email, currentPassword])
  const onSubmit = async (data: ChangePasswordFormValues) => {
    try {
      setApiError('')
      clearErrors('root')

      await apiClient.post(
        endpoints.accountingBasis.verifyIdentity(activePracticeId ?? ''),
        {
          email: data.email,
          password: data.currentPassword
        }
      )

      await apiClient.post(
        endpoints.accountingBasis.sendOtp(activePracticeId ?? ''),
        {
          email: data.email
        }
      )

      notify.success('OTP has been successfully sent to your email address.')
      onNext()
    } catch {
      const message =
        'The email or password you entered is incorrect. Please try again.'

      setApiError(message)
      setError('root', {
        type: 'manual',
        message
      })
    }
  }

  const rootErrorMessage = errors.root?.message || apiError

  return (
    <Box className={styles.stepTwoRoot}>
      <Box className={styles.stepTwoContainer}>
        <Typography variant='subtitle1' color='text.secondary'>
          Step 2 of 5
        </Typography>

        <Stack spacing={2}>
          <PageHeader
            isDividerVisible={false}
            title={'Confirm Your Identity'}
            description={
              'For security purposes, please re-enter your account credentials to continue.'
            }
            logo={'/assets/security.svg'}
          />

          <Controller
            name='email'
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                label='Email'
                required
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Box>
            <PasswordField
              name='currentPassword'
              label='Current password'
              control={control}
            />

            {rootErrorMessage ? (
              <Typography variant='body2' color='error' px={1} pt={1}>
                {rootErrorMessage}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        <Stack direction='row' spacing={2} className={styles.actions}>
          <Button variant='outlined' onClick={onBack} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button
            variant='contained'
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty || !isValid || !!apiError || isSubmitting}
          >
            Continue
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

export default StepTwo
