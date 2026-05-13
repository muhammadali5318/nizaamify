import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { loginSchema, type LoginValues } from './schemas'
import { supabase } from 'src/lib/supabase'
import { consumeAccessRevokedFlag } from 'src/lib/accessRevoked'
import { paths } from 'src/paths'
import AuthLayout from './AuthLayout'
import { Banner, Button, Field, Input } from 'src/components/ui'

const linkStyle: React.CSSProperties = {
  color: 'var(--text-brand)',
  fontWeight: 600,
  textDecoration: 'none'
}

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  // Read the access-revoked flag once on mount and freeze the result.
  // Calling consume in render would clear the flag on the first render
  // and miss it on the strict-mode double-invoke; useState's initializer
  // runs exactly once.
  const [accessRevoked] = useState<boolean>(() => consumeAccessRevokedFlag())

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
        <Stack spacing={2.5}>
          {accessRevoked && !serverError && (
            <Banner variant='warning'>{t('auth:login.access_revoked')}</Banner>
          )}
          {serverError && <Banner variant='error'>{serverError}</Banner>}

          <Field
            label={t('auth:login.email_label')}
            error={errors.email?.message}
          >
            <Input type='email' autoComplete='email' {...register('email')} />
          </Field>

          <Field
            label={t('auth:login.password_label')}
            error={errors.password?.message}
          >
            <Input
              type='password'
              autoComplete='current-password'
              {...register('password')}
            />
          </Field>

          <Button
            type='submit'
            variant='primary'
            size='lg'
            fullWidth
            loading={isSubmitting}
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
              style={{ ...linkStyle, fontSize: '0.875rem' }}
            >
              {t('auth:login.forgot')}
            </RouterLink>
            <Typography variant='body2'>
              {t('auth:login.no_account')}{' '}
              <RouterLink to={paths.signup} style={linkStyle}>
                {t('auth:login.signup_link')}
              </RouterLink>
            </Typography>
          </Stack>
        </Stack>
      </form>
    </AuthLayout>
  )
}
