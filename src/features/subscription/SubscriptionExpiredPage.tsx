import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import StorefrontIcon from '@mui/icons-material/Storefront'
import RefreshIcon from '@mui/icons-material/Refresh'
import LogoutIcon from '@mui/icons-material/Logout'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useEffectiveSubscription } from 'src/features/auth/hooks'
import { supabase } from 'src/lib/supabase'
import { paths } from 'src/paths'
import { subscriptionEnv, whatsappLink, formatPKR } from './env'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'
import { Banner, Button, Card } from 'src/components/ui'

function getLocale(lng: string) {
  return lng === 'ur' ? 'ur-PK' : 'en-PK'
}

export default function SubscriptionExpiredPage() {
  const { t, i18n } = useTranslation(['subscription', 'common'])
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, refetch, isFetching } = useEffectiveSubscription()
  const locale = getLocale(i18n.language)

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['subscription'] })
    await refetch()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    queryClient.clear()
    navigate(paths.login, { replace: true })
  }

  const status = data?.effective_status ?? 'expired'
  const lastPaymentDate = data?.last_payment_date
    ? new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(data.last_payment_date))
    : null

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'var(--surface-subtle)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <LanguageSelector />
      </Box>
      <Container maxWidth='md' sx={{ py: 2 }}>
        <Card variant='elevated' sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} alignItems='center' mb={3}>
            <StorefrontIcon sx={{ fontSize: 40, color: 'var(--text-brand)' }} />
            <Typography
              variant='display'
              component='h1'
              sx={{ textAlign: 'center', color: 'var(--text-primary)' }}
            >
              {t('subscription:expired.title')}
            </Typography>
            <Typography
              variant='body1'
              sx={{
                textAlign: 'center',
                color: 'var(--text-secondary)',
                maxWidth: '52ch'
              }}
            >
              {t('subscription:expired.body', {
                appName: t('common:app_name')
              })}
            </Typography>
          </Stack>

          <Box sx={{ mb: 3 }}>
            <Banner variant='warning'>
              <Stack spacing={0.5}>
                <Typography variant='body2' sx={{ color: 'inherit' }}>
                  {t('subscription:expired.current_status', {
                    status: t(`subscription:status.${status}`)
                  })}
                </Typography>
                {lastPaymentDate ? (
                  <Typography variant='body2' sx={{ color: 'inherit' }}>
                    {t('subscription:expired.last_payment', {
                      date: lastPaymentDate
                    })}
                  </Typography>
                ) : (
                  <Typography variant='body2' sx={{ color: 'inherit' }}>
                    {t('subscription:expired.no_payment')}
                  </Typography>
                )}
              </Stack>
            </Banner>
          </Box>

          <Stack spacing={3}>
            <Box>
              <Typography variant='h3' sx={{ mb: 1.5 }}>
                {t('subscription:expired.payment_instructions_title')}
              </Typography>
              <Stack spacing={1.5}>
                <Row
                  label={t('subscription:expired.monthly_price')}
                  value={formatPKR(subscriptionEnv.monthlyPrice, locale)}
                />
                <Row
                  label={t('subscription:expired.bank_label')}
                  value={subscriptionEnv.bankName}
                />
                <Row
                  label={t('subscription:expired.account_name_label')}
                  value={subscriptionEnv.bankAccountName}
                />
                <Row
                  label={t('subscription:expired.account_number_label')}
                  value={subscriptionEnv.bankAccountNumber}
                />
              </Stack>
            </Box>

            <Divider sx={{ borderColor: 'var(--border-subtle)' }} />

            <Box>
              <Typography variant='h3' sx={{ mb: 1.5 }}>
                {t('subscription:expired.support_title')}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                flexWrap='wrap'
              >
                {subscriptionEnv.supportPhone && (
                  <Button
                    component='a'
                    href={`tel:${subscriptionEnv.supportPhone}`}
                    startIcon={<PhoneIcon />}
                    variant='secondary'
                  >
                    {subscriptionEnv.supportPhone}
                  </Button>
                )}
                {subscriptionEnv.supportWhatsapp && (
                  <Button
                    component='a'
                    href={whatsappLink(
                      t('subscription:expired.whatsapp_message')
                    )}
                    target='_blank'
                    rel='noopener noreferrer'
                    startIcon={<WhatsAppIcon />}
                    variant='secondary'
                  >
                    {t('subscription:expired.whatsapp_label')}
                  </Button>
                )}
                {subscriptionEnv.supportEmail && (
                  <Button
                    component='a'
                    href={`mailto:${subscriptionEnv.supportEmail}`}
                    startIcon={<EmailIcon />}
                    variant='secondary'
                  >
                    {subscriptionEnv.supportEmail}
                  </Button>
                )}
              </Stack>
            </Box>

            <Divider sx={{ borderColor: 'var(--border-subtle)' }} />

            <Stack
              direction={{ xs: 'column-reverse', sm: 'row' }}
              spacing={1.5}
              justifyContent='flex-end'
            >
              <Button
                variant='ghost'
                onClick={handleRefresh}
                startIcon={<RefreshIcon />}
                disabled={isFetching}
                loading={isFetching}
              >
                {t('subscription:expired.refresh')}
              </Button>
              <Button
                variant='primary'
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
              >
                {t('subscription:expired.logout')}
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Container>
    </Box>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent='space-between'
      alignItems={{ sm: 'center' }}
      spacing={0.5}
    >
      <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
        {label}
      </Typography>
      <Typography variant='body1' sx={{ fontWeight: 600 }}>
        {value || '—'}
      </Typography>
    </Stack>
  )
}
