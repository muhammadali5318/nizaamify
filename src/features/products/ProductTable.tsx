import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
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
  // The view returns packs sorted by base_qty desc, so packs[0] is largest.
  if (mode === 'compact') {
    const exact = packs.find((p) => p.remainder_base === 0)
    if (exact) {
      return { primary: `${exact.whole_packs} ${exact.unit_name}` }
    }
    return { primary: `${stock} ${base_unit_name}`.trim() }
  }
  // compound — use the largest pack's pre-computed whole/remainder
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
  /** Action slot rendered in the rightmost column. POS puts the primary [+]
   * (or "Scan only" caption) plus pack quick-add chips stacked vertically;
   * the products list puts edit/archive icons. */
  renderActions: (
    row: ProductSearchRow,
    breakdown?: ProductStockBreakdown
  ) => ReactNode
  /** Optional column header shown above the actions cell. POS uses "Add";
   * the products list leaves it blank since edit/archive don't share a
   * single label. */
  actionsHeader?: ReactNode
  onlyInStock?: boolean
  showSearch?: boolean
  pageSize?: number
  showAvgCost?: boolean
  showLastPurchase?: boolean
  emptyTitle?: string
  emptyHelp?: string
  syncUrl?: boolean
  /** Stock-cell rendering mode (spec §5.2). */
  stockDisplayMode?: StockDisplayMode
  /** Force a breakdown fetch even when stockDisplayMode='base' — used by the
   * POS so renderActions can offer per-pack quick-add buttons. */
  loadBreakdownsForActions?: boolean
}

const DEFAULT_PAGE_SIZE = 50

export default function ProductTable({
  renderActions,
  actionsHeader,
  onlyInStock = false,
  showSearch = true,
  pageSize = DEFAULT_PAGE_SIZE,
  showAvgCost = true,
  showLastPurchase = false,
  emptyTitle,
  emptyHelp,
  syncUrl = true,
  stockDisplayMode = 'base',
  loadBreakdownsForActions = false
}: ProductTableProps) {
  const { t, i18n } = useTranslation(['products', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const [params, setParams] = useSearchParams()
  const initialQuery = syncUrl ? (params.get('q') ?? '') : ''
  const initialPageOneIdx = syncUrl
    ? Math.max(1, Number(params.get('page')) || 1)
    : 1

  const [search, setSearch] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery.trim())
  const [page, setPage] = useState(initialPageOneIdx - 1)

  // Debounce keyboard input
  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(h)
  }, [search])

  // Reset to first page when query changes
  useEffect(() => {
    setPage(0)
  }, [debounced])

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
    onlyInStock
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  const visibleProductIds = useMemo(() => rows.map((r) => r.id), [rows])
  // Skip the breakdown fetch when the stock toggle is on Base AND no caller
  // needs breakdowns for actions — most retailers never flip the toggle, and
  // the bare `stock` count is already in row.
  const needsBreakdowns =
    stockDisplayMode !== 'base' || loadBreakdownsForActions
  const { data: breakdowns } = useProductStockBreakdowns(
    needsBreakdowns ? visibleProductIds : []
  )

  const isEmpty = !isLoading && rows.length === 0
  const isSearchingButEmpty = isEmpty && debounced.length > 0
  const emptyMessage = isSearchingButEmpty
    ? t('products:no_results')
    : (emptyTitle ?? t('products:empty'))
  const emptyHelper = isSearchingButEmpty ? '' : (emptyHelp ?? '')

  const columns: DataTableColumn<ProductSearchRow>[] = [
    {
      id: 'name',
      header: t('products:fields.name'),
      cardRole: 'heading',
      cell: (row) => (
        <Stack spacing={0.5}>
          <Typography variant='body1' sx={{ fontWeight: 600 }} noWrap>
            {row.name}
          </Typography>
          <Stack direction='row' spacing={0.5} alignItems='center'>
            <Badge variant='neutral' label={row.type} />
            {row.type === 'General' && (
              <Badge
                variant='warning'
                label={t('products:badges.default_type_warning')}
              />
            )}
          </Stack>
        </Stack>
      )
    },
    {
      id: 'stock',
      header: t('products:fields.stock'),
      align: 'start',
      cell: (row) => {
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
      cell: (row) => formatPKR(Number(row.price), locale)
    },
    ...(showAvgCost
      ? [
          {
            id: 'avg_cost',
            header: t('products:fields.avg_cost'),
            align: 'end' as const,
            hideOnMobile: true,
            cell: (row: ProductSearchRow) => (
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {formatPKR(Number(row.avg_cost), locale)}
              </Typography>
            )
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
            cell: (row: ProductSearchRow) => (
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {row.last_purchase_cost === null
                  ? '—'
                  : formatPKR(Number(row.last_purchase_cost), locale)}
              </Typography>
            )
          }
        ]
      : []),
    {
      // Rightmost column per v2.3 §6.3.2. POS renders the primary [+] and
      // any pack quick-add chips here, stacked vertically; products list
      // renders edit/archive icons. Wider when actions need pack chips so
      // labels like "+1 Carton (100)" don't truncate.
      id: 'actions',
      header: actionsHeader ?? '',
      width: loadBreakdownsForActions ? 160 : 96,
      align: 'end',
      cardRole: 'actions',
      cell: (row) => renderActions(row, breakdowns?.get(row.id))
    }
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
