import { useState } from 'react'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { Banner, Button, Dialog, Field, Textarea } from 'src/components/ui'
import { useDeactivateBatch } from './hooks'

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
  const deactivate = useDeactivateBatch()
  const [reason, setReason] = useState('')

  const handleSubmit = async () => {
    try {
      await deactivate.mutateAsync({
        batch_id: batchId,
        reason: reason.trim() === '' ? null : reason.trim()
      })
      notify.success(t('common:actions.confirm'))
      onClose()
    } catch {
      notify.error(t('batches:errors.deactivate_failed'))
    }
  }

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
            disabled={deactivate.isPending}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSubmit}
            loading={deactivate.isPending}
          >
            {t('batches:actions.write_off_submit')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Banner variant='warning'>
          {t('batches:actions.write_off_confirm_body', {
            qty: qtyRemaining,
            productName
          })}
        </Banner>

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
