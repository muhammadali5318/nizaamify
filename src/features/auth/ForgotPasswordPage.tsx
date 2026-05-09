import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { forgotSchema, type ForgotValues } from './schemas'
import { supabase } from 'src/lib/supabase'
import { paths } from 'src/paths'
import AuthLayout from './AuthLayout'
import { Banner, Button, Field, Input } from 'src/components/ui'

const linkStyle: React.CSSProperties = {
  color: 'var(--text-brand)',
  fontWeight: 600,
  textDecoration: 'none'
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common'])
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema(t)),
    defaultValues: { email: '' }
  })

  const onSubmit = async (values: ForgotValues) => {
    setServerError(null)
    const redirectTo = `${window.location.origin}${paths.resetPassword}`
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo
    })
    if (error) {
      setServerError(t('auth:errors.generic'))
      return
    }
    setSentEmail(values.email)
  }

  if (sentEmail) {
    return (
      <AuthLayout
        title={t('auth:forgot.sent_title')}
        subtitle={t('auth:forgot.sent_body', { email: sentEmail })}
      >
        <Stack alignItems='center'>
          <RouterLink to={paths.login} style={linkStyle}>
            {t('auth:forgot.back_to_login')}
          </RouterLink>
        </Stack>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth:forgot.title')}
      subtitle={t('auth:forgot.subtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {serverError && <Banner variant='error'>{serverError}</Banner>}

          <Field
            label={t('auth:forgot.email_label')}
            error={errors.email?.message}
          >
            <Input type='email' autoComplete='email' {...register('email')} />
          </Field>

          <Button
            type='submit'
            variant='primary'
            size='lg'
            fullWidth
            loading={isSubmitting}
          >
            {t('auth:forgot.submit')}
          </Button>

          <Typography variant='body2' textAlign='center'>
            <RouterLink to={paths.login} style={linkStyle}>
              {t('auth:forgot.back_to_login')}
            </RouterLink>
          </Typography>
        </Stack>
      </form>
    </AuthLayout>
  )
}
