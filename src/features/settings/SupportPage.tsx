import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import { useTranslation } from 'react-i18next'
import {
  subscriptionEnv,
  whatsappLink,
  formatPKR
} from 'src/features/subscription/env'

function getLocale(lng: string) {
  return lng === 'ur' ? 'ur-PK' : 'en-PK'
}

export default function SupportPage() {
  const { t, i18n } = useTranslation(['subscription', 'common'])
  const locale = getLocale(i18n.language)

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
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
        </Stack>
      </Paper>
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
