import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Stack from '@mui/material/Stack'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { resetSchema, type ResetValues } from './schemas'
import { supabase } from 'src/lib/supabase'
import { paths } from 'src/paths'
import AuthLayout from './AuthLayout'
import { Banner, Button, Field, Input } from 'src/components/ui'

export default function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Supabase auto-detects the recovery token in the URL hash and creates
  // a temporary session via detectSessionInUrl: true (set in supabase client).
  useEffect(() => {
    if (!success) return
    const tid = window.setTimeout(
      () => navigate(paths.login, { replace: true }),
      2000
    )
    return () => window.clearTimeout(tid)
  }, [success, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema(t)),
    defaultValues: { password: '', confirmPassword: '' }
  })

  const onSubmit = async (values: ResetValues) => {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({
      password: values.password
    })
    if (error) {
      setServerError(t('auth:errors.generic'))
      return
    }
    setSuccess(true)
    await supabase.auth.signOut()
  }

  if (success) {
    return (
      <AuthLayout
        title={t('auth:reset.success_title')}
        subtitle={t('auth:reset.success_body')}
      >
        <></>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth:reset.title')}
      subtitle={t('auth:reset.subtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {serverError && <Banner variant='error'>{serverError}</Banner>}

          <Field
            label={t('auth:reset.password_label')}
            error={errors.password?.message}
          >
            <Input
              type='password'
              autoComplete='new-password'
              {...register('password')}
            />
          </Field>

          <Field
            label={t('auth:reset.confirm_password_label')}
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
            {t('auth:reset.submit')}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  )
}
