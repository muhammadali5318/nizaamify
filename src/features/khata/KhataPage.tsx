import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Paper,
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
import { useNavigate, useSearchParams } from 'react-router'
import { paths } from 'src/paths'
import { useSearchKhataCustomers, type KhataStatus } from './hooks'
import { formatPKR } from 'src/features/subscription/env'

const PAGE_SIZE = 50

const isStatus = (s: string | null): s is KhataStatus =>
  s === 'open' || s === 'closed' || s === 'all'

export default function KhataPage() {
  const { t, i18n } = useTranslation(['khata', 'common'])
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const [params, setParams] = useSearchParams()

  const initialStatus: KhataStatus = isStatus(params.get('status'))
    ? (params.get('status') as KhataStatus)
    : 'open'
  const initialQuery = params.get('q') ?? ''
  const initialPage = Math.max(1, Number(params.get('page')) || 1)

  const [status, setStatus] = useState<KhataStatus>(initialStatus)
  const [search, setSearch] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery.trim())
  const [page, setPage] = useState(initialPage - 1)

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(h)
  }, [search])

  // Reset to page 1 when filter or query changes
  useEffect(() => {
    setPage(0)
  }, [debounced, status])

  // Sync state -> URL (replace mode so back-button still works)
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (debounced) next.set('q', debounced)
    else next.delete('q')
    if (status !== 'open') next.set('status', status)
    else next.delete('status')
    if (page > 0) next.set('page', String(page + 1))
    else next.delete('page')
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [debounced, status, page, params, setParams])

  const { data, isLoading } = useSearchKhataCustomers({
    query: debounced,
    status,
    page,
    pageSize: PAGE_SIZE
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const emptyKey =
    status === 'closed'
      ? 'khata:list.empty_closed'
      : status === 'all'
        ? 'khata:list.empty_all'
        : 'khata:list.empty_open'

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack mb={2}>
        <Typography variant='h5' fontWeight={700}>
          {t('khata:title')}
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          {t('khata:subtitle')}
        </Typography>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        mb={2}
      >
        <TextField
          select
          size='small'
          label={t('khata:list.filter_label')}
          value={status}
          onChange={(e) => setStatus(e.target.value as KhataStatus)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value='open'>{t('khata:list.filter_open')}</MenuItem>
          <MenuItem value='closed'>{t('khata:list.filter_closed')}</MenuItem>
          <MenuItem value='all'>{t('khata:list.filter_all')}</MenuItem>
        </TextField>
        <TextField
          fullWidth
          size='small'
          placeholder={t('khata:list.search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete='off'
        />
      </Stack>

      <Paper variant='outlined' sx={{ borderRadius: 2 }}>
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='body2' color='text.secondary'>
              {t(emptyKey)}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('khata:fields.customer')}</TableCell>
                    <TableCell>{t('khata:fields.last_activity')}</TableCell>
                    <TableCell align='right'>
                      {t('khata:fields.entries')}
                    </TableCell>
                    <TableCell align='right'>
                      {t('khata:fields.outstanding')}
                    </TableCell>
                    <TableCell align='right' />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((c) => {
                    const balance = Number(c.outstanding_balance)
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography variant='body2' fontWeight={700}>
                              {c.name}
                            </Typography>
                            <Typography
                              variant='caption'
                              color='text.secondary'
                            >
                              {c.phone}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant='caption' color='text.secondary'>
                            {c.last_activity_at
                              ? new Intl.DateTimeFormat(locale, {
                                  dateStyle: 'short'
                                }).format(new Date(c.last_activity_at))
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <Typography variant='caption' color='text.secondary'>
                            {Number(c.entry_count)}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <Typography
                            variant='body2'
                            fontWeight={700}
                            color={
                              balance > 0
                                ? 'warning.main'
                                : balance < 0
                                  ? 'error.main'
                                  : 'text.secondary'
                            }
                          >
                            {formatPKR(balance, locale)}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <Button
                            size='small'
                            onClick={() => navigate(paths.gotoCustomer(c.id))}
                          >
                            {t('khata:list.view_history')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {totalPages > 1 && (
              <Box
                sx={{
                  p: 1.5,
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <Pagination
                  count={totalPages}
                  page={page + 1}
                  onChange={(_, p) => setPage(p - 1)}
                  size='small'
                />
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  )
}
