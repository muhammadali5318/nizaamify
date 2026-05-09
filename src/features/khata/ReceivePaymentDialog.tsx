import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { classifyReceivePaymentError, useReceivePayment } from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { formatPKR } from 'src/features/subscription/env'

type Props = {
  open: boolean
  onClose: () => void
  customerId: string
  customerName?: string
  outstanding?: number
}

export default function ReceivePaymentDialog({
  open,
  onClose,
  customerId,
  customerName,
  outstanding
}: Props) {
  const { t, i18n } = useTranslation(['khata', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const receive = useReceivePayment()
  const notify = useNotifier()

  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount('')
      setNotes('')
      setError(null)
    }
  }, [open, customerId])

  const cap =
    typeof outstanding === 'number' && outstanding > 0 ? outstanding : 0
  const numericAmount = Number(amount)
  const exceedsCap =
    Number.isFinite(numericAmount) && cap > 0 && numericAmount > cap
  const submittable =
    !receive.isPending &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    !exceedsCap

  const submit = async () => {
    setError(null)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t('khata:receive_payment.errors.amount_invalid'))
      return
    }
    try {
      await receive.mutateAsync({
        customer_id: customerId,
        amount: numericAmount,
        notes: notes.trim() || null
      })
      notify.success(t('khata:receive_payment.saved'))
      onClose()
    } catch (err) {
      const cls = classifyReceivePaymentError(err)
      switch (cls.kind) {
        case 'overpayment_customer':
          setError(
            t('khata:errors.overpayment_customer', {
              max: formatPKR(cls.max, locale)
            })
          )
          break
        case 'amount_must_be_positive':
          setError(t('khata:errors.amount_must_be_positive'))
          break
        case 'customer_not_in_shop':
          setError(t('khata:errors.customer_not_in_shop'))
          break
        default:
          setError(t('khata:receive_payment.errors.save_failed'))
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='xs'>
      <DialogTitle>{t('khata:receive_payment.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {customerName && (
            <Typography variant='body2' color='text.secondary'>
              {customerName}
            </Typography>
          )}
          {typeof outstanding === 'number' && (
            <Typography variant='body2'>
              {t('khata:fields.outstanding')}:{' '}
              <strong>{formatPKR(outstanding, locale)}</strong>
            </Typography>
          )}
          {error && <Alert severity='error'>{error}</Alert>}

          <TextField
            label={t('khata:receive_payment.amount')}
            type='number'
            inputProps={{
              min: 0,
              max: cap > 0 ? cap : undefined,
              step: '0.01'
            }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            size='small'
            error={exceedsCap}
            helperText={
              cap > 0
                ? t('khata:receive_payment.amount_max_customer', {
                    max: formatPKR(cap, locale)
                  })
                : undefined
            }
          />

          <TextField
            label={t('khata:receive_payment.notes_label')}
            placeholder={t('khata:receive_payment.notes_placeholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            size='small'
            multiline
            minRows={2}
            inputProps={{ maxLength: 1000 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={receive.isPending}>
          {t('common:actions.cancel')}
        </Button>
        <Button variant='contained' onClick={submit} disabled={!submittable}>
          {t('khata:receive_payment.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
