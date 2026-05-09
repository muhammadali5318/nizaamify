import { useEffect, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useSearchProducts, type ProductSearchRow } from './hooks'
import { formatPKR } from 'src/features/subscription/env'
import {
  Badge,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  type DataTableColumn
} from 'src/components/ui'

export type ProductTableProps = {
  renderActions: (row: ProductSearchRow) => ReactNode
  onlyInStock?: boolean
  showSearch?: boolean
  pageSize?: number
  showAvgCost?: boolean
  showLastPurchase?: boolean
  emptyTitle?: string
  emptyHelp?: string
  syncUrl?: boolean
}

const DEFAULT_PAGE_SIZE = 50

export default function ProductTable({
  renderActions,
  onlyInStock = false,
  showSearch = true,
  pageSize = DEFAULT_PAGE_SIZE,
  showAvgCost = true,
  showLastPurchase = false,
  emptyTitle,
  emptyHelp,
  syncUrl = true
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

  const isEmpty = !isLoading && rows.length === 0
  const isSearchingButEmpty = isEmpty && debounced.length > 0
  const emptyMessage = isSearchingButEmpty
    ? t('products:no_results')
    : (emptyTitle ?? t('products:empty'))
  const emptyHelper = isSearchingButEmpty ? '' : (emptyHelp ?? '')

  const columns: DataTableColumn<ProductSearchRow>[] = [
    {
      id: 'actions',
      header: '',
      width: 96,
      cardRole: 'actions',
      cell: (row) => renderActions(row)
    },
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
      align: 'end',
      cell: (row) => (
        <Stack
          direction='row'
          spacing={0.75}
          justifyContent='flex-end'
          alignItems='center'
        >
          <Typography variant='body1'>{row.stock}</Typography>
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
