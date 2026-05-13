import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, EmptyState, Skeleton } from 'src/components/ui'
import { formatPKR } from 'src/features/subscription/env'
import { usePermission } from 'src/lib/permissions'
import {
  useProductActivity,
  type Product,
  type ProductActivityRow
} from './hooks'
import { useCategory } from './categoryHooks'
import {
  useProductStockBreakdowns,
  type ProductStockBreakdown
} from 'src/features/units/hooks'
import PacksSection from './PacksSection'
import VariantsTable from './VariantsTable'
import BatchesSection from 'src/features/batches/BatchesSection'

type Props = {
  product: Product
  onEdit?: () => void
  /** Whether to render packs management inline (full detail page) or
   * just summarise them (slimmer POS drawer). */
  showPacksSection?: boolean
}

function formatStockSummary(
  bd: ProductStockBreakdown | undefined,
  stock: number
): string {
  if (!bd) return String(stock)
  const baseUnit = bd.base_unit_name ?? ''
  const packs = bd.pack_breakdown ?? []
  if (packs.length === 0) return `${stock} ${baseUnit}`.trim()
  const largest = packs[0]
  const whole = largest.whole_packs
  const remainder = largest.remainder_base
  const base = `${stock} ${baseUnit}`.trim()
  if (whole === 0) return base
  if (remainder === 0) return `${base} (${whole} ${largest.unit_name})`
  return `${base} (${whole} ${largest.unit_name} + ${remainder} ${baseUnit})`
}

export default function ProductDetailBody({
  product,
  onEdit,
  showPacksSection = true
}: Props) {
  const { t, i18n } = useTranslation(['products', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const dateLocale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  // v2.9.1: avg_cost + last_purchase_cost rows gate on view_product_cost.
  // Single-variant case only — multi-variant rows live in VariantsTable
  // which has its own gate. HOOKS ORDER: top.
  const canViewProductCost = usePermission('view_product_cost')

  const { data: category } = useCategory(product.category_id)
  const { data: bdMap } = useProductStockBreakdowns([product.id])
  const breakdown = bdMap?.get(product.id)
  const { data: activity, isLoading: activityLoading } = useProductActivity(
    product.id
  )

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Card>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'flex-start' }}
          justifyContent='space-between'
        >
          <Stack direction='row' spacing={1.5} alignItems='flex-start'>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-muted)',
                color: 'var(--text-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              aria-hidden
            >
              <VisibilityIcon fontSize='small' />
            </Box>
            <Stack spacing={0.5}>
              <Typography variant='h5' sx={{ fontWeight: 700 }}>
                {product.name}
              </Typography>
              <Stack direction='row' spacing={0.75} alignItems='center'>
                {category?.name && (
                  <Badge variant='neutral' label={category.name} />
                )}
                <Badge
                  variant={product.is_active ? 'success' : 'neutral'}
                  label={
                    product.is_active
                      ? t('products:fields.active')
                      : t('products:actions.archive')
                  }
                />
              </Stack>
            </Stack>
          </Stack>
          {onEdit && (
            <Button variant='primary' onClick={onEdit}>
              {t('products:detail.edit_button')}
            </Button>
          )}
        </Stack>
      </Card>

      {/* v2.8.1: null-price banner. Selling price is optional at create
       *  time; POS hides the product until set. Surface this prominently
       *  so the user knows what to do. */}
      {product.price === null && !product.has_variants && onEdit && (
        <Card>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent='space-between'
          >
            <Typography
              variant='body2'
              sx={{ color: 'var(--status-warning-text)', fontWeight: 500 }}
            >
              {t('products:fields.price_not_set_banner')}
            </Typography>
            <Button variant='secondary' size='sm' onClick={onEdit}>
              {t('products:fields.set_price')}
            </Button>
          </Stack>
        </Card>
      )}

      {/* Fields */}
      <Card>
        <Stack spacing={1.5}>
          <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
            {t('products:detail.section_fields')}
          </Typography>
          <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
          <DetailRow
            label={t('products:detail.field.name')}
            value={product.name}
          />
          <DetailRow
            label={t('products:detail.field.category')}
            value={category?.name ?? '—'}
          />
          {!product.has_variants && (
            <>
              <DetailRow
                label={t('products:detail.field.sell_price')}
                value={
                  product.price === null
                    ? '—'
                    : formatPKR(Number(product.price), locale)
                }
              />
              <DetailRow
                label={t('products:detail.field.stock')}
                value={formatStockSummary(breakdown, product.stock)}
              />
              {/* v2.9.1: cost rows gated on view_product_cost. */}
              {canViewProductCost && (
                <DetailRow
                  label={t('products:detail.field.avg_cost')}
                  value={formatPKR(Number(product.avg_cost), locale)}
                />
              )}
              {canViewProductCost && (
                <DetailRow
                  label={t('products:detail.field.last_purchase')}
                  value={
                    product.last_purchase_cost === null
                      ? '—'
                      : formatPKR(Number(product.last_purchase_cost), locale)
                  }
                />
              )}
            </>
          )}
          {product.description && (
            <DetailRow
              label={t('products:detail.field.description')}
              value={product.description}
            />
          )}
          <DetailRow
            label={t('products:detail.field.created')}
            value={fmtDate(product.created_at)}
          />
          <DetailRow
            label={t('products:detail.field.last_updated')}
            value={fmtDate(product.updated_at)}
          />
        </Stack>
      </Card>

      {/* Multi-variant: variants table replaces the single-variant stock/price card */}
      {product.has_variants && <VariantsTable productId={product.id} />}

      {/* v2.8: batches section (only for batched single-variant products
       *  in v2.8 — multi-variant batched products are a v2.8 polish ticket). */}
      {product.has_batches &&
        !product.has_variants &&
        (product as Product & { default_variant_id?: string | null })
          .default_variant_id && (
          <BatchesSection
            variantId={
              (product as Product & { default_variant_id: string })
                .default_variant_id
            }
            productName={product.name}
          />
        )}

      {/* Packs (single-variant only — v2.7 multi-variant packs are a future ticket) */}
      {showPacksSection && !product.has_variants && (
        <Card>
          <PacksSection productId={product.id} productName={product.name} />
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <Stack spacing={1.5}>
          <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
            {t('products:detail.section_activity')}
          </Typography>
          <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
          {activityLoading ? (
            <Stack spacing={1}>
              <Skeleton variant='text' width='80%' />
              <Skeleton variant='text' width='65%' />
              <Skeleton variant='text' width='75%' />
            </Stack>
          ) : !activity || activity.length === 0 ? (
            <EmptyState title={t('products:detail.activity.empty')} />
          ) : (
            <Stack spacing={1}>
              {activity.map((row, idx) => (
                <ActivityLine
                  key={`${row.kind}-${row.at}-${idx}`}
                  row={row}
                  unit={breakdown?.base_unit_name ?? ''}
                  fmtDate={fmtDate}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0.25, sm: 2 }}
      alignItems={{ sm: 'baseline' }}
    >
      <Typography
        variant='body2'
        sx={{
          color: 'var(--text-muted)',
          minWidth: 140,
          flexShrink: 0
        }}
      >
        {label}
      </Typography>
      <Typography
        variant='body1'
        sx={{ fontWeight: 500, wordBreak: 'break-word' }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

function ActivityLine({
  row,
  unit,
  fmtDate
}: {
  row: ProductActivityRow
  unit: string
  fmtDate: (iso: string) => string
}) {
  const { t } = useTranslation(['products'])
  const date = fmtDate(row.at)
  const qty = `${row.qty}`
  if (row.kind === 'stock_in') {
    const text = row.party
      ? t('products:detail.activity.stock_in', {
          date,
          qty,
          unit,
          supplier: row.party
        })
      : t('products:detail.activity.stock_in_no_supplier', {
          date,
          qty,
          unit
        })
    return (
      <Stack direction='row' spacing={1} alignItems='center'>
        <Badge variant='success' label='+' />
        <Typography variant='body2'>{text}</Typography>
      </Stack>
    )
  }
  const text = row.party
    ? t('products:detail.activity.sale', {
        date,
        qty,
        unit,
        customer: row.party
      })
    : t('products:detail.activity.sale_walkin', { date, qty, unit })
  return (
    <Stack direction='row' spacing={1} alignItems='center'>
      <Badge variant='neutral' label='−' />
      <Typography variant='body2'>{text}</Typography>
    </Stack>
  )
}
