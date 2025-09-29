// FILE: src/components/settings/ChangePassword.tsx
import React, { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoadingButton } from '@mui/lab'
import { Box, Stack, Button } from '@mui/material'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import PasswordField from 'src/components/common/PasswordField'

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(
        8,
        'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.'
      )
      .max(50, 'Password must not exceed 50 characters')
      .refine((val) => /[A-Z]/.test(val), {
        message: 'Password must contain at least one uppercase letter'
      })
      .refine((val) => /\d/.test(val), {
        message: 'Password must contain at least one number'
      })
      .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
        message: 'Password must contain at least one special character'
      }),
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  })

export type ChangePasswordFormValues = z.infer<typeof ChangePasswordSchema>

type Props = {
  isSubmitting?: boolean
  serverErrors?: Record<string, string>
  onSubmit?: (payload: { currentPassword: string; newPassword: string }) => void
  onCancel?: () => void
}

const Security: React.FC<Props> = ({
  isSubmitting = false,
  onSubmit,
  onCancel
}) => {
  const {
    control,
    handleSubmit,
    watch,
    getValues,
    reset,
    trigger,
    clearErrors,
    formState: { isValid, isDirty }
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(ChangePasswordSchema),
    mode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  })

  const newPassword = watch('newPassword')
  useEffect(() => {
    const confirm = getValues('confirmPassword')
    if (!confirm) return

    if (newPassword === confirm) {
      clearErrors('confirmPassword')
    } else {
      void trigger('confirmPassword')
    }
  }, [newPassword, getValues, trigger, clearErrors])

  const submit = (data: ChangePasswordFormValues) => {
    onSubmit?.({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    })
  }

  return (
    <Box>
      <Box
        component='form'
        noValidate
        onSubmit={handleSubmit(submit)}
        sx={{ mt: 1 }}
      >
        <Stack spacing={2}>
          <PasswordField
            name='currentPassword'
            label='Current password'
            control={control}
          />

          <PasswordField
            name='newPassword'
            label='New password'
            control={control}
            helperText='Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.'
          />

          <PasswordField
            name='confirmPassword'
            label='Confirm new password'
            control={control}
          />

          <Stack direction='row' spacing={2.5}>
            <Button
              size='large'
              variant='outlined'
              onClick={() => {
                reset({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: ''
                })
                onCancel?.()
              }}
            >
              Cancel
            </Button>

            <LoadingButton
              type='submit'
              size='large'
              variant='contained'
              loading={isSubmitting}
              disabled={!isDirty || !isValid}
            >
              Save
            </LoadingButton>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

export default Security
