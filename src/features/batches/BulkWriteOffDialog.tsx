import { useState } from 'react'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { Banner, Button, Dialog, Field, Textarea } from 'src/components/ui'
import { useRecordPartialWriteoff } from './hooks'

type Batch = {
  batch_id: string
  batch_no: string
  qty_remaining: number
  product_name: string
}

type Props = {
  batches: Batch[]
  onClose: () => void
}

/**
 * v2.8.3 bulk write-off — iterates record_partial_writeoff(qty_remaining)
 * over each batch with the same reason. Frontend loop; no new bulk RPC.
 * Each batch gets its own write-off row (audit trail per ADR
 * 2026-05-13-bulk-write-off-loops-existing-rpc).
 */
export default function BulkWriteOffDialog({ batches, onClose }: Props) {
  const { t } = useTranslation(['dashboard', 'common'])
  const notify = useNotifier()
  const writeoff = useRecordPartialWriteoff()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    let failedCount = 0
    for (const b of batches) {
      try {
        await writeoff.mutateAsync({
          batch_id: b.batch_id,
          qty: b.qty_remaining,
          reason: reason.trim() === '' ? null : reason.trim()
        })
      } catch {
        failedCount += 1
      }
    }
    setSubmitting(false)
    if (failedCount === 0) {
      notify.success(t('common:actions.confirm'))
      onClose()
    } else {
      notify.error(
        t('dashboard:expired_stock.write_off_all_failed', {
          count: failedCount
        })
      )
    }
  }

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={t('dashboard:expired_stock.write_off_all_dialog_title', {
        count: batches.length
      })}
      maxWidth='sm'
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={submitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant='primary' onClick={handleSubmit} loading={submitting}>
            {t('dashboard:expired_stock.write_off_all_submit')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Banner variant='warning'>
          {t('dashboard:expired_stock.write_off_all_dialog_body')}
        </Banner>

        <Box
          sx={{
            maxHeight: 240,
            overflowY: 'auto',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            p: 1.5
          }}
        >
          <Stack spacing={0.75}>
            {batches.map((b) => (
              <Stack
                key={b.batch_id}
                direction='row'
                spacing={1}
                alignItems='baseline'
              >
                <Typography variant='body2' sx={{ fontWeight: 500 }}>
                  {b.product_name}
                </Typography>
                <Typography
                  variant='caption'
                  sx={{
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace'
                  }}
                >
                  {b.batch_no}
                </Typography>
                <Typography
                  variant='caption'
                  sx={{ color: 'var(--text-muted)' }}
                >
                  ({b.qty_remaining})
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Field label={t('dashboard:expired_stock.write_off_all_reason_label')}>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(
              'dashboard:expired_stock.write_off_all_reason_placeholder'
            )}
            inputProps={{ maxLength: 200 }}
          />
        </Field>
      </Stack>
    </Dialog>
  )
}
