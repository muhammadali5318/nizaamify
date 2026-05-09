import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import { useSale } from './hooks'
import { formatPKR } from 'src/features/subscription/env'

type ChipColor = 'success' | 'warning' | 'info' | 'default'

const paymentChipColor: Record<string, ChipColor> = {
  cash: 'success',
  credit: 'warning',
  partial: 'info'
}

export default function SaleDetailPage() {
  const { t, i18n } = useTranslation(['sales', 'khata', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: sale, isLoading, error } = useSale(id)

  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (error || !sale) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity='error'>{t('sales:detail.not_found')}</Alert>
        <Button onClick={() => navigate(paths.sales)} sx={{ mt: 2 }}>
          {t('sales:detail.back')}
        </Button>
      </Box>
    )
  }

  const shortId = sale.id.slice(0, 8)
  const subtotal = sale.items.reduce(
    (s, it) => s + Number(it.price_at_sale) * it.qty,
    0
  )
  const total = Number(sale.total)
  const amountPaid = Number(sale.amount_paid ?? 0)
  const onCredit = Math.max(0, total - amountPaid)

  const linkedLedger = sale.ledger
  const isCreditish =
    sale.payment_type === 'credit' || sale.payment_type === 'partial'

  const paymentLabel =
    sale.payment_type === 'cash'
      ? t('sales:filters.cash')
      : sale.payment_type === 'credit'
        ? t('sales:filters.credit')
        : t('sales:filters.partial')

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Button onClick={() => navigate(paths.sales)} sx={{ mb: 1 }}>
        {t('sales:detail.back')}
      </Button>

      <Paper sx={{ p: 3, borderRadius: 3, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent='space-between'
          alignItems={{ sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant='h5' fontWeight={700}>
              {t('sales:detail.title', { shortId })}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short'
              }).format(new Date(sale.created_at))}
            </Typography>
          </Box>
          <Chip
            label={paymentLabel}
            color={paymentChipColor[sale.payment_type] ?? 'default'}
          />
        </Stack>
        <Stack direction='row' spacing={3} mt={2} flexWrap='wrap' rowGap={2}>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              {t('sales:columns.customer')}
            </Typography>
            <Typography variant='body1'>
              {sale.customer ? (
                <Button
                  size='small'
                  onClick={() =>
                    navigate(paths.gotoCustomer(sale.customer!.id))
                  }
                  sx={{ p: 0, minWidth: 0 }}
                >
                  {sale.customer.name}
                </Button>
              ) : (
                t('sales:walk_in')
              )}
            </Typography>
          </Box>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              {t('sales:detail.cashier')}
            </Typography>
            <Typography variant='body1'>
              {sale.cashier?.email ?? '—'}
            </Typography>
          </Box>
        </Stack>

        {sale.notes && (
          <Box sx={{ mt: 2 }}>
            <Typography variant='caption' color='text.secondary'>
              {t('sales:detail.notes_label')}
            </Typography>
            <Typography
              variant='body2'
              sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}
            >
              {sale.notes}
            </Typography>
          </Box>
        )}
      </Paper>

      <Paper variant='outlined' sx={{ borderRadius: 2, mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant='subtitle1' fontWeight={700}>
            {t('sales:detail.items')}
          </Typography>
        </Box>
        {sale.items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='body2' color='text.secondary'>
              {t('sales:detail.service_only')}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('sales:detail.product')}</TableCell>
                  <TableCell align='right'>{t('sales:detail.qty')}</TableCell>
                  <TableCell align='right'>
                    {t('sales:detail.unit_price')}
                  </TableCell>
                  <TableCell align='right'>
                    {t('sales:detail.unit_cost')}
                  </TableCell>
                  <TableCell align='right'>
                    {t('sales:detail.line_total')}
                  </TableCell>
                  <TableCell align='right'>
                    {t('sales:detail.line_profit')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sale.items.map((it) => {
                  const price = Number(it.price_at_sale)
                  const cost = Number(it.cost_at_sale)
                  const lineTotal = price * it.qty
                  const profit = (price - cost) * it.qty
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        {it.product?.name ?? t('sales:detail.deleted_product')}
                      </TableCell>
                      <TableCell align='right'>{it.qty}</TableCell>
                      <TableCell align='right'>
                        {formatPKR(price, locale)}
                      </TableCell>
                      <TableCell align='right'>
                        {formatPKR(cost, locale)}
                      </TableCell>
                      <TableCell align='right'>
                        {formatPKR(lineTotal, locale)}
                      </TableCell>
                      <TableCell
                        align='right'
                        sx={{
                          color: profit < 0 ? 'error.main' : 'success.main'
                        }}
                      >
                        {formatPKR(profit, locale)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Stack
          direction='row'
          justifyContent='flex-end'
          spacing={4}
          sx={{ p: 2 }}
        >
          <Box sx={{ minWidth: 240 }}>
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' color='text.secondary'>
                {t('sales:detail.subtotal')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(subtotal, locale)}
              </Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' color='text.secondary'>
                {t('sales:columns.service_charge')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(sale.service_charge, locale)}
              </Typography>
            </Stack>
            <Stack
              direction='row'
              justifyContent='space-between'
              mt={1}
              pt={1}
              sx={{ borderTop: 1, borderColor: 'divider' }}
            >
              <Typography variant='subtitle1' fontWeight={700}>
                {t('sales:columns.total')}
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {formatPKR(total, locale)}
              </Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between' mt={1}>
              <Typography variant='body2' color='text.secondary'>
                {t('sales:detail.amount_paid_cash')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(amountPaid, locale)}
              </Typography>
            </Stack>
            {onCredit > 0 && (
              <Stack direction='row' justifyContent='space-between' mt={0.5}>
                <Typography variant='body2' color='warning.main'>
                  {t('sales:detail.on_credit')}
                </Typography>
                <Stack direction='row' spacing={1} alignItems='center'>
                  <Typography
                    variant='body2'
                    fontWeight={700}
                    color='warning.main'
                  >
                    {formatPKR(onCredit, locale)}
                  </Typography>
                  {sale.customer && (
                    <Button
                      size='small'
                      onClick={() =>
                        navigate(paths.gotoCustomer(sale.customer!.id))
                      }
                      sx={{ p: 0, minWidth: 0 }}
                    >
                      {t('sales:detail.view_khata')}
                    </Button>
                  )}
                </Stack>
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>

      {isCreditish && sale.customer && (
        <Paper variant='outlined' sx={{ borderRadius: 2 }}>
          <Box sx={{ p: 2 }}>
            <Stack
              direction='row'
              justifyContent='space-between'
              alignItems='center'
            >
              <Typography variant='subtitle1' fontWeight={700}>
                {t('sales:detail.khata_panel_title')}
              </Typography>
              <Button
                size='small'
                onClick={() => navigate(paths.gotoCustomer(sale.customer!.id))}
              >
                {t('sales:detail.view_customer_khata')}
              </Button>
            </Stack>
          </Box>
          {linkedLedger.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Typography variant='body2' color='text.secondary'>
                {t('sales:detail.no_khata_entries')}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('khata:history.date')}</TableCell>
                    <TableCell>{t('khata:history.type')}</TableCell>
                    <TableCell align='right'>
                      {t('khata:history.amount')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linkedLedger.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        }).format(new Date(l.created_at))}
                      </TableCell>
                      <TableCell>
                        {l.type === 'debit' ? (
                          <Chip
                            size='small'
                            label={t('khata:history.debit')}
                            color='warning'
                          />
                        ) : (
                          <Chip
                            size='small'
                            label={t('khata:history.credit')}
                            color='success'
                          />
                        )}
                      </TableCell>
                      <TableCell align='right'>
                        {formatPKR(l.amount, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}
    </Box>
  )
}
