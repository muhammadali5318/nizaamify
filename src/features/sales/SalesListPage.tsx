import { useMemo, useState } from 'react'
import {
  Box,
  Chip,
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
  Tooltip,
  Typography
} from '@mui/material'
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { useSales, type SalesFilters } from './hooks'
import { useCustomers } from 'src/features/customers/hooks'
import { formatPKR } from 'src/features/subscription/env'

const PAGE_SIZE = 25

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10)

type ChipColor = 'success' | 'warning' | 'info' | 'default'

const paymentChipColor: Record<string, ChipColor> = {
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const onChangeFilter = () => setPage(0)

  const labelForPaymentType = (pt: string) => {
    if (pt === 'cash') return t('sales:filters.cash')
    if (pt === 'credit') return t('sales:filters.credit')
    if (pt === 'partial') return t('sales:filters.partial')
    return pt
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant='h5' fontWeight={700} mb={2}>
        {t('sales:title')}
      </Typography>

      <Paper variant='outlined' sx={{ p: 2, borderRadius: 2, mb: 2 }}>
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
            InputLabelProps={{ shrink: true }}
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
            InputLabelProps={{ shrink: true }}
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
      </Paper>

      <Paper variant='outlined' sx={{ borderRadius: 2 }}>
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='body2' color='text.secondary'>
              {t('sales:empty')}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('sales:columns.datetime')}</TableCell>
                    <TableCell>{t('sales:columns.customer')}</TableCell>
                    <TableCell>{t('sales:columns.payment_type')}</TableCell>
                    <TableCell align='right'>
                      {t('sales:columns.items')}
                    </TableCell>
                    <TableCell align='right'>
                      {t('sales:columns.service_charge')}
                    </TableCell>
                    <TableCell align='right'>
                      {t('sales:columns.total')}
                    </TableCell>
                    <TableCell align='center'>
                      {t('sales:columns.notes')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => {
                    const isPartial = r.payment_type === 'partial'
                    const paid = Number(r.amount_paid ?? 0)
                    const credit = Math.max(0, Number(r.total) - paid)
                    const chip = (
                      <Chip
                        size='small'
                        label={labelForPaymentType(r.payment_type)}
                        color={paymentChipColor[r.payment_type] ?? 'default'}
                      />
                    )
                    return (
                      <TableRow
                        key={r.id}
                        hover
                        onClick={() => navigate(paths.gotoSale(r.id))}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          }).format(new Date(r.created_at))}
                        </TableCell>
                        <TableCell>
                          {r.customer?.name ?? t('sales:walk_in')}
                        </TableCell>
                        <TableCell>
                          {isPartial ? (
                            <Tooltip
                              title={t('sales:partial_breakdown', {
                                paid: formatPKR(paid, locale),
                                credit: formatPKR(credit, locale)
                              })}
                            >
                              {chip}
                            </Tooltip>
                          ) : (
                            chip
                          )}
                        </TableCell>
                        <TableCell align='right'>
                          {r.sale_items?.length ?? 0}
                        </TableCell>
                        <TableCell align='right'>
                          {formatPKR(r.service_charge, locale)}
                        </TableCell>
                        <TableCell align='right'>
                          {formatPKR(r.total, locale)}
                        </TableCell>
                        <TableCell align='center'>
                          {r.notes ? (
                            <Tooltip title={t('sales:has_notes_tooltip')}>
                              <StickyNote2OutlinedIcon
                                fontSize='small'
                                color='action'
                              />
                            </Tooltip>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {totalPages > 1 && (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={totalPages}
                  page={page + 1}
                  onChange={(_, p) => setPage(p - 1)}
                />
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  )
}
