// FILE: src/components/settings/ChangePassword.tsx
import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button, Stack } from '@mui/material'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import PasswordField from 'src/components/common/PasswordField'
import { useUpdateUserProfile } from '../hooks/useUserProfile'
import { notify } from 'src/components/notistack/NotificationProvider'

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
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password cannot be the same as current password',
    path: ['newPassword']
  })

export type ChangePasswordFormValues = z.infer<typeof ChangePasswordSchema>

const Security = () => {
  const {
    control,
    handleSubmit,
    watch,
    getValues,
    reset,
    trigger,
    clearErrors,
    setError,
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

  const { mutateAsync, isPending } = useUpdateUserProfile()

  const newPassword = watch('newPassword')
  const currentPassword = watch('currentPassword')

  useEffect(() => {
    const confirm = getValues('confirmPassword')
    if (!confirm) return

    if (newPassword === confirm) {
      clearErrors('confirmPassword')
    } else {
      void trigger('confirmPassword')
    }
  }, [newPassword, trigger, clearErrors, getValues])

  useEffect(() => {
    if (!newPassword) return
    void trigger('newPassword')
  }, [currentPassword, newPassword, trigger])

  const defaultSubmit = async (data: ChangePasswordFormValues) => {
    const payload = {
      current_password: data.currentPassword,
      new_password: data.newPassword,
      confirm_password: data.confirmPassword
    }

    try {
      await mutateAsync(payload as any)
      notify.success('Password changed successfully')
      reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (err: any) {
      if (err?.error?.current_password) {
        setError('currentPassword', {
          type: 'server',
          message: err.error.current_password[0]
        })
      } else if (
        err?.error?.toLowerCase()?.includes('password has previously')
      ) {
        setError('newPassword', {
          type: 'server',
          message: 'Password has been used before. Please choose a new one.'
        })
      } else {
        setError('currentPassword', {
          type: 'server',
          message: err?.message || 'Failed to change password'
        })
      }
    }
  }

  const submit = (data: ChangePasswordFormValues) => {
    defaultSubmit(data)
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
              type='submit'
              size='large'
              variant='contained'
              loading={isPending}
              disabled={!isDirty || !isValid}
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

export default Security
