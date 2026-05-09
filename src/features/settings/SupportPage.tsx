import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import { useTranslation } from 'react-i18next'
import {
  subscriptionEnv,
  whatsappLink,
  formatPKR
} from 'src/features/subscription/env'
import { Button, Card } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

function getLocale(lng: string) {
  return lng === 'ur' ? 'ur-PK' : 'en-PK'
}

export default function SupportPage() {
  const { t, i18n } = useTranslation(['subscription', 'common'])
  const locale = getLocale(i18n.language)

  return (
    <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('subscription:expired.support_title')} />
      <Card>
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
        </Stack>
      </Card>
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
