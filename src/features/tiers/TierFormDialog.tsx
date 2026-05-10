import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Field, Input, Textarea } from 'src/components/ui'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  useDefineTier,
  useUpdateTier,
  tierErrorKey,
  type CustomerTier
} from './hooks'

type Mode = { kind: 'create' } | { kind: 'edit'; tier: CustomerTier }

type Props = {
  open: boolean
  onClose: () => void
  mode: Mode
  /** True if there's already a default tier other than this one — used to
   * grey out the toggle when un-defaulting would leave the shop with none. */
  defaultExistsElsewhere: boolean
}

export default function TierFormDialog({
  open,
  onClose,
  mode,
  defaultExistsElsewhere
}: Props) {
  const { t } = useTranslation(['tiers', 'common'])
  const define = useDefineTier()
  const update = useUpdateTier()
  const notify = useNotifier()

  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [notes, setNotes] = useState('')
  const [errs, setErrs] = useState<{ name?: string }>({})

  useEffect(() => {
    if (mode.kind === 'edit') {
      setName(mode.tier.name)
      setIsDefault(mode.tier.is_default)
      setNotes(mode.tier.notes ?? '')
    } else {
      setName('')
      setIsDefault(false)
      setNotes('')
    }
    setErrs({})
  }, [mode, open])

  const submit = async () => {
    const trimmed = name.trim()
    const next: typeof errs = {}
    if (!trimmed) next.name = t('tiers:errors.name_required')
    if (next.name) {
      setErrs(next)
      return
    }

    try {
      if (mode.kind === 'create') {
        await define.mutateAsync({
          name: trimmed,
          isDefault,
          notes: notes.trim() || null
        })
      } else {
        await update.mutateAsync({
          tierId: mode.tier.id,
          name: trimmed,
          isDefault,
          notes: notes.trim() || null
        })
      }
      notify.success(t('tiers:messages.saved'))
      onClose()
    } catch (err) {
      const key = tierErrorKey(err)
      notify.error(key ? t(key) : t('tiers:errors.save_failed'))
    }
  }

  const saving = define.isPending || update.isPending

  // Editing the current default? Disable the toggle — the spec rejects
  // un-defaulting a tier; the user must designate another default first.
  const defaultLocked =
    mode.kind === 'edit' && mode.tier.is_default && !defaultExistsElsewhere

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      title={
        mode.kind === 'create'
          ? t('tiers:dialog.new_title')
          : t('tiers:dialog.edit_title')
      }
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={saving}>
            {t('tiers:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={() => void submit()}
            loading={saving}
          >
            {t('tiers:actions.save')}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Field label={t('tiers:fields.name')} error={errs.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={isDefault}
                disabled={defaultLocked}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
            }
            label={t('tiers:fields.is_default')}
          />
        </Box>
        <Field label={t('tiers:fields.notes')}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={2}
            inputProps={{ maxLength: 500 }}
          />
        </Field>
      </Stack>
    </Dialog>
  )
}
