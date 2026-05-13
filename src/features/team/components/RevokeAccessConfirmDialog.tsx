import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from '@mui/material'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from 'src/components/ui'
import { useRevokeUserAccess } from 'src/features/team/hooks'
import { mapErrorToI18nKey } from 'src/lib/errorMap'

interface RevokeAccessConfirmDialogProps {
  open: boolean
  onClose: () => void
  member: { user_id: string; email: string } | null
}

export function RevokeAccessConfirmDialog({
  open,
  onClose,
  member
}: RevokeAccessConfirmDialogProps) {
  const { t } = useTranslation('team')
  const revoke = useRevokeUserAccess()
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!member) return
    setError(null)
    try {
      await revoke.mutateAsync(member.user_id)
      onClose()
    } catch (err) {
      setError(mapErrorToI18nKey(err))
    }
  }

  if (!member) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>
        {t('revoke.dialog_title', { email: member.email })}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          <Typography variant='body2'>
            <Trans
              i18nKey='team:revoke.warning'
              values={{ email: member.email }}
              components={{ b: <strong /> }}
            />
          </Typography>
          {error && <Alert severity='error'>{t(`common:${error}`)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button variant='secondary' onClick={onClose}>
          {t('revoke.cancel')}
        </Button>
        <Button
          variant='destructive'
          loading={revoke.isPending}
          onClick={() => void handleConfirm()}
        >
          {t('revoke.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RevokeAccessConfirmDialog
