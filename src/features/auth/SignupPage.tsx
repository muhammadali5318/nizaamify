import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { signupSchema, type SignupValues } from './schemas'
import { supabase } from 'src/lib/supabase'
import { paths } from 'src/paths'
import AuthLayout from './AuthLayout'
import { Banner, Button, Field, Input } from 'src/components/ui'

const linkStyle: React.CSSProperties = {
  color: 'var(--text-brand)',
  fontWeight: 600,
  textDecoration: 'none'
}

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
        <Stack spacing={2.5}>
          {serverError && <Banner variant='error'>{serverError}</Banner>}

          <Field
            label={t('auth:signup.email_label')}
            error={errors.email?.message}
          >
            <Input type='email' autoComplete='email' {...register('email')} />
          </Field>

          <Field
            label={t('auth:signup.password_label')}
            error={errors.password?.message}
          >
            <Input
              type='password'
              autoComplete='new-password'
              {...register('password')}
            />
          </Field>

          <Field
            label={t('auth:signup.confirm_password_label')}
            error={errors.confirmPassword?.message}
          >
            <Input
              type='password'
              autoComplete='new-password'
              {...register('confirmPassword')}
            />
          </Field>

          <Button
            type='submit'
            variant='primary'
            size='lg'
            fullWidth
            loading={isSubmitting}
          >
            {t('auth:signup.submit')}
          </Button>

          <Typography variant='body2' textAlign='center'>
            {t('auth:signup.have_account')}{' '}
            <RouterLink to={paths.login} style={linkStyle}>
              {t('auth:signup.login_link')}
            </RouterLink>
          </Typography>
        </Stack>
      </form>
    </AuthLayout>
  )
}
