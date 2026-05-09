import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  classifyReverseError,
  useReverseLedgerEntry,
  type LedgerEntryView
} from './hooks'

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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth='xs'>
      <DialogTitle>{t('khata:entry.reverse_confirm_title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <DialogContentText>
            {t('khata:entry.reverse_confirm_body')}
          </DialogContentText>
          {error && <Alert severity='error'>{error}</Alert>}
          <TextField
            label={t('khata:entry.reverse_confirm_notes_label')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: 1000 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={reverse.isPending}>
          {t('common:actions.cancel')}
        </Button>
        <Button
          variant='contained'
          color='warning'
          onClick={submit}
          disabled={reverse.isPending}
        >
          {t('khata:entry.reverse_confirm_cta')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
