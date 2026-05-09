import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { useTranslation } from 'react-i18next'
import { formatPKR } from 'src/features/subscription/env'

export type ReceiptLine = {
  product_id: string
  name: string
  qty: number
  price: number
}

export type ReceiptPaymentType = 'cash' | 'credit' | 'partial'

type Props = {
  open: boolean
  onClose: () => void
  onNewSale: () => void
  invoiceId: string
  shopName: string
  paymentType: ReceiptPaymentType
  serviceCharge: number
  lines: ReceiptLine[]
  customerName?: string
  total: number
  amountPaid: number
  onCredit: number
  notes?: string
}

export default function Receipt({
  open,
  onClose,
  onNewSale,
  invoiceId,
  shopName,
  paymentType,
  serviceCharge,
  lines,
  customerName,
  total,
  amountPaid,
  onCredit,
  notes
}: Props) {
  const { t, i18n } = useTranslation(['pos', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const subtotal = lines.reduce((s, ln) => s + ln.qty * ln.price, 0)

  const summaryLabel =
    paymentType === 'cash'
      ? t('pos:receipt.paid')
      : paymentType === 'credit'
        ? t('pos:receipt.credit')
        : t('pos:receipt.partial')

  const summaryColor =
    paymentType === 'cash'
      ? 'success.main'
      : paymentType === 'credit'
        ? 'warning.main'
        : 'info.main'

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('pos:receipt.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} mb={2}>
          <Typography variant='subtitle1' fontWeight={700} textAlign='center'>
            {shopName}
          </Typography>
          <Typography
            variant='caption'
            color='text.secondary'
            textAlign='center'
          >
            {t('pos:receipt.invoice')}: {invoiceId.slice(0, 8)}
          </Typography>
          <Typography
            variant='caption'
            color='text.secondary'
            textAlign='center'
          >
            {t('pos:receipt.date')}:{' '}
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'short',
              timeStyle: 'short'
            }).format(new Date())}
          </Typography>
          {customerName && (
            <Typography variant='caption' textAlign='center'>
              {t('pos:payment.customer')}: {customerName}
            </Typography>
          )}
        </Stack>

        {lines.length > 0 ? (
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>{t('pos:receipt.item')}</TableCell>
                <TableCell align='right'>{t('pos:cart.qty')}</TableCell>
                <TableCell align='right'>{t('pos:receipt.price')}</TableCell>
                <TableCell align='right'>{t('pos:receipt.total')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((ln) => (
                <TableRow key={ln.product_id}>
                  <TableCell>{ln.name}</TableCell>
                  <TableCell align='right'>{ln.qty}</TableCell>
                  <TableCell align='right'>
                    {formatPKR(ln.price, locale)}
                  </TableCell>
                  <TableCell align='right'>
                    {formatPKR(ln.qty * ln.price, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        <Stack
          spacing={0.5}
          mt={lines.length > 0 ? 2 : 0}
          sx={{ maxWidth: 360, ml: 'auto' }}
        >
          {lines.length > 0 && (
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' color='text.secondary'>
                {t('pos:cart.subtotal')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(subtotal, locale)}
              </Typography>
            </Stack>
          )}
          {serviceCharge > 0 && (
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' color='text.secondary'>
                {t('pos:cart.service_charge')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(serviceCharge, locale)}
              </Typography>
            </Stack>
          )}
          <Stack direction='row' justifyContent='space-between' mt={0.5}>
            <Typography variant='subtitle2' fontWeight={700}>
              {t('pos:cart.total')}
            </Typography>
            <Typography variant='subtitle2' fontWeight={700}>
              {formatPKR(total, locale)}
            </Typography>
          </Stack>
          <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2' color='text.secondary'>
              {t('pos:receipt.amount_paid')}
            </Typography>
            <Typography variant='body2'>
              {formatPKR(amountPaid, locale)}
            </Typography>
          </Stack>
          {onCredit > 0 && (
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' color='warning.main'>
                {t('pos:receipt.on_credit_amount')}
              </Typography>
              <Typography variant='body2' fontWeight={700} color='warning.main'>
                {formatPKR(onCredit, locale)}
              </Typography>
            </Stack>
          )}
        </Stack>

        {notes && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant='caption' color='text.secondary'>
              {t('pos:receipt.notes')}
            </Typography>
            <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>
              {notes}
            </Typography>
          </Box>
        )}

        <Typography
          variant='body2'
          mt={2}
          textAlign='center'
          color={summaryColor}
          fontWeight={700}
        >
          {summaryLabel}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('pos:actions.close')}</Button>
        <Button onClick={() => window.print()} startIcon={<PrintIcon />}>
          {t('pos:actions.print')}
        </Button>
        <Button variant='contained' onClick={onNewSale}>
          {t('pos:actions.new_sale')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
