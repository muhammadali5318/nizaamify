import {
  Alert,
  Box,
  Button,
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
import { usePurchase } from './hooks'
import { formatPKR } from 'src/features/subscription/env'

export default function PurchaseDetailPage() {
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: purchase, isLoading, error } = usePurchase(id)

  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (error || !purchase) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity='error'>{t('purchases:errors.not_found')}</Alert>
        <Button onClick={() => navigate(paths.purchases)} sx={{ mt: 2 }}>
          {t('purchases:actions.back')}
        </Button>
      </Box>
    )
  }

  const totalQty = purchase.items.reduce((s, it) => s + it.qty, 0)
  const itemsTotal = purchase.items.reduce(
    (s, it) => s + it.qty * Number(it.cost_at_purchase),
    0
  )
  const totalsMismatch =
    Math.abs(itemsTotal - Number(purchase.total_cost)) > 0.01

  const shortId = purchase.id.slice(0, 8)

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Button onClick={() => navigate(paths.purchases)} sx={{ mb: 1 }}>
        {t('purchases:actions.back')}
      </Button>

      <Paper sx={{ p: 3, borderRadius: 3, mb: 2 }}>
        <Typography variant='h5' fontWeight={700}>
          {t('purchases:detail.title', { shortId })}
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          mt={2}
          flexWrap='wrap'
          rowGap={2}
        >
          <Box>
            <Typography variant='caption' color='text.secondary'>
              {t('purchases:list.date')}
            </Typography>
            <Typography variant='body1'>
              {new Intl.DateTimeFormat(locale, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }).format(new Date(purchase.purchase_date))}
            </Typography>
          </Box>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              {t('purchases:list.source')}
            </Typography>
            <Typography variant='body1'>{purchase.source ?? '—'}</Typography>
          </Box>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              {t('purchases:list.total')}
            </Typography>
            <Typography variant='body1'>
              {formatPKR(purchase.total_cost, locale)}
            </Typography>
          </Box>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              {t('purchases:detail.recorded_by')}
            </Typography>
            <Typography variant='body1'>
              {purchase.cashier_email ?? '—'}
            </Typography>
          </Box>
        </Stack>
        {purchase.note && (
          <Box mt={2}>
            <Typography variant='caption' color='text.secondary'>
              {t('purchases:fields.note')}
            </Typography>
            <Typography variant='body2'>{purchase.note}</Typography>
          </Box>
        )}
      </Paper>

      <Paper variant='outlined' sx={{ borderRadius: 2, mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant='subtitle1' fontWeight={700}>
            {t('purchases:fields.product')}
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('purchases:fields.product')}</TableCell>
                <TableCell align='right'>{t('purchases:fields.qty')}</TableCell>
                <TableCell align='right'>
                  {t('purchases:detail.cost_at_purchase')}
                </TableCell>
                <TableCell align='right'>
                  {t('purchases:fields.total')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchase.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    {it.product?.name ?? t('purchases:detail.deleted_product')}
                  </TableCell>
                  <TableCell align='right'>{it.qty}</TableCell>
                  <TableCell align='right'>
                    {formatPKR(it.cost_at_purchase, locale)}
                  </TableCell>
                  <TableCell align='right'>
                    {formatPKR(it.qty * Number(it.cost_at_purchase), locale)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  {t('purchases:fields.total')}
                </TableCell>
                <TableCell align='right' sx={{ fontWeight: 700 }}>
                  {totalQty}
                </TableCell>
                <TableCell />
                <TableCell align='right' sx={{ fontWeight: 700 }}>
                  {formatPKR(itemsTotal, locale)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {totalsMismatch && (
          <Box sx={{ p: 2 }}>
            <Alert severity='warning'>
              {t('purchases:detail.totals_mismatch')}
            </Alert>
          </Box>
        )}
      </Paper>

      <Paper variant='outlined' sx={{ borderRadius: 2 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant='subtitle1' fontWeight={700}>
            {t('purchases:detail.effect_on_inventory')}
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            {t('purchases:detail.effect_caveat')}
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('purchases:fields.product')}</TableCell>
                <TableCell align='right'>
                  {t('purchases:detail.avg_before')}
                </TableCell>
                <TableCell align='right'>
                  {t('purchases:detail.avg_after')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchase.items.map((it) => {
                const product = it.product
                const isMostRecent =
                  product?.last_purchase_cost !== undefined &&
                  product?.last_purchase_cost !== null &&
                  Math.abs(
                    Number(product.last_purchase_cost) -
                      Number(it.cost_at_purchase)
                  ) < 0.01
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      {product?.name ?? t('purchases:detail.deleted_product')}
                    </TableCell>
                    <TableCell align='right'>
                      {t('purchases:detail.not_available')}
                    </TableCell>
                    <TableCell align='right'>
                      {isMostRecent && product
                        ? formatPKR(product.avg_cost, locale)
                        : t('purchases:detail.not_available')}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
