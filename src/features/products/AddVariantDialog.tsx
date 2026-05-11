import { useEffect, useMemo, useState } from 'react'
import Stack from '@mui/material/Stack'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { Banner, Button, Dialog, Field, Input } from 'src/components/ui'
import {
  useAddVariantToProduct,
  useProductAttributeIds,
  type ProductVariantRow
} from './hooks'
import {
  useVariantAttributes,
  useAttributeValues,
  type VariantAttribute
} from 'src/features/variants/hooks'

type Props = {
  open: boolean
  productId: string
  existingVariants: ProductVariantRow[]
  onClose: () => void
}

export default function AddVariantDialog({
  open,
  productId,
  existingVariants,
  onClose
}: Props) {
  const { t } = useTranslation(['variants', 'products', 'common'])
  const notify = useNotifier()
  const addVariant = useAddVariantToProduct()
  const { data: attributeIds = [] } = useProductAttributeIds(productId)
  const { data: allAttributes = [] } = useVariantAttributes()

  const productAttributes = useMemo<VariantAttribute[]>(
    () =>
      attributeIds
        .map((id) => allAttributes.find((a) => a.id === id))
        .filter((a): a is VariantAttribute => !!a),
    [attributeIds, allAttributes]
  )

  const [valueByAttr, setValueByAttr] = useState<Record<string, string>>({})
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [openingStock, setOpeningStock] = useState('0')
  const [openingCost, setOpeningCost] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValueByAttr({})
      setSku('')
      setPrice('')
      setOpeningStock('0')
      setOpeningCost('')
      setError(null)
    }
  }, [open])

  const handleSave = async () => {
    setError(null)
    // Need one value per attribute
    if (productAttributes.some((a) => !valueByAttr[a.id])) {
      setError(t('variants:errors.need_at_least_one_combination'))
      return
    }
    const valueIds = productAttributes.map((a) => valueByAttr[a.id])

    // Check duplicate-combination client-side for a better error
    const isDuplicate = existingVariants.some((v) => {
      const sortedExisting = Object.values(v.attributes).sort()
      const sortedNew = valueIds.sort()
      // attributes is keyed by attribute name → value; can't directly compare ids.
      // Fall back to server-side duplicate_variant_combination error.
      void sortedExisting
      void sortedNew
      return false
    })
    if (isDuplicate) {
      setError(t('variants:errors.duplicate_combination'))
      return
    }

    const priceNum = price === '' ? null : Number(price)
    const stockNum = Number(openingStock) || 0
    const costNum = openingCost === '' ? null : Number(openingCost)
    if (stockNum > 0 && (costNum === null || !Number.isFinite(costNum))) {
      setError(t('products:errors.opening_cost_invalid'))
      return
    }

    try {
      await addVariant.mutateAsync({
        product_id: productId,
        attribute_value_ids: valueIds,
        sku: sku.trim() === '' ? null : sku.trim(),
        price: priceNum,
        opening_stock: stockNum,
        opening_cost: costNum
      })
      notify.success(t('products:messages.saved'))
      onClose()
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? ''
      if (msg.includes('duplicate_variant_combination')) {
        setError(t('variants:errors.duplicate_combination'))
      } else if (msg.includes('attribute_composition_mismatch')) {
        setError(t('variants:errors.attribute_composition_mismatch'))
      } else {
        notify.error(t('products:errors.save_failed'))
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('variants:actions.add_variant')}
      maxWidth='sm'
      actions={
        <>
          <Button
            variant='ghost'
            onClick={onClose}
            disabled={addVariant.isPending}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSave}
            loading={addVariant.isPending}
          >
            {t('products:actions.save')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Banner variant='error'>{error}</Banner>}
        {productAttributes.length === 0 ? (
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            {t('variants:errors.attribute_not_in_shop')}
          </Typography>
        ) : (
          productAttributes.map((attr) => (
            <AttributeValueSelect
              key={attr.id}
              attribute={attr}
              value={valueByAttr[attr.id] ?? ''}
              onChange={(v) => setValueByAttr({ ...valueByAttr, [attr.id]: v })}
            />
          ))
        )}
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Field label={t('products:fields.opening_qty')}>
            <Input
              type='number'
              inputProps={{ step: '1', min: 0, inputMode: 'numeric' }}
              value={openingStock}
              onChange={(e) => setOpeningStock(e.target.value)}
            />
          </Field>
          <Field label={t('products:fields.opening_cost')}>
            <Input
              type='number'
              inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
              value={openingCost}
              onChange={(e) => setOpeningCost(e.target.value)}
            />
          </Field>
        </Stack>
      </Stack>
    </Dialog>
  )
}

function AttributeValueSelect({
  attribute,
  value,
  onChange
}: {
  attribute: VariantAttribute
  value: string
  onChange: (v: string) => void
}) {
  const { data: values = [], isLoading } = useAttributeValues(attribute.id)
  return (
    <TextField
      select
      label={attribute.name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading || values.length === 0}
      fullWidth
    >
      {values.map((v) => (
        <MenuItem key={v.id} value={v.id}>
          {v.value}
        </MenuItem>
      ))}
    </TextField>
  )
}
