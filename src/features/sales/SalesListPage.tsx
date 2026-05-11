import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { useSales, type SaleListRow, type SalesFilters } from './hooks'
import { useCustomers } from 'src/features/customers/hooks'
import { formatPKR } from 'src/features/subscription/env'
import {
  Badge,
  type BadgeVariant,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  Tooltip,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

const PAGE_SIZE = 25

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10)

const paymentBadgeVariant: Record<string, BadgeVariant> = {
  cash: 'success',
  credit: 'warning',
  partial: 'info'
}

export default function SalesListPage() {
  const { t, i18n } = useTranslation(['sales', 'common'])
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: customers } = useCustomers()

  const today = useMemo(() => new Date(), [])
  const sevenDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d
  }, [])

  const [start, setStart] = useState<string>(toIsoDate(sevenDaysAgo))
  const [end, setEnd] = useState<string>(toIsoDate(today))
  const [paymentType, setPaymentType] =
    useState<SalesFilters['paymentType']>('all')
  const [customerId, setCustomerId] = useState<string>('')
  const [page, setPage] = useState(0)

  const filters: SalesFilters = {
    start,
    end,
    paymentType,
    customerId: customerId || null,
    page,
    pageSize: PAGE_SIZE
  }

  const { data, isLoading } = useSales(filters)
  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  const onChangeFilter = () => setPage(0)

  const labelForPaymentType = (pt: string) => {
    if (pt === 'cash') return t('sales:filters.cash')
    if (pt === 'credit') return t('sales:filters.credit')
    if (pt === 'partial') return t('sales:filters.partial')
    return pt
  }

  const columns: DataTableColumn<SaleListRow>[] = [
    {
      id: 'datetime',
      header: t('sales:columns.datetime'),
      cardRole: 'heading',
      cell: (r) =>
        new Intl.DateTimeFormat(locale, {
          dateStyle: 'short',
          timeStyle: 'short'
        }).format(new Date(r.created_at))
    },
    {
      id: 'customer',
      header: t('sales:columns.customer'),
      cell: (r) => r.customer?.name ?? t('sales:walk_in')
    },
    {
      id: 'payment_type',
      header: t('sales:columns.payment_type'),
      cell: (r) => {
        const isPartial = r.payment_type === 'partial'
        const paid = Number(r.amount_paid ?? 0)
        // v2.6c: outstanding is a server-computed generated column on
        // invoices (numeric(12,2)). No JS arithmetic on money.
        const credit = Number(r.outstanding ?? 0)
        const badge = (
          <Badge
            variant={paymentBadgeVariant[r.payment_type] ?? 'neutral'}
            label={labelForPaymentType(r.payment_type)}
          />
        )
        return isPartial ? (
          <Tooltip
            title={t('sales:partial_breakdown', {
              paid: formatPKR(paid, locale),
              credit: formatPKR(credit, locale)
            })}
          >
            <span>{badge}</span>
          </Tooltip>
        ) : (
          badge
        )
      }
    },
    {
      id: 'service_charge',
      header: t('sales:columns.service_charge'),
      align: 'end',
      hideOnMobile: true,
      cell: (r) => formatPKR(r.service_charge, locale)
    },
    {
      id: 'total',
      header: t('sales:columns.total'),
      align: 'end',
      cell: (r) => (
        <Box component='span' sx={{ fontWeight: 600 }}>
          {formatPKR(r.total, locale)}
        </Box>
      )
    },
    {
      id: 'notes',
      header: t('sales:columns.notes'),
      hideOnMobile: true,
      cell: (r) =>
        r.notes ? (
          <Tooltip title={r.notes}>
            <Typography
              variant='body2'
              sx={{
                color: 'var(--text-muted)',
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {r.notes}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant='body2' sx={{ color: 'var(--text-disabled)' }}>
            —
          </Typography>
        )
    },
    {
      id: 'actions',
      header: t('sales:columns.actions'),
      align: 'center',
      width: 64,
      cardRole: 'actions',
      cell: (r) => (
        <Tooltip title={t('sales:view_details')}>
          <IconButton
            size='small'
            // The row already has onClick; this icon is the explicit
            // affordance. Click bubbles to the row's onRowClick handler.
            aria-label={t('sales:view_details')}
            sx={{ color: 'var(--text-muted)' }}
            onClick={(e) => {
              e.stopPropagation()
              navigate(paths.gotoSale(r.id))
            }}
          >
            <VisibilityIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      )
    }
  ]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('sales:title')} />

      <Card sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ md: 'center' }}
        >
          <TextField
            label={t('sales:filters.start_date')}
            type='date'
            size='small'
            value={start}
            onChange={(e) => {
              setStart(e.target.value)
              onChangeFilter()
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label={t('sales:filters.end_date')}
            type='date'
            size='small'
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
              onChangeFilter()
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label={t('sales:filters.payment_type')}
            size='small'
            value={paymentType}
            onChange={(e) => {
              setPaymentType(e.target.value as SalesFilters['paymentType'])
              onChangeFilter()
            }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value='all'>{t('sales:filters.all')}</MenuItem>
            <MenuItem value='cash'>{t('sales:filters.cash')}</MenuItem>
            <MenuItem value='credit'>{t('sales:filters.credit')}</MenuItem>
            <MenuItem value='partial'>{t('sales:filters.partial')}</MenuItem>
          </TextField>
          <TextField
            select
            label={t('sales:filters.customer')}
            size='small'
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
              onChangeFilter()
            }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value=''>{t('sales:filters.all')}</MenuItem>
            {customers?.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        loading={isLoading}
        onRowClick={(r) => navigate(paths.gotoSale(r.id))}
        empty={
          <Box sx={{ py: 4 }}>
            <EmptyState title={t('sales:empty')} />
          </Box>
        }
        ariaLabel={t('sales:title')}
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
