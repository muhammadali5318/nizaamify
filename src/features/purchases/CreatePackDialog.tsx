import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Field, Input } from 'src/components/ui'
import {
  useDefinePackInline,
  useUnitsOfMeasure,
  type UnitOfMeasure
} from 'src/features/units/hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'

type Props = {
  open: boolean
  onClose: () => void
  productId: string
  productName: string
  /** Suggested unit name typed inline before opening the modal (optional). */
  initialUnitName?: string
  /** Called with the new pack's id after a successful save so the caller can
   * auto-select the pack on the corresponding stock-in line. */
  onCreated: (packId: string) => void
}

function slugifyUnitCode(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'unit'
  )
}

/**
 * Stock-in form's "+ Create new pack" affordance (spec §5.1).
 * Calls `define_pack_inline` which auto-creates the UoM if the code doesn't
 * yet exist for this shop.
 */
export default function CreatePackDialog({
  open,
  onClose,
  productId,
  productName,
  initialUnitName = '',
  onCreated
}: Props) {
  const { t } = useTranslation(['purchases', 'common'])
  const { data: units } = useUnitsOfMeasure()
  const define = useDefinePackInline()
  const notify = useNotifier()

  const [unitName, setUnitName] = useState(initialUnitName)
  const [baseQty, setBaseQty] = useState<string>('')
  const [isDefault, setIsDefault] = useState(false)
  const [errs, setErrs] = useState<{ name?: string; qty?: string }>({})

  const reset = () => {
    setUnitName(initialUnitName)
    setBaseQty('')
    setIsDefault(false)
    setErrs({})
  }

  const close = () => {
    reset()
    onClose()
  }

  const submit = async () => {
    const trimmed = unitName.trim()
    const qty = Number(baseQty)
    const next: typeof errs = {}
    if (!trimmed) next.name = t('purchases:form.create_pack_invalid_name')
    if (!Number.isInteger(qty) || qty <= 1) {
      next.qty = t('purchases:form.create_pack_invalid_qty')
    }
    if (next.name || next.qty) {
      setErrs(next)
      return
    }

    // Reuse an existing UoM by name (case-insensitive) if it matches —
    // otherwise the RPC slugifies and creates one.
    const lower = trimmed.toLowerCase()
    const existing = (units ?? []).find(
      (u: UnitOfMeasure) => u.name.toLowerCase() === lower || u.code === lower
    )
    const code = existing ? existing.code : slugifyUnitCode(trimmed)

    try {
      const packId = await define.mutateAsync({
        productId,
        unitCode: code,
        unitName: trimmed,
        baseQty: qty,
        isDefaultPurchase: isDefault
      })
      notify.success(t('purchases:messages.saved'))
      onCreated(packId)
      reset()
      onClose()
    } catch {
      notify.error(t('purchases:form.create_pack_save_failed'))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth='xs'
      title={t('purchases:form.create_pack_modal_title', { productName })}
      actions={
        <>
          <Button variant='ghost' onClick={close} disabled={define.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={() => void submit()}
            loading={define.isPending}
          >
            {t('purchases:form.create_pack_save')}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Field
          label={t('purchases:form.create_pack_unit_label')}
          error={errs.name}
        >
          <Input
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder={t('purchases:form.create_pack_unit_placeholder')}
          />
        </Field>
        <Field
          label={t('purchases:form.create_pack_contains')}
          hint={t('purchases:form.create_pack_contains_help')}
          error={errs.qty}
        >
          <Input
            type='number'
            inputProps={{ min: 2, step: 1, inputMode: 'numeric' }}
            value={baseQty}
            onChange={(e) => setBaseQty(e.target.value)}
          />
        </Field>
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
            }
            label={t('purchases:form.create_pack_default')}
          />
          <Typography
            variant='caption'
            sx={{ display: 'block', color: 'var(--text-muted)' }}
          >
            {t('purchases:form.create_pack_default')}
          </Typography>
        </Box>
      </Stack>
    </Dialog>
  )
}
