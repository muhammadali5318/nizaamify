import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Field, Input } from 'src/components/ui'
import { formatPKR } from 'src/features/subscription/env'

export type DiscountType = 'percent' | 'fixed'

export type OverrideValue = {
  type: DiscountType
  value: number
}

type Props = {
  open: boolean
  onClose: () => void
  /** Current items_subtotal (post line discounts, pre tier discount). */
  itemsSubtotal: number
  serviceCharge: number
  /** Existing override (re-edit) or the customer's tier % (initial fill). */
  initialValue: OverrideValue
  /** Locale for currency formatting. */
  locale: string
  onApply: (value: OverrideValue) => void
  /** Reset removes the override entirely; tier returns to customer/default. */
  onReset: () => void
}

export default function OverrideDiscountDialog({
  open,
  onClose,
  itemsSubtotal,
  serviceCharge,
  initialValue,
  locale,
  onApply,
  onReset
}: Props) {
  const { t } = useTranslation(['pos', 'common'])
  const [type, setType] = useState<DiscountType>(initialValue.type)
  const [valueStr, setValueStr] = useState(String(initialValue.value))
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setType(initialValue.type)
    setValueStr(String(initialValue.value))
    setErr(null)
  }, [initialValue, open])

  const numeric = Number(valueStr)
  const valid =
    Number.isFinite(numeric) &&
    numeric >= 0 &&
    (type === 'percent' ? numeric <= 100 : numeric <= itemsSubtotal)

  const previewDiscount = !valid
    ? 0
    : type === 'percent'
      ? Math.round(((itemsSubtotal * numeric) / 100) * 100) / 100
      : numeric
  const previewTotal =
    Math.max(0, itemsSubtotal - previewDiscount) + serviceCharge

  const apply = () => {
    if (!Number.isFinite(numeric) || numeric < 0) {
      setErr(
        type === 'percent'
          ? t('pos:errors.override_percent_out_of_range')
          : t('pos:errors.override_fixed_exceeds_items')
      )
      return
    }
    if (type === 'percent' && numeric > 100) {
      setErr(t('pos:errors.override_percent_out_of_range'))
      return
    }
    if (type === 'fixed' && numeric > itemsSubtotal) {
      setErr(t('pos:errors.override_fixed_exceeds_items'))
      return
    }
    onApply({ type, value: numeric })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      title={t('pos:totals.override_modal_title')}
      actions={
        <>
          <Button variant='ghost' onClick={onReset}>
            {t('pos:totals.override_reset')}
          </Button>
          <Button variant='secondary' onClick={onClose}>
            {t('pos:totals.override_cancel')}
          </Button>
          <Button variant='primary' onClick={apply} disabled={!valid}>
            {t('pos:totals.override_apply')}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Field label={t('pos:totals.override_type_label')}>
          <RadioGroup
            row
            value={type}
            onChange={(_, v) => setType(v as DiscountType)}
          >
            <FormControlLabel
              value='percent'
              control={<Radio />}
              label={t('pos:totals.override_type_percent')}
            />
            <FormControlLabel
              value='fixed'
              control={<Radio />}
              label={t('pos:totals.override_type_fixed')}
            />
          </RadioGroup>
        </Field>
        <Field
          label={
            type === 'percent'
              ? `${t('pos:totals.override_value_label')} (%)`
              : `${t('pos:totals.override_value_label')} (PKR)`
          }
          error={err ?? undefined}
        >
          <Input
            type='number'
            inputProps={{
              min: 0,
              max: type === 'percent' ? 100 : itemsSubtotal,
              step: '0.01',
              inputMode: 'decimal'
            }}
            value={valueStr}
            onChange={(e) => {
              setValueStr(e.target.value)
              setErr(null)
            }}
          />
        </Field>

        <Box
          sx={{
            backgroundColor: 'var(--surface-muted)',
            p: 1.5,
            borderRadius: 1
          }}
        >
          <Stack spacing={0.5}>
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {t('pos:cart.subtotal_products')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(itemsSubtotal, locale)}
              </Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {t('pos:totals.tier_discount')}
              </Typography>
              <Typography variant='body2'>
                −{formatPKR(previewDiscount, locale)}
              </Typography>
            </Stack>
            {serviceCharge > 0 && (
              <Stack direction='row' justifyContent='space-between'>
                <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                  {t('pos:cart.service_charge')}
                </Typography>
                <Typography variant='body2'>
                  {formatPKR(serviceCharge, locale)}
                </Typography>
              </Stack>
            )}
            <Stack
              direction='row'
              justifyContent='space-between'
              sx={{
                pt: 0.5,
                mt: 0.5,
                borderTop: '1px solid var(--border-subtle)'
              }}
            >
              <Typography variant='body2' sx={{ fontWeight: 700 }}>
                {t('pos:cart.total')}
              </Typography>
              <Typography variant='body2' sx={{ fontWeight: 700 }}>
                {formatPKR(previewTotal, locale)}
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {t('pos:totals.override_help')}
        </Typography>
      </Stack>
    </Dialog>
  )
}
