import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Dialog, EmptyState } from 'src/components/ui'
import { formatPKR } from 'src/features/subscription/env'
import {
  useProductVariants,
  type ProductVariantRow
} from 'src/features/products/hooks'

type Props = {
  open: boolean
  productId: string | null
  productName: string
  onClose: () => void
  onAdd: (variant: ProductVariantRow) => void
}

/**
 * v2.7 §8 POS variant picker. Opens when the cashier taps the "..." button
 * on a multi-variant product row. Lists every active variant with its current
 * stock; clicking adds 1 of that variant to the cart at the variant's price.
 *
 * This first cut renders variants as a vertical list of pill-buttons rather
 * than a 2D grid (spec §8.2). The grid layout is design-system polish that
 * can come later; the list is functional, accessible, and works for any
 * attribute count.
 */
export default function PosVariantPicker({
  open,
  productId,
  productName,
  onClose,
  onAdd
}: Props) {
  const { t, i18n } = useTranslation(['pos', 'variants', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: variants = [], isLoading } = useProductVariants(
    productId ?? undefined
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      title={t('pos:variant_picker.title', { productName })}
    >
      <Box sx={{ pt: 1 }}>
        {isLoading ? (
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            {t('common:loading')}
          </Typography>
        ) : variants.length === 0 ? (
          <EmptyState title={t('variants:variants_count', { count: 0 })} />
        ) : (
          <Stack spacing={1}>
            {variants
              .filter((v) => v.variant_is_active)
              .map((v) => {
                const outOfStock = v.stock <= 0
                return (
                  <Button
                    key={v.variant_id}
                    variant='secondary'
                    onClick={() => onAdd(v)}
                    disabled={outOfStock || v.price === null}
                    sx={{
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1.25,
                      width: '100%'
                    }}
                  >
                    <Stack
                      direction='row'
                      spacing={1.5}
                      alignItems='center'
                      sx={{ flex: 1 }}
                    >
                      <Typography variant='body1' sx={{ fontWeight: 600 }}>
                        {v.variant_label ?? v.sku ?? v.variant_id.slice(0, 6)}
                      </Typography>
                      {outOfStock && (
                        <Badge
                          variant='neutral'
                          label={t('pos:variant_picker.out_of_stock')}
                        />
                      )}
                    </Stack>
                    <Stack
                      direction='row'
                      spacing={1.5}
                      alignItems='center'
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      <Typography variant='body2'>
                        {t('pos:variant_picker.stock_in_cell')}: {v.stock}
                      </Typography>
                      <Typography variant='body2'>
                        {v.price === null
                          ? '—'
                          : formatPKR(Number(v.price), locale)}
                      </Typography>
                    </Stack>
                  </Button>
                )
              })}
          </Stack>
        )}
      </Box>
    </Dialog>
  )
}
