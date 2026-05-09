import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { loginSchema, type LoginValues } from './schemas'
import { supabase } from 'src/lib/supabase'
import { paths } from 'src/paths'
import AuthLayout from './AuthLayout'

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema(t)),
    defaultValues: { email: '', password: '' }
  })

  const onSubmit = async (values: LoginValues) => {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password
    })
    if (error) {
      setServerError(t('auth:errors.invalid_credentials'))
      return
    }
    navigate(paths.dashboard, { replace: true })
  }

  return (
    <AuthLayout
      title={t('auth:login.title')}
      subtitle={t('auth:login.subtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2}>
          {serverError && <Alert severity='error'>{serverError}</Alert>}

          <TextField
            label={t('auth:login.email_label')}
            type='email'
            autoComplete='email'
            fullWidth
            {...register('email')}
            error={!!errors.email}
            helperText={errors.email?.message}
          />

          <TextField
            label={t('auth:login.password_label')}
            type='password'
            autoComplete='current-password'
            fullWidth
            {...register('password')}
            error={!!errors.password}
            helperText={errors.password?.message}
          />

          <Button
            type='submit'
            variant='contained'
            size='large'
            disabled={isSubmitting}
          >
            {t('auth:login.submit')}
          </Button>

          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            flexWrap='wrap'
            gap={1}
          >
            <RouterLink
              to={paths.forgotPassword}
              style={{ color: 'inherit', fontSize: '0.875rem' }}
            >
              {t('auth:login.forgot')}
            </RouterLink>
            <Typography variant='body2'>
              {t('auth:login.no_account')}{' '}
              <RouterLink
                to={paths.signup}
                style={{ color: 'inherit', fontWeight: 600 }}
              >
                {t('auth:login.signup_link')}
              </RouterLink>
            </Typography>
          </Stack>
        </Stack>
      </form>
    </AuthLayout>
  )
}
