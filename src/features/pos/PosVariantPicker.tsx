import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { useTranslation } from 'react-i18next'
import { Badge, Dialog, EmptyState } from 'src/components/ui'
import { formatPKR } from 'src/features/subscription/env'
import { usePermission } from 'src/lib/permissions'
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

const LOW_STOCK_THRESHOLD = 5

/**
 * v2.7 §8 POS variant picker (v2 — UX overhaul).
 *
 * Layout strategy depends on the variant's attribute composition:
 *   - 1 attribute  → flat list of variant cards (Sizes for a yoga mat).
 *   - 2 attributes → grouped: first-attr value as a section header, second-attr
 *                    values as cards inside the group (Color rows, Size cards).
 *   - 3+ attributes → flat list (the 3D grid from spec §8.2 was deferred per
 *                    ADR-0027 / 0028; the flat list scales without losing info).
 *
 * Each variant card surfaces: label, stock (color-coded badge), selling price,
 * and avg cost as a muted caption. Out-of-stock cards are visually muted but
 * still rendered so the cashier can SEE which variants exist but are 0.
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

  const activeVariants = useMemo(
    () => variants.filter((v) => v.variant_is_active && !v.is_default),
    [variants]
  )

  // Detect attribute axes from the first active variant's `attributes` map.
  // Stable order via the keys() iterator — search_variant_attributes is
  // ordered by display_order, and product_variant_full's jsonb_object_agg
  // returns keys in the same order they were aggregated.
  const attributeKeys = useMemo(() => {
    if (activeVariants.length === 0) return [] as string[]
    return Object.keys(activeVariants[0].attributes ?? {})
  }, [activeVariants])

  const totalInStock = useMemo(
    () => activeVariants.reduce((sum, v) => sum + (v.stock ?? 0), 0),
    [activeVariants]
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='md'
      fullWidth
      title={
        <Stack spacing={0.5}>
          <Typography variant='h3' sx={{ fontWeight: 700 }}>
            {productName}
          </Typography>
          <Stack
            direction='row'
            spacing={1}
            alignItems='center'
            sx={{ color: 'var(--text-muted)' }}
          >
            <Typography variant='caption'>
              {t('pos:picker.variants_badge', {
                count: activeVariants.length
              })}
            </Typography>
            <Box
              sx={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                backgroundColor: 'var(--text-muted)'
              }}
            />
            <Typography variant='caption'>
              {t('pos:picker.variants_total_in_stock', { count: totalInStock })}
            </Typography>
          </Stack>
        </Stack>
      }
    >
      <Box sx={{ pt: 1 }}>
        {isLoading ? (
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            {t('common:loading')}
          </Typography>
        ) : activeVariants.length === 0 ? (
          <EmptyState title={t('variants:variants_count', { count: 0 })} />
        ) : attributeKeys.length === 2 ? (
          <GroupedByFirstAttribute
            variants={activeVariants}
            attributeKeys={attributeKeys}
            locale={locale}
            onAdd={onAdd}
          />
        ) : (
          <FlatVariantList
            variants={activeVariants}
            locale={locale}
            onAdd={onAdd}
          />
        )}
      </Box>
    </Dialog>
  )
}

/** Two-attribute layout: first attribute groups rows, second attribute is the
 *  card grid inside each group. Matches the spec §8.2 sketch. */
function GroupedByFirstAttribute({
  variants,
  attributeKeys,
  locale,
  onAdd
}: {
  variants: ProductVariantRow[]
  attributeKeys: string[]
  locale: string
  onAdd: (variant: ProductVariantRow) => void
}) {
  const [primaryKey, secondaryKey] = attributeKeys
  // Group by the primary attribute's value, preserving variant order.
  const groups = useMemo(() => {
    const m = new Map<string, ProductVariantRow[]>()
    for (const v of variants) {
      const key = String(v.attributes[primaryKey] ?? '')
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(v)
    }
    return Array.from(m.entries())
  }, [variants, primaryKey])

  return (
    <Stack
      spacing={2.5}
      divider={<Divider sx={{ borderColor: 'var(--border-subtle)' }} />}
    >
      {groups.map(([groupValue, groupVariants]) => (
        <Stack key={groupValue} spacing={1}>
          <Stack direction='row' spacing={1} alignItems='baseline'>
            <Typography
              variant='caption'
              sx={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600
              }}
            >
              {primaryKey}
            </Typography>
            <Typography variant='h6' sx={{ fontWeight: 600 }}>
              {groupValue}
            </Typography>
          </Stack>
          <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
            {groupVariants.map((v) => (
              <VariantCard
                key={v.variant_id}
                variant={v}
                locale={locale}
                onAdd={onAdd}
                showAttributeLabel={String(v.attributes[secondaryKey] ?? '')}
              />
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  )
}

/** Flat list — single attribute (Sizes only) or 3-attribute products. */
function FlatVariantList({
  variants,
  locale,
  onAdd
}: {
  variants: ProductVariantRow[]
  locale: string
  onAdd: (variant: ProductVariantRow) => void
}) {
  return (
    <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
      {variants.map((v) => (
        <VariantCard
          key={v.variant_id}
          variant={v}
          locale={locale}
          onAdd={onAdd}
          showAttributeLabel={v.variant_label ?? v.sku ?? '?'}
        />
      ))}
    </Stack>
  )
}

function VariantCard({
  variant,
  locale,
  onAdd,
  showAttributeLabel
}: {
  variant: ProductVariantRow
  locale: string
  onAdd: (variant: ProductVariantRow) => void
  showAttributeLabel: string
}) {
  const { t } = useTranslation(['pos', 'products'])
  // v2.9.1 D.5 — avg_cost hidden for users without view_product_cost (HIDE rule)
  const canViewProductCost = usePermission('view_product_cost')
  const outOfStock = variant.stock <= 0
  const lowStock = !outOfStock && variant.stock <= LOW_STOCK_THRESHOLD
  const notSellable = variant.price === null
  const disabled = outOfStock || notSellable

  // Stock badge color: out → neutral muted, low → warning, healthy → success
  const stockBadgeVariant = outOfStock
    ? 'neutral'
    : lowStock
      ? 'warning'
      : 'success'
  const stockLabel = outOfStock
    ? t('pos:variant_picker.out_of_stock')
    : t('pos:picker.stock_in', { count: variant.stock })

  return (
    <Box
      role='button'
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && onAdd(variant)}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAdd(variant)
        }
      }}
      sx={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        minWidth: 180,
        maxWidth: 240,
        flex: '1 1 200px',
        p: 1.5,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        backgroundColor: disabled ? 'transparent' : 'var(--surface-card)',
        opacity: disabled ? 0.55 : 1,
        boxShadow: disabled ? 'none' : 'var(--shadow-xs)',
        transition:
          'transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out), background-color var(--duration-fast) var(--ease-out)',
        '&:hover': disabled
          ? undefined
          : {
              boxShadow: 'var(--shadow-card)',
              borderColor: 'var(--text-brand)',
              transform: 'translateY(-1px)'
            },
        '&:focus-visible': {
          outline: '2px solid var(--focus-ring)',
          outlineOffset: 2
        }
      }}
    >
      <Stack spacing={0.75}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          spacing={1}
        >
          <Typography
            variant='body1'
            sx={{ fontWeight: 600, lineHeight: 1.2 }}
            noWrap
          >
            {showAttributeLabel}
          </Typography>
          <Badge variant={stockBadgeVariant} label={stockLabel} />
        </Stack>

        {variant.sku && (
          <Typography
            variant='caption'
            sx={{
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              letterSpacing: '0.02em'
            }}
            noWrap
          >
            {variant.sku}
          </Typography>
        )}

        <Stack
          direction='row'
          alignItems='baseline'
          justifyContent='space-between'
          spacing={1}
        >
          <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
            {t('products:fields.selling_price')}
          </Typography>
          <Typography
            variant='body1'
            sx={{
              fontWeight: 600,
              color: notSellable ? 'var(--text-muted)' : 'inherit'
            }}
          >
            {notSellable ? '—' : formatPKR(Number(variant.price), locale)}
          </Typography>
        </Stack>

        {canViewProductCost && (
          <Stack
            direction='row'
            alignItems='baseline'
            justifyContent='space-between'
            spacing={1}
          >
            <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
              {t('products:fields.avg_cost')}
            </Typography>
            <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
              {formatPKR(Number(variant.avg_cost ?? 0), locale)}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
