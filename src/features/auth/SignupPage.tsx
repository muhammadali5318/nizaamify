import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { signupSchema, type SignupValues } from './schemas'
import { supabase } from 'src/lib/supabase'
import { paths } from 'src/paths'
import AuthLayout from './AuthLayout'

export default function SignupPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema(t)),
    defaultValues: { email: '', password: '', confirmPassword: '' }
  })

  const onSubmit = async (values: SignupValues) => {
    setServerError(null)
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password
    })
    if (error) {
      const code = error.message?.toLowerCase() ?? ''
      if (code.includes('already') || code.includes('registered')) {
        setServerError(t('auth:errors.email_taken'))
      } else {
        setServerError(t('auth:errors.generic'))
      }
      return
    }
    navigate(`${paths.verifyEmail}?email=${encodeURIComponent(values.email)}`)
  }

  return (
    <AuthLayout
      title={t('auth:signup.title')}
      subtitle={t('auth:signup.subtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2}>
          {serverError && <Alert severity='error'>{serverError}</Alert>}

          <TextField
            label={t('auth:signup.email_label')}
            type='email'
            autoComplete='email'
            fullWidth
            {...register('email')}
            error={!!errors.email}
            helperText={errors.email?.message}
          />

          <TextField
            label={t('auth:signup.password_label')}
            type='password'
            autoComplete='new-password'
            fullWidth
            {...register('password')}
            error={!!errors.password}
            helperText={errors.password?.message}
          />

          <TextField
            label={t('auth:signup.confirm_password_label')}
            type='password'
            autoComplete='new-password'
            fullWidth
            {...register('confirmPassword')}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
          />

          <Button
            type='submit'
            variant='contained'
            size='large'
            disabled={isSubmitting}
          >
            {t('auth:signup.submit')}
          </Button>

          <Typography variant='body2' textAlign='center'>
            {t('auth:signup.have_account')}{' '}
            <RouterLink
              to={paths.login}
              style={{ color: 'inherit', fontWeight: 600 }}
            >
              {t('auth:signup.login_link')}
            </RouterLink>
          </Typography>
        </Stack>
      </form>
    </AuthLayout>
  )
}
