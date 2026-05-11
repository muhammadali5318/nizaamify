import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useSession } from 'src/features/auth/AuthProvider'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'
import { Button, Card, Field, Input } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { paths } from 'src/paths'
import {
  useShopAlertDefaults,
  useUpdateShopAlertDefaults
} from 'src/features/batches/hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'

export default function SettingsPage() {
  const { t } = useTranslation([
    'common',
    'tiers',
    'batches',
    'variant_attributes'
  ])
  const { user } = useSession()
  const navigate = useNavigate()
  const notify = useNotifier()
  const alertDefaults = useShopAlertDefaults()
  const updateDefaults = useUpdateShopAlertDefaults()
  const [expiryDays, setExpiryDays] = useState<string>('30')
  const [warrantyDays, setWarrantyDays] = useState<string>('30')

  useEffect(() => {
    if (alertDefaults.data) {
      setExpiryDays(String(alertDefaults.data.default_expiry_alert_days))
      setWarrantyDays(String(alertDefaults.data.default_warranty_alert_days))
    }
  }, [alertDefaults.data])

  const saveAlertDefaults = async () => {
    const e = Number(expiryDays)
    const w = Number(warrantyDays)
    if (!Number.isFinite(e) || e <= 0 || !Number.isFinite(w) || w <= 0) {
      notify.error(t('batches:settings.save_failed'))
      return
    }
    try {
      await updateDefaults.mutateAsync({
        default_expiry_alert_days: Math.trunc(e),
        default_warranty_alert_days: Math.trunc(w)
      })
      notify.success(t('batches:settings.saved'))
    } catch {
      notify.error(t('batches:settings.save_failed'))
    }
  }

  return (
    <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={`${t('common:actions.edit')} — Settings`}
        subtitle={user?.email}
      />
      <Card>
        <Stack spacing={2}>
          <Stack direction='row' spacing={2} alignItems='center'>
            <Typography variant='body1'>
              {t('common:language.select_language')}:
            </Typography>
            <LanguageSelector />
          </Stack>
          <Divider />
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
          >
            <Box>
              <Typography variant='body1' sx={{ fontWeight: 600 }}>
                {t('tiers:title')}
              </Typography>
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {t('tiers:subtitle')}
              </Typography>
            </Box>
            <Button variant='secondary' onClick={() => navigate(paths.tiers)}>
              {t('common:actions.edit')}
            </Button>
          </Stack>
          <Divider />
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
          >
            <Box>
              <Typography variant='body1' sx={{ fontWeight: 600 }}>
                {t('variant_attributes:title')}
              </Typography>
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {t('variant_attributes:subtitle')}
              </Typography>
            </Box>
            <Button
              variant='secondary'
              onClick={() => navigate(paths.variantAttributes)}
            >
              {t('common:actions.edit')}
            </Button>
          </Stack>

          {/* v2.8 — shop-level inventory alert defaults. Per-product
           *  overrides live on each product's edit dialog. */}
          <Divider />
          <Stack spacing={1.5}>
            <Box>
              <Typography variant='body1' sx={{ fontWeight: 600 }}>
                {t('batches:settings.section_title')}
              </Typography>
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {t('batches:settings.section_subtitle')}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Field label={t('batches:settings.default_expiry_label')}>
                <Input
                  type='number'
                  inputProps={{ min: 1, step: 1 }}
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                />
              </Field>
              <Field label={t('batches:settings.default_warranty_label')}>
                <Input
                  type='number'
                  inputProps={{ min: 1, step: 1 }}
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(e.target.value)}
                />
              </Field>
            </Stack>
            <Box>
              <Button
                variant='primary'
                size='sm'
                onClick={() => void saveAlertDefaults()}
                loading={updateDefaults.isPending}
              >
                {t('batches:settings.save')}
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Card>
    </Box>
  )
}
