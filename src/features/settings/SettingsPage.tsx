import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
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
  useShopExpiredSaleSettings,
  useUpdateShopAlertDefaults,
  useUpdateShopExpiredSaleSettings,
  type ExpiredSalePolicy
} from 'src/features/batches/hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { usePermission } from 'src/lib/permissions'

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
  const expiredSaleSettings = useShopExpiredSaleSettings()
  const updateExpiredSale = useUpdateShopExpiredSaleSettings()
  // v2.9.1 D.8 — section gates. Per B.2: management knobs = grey-out;
  // owner-only sections (shop-wide settings) = HIDDEN entirely from
  // non-owner staff (don't show knobs they can't use).
  const canManageTiers = usePermission('manage_customer_tiers')
  const canManageVariantAttrs = usePermission('manage_variant_attributes')
  const canEditShopSettings = usePermission('edit_shop_settings')

  const [expiryDays, setExpiryDays] = useState<string>('30')
  const [warrantyDays, setWarrantyDays] = useState<string>('30')
  const [policy, setPolicy] = useState<ExpiredSalePolicy>('warn')
  const [disclaimer, setDisclaimer] = useState<boolean>(false)

  useEffect(() => {
    if (alertDefaults.data) {
      setExpiryDays(String(alertDefaults.data.default_expiry_alert_days))
      setWarrantyDays(String(alertDefaults.data.default_warranty_alert_days))
    }
  }, [alertDefaults.data])

  useEffect(() => {
    if (expiredSaleSettings.data) {
      setPolicy(expiredSaleSettings.data.default_expired_sale_policy)
      setDisclaimer(expiredSaleSettings.data.expired_sale_receipt_disclaimer)
    }
  }, [expiredSaleSettings.data])

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

  const saveExpiredSaleSettings = async () => {
    try {
      await updateExpiredSale.mutateAsync({
        default_expired_sale_policy: policy,
        expired_sale_receipt_disclaimer: disclaimer
      })
      notify.success(t('batches:expired_sales.saved'))
    } catch {
      notify.error(t('batches:expired_sales.save_failed'))
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
          {canManageTiers && (
            <>
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
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-muted)' }}
                  >
                    {t('tiers:subtitle')}
                  </Typography>
                </Box>
                <Button
                  variant='secondary'
                  onClick={() => navigate(paths.tiers)}
                >
                  {t('common:actions.edit')}
                </Button>
              </Stack>
            </>
          )}
          {canManageVariantAttrs && (
            <>
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
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-muted)' }}
                  >
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
            </>
          )}

          {/* v2.8 — shop-level inventory alert defaults. Per-product
           *  overrides live on each product's edit dialog.
           *
           *  v2.9.1 D.8: HIDDEN section for non-owner staff (B.2
           *  owner-only-settings rule). edit_shop_settings is owner-only
           *  by default per the v2.9 catalog. */}
          {canEditShopSettings && (
            <>
              <Divider />
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant='body1' sx={{ fontWeight: 600 }}>
                    {t('batches:settings.section_title')}
                  </Typography>
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-muted)' }}
                  >
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
            </>
          )}

          {/* v2.8.4 — shop-level expired-sale policy + opt-in receipt disclaimer.
           *  v2.9.1 D.8: HIDDEN for non-owner staff (same rule as alert defaults). */}
          {canEditShopSettings && (
            <>
              <Divider />
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant='body1' sx={{ fontWeight: 600 }}>
                    {t('batches:expired_sales.section_title')}
                  </Typography>
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-muted)' }}
                  >
                    {t('batches:expired_sales.section_subtitle')}
                  </Typography>
                </Box>
                <FormControl>
                  <Typography
                    variant='body2'
                    sx={{ mb: 0.5, color: 'var(--text-muted)' }}
                  >
                    {t('batches:expired_sales.default_policy_label')}
                  </Typography>
                  <RadioGroup
                    value={policy}
                    onChange={(_, v) => setPolicy(v as ExpiredSalePolicy)}
                  >
                    <FormControlLabel
                      value='block'
                      control={<Radio size='small' />}
                      label={t('batches:expired_sales.policy_block')}
                    />
                    <FormControlLabel
                      value='warn'
                      control={<Radio size='small' />}
                      label={t('batches:expired_sales.policy_warn')}
                    />
                    <FormControlLabel
                      value='allow'
                      control={<Radio size='small' />}
                      label={t('batches:expired_sales.policy_allow')}
                    />
                  </RadioGroup>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      size='small'
                      checked={disclaimer}
                      onChange={(_, v) => setDisclaimer(v)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant='body2'>
                        {t('batches:expired_sales.receipt_disclaimer_label')}
                      </Typography>
                      <Typography
                        variant='caption'
                        sx={{ color: 'var(--text-muted)' }}
                      >
                        {t('batches:expired_sales.receipt_disclaimer_help')}
                      </Typography>
                    </Box>
                  }
                />
                <Box>
                  <Button
                    variant='primary'
                    size='sm'
                    onClick={() => void saveExpiredSaleSettings()}
                    loading={updateExpiredSale.isPending}
                  >
                    {t('batches:expired_sales.save')}
                  </Button>
                </Box>
              </Stack>
            </>
          )}
        </Stack>
      </Card>
    </Box>
  )
}
