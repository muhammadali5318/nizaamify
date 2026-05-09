import { useState } from 'react'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  classifyReverseError,
  useReverseLedgerEntry,
  type LedgerEntryView
} from './hooks'
import { Banner, Button, Dialog, Field, Textarea } from 'src/components/ui'

type Props = {
  open: boolean
  onClose: () => void
  entry: LedgerEntryView | null
}

export default function ReverseEntryDialog({ open, onClose, entry }: Props) {
  const { t } = useTranslation(['khata', 'common'])
  const reverse = useReverseLedgerEntry()
  const notify = useNotifier()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setNotes('')
    setError(null)
    onClose()
  }

  const submit = async () => {
    if (!entry) return
    setError(null)
    try {
      await reverse.mutateAsync({
        entry_id: entry.id,
        notes: notes.trim() || null
      })
      notify.success(t('khata:messages.reversed'))
      handleClose()
    } catch (err) {
      const cls = classifyReverseError(err)
      switch (cls.kind) {
        case 'cannot_reverse_a_reversal':
          setError(t('khata:errors.cannot_reverse_a_reversal'))
          break
        case 'entry_already_reversed':
          setError(t('khata:errors.entry_already_reversed'))
          break
        case 'entry_not_in_shop':
          setError(t('khata:errors.entry_not_in_shop'))
          break
        default:
          setError(t('khata:errors.reverse_failed'))
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t('khata:entry.reverse_confirm_title')}
      actions={
        <>
          <Button
            variant='ghost'
            onClick={handleClose}
            disabled={reverse.isPending}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='destructive'
            onClick={submit}
            loading={reverse.isPending}
          >
            {t('khata:entry.reverse_confirm_cta')}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5} mt={1}>
        <Typography variant='body2' sx={{ color: 'var(--text-secondary)' }}>
          {t('khata:entry.reverse_confirm_body')}
        </Typography>
        {error && <Banner variant='error'>{error}</Banner>}
        <Field label={t('khata:entry.reverse_confirm_notes_label')}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={2}
            inputProps={{ maxLength: 1000 }}
          />
        </Field>
      </Stack>
    </Dialog>
  )
}
