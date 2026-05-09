import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography
} from '@mui/material'
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <LanguageSelector />
      </Box>
      <Container maxWidth='md' sx={{ py: 2 }}>
        <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
          <Stack spacing={2} alignItems='center' mb={3}>
            <StorefrontIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant='h5' fontWeight={700} textAlign='center'>
              {t('subscription:expired.title')}
            </Typography>
            <Typography
              variant='body1'
              color='text.secondary'
              textAlign='center'
            >
              {t('subscription:expired.body', {
                appName: t('common:app_name')
              })}
            </Typography>
          </Stack>

          <Alert severity='warning' sx={{ mb: 3 }}>
            <Stack spacing={0.5}>
              <Typography variant='body2'>
                {t('subscription:expired.current_status', {
                  status: t(`subscription:status.${status}`)
                })}
              </Typography>
              {lastPaymentDate ? (
                <Typography variant='body2'>
                  {t('subscription:expired.last_payment', {
                    date: lastPaymentDate
                  })}
                </Typography>
              ) : (
                <Typography variant='body2'>
                  {t('subscription:expired.no_payment')}
                </Typography>
              )}
            </Stack>
          </Alert>

          <Stack spacing={3}>
            <Box>
              <Typography variant='subtitle1' fontWeight={700} mb={1}>
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

            <Divider />

            <Box>
              <Typography variant='subtitle1' fontWeight={700} mb={1}>
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
                    variant='outlined'
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
                    variant='outlined'
                  >
                    {t('subscription:expired.whatsapp_label')}
                  </Button>
                )}
                {subscriptionEnv.supportEmail && (
                  <Button
                    component='a'
                    href={`mailto:${subscriptionEnv.supportEmail}`}
                    startIcon={<EmailIcon />}
                    variant='outlined'
                  >
                    {subscriptionEnv.supportEmail}
                  </Button>
                )}
              </Stack>
            </Box>

            <Divider />

            <Stack direction='row' spacing={1} justifyContent='flex-end'>
              <Button
                onClick={handleRefresh}
                startIcon={<RefreshIcon />}
                disabled={isFetching}
              >
                {t('subscription:expired.refresh')}
              </Button>
              <Button
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                variant='contained'
                color='inherit'
              >
                {t('subscription:expired.logout')}
              </Button>
            </Stack>
          </Stack>
        </Paper>
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
      <Typography variant='body2' color='text.secondary'>
        {label}
      </Typography>
      <Typography variant='body2' fontWeight={700}>
        {value || '—'}
      </Typography>
    </Stack>
  )
}

// Suppress unused-import warning when there's no IconButton
void IconButton
