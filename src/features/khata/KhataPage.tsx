import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { paths } from 'src/paths'
import { useSearchKhataCustomers, type KhataStatus } from './hooks'
import { formatPKR } from 'src/features/subscription/env'
import {
  Button,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

const PAGE_SIZE = 50

const isStatus = (s: string | null): s is KhataStatus =>
  s === 'open' || s === 'closed' || s === 'all'

type KhataRow = {
  id: string
  name: string
  phone: string
  outstanding_balance: number | string
  last_activity_at: string | null
  entry_count: number | string
}

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

  const rows = (data?.rows ?? []) as KhataRow[]
  const total = data?.total ?? 0

  const emptyKey =
    status === 'closed'
      ? 'khata:list.empty_closed'
      : status === 'all'
        ? 'khata:list.empty_all'
        : 'khata:list.empty_open'

  const columns: DataTableColumn<KhataRow>[] = [
    {
      id: 'customer',
      header: t('khata:fields.customer'),
      cardRole: 'heading',
      cell: (c) => (
        <Stack spacing={0.25}>
          <Typography variant='body1' sx={{ fontWeight: 600 }}>
            {c.name}
          </Typography>
          <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
            {c.phone}
          </Typography>
        </Stack>
      )
    },
    {
      id: 'last_activity',
      header: t('khata:fields.last_activity'),
      hideOnMobile: true,
      cell: (c) => (
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {c.last_activity_at
            ? new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(
                new Date(c.last_activity_at)
              )
            : '—'}
        </Typography>
      )
    },
    {
      id: 'entries',
      header: t('khata:fields.entries'),
      align: 'end',
      hideOnMobile: true,
      cell: (c) => (
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {Number(c.entry_count)}
        </Typography>
      )
    },
    {
      id: 'outstanding',
      header: t('khata:fields.outstanding'),
      align: 'end',
      cell: (c) => {
        const balance = Number(c.outstanding_balance)
        const color =
          balance > 0
            ? 'var(--status-warning-text)'
            : balance < 0
              ? 'var(--status-error-text)'
              : 'var(--text-muted)'
        return (
          <Typography variant='body1' sx={{ fontWeight: 700, color }}>
            {formatPKR(balance, locale)}
          </Typography>
        )
      }
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      width: 140,
      cardRole: 'actions',
      cell: (c) => (
        <Button
          variant='link'
          size='sm'
          onClick={() => navigate(paths.gotoCustomer(c.id))}
        >
          {t('khata:list.view_history')}
        </Button>
      )
    }
  ]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('khata:title')} subtitle={t('khata:subtitle')} />

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
        <Input
          placeholder={t('khata:list.search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete='off'
        />
      </Stack>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(c) => c.id}
        loading={isLoading}
        empty={
          <Box sx={{ py: 4 }}>
            <EmptyState title={t(emptyKey)} />
          </Box>
        }
        ariaLabel={t('khata:title')}
      />

      {total > PAGE_SIZE && (
        <Pagination
          page={page + 1}
          total={total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setPage(p - 1)}
        />
      )}
    </Box>
  )
}
