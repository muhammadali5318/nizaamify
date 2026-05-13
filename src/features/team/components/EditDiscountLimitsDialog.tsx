import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Button, Field, Input } from 'src/components/ui'
import { useUpdateUserDiscountLimits } from 'src/features/team/hooks'
import { mapErrorToI18nKey } from 'src/lib/errorMap'

interface EditDiscountLimitsDialogProps {
  open: boolean
  onClose: () => void
  member: { user_id: string; email: string } | null
  // Limits aren't returned by get_team_for_active_shop; for v2.9.1 we
  // submit deltas only. The dialog initializes blank fields = "no change".
  // A future polish ticket can prefetch existing limits via a dedicated RPC.
}

export function EditDiscountLimitsDialog({
  open,
  onClose,
  member
}: EditDiscountLimitsDialogProps) {
  const { t } = useTranslation('team')
  const update = useUpdateUserDiscountLimits()
  const [perLinePct, setPerLinePct] = useState('')
  const [perLinePkr, setPerLinePkr] = useState('')
  const [perInvoicePct, setPerInvoicePct] = useState('')
  const [perInvoicePkr, setPerInvoicePkr] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPerLinePct('')
      setPerLinePkr('')
      setPerInvoicePct('')
      setPerInvoicePkr('')
      setError(null)
    }
  }, [open])

  const handleSave = async () => {
    if (!member) return
    setError(null)
    const limits: Record<string, number> = {}
    const parse = (v: string) => {
      const n = Number(v.trim())
      return v.trim() && Number.isFinite(n) ? n : null
    }
    const pl = parse(perLinePct)
    const plk = parse(perLinePkr)
    const pi = parse(perInvoicePct)
    const pik = parse(perInvoicePkr)
    if (pl !== null) limits.per_line_max_pct = pl
    if (plk !== null) limits.per_line_max_pkr = plk
    if (pi !== null) limits.per_invoice_max_pct = pi
    if (pik !== null) limits.per_invoice_max_pkr = pik
    try {
      await update.mutateAsync({
        target_user_id: member.user_id,
        limits
      })
      onClose()
    } catch (err) {
      setError(mapErrorToI18nKey(err))
    }
  }

  if (!member) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        {t('discount_limits.dialog_title', { email: member.email })}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2.5}>
          <Typography variant='body2' sx={{ color: 'var(--text-secondary)' }}>
            {t('discount_limits.intro')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }
            }}
          >
            <Field label={t('discount_limits.field_per_line_pct')}>
              <Input
                type='number'
                inputMode='decimal'
                value={perLinePct}
                onChange={(e) => setPerLinePct(e.target.value)}
                placeholder='—'
                min={0}
                max={100}
              />
            </Field>
            <Field label={t('discount_limits.field_per_line_pkr')}>
              <Input
                type='number'
                inputMode='decimal'
                value={perLinePkr}
                onChange={(e) => setPerLinePkr(e.target.value)}
                placeholder='—'
                min={0}
              />
            </Field>
            <Field label={t('discount_limits.field_per_invoice_pct')}>
              <Input
                type='number'
                inputMode='decimal'
                value={perInvoicePct}
                onChange={(e) => setPerInvoicePct(e.target.value)}
                placeholder='—'
                min={0}
                max={100}
              />
            </Field>
            <Field label={t('discount_limits.field_per_invoice_pkr')}>
              <Input
                type='number'
                inputMode='decimal'
                value={perInvoicePkr}
                onChange={(e) => setPerInvoicePkr(e.target.value)}
                placeholder='—'
                min={0}
              />
            </Field>
          </Box>
          {error && <Alert severity='error'>{t(`common:${error}`)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button variant='secondary' onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>
        <Button loading={update.isPending} onClick={() => void handleSave()}>
          {t('discount_limits.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default EditDiscountLimitsDialog
