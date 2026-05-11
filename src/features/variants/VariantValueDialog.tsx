import { useEffect, useState } from 'react'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Field, Input } from 'src/components/ui'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  attributeName: string
  initialValue?: string
  initialDisplayOrder?: number
  submitting?: boolean
  errorText?: string | null
  onClose: () => void
  onSubmit: (input: { value: string; display_order: number }) => Promise<void>
}

export default function VariantValueDialog({
  open,
  mode,
  attributeName,
  initialValue = '',
  initialDisplayOrder = 0,
  submitting,
  errorText,
  onClose,
  onSubmit
}: Props) {
  const { t } = useTranslation(['variant_attributes', 'common'])
  const [value, setValue] = useState(initialValue)
  const [displayOrder, setDisplayOrder] = useState(String(initialDisplayOrder))
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setDisplayOrder(String(initialDisplayOrder))
      setLocalError(null)
    }
  }, [open, initialValue, initialDisplayOrder])

  const handleSubmit = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      setLocalError(t('variant_attributes:errors.blank_name'))
      return
    }
    const order = Number(displayOrder)
    await onSubmit({
      value: trimmed,
      display_order: Number.isFinite(order) ? order : 0
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      title={`${mode === 'create' ? t('variant_attributes:dialog.new_value_title') : t('variant_attributes:dialog.edit_value_title')} — ${attributeName}`}
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={submitting}>
            {t('variant_attributes:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSubmit}
            loading={submitting}
            disabled={!value.trim()}
          >
            {t('variant_attributes:actions.save')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Field
          label={t('variant_attributes:fields.value')}
          error={localError ?? errorText ?? undefined}
        >
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- modal capture-focus pattern
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (localError) setLocalError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            inputProps={{ maxLength: 80 }}
          />
        </Field>
        <Field
          label={t('variant_attributes:fields.display_order')}
          hint={t('variant_attributes:value_display_order_hint')}
        >
          <Input
            type='number'
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            inputProps={{ step: '1', min: 0 }}
          />
        </Field>
      </Stack>
    </Dialog>
  )
}
