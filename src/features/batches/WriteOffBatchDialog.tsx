import { useState } from 'react'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  Banner,
  Button,
  Dialog,
  Field,
  Input,
  Textarea
} from 'src/components/ui'
import { useRecordPartialWriteoff } from './hooks'

type Props = {
  batchId: string
  batchNo: string
  qtyRemaining: number
  productName?: string
  onClose: () => void
}

export default function WriteOffBatchDialog({
  batchId,
  batchNo,
  qtyRemaining,
  productName,
  onClose
}: Props) {
  const { t } = useTranslation(['batches', 'common'])
  const notify = useNotifier()
  const writeoff = useRecordPartialWriteoff()
  // v2.8.2: qty defaults to qty_remaining (legacy "write off whole batch"
  // behavior). User can lower it for partial RTV / damage.
  const [qty, setQty] = useState<string>(String(qtyRemaining))
  const [reason, setReason] = useState('')

  const qtyNum = qty === '' ? NaN : Number(qty)
  const qtyValid =
    Number.isInteger(qtyNum) && qtyNum > 0 && qtyNum <= qtyRemaining

  const handleSubmit = async () => {
    if (!qtyValid) {
      notify.error(t('batches:errors.qty_invalid'))
      return
    }
    try {
      await writeoff.mutateAsync({
        batch_id: batchId,
        qty: qtyNum,
        reason: reason.trim() === '' ? null : reason.trim()
      })
      notify.success(t('common:actions.confirm'))
      onClose()
    } catch {
      notify.error(t('batches:errors.deactivate_failed'))
    }
  }

  // When qty < remaining: partial. When qty == remaining: full (auto-
  // deactivate trigger flips is_active=false). Same call either way.
  const isFull = qtyNum === qtyRemaining

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={t('batches:actions.write_off_confirm_title', { batchNo })}
      maxWidth='xs'
      actions={
        <>
          <Button
            variant='ghost'
            onClick={onClose}
            disabled={writeoff.isPending}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSubmit}
            loading={writeoff.isPending}
            disabled={!qtyValid}
          >
            {t('batches:actions.write_off_submit')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Banner variant='warning'>
          {t('batches:actions.write_off_confirm_body', {
            qty: Number.isFinite(qtyNum) ? qtyNum : qtyRemaining,
            productName
          })}
          {isFull && ` ${t('batches:actions.write_off_full_note')}`}
        </Banner>

        <Field
          label={t('batches:actions.write_off_qty_label', {
            max: qtyRemaining
          })}
          hint={t('batches:actions.write_off_qty_help')}
        >
          <Input
            type='number'
            inputProps={{ min: 1, max: qtyRemaining, step: 1 }}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>

        <Field label={t('batches:actions.write_off_reason_label')}>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('batches:actions.write_off_reason_placeholder')}
            inputProps={{ maxLength: 200 }}
          />
        </Field>
      </Stack>
    </Dialog>
  )
}
