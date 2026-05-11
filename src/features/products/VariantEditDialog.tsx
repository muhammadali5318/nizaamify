import { useEffect, useState } from 'react'
import Stack from '@mui/material/Stack'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { Banner, Button, Dialog, Field, Input } from 'src/components/ui'
import { useUpdateVariantInline, type ProductVariantRow } from './hooks'

type Props = {
  open: boolean
  variant: ProductVariantRow | null
  onClose: () => void
}

export default function VariantEditDialog({ open, variant, onClose }: Props) {
  const { t } = useTranslation(['variants', 'products', 'common'])
  const notify = useNotifier()
  const update = useUpdateVariantInline()

  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && variant) {
      setSku(variant.sku ?? '')
      setPrice(variant.price === null ? '' : String(variant.price))
      setIsActive(variant.variant_is_active)
      setError(null)
    }
  }, [open, variant])

  const handleSave = async () => {
    if (!variant) return
    setError(null)
    const priceNum = price === '' ? null : Number(price)
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) {
      setError(t('products:errors.price_invalid'))
      return
    }
    try {
      await update.mutateAsync({
        variant_id: variant.variant_id,
        sku: sku.trim() === '' ? null : sku.trim(),
        price: priceNum,
        is_active: isActive
      })
      notify.success(t('products:messages.saved'))
      onClose()
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? ''
      if (msg.includes('uq_variant_sku')) {
        setError(t('products:errors.duplicate_name_category'))
      } else {
        notify.error(t('products:errors.save_failed'))
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={variant?.variant_label ?? t('variants:title')}
      maxWidth='xs'
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={update.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSave}
            loading={update.isPending}
          >
            {t('products:actions.save')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Banner variant='error'>{error}</Banner>}
        <Field label={t('variants:columns.sku')}>
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            inputProps={{ maxLength: 40 }}
          />
        </Field>
        <Field label={t('variants:columns.price')}>
          <Input
            type='number'
            inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <FormControlLabel
          control={
            <Switch
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          }
          label={t('products:fields.active')}
        />
      </Stack>
    </Dialog>
  )
}
