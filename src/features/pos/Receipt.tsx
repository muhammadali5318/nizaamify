import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PrintIcon from '@mui/icons-material/Print'
import { useTranslation } from 'react-i18next'
import { formatPKR } from 'src/features/subscription/env'
import {
  Badge,
  type BadgeVariant,
  Button,
  DataTable,
  Dialog,
  type DataTableColumn
} from 'src/components/ui'

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
  /** v2.8.4: render the expired-stock disclaimer footer. Caller decides
   *  (shop opt-in × any sold_expired line). */
  showExpiredDisclaimer?: boolean
}

const paymentBadgeVariant: Record<ReceiptPaymentType, BadgeVariant> = {
  cash: 'success',
  credit: 'warning',
  partial: 'info'
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
  notes,
  showExpiredDisclaimer
}: Props) {
  const { t, i18n } = useTranslation(['pos', 'common', 'sales'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const subtotal = lines.reduce((s, ln) => s + ln.qty * ln.price, 0)

  const summaryLabel =
    paymentType === 'cash'
      ? t('pos:receipt.paid')
      : paymentType === 'credit'
        ? t('pos:receipt.credit')
        : t('pos:receipt.partial')

  const itemColumns: DataTableColumn<ReceiptLine>[] = [
    {
      id: 'item',
      header: t('pos:receipt.item'),
      cardRole: 'heading',
      cell: (ln) => ln.name
    },
    {
      id: 'qty',
      header: t('pos:cart.qty'),
      align: 'end',
      cell: (ln) => ln.qty
    },
    {
      id: 'price',
      header: t('pos:receipt.price'),
      align: 'end',
      cell: (ln) => formatPKR(ln.price, locale)
    },
    {
      id: 'total',
      header: t('pos:receipt.total'),
      align: 'end',
      cell: (ln) => formatPKR(ln.qty * ln.price, locale)
    }
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      title={t('pos:receipt.title')}
      actions={
        <>
          <Button variant='ghost' onClick={onClose}>
            {t('pos:actions.close')}
          </Button>
          <Button
            variant='secondary'
            onClick={() => window.print()}
            startIcon={<PrintIcon />}
          >
            {t('pos:actions.print')}
          </Button>
          <Button variant='primary' onClick={onNewSale}>
            {t('pos:actions.new_sale')}
          </Button>
        </>
      }
    >
      <Stack spacing={1} mb={2}>
        <Typography
          variant='h3'
          sx={{ textAlign: 'center', color: 'var(--text-primary)' }}
        >
          {shopName}
        </Typography>
        <Typography
          variant='caption'
          sx={{ textAlign: 'center', color: 'var(--text-muted)' }}
        >
          {t('pos:receipt.invoice')}: {invoiceId.slice(0, 8)}
        </Typography>
        <Typography
          variant='caption'
          sx={{ textAlign: 'center', color: 'var(--text-muted)' }}
        >
          {t('pos:receipt.date')}:{' '}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'short',
            timeStyle: 'short'
          }).format(new Date())}
        </Typography>
        {customerName && (
          <Typography variant='caption' sx={{ textAlign: 'center' }}>
            {t('pos:payment.customer')}: {customerName}
          </Typography>
        )}
      </Stack>

      {lines.length > 0 && (
        <DataTable
          columns={itemColumns}
          rows={lines}
          getRowId={(ln) => ln.product_id}
          ariaLabel={t('pos:receipt.title')}
        />
      )}

      <Stack
        spacing={0.5}
        mt={lines.length > 0 ? 2 : 0}
        sx={{ maxWidth: 360, marginInlineStart: 'auto' }}
      >
        {lines.length > 0 && (
          <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
              {t('pos:cart.subtotal')}
            </Typography>
            <Typography variant='body2'>
              {formatPKR(subtotal, locale)}
            </Typography>
          </Stack>
        )}
        {serviceCharge > 0 && (
          <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
              {t('pos:cart.service_charge')}
            </Typography>
            <Typography variant='body2'>
              {formatPKR(serviceCharge, locale)}
            </Typography>
          </Stack>
        )}
        <Stack
          direction='row'
          justifyContent='space-between'
          mt={0.5}
          pt={0.5}
          sx={{ borderTop: '1px solid var(--border-default)' }}
        >
          <Typography variant='h3' component='span'>
            {t('pos:cart.total')}
          </Typography>
          <Typography variant='h3' component='span'>
            {formatPKR(total, locale)}
          </Typography>
        </Stack>
        <Stack direction='row' justifyContent='space-between'>
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            {t('pos:receipt.amount_paid')}
          </Typography>
          <Typography variant='body2'>
            {formatPKR(amountPaid, locale)}
          </Typography>
        </Stack>
        {onCredit > 0 && (
          <Stack direction='row' justifyContent='space-between'>
            <Typography
              variant='body2'
              sx={{ color: 'var(--status-warning-text)' }}
            >
              {t('pos:receipt.on_credit_amount')}
            </Typography>
            <Typography
              variant='body2'
              sx={{ fontWeight: 600, color: 'var(--status-warning-text)' }}
            >
              {formatPKR(onCredit, locale)}
            </Typography>
          </Stack>
        )}
      </Stack>

      {notes && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: 'var(--surface-muted)',
            borderRadius: 'var(--radius)'
          }}
        >
          <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
            {t('pos:receipt.notes')}
          </Typography>
          <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>
            {notes}
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Badge
          variant={paymentBadgeVariant[paymentType]}
          label={summaryLabel}
        />
      </Box>

      {showExpiredDisclaimer && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            border: '1px solid var(--status-warning-text)',
            borderRadius: 'var(--radius)'
          }}
        >
          <Typography
            variant='caption'
            sx={{ color: 'var(--status-warning-text)', display: 'block' }}
          >
            {t('sales:detail.receipt_disclaimer_default')}
          </Typography>
        </Box>
      )}
    </Dialog>
  )
}
