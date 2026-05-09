import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { paths } from 'src/paths'
import AuthLayout from './AuthLayout'

const linkStyle: React.CSSProperties = {
  color: 'var(--text-brand)',
  fontWeight: 600,
  textDecoration: 'none'
}

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
        <Typography
          variant='body2'
          sx={{ color: 'var(--text-muted)', textAlign: 'center' }}
        >
          {t('auth:verify_email.no_email')}
        </Typography>
        <RouterLink to={paths.login} style={linkStyle}>
          {t('auth:verify_email.back_to_login')}
        </RouterLink>
      </Stack>
    </AuthLayout>
  )
}
