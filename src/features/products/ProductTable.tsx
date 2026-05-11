import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useSearchProducts, type ProductSearchRow } from './hooks'
import {
  useProductStockBreakdowns,
  type ProductStockBreakdown
} from 'src/features/units/hooks'
import { formatPKR } from 'src/features/subscription/env'
import {
  Badge,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Tooltip,
  type DataTableColumn
} from 'src/components/ui'

export type StockDisplayMode = 'base' | 'compact' | 'compound'

/**
 * Compact / Compound rendering per spec §5.2. The frontend MUST consume
 * `whole_packs` and `remainder_base` from the view — recomputing in JS was
 * the documented source of the v2.0 "5 cartons + 5 each" off-by-one bug.
 *
 * - Base: "66 each" (always — ignores packs)
 * - Compact: largest pack whose remainder_base = 0, else base
 * - Compound: largest pack split: "5 cartons + 6 each"
 */
function formatStock(
  stock: number,
  base_unit_name: string,
  packs: ProductStockBreakdown['pack_breakdown'],
  mode: StockDisplayMode
): { primary: string; secondary?: string } {
  if (mode === 'base' || packs.length === 0) {
    return { primary: `${stock} ${base_unit_name}`.trim() }
  }
  if (mode === 'compact') {
    const exact = packs.find((p) => p.remainder_base === 0)
    if (exact) {
      return { primary: `${exact.whole_packs} ${exact.unit_name}` }
    }
    return { primary: `${stock} ${base_unit_name}`.trim() }
  }
  const largest = packs[0]
  const whole = largest.whole_packs
  const remainder = largest.remainder_base
  if (whole === 0) {
    return { primary: `${remainder} ${base_unit_name}`.trim() }
  }
  if (remainder === 0) {
    return { primary: `${whole} ${largest.unit_name}` }
  }
  return {
    primary: `${whole} ${largest.unit_name} + ${remainder} ${base_unit_name}`
  }
}

export type ProductTableProps = {
  /** Action slot rendered in the trailing column. POS puts the primary [+]
   * (or "Scan only" caption) plus pack quick-add chips stacked vertically.
   * Pass null / omit to drop the actions column entirely — v2.5 default for
   * the products list. */
  renderActions?: (
    row: ProductSearchRow,
    breakdown?: ProductStockBreakdown
  ) => ReactNode
  /** Optional column header shown above the actions cell. POS uses
   * "Add to cart"; the products list omits the column. */
  actionsHeader?: ReactNode
  /** Center the actions cell content (POS primary "+" lives here). */
  actionsAlign?: 'start' | 'center' | 'end'
  /** Show the eye-icon "view details" affordance as the leftmost column.
   * v2.5 §2: every row in /products and POS gets this. */
  showViewIcon?: boolean
  /** Click handler for the row + eye icon. Required when showViewIcon is true. */
  onView?: (row: ProductSearchRow) => void
  onlyInStock?: boolean
  showSearch?: boolean
  pageSize?: number
  showAvgCost?: boolean
  showLastPurchase?: boolean
  /** Show a category column (between name and stock). v2.5 §3.2. */
  showCategoryColumn?: boolean
  emptyTitle?: string
  emptyHelp?: string
  syncUrl?: boolean
  /** Stock-cell rendering mode (spec §5.2). */
  stockDisplayMode?: StockDisplayMode
  /** Force a breakdown fetch even when stockDisplayMode='base' — used by the
   * POS so renderActions can offer per-pack quick-add buttons. */
  loadBreakdownsForActions?: boolean
  /** Category filter (v2.5 §7). null = all categories. */
  categoryId?: string | null
}

const DEFAULT_PAGE_SIZE = 50

export default function ProductTable({
  renderActions,
  actionsHeader,
  actionsAlign = 'end',
  showViewIcon = false,
  onView,
  onlyInStock = false,
  showSearch = true,
  pageSize = DEFAULT_PAGE_SIZE,
  showAvgCost = true,
  showLastPurchase = false,
  showCategoryColumn = false,
  emptyTitle,
  emptyHelp,
  syncUrl = true,
  stockDisplayMode = 'base',
  loadBreakdownsForActions = false,
  categoryId = null
}: ProductTableProps) {
  const { t, i18n } = useTranslation(['products', 'common', 'pos'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const [params, setParams] = useSearchParams()
  const initialQuery = syncUrl ? (params.get('q') ?? '') : ''
  const initialPageOneIdx = syncUrl
    ? Math.max(1, Number(params.get('page')) || 1)
    : 1

  const [search, setSearch] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery.trim())
  const [page, setPage] = useState(initialPageOneIdx - 1)

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(h)
  }, [search])

  // Reset to page 1 whenever the query or category filter changes.
  useEffect(() => {
    setPage(0)
  }, [debounced, categoryId])

  // Sync state -> URL (without breaking back-button)
  useEffect(() => {
    if (!syncUrl) return
    const next = new URLSearchParams(params)
    if (debounced) next.set('q', debounced)
    else next.delete('q')
    if (page > 0) next.set('page', String(page + 1))
    else next.delete('page')
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [debounced, page, syncUrl, params, setParams])

  const { data, isLoading } = useSearchProducts({
    query: debounced,
    page,
    pageSize,
    onlyInStock,
    categoryId
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  const visibleProductIds = useMemo(() => rows.map((r) => r.id), [rows])
  const needsBreakdowns =
    stockDisplayMode !== 'base' || loadBreakdownsForActions
  const { data: breakdowns } = useProductStockBreakdowns(
    needsBreakdowns ? visibleProductIds : []
  )

  const isEmpty = !isLoading && rows.length === 0
  const isSearchingButEmpty =
    isEmpty && (debounced.length > 0 || categoryId !== null)
  const emptyMessage = isSearchingButEmpty
    ? t('products:no_results')
    : (emptyTitle ?? t('products:empty'))
  const emptyHelper = isSearchingButEmpty ? '' : (emptyHelp ?? '')

  const columns: DataTableColumn<ProductSearchRow>[] = [
    ...(showViewIcon
      ? [
          {
            id: 'view',
            // v2.5 §2: eye icon = explicit "view details" affordance.
            // Cell click bubbles up to the row's onRowClick handler.
            header: '',
            align: 'center' as const,
            width: 56,
            cell: () => (
              <Tooltip title={t('products:tooltip.view_details')}>
                <IconButton
                  size='small'
                  // The row already has onClick; this is purely visual.
                  // pointerEvents:none on the icon would block the tooltip,
                  // so we let MUI handle it and rely on row-click bubbling.
                  aria-label={t('products:actions.view')}
                  sx={{ color: 'var(--text-muted)' }}
                >
                  <VisibilityIcon fontSize='small' />
                </IconButton>
              </Tooltip>
            )
          }
        ]
      : []),
    {
      id: 'name',
      header: t('products:fields.name'),
      cardRole: 'heading',
      cell: (row) => (
        <Stack spacing={0.5}>
          <Typography variant='body1' sx={{ fontWeight: 600 }} noWrap>
            {row.name}
          </Typography>
          {!showCategoryColumn && (
            <Stack direction='row' spacing={0.5} alignItems='center'>
              <Badge variant='neutral' label={row.type} />
            </Stack>
          )}
        </Stack>
      )
    },
    ...(showCategoryColumn
      ? [
          {
            id: 'category',
            header: t('products:fields.category'),
            align: 'start' as const,
            hideOnMobile: true,
            cell: (row: ProductSearchRow) => (
              <Badge variant='neutral' label={row.type} />
            )
          }
        ]
      : []),
    {
      id: 'stock',
      header: t('products:fields.stock'),
      align: 'start',
      cell: (row) => {
        // v2.7: multi-variant rows show total stock on top (the number a
        // cashier scans for at a glance) and the variant-count badge below.
        // Click the row to see the per-variant breakdown.
        if (row.has_variants) {
          const total = Number(row.total_stock_all_variants ?? 0)
          return (
            <Stack spacing={0.25} alignItems='flex-start'>
              <Typography variant='body1' sx={{ fontWeight: 600 }}>
                {t('pos:picker.variants_total_in_stock', { count: total })}
              </Typography>
              <Badge
                variant='neutral'
                label={t('pos:picker.variants_badge', {
                  count: row.variant_count ?? 0
                })}
              />
            </Stack>
          )
        }
        const breakdown = breakdowns?.get(row.id)
        const formatted =
          stockDisplayMode !== 'base' && breakdown
            ? formatStock(
                breakdown.base_qty ?? row.stock,
                breakdown.base_unit_name ?? '',
                breakdown.pack_breakdown ?? [],
                stockDisplayMode
              )
            : { primary: String(row.stock) }
        return (
          <Stack
            direction='row'
            spacing={0.75}
            justifyContent='flex-start'
            alignItems='center'
          >
            <Typography variant='body1'>{formatted.primary}</Typography>
            {row.stock === 0 ? (
              <Badge
                variant='neutral'
                label={t('products:badges.out_of_stock')}
              />
            ) : row.stock <= 5 ? (
              <Badge variant='warning' label={t('products:badges.low_stock')} />
            ) : null}
          </Stack>
        )
      }
    },
    {
      id: 'price',
      header: t('products:fields.selling_price'),
      align: 'end',
      cell: (row) => {
        // v2.7: multi-variant products show a price range "Rs min – max"
        if (row.has_variants) {
          if (row.min_price === null || row.max_price === null) return '—'
          if (Number(row.min_price) === Number(row.max_price)) {
            return formatPKR(Number(row.min_price), locale)
          }
          return t('pos:picker.price_range', {
            min: Number(row.min_price).toLocaleString(locale),
            max: Number(row.max_price).toLocaleString(locale)
          })
        }
        return formatPKR(Number(row.price), locale)
      }
    },
    ...(showAvgCost
      ? [
          {
            id: 'avg_cost',
            header: t('products:fields.avg_cost'),
            align: 'end' as const,
            hideOnMobile: true,
            cell: (row: ProductSearchRow) => {
              // v2.7: multi-variant products have no product-level avg_cost —
              // each variant has its own. The compat view's left-join returns
              // null here, which formatPKR(Number(null)) would render as
              // "Rs 0.00" — misleading. Show "—" instead.
              if (row.has_variants) {
                return (
                  <Tooltip
                    title={t('pos:picker.per_variant_tooltip')}
                    placement='top'
                  >
                    <Typography
                      variant='body2'
                      sx={{
                        color: 'var(--text-muted)',
                        fontStyle: 'italic'
                      }}
                    >
                      {t('pos:picker.per_variant')}
                    </Typography>
                  </Tooltip>
                )
              }
              return (
                <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                  {formatPKR(Number(row.avg_cost), locale)}
                </Typography>
              )
            }
          }
        ]
      : []),
    ...(showLastPurchase
      ? [
          {
            id: 'last_purchase',
            header: t('products:fields.last_purchase_cost'),
            align: 'end' as const,
            hideOnMobile: true,
            cell: (row: ProductSearchRow) => {
              if (row.has_variants) {
                return (
                  <Tooltip
                    title={t('pos:picker.per_variant_tooltip')}
                    placement='top'
                  >
                    <Typography
                      variant='body2'
                      sx={{
                        color: 'var(--text-muted)',
                        fontStyle: 'italic'
                      }}
                    >
                      {t('pos:picker.per_variant')}
                    </Typography>
                  </Tooltip>
                )
              }
              return (
                <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                  {row.last_purchase_cost === null
                    ? '—'
                    : formatPKR(Number(row.last_purchase_cost), locale)}
                </Typography>
              )
            }
          }
        ]
      : []),
    ...(renderActions
      ? [
          {
            // v2.3 §6.3.2 / v2.5 §4: POS puts the primary [+] (centered when
            // actionsAlign='center') and pack quick-add chips here.
            id: 'actions',
            header: actionsHeader ?? '',
            width: loadBreakdownsForActions ? 160 : 96,
            align: actionsAlign,
            cardRole: 'actions' as const,
            cell: (row: ProductSearchRow) =>
              renderActions(row, breakdowns?.get(row.id))
          }
        ]
      : [])
  ]

  return (
    <Stack spacing={2}>
      {showSearch && (
        <Input
          placeholder={t('products:search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete='off'
          slotProps={{
            input: {
              'aria-label': t('products:search_placeholder')
            } as React.InputHTMLAttributes<HTMLInputElement>
          }}
        />
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={isLoading}
        onRowClick={onView}
        empty={
          <Box sx={{ py: 4 }}>
            <EmptyState
              title={emptyMessage}
              description={emptyHelper || undefined}
            />
          </Box>
        }
        ariaLabel={t('products:title')}
      />

      {total > pageSize && (
        <Pagination
          page={page + 1}
          total={total}
          pageSize={pageSize}
          onChange={(p) => setPage(p - 1)}
        />
      )}
    </Stack>
  )
}
