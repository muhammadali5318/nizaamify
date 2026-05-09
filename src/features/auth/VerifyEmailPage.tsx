import { Stack, Typography } from '@mui/material'
import { Link as RouterLink, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { paths } from 'src/paths'
import AuthLayout from './AuthLayout'

export default function VerifyEmailPage() {
  const { t } = useTranslation(['auth', 'common'])
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') ?? ''

  return (
    <AuthLayout
      title={t('auth:verify_email.title')}
      subtitle={t('auth:verify_email.body', { email })}
    >
      <Stack spacing={2} alignItems='center'>
        <Typography variant='body2' color='text.secondary' textAlign='center'>
          {t('auth:verify_email.no_email')}
        </Typography>
        <RouterLink to={paths.login} style={{ color: 'inherit' }}>
          {t('auth:verify_email.back_to_login')}
        </RouterLink>
      </Stack>
    </AuthLayout>
  )
}
