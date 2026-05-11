import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { useTranslation } from 'react-i18next'
import { Field } from 'src/components/ui'
import { useProductVariants } from 'src/features/products/hooks'

type Props = {
  productId: string
  value: string
  onChange: (variantId: string) => void
}

/**
 * v2.7 §7.6 fallback ("expanding-line pattern"): when a stock-in line targets
 * a multi-variant product, the user picks which variant they're receiving on
 * this line. Multi-variant products with N variants → N stock-in lines, one
 * per variant. The matrix UX from §7 is deferred.
 *
 * Renders nothing for single-variant products (variants.length <= 1) — the
 * default variant is resolved server-side via record_purchase's product_id
 * fallback.
 */
export default function LineVariantPicker({
  productId,
  value,
  onChange
}: Props) {
  const { t } = useTranslation(['variants', 'common'])
  const { data: variants = [], isLoading } = useProductVariants(productId)

  // Single-variant products: variants table has one row with is_default = true.
  // Hide the picker; the server resolves to default variant via product_id.
  const nonDefaultVariants = variants.filter((v) => !v.is_default)
  if (nonDefaultVariants.length === 0) return null

  return (
    <Field label={t('variants:columns.variant')}>
      <Select
        size='small'
        fullWidth
        value={value}
        displayEmpty
        disabled={isLoading}
        onChange={(e) => onChange(e.target.value as string)}
      >
        <MenuItem value='' disabled>
          {t('variants:select_values')}
        </MenuItem>
        {nonDefaultVariants.map((v) => (
          <MenuItem key={v.variant_id} value={v.variant_id}>
            {v.variant_label ?? v.sku ?? v.variant_id.slice(0, 6)}
          </MenuItem>
        ))}
      </Select>
    </Field>
  )
}
