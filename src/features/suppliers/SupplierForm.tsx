import { useState } from 'react'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { Banner, Button, Field, Input, Textarea } from 'src/components/ui'
import { PK_PHONE_HINT } from 'src/lib/phone'
import { supplierSchema, type SupplierFormValues } from './schemas'

type Props = {
  mode: 'create' | 'edit'
  initial?: Partial<SupplierFormValues>
  submitting?: boolean
  topError?: string | null
  compact?: boolean
  onSubmit: (values: SupplierFormValues) => void
  onCancel: () => void
}

export default function SupplierForm({
  mode,
  initial,
  submitting,
  topError,
  compact,
  onSubmit,
  onCancel
}: Props) {
  const { t } = useTranslation(['suppliers', 'common'])
  const [name, setName] = useState(initial?.name ?? '')
  const [contact, setContact] = useState(initial?.contact ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const parsed = supplierSchema.safeParse({ name, contact, address, notes })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing={compact ? 2 : 2.5}>
        {topError && <Banner variant='error'>{topError}</Banner>}

        <Field
          label={t('suppliers:fields.name')}
          required
          error={errors.name && t('suppliers:errors.name_required')}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 120 }}
          />
        </Field>

        <Field
          label={t('suppliers:fields.contact')}
          error={errors.contact && t('suppliers:errors.contact_invalid')}
        >
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            inputProps={{ maxLength: 60 }}
            placeholder={PK_PHONE_HINT}
          />
        </Field>

        <Field label={t('suppliers:fields.address')}>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            inputProps={{ maxLength: 500 }}
          />
        </Field>

        <Field label={t('suppliers:fields.notes')}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={2}
            inputProps={{ maxLength: 1000 }}
          />
        </Field>

        <Stack direction='row' spacing={1.5} justifyContent='flex-end'>
          <Button variant='ghost' onClick={onCancel} disabled={submitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button type='submit' variant='primary' loading={submitting}>
            {mode === 'create'
              ? t('suppliers:actions.create')
              : t('suppliers:actions.save')}
          </Button>
        </Stack>
      </Stack>
    </form>
  )
}
