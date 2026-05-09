import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useSearchProducts, type ProductSearchRow } from './hooks'
import { formatPKR } from 'src/features/subscription/env'

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

  const { data, isLoading, isFetching } = useSearchProducts({
    query: debounced,
    page,
    pageSize,
    onlyInStock
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  const isEmpty = !isLoading && rows.length === 0
  const isSearchingButEmpty = isEmpty && debounced.length > 0
  const emptyMsg = useMemo(() => {
    if (isSearchingButEmpty) {
      return {
        title: t('products:no_results'),
        help: ''
      }
    }
    return {
      title: emptyTitle ?? t('products:empty'),
      help: emptyHelp ?? ''
    }
  }, [isSearchingButEmpty, emptyTitle, emptyHelp, t])

  return (
    <Stack spacing={2}>
      {showSearch && (
        <TextField
          fullWidth
          size='small'
          placeholder={t('products:search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete='off'
          inputProps={{
            'aria-label': t('products:search_placeholder')
          }}
        />
      )}

      <Paper variant='outlined' sx={{ borderRadius: 2 }}>
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : isEmpty ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='body2' color='text.secondary'>
              {emptyMsg.title}
            </Typography>
            {emptyMsg.help && (
              <Typography variant='caption' color='text.secondary'>
                {emptyMsg.help}
              </Typography>
            )}
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 64 }} />
                    <TableCell>{t('products:fields.name')}</TableCell>
                    <TableCell align='right'>
                      {t('products:fields.stock')}
                    </TableCell>
                    <TableCell align='right'>
                      {t('products:fields.selling_price')}
                    </TableCell>
                    {showAvgCost && (
                      <TableCell
                        align='right'
                        sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                      >
                        {t('products:fields.avg_cost')}
                      </TableCell>
                    )}
                    {showLastPurchase && (
                      <TableCell
                        align='right'
                        sx={{ display: { xs: 'none', md: 'table-cell' } }}
                      >
                        {t('products:fields.last_purchase_cost')}
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isFetching && rows.length === 0
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={5}>
                            <Skeleton height={28} />
                          </TableCell>
                        </TableRow>
                      ))
                    : rows.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{renderActions(row)}</TableCell>
                          <TableCell>
                            <Stack spacing={0.25}>
                              <Typography
                                variant='body2'
                                fontWeight={700}
                                noWrap
                              >
                                {row.name}
                              </Typography>
                              <Stack
                                direction='row'
                                spacing={0.5}
                                alignItems='center'
                              >
                                <Chip
                                  label={row.type}
                                  size='small'
                                  variant='outlined'
                                  sx={{ height: 20, fontSize: 11 }}
                                />
                                {row.type === 'General' && (
                                  <Chip
                                    label={t(
                                      'products:badges.default_type_warning'
                                    )}
                                    size='small'
                                    color='warning'
                                    variant='outlined'
                                    sx={{ height: 20, fontSize: 10 }}
                                  />
                                )}
                              </Stack>
                            </Stack>
                          </TableCell>
                          <TableCell align='right'>
                            <Stack
                              spacing={0.25}
                              direction='row'
                              justifyContent='flex-end'
                              alignItems='center'
                            >
                              <Typography variant='body2'>
                                {row.stock}
                              </Typography>
                              {row.stock === 0 ? (
                                <Chip
                                  size='small'
                                  color='default'
                                  label={t('products:badges.out_of_stock')}
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              ) : row.stock <= 5 ? (
                                <Chip
                                  size='small'
                                  color='warning'
                                  label={t('products:badges.low_stock')}
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell align='right'>
                            {formatPKR(Number(row.price), locale)}
                          </TableCell>
                          {showAvgCost && (
                            <TableCell
                              align='right'
                              sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                            >
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                {formatPKR(Number(row.avg_cost), locale)}
                              </Typography>
                            </TableCell>
                          )}
                          {showLastPurchase && (
                            <TableCell
                              align='right'
                              sx={{ display: { xs: 'none', md: 'table-cell' } }}
                            >
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                {row.last_purchase_cost === null
                                  ? '—'
                                  : formatPKR(
                                      Number(row.last_purchase_cost),
                                      locale
                                    )}
                              </Typography>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent='space-between'
              sx={{ p: 1.5, gap: 1 }}
            >
              <Typography variant='caption' color='text.secondary'>
                {t('products:pagination.showing', { from, to, total })}
              </Typography>
              {totalPages > 1 && (
                <Pagination
                  count={totalPages}
                  page={page + 1}
                  onChange={(_, p) => setPage(p - 1)}
                  size='small'
                />
              )}
            </Stack>
          </>
        )}
      </Paper>
    </Stack>
  )
}
