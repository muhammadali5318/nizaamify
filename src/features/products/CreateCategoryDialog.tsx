import { useEffect, useState } from 'react'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Field, Input } from 'src/components/ui'
import { useNotifier } from 'src/components/notistack/NotificationProvider'

type Props = {
  open: boolean
  onClose: () => void
  initialName?: string
  submitting?: boolean
  onSubmit: (name: string) => Promise<void> | void
}

export default function CreateCategoryDialog({
  open,
  onClose,
  initialName = '',
  submitting,
  onSubmit
}: Props) {
  const { t } = useTranslation(['products', 'common'])
  const notify = useNotifier()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setError(null)
    }
  }, [open, initialName])

  const trimmed = name.trim()

  const handleSubmit = async () => {
    if (!trimmed) {
      setError(t('products:category.errors.required'))
      return
    }
    try {
      await onSubmit(trimmed)
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? ''
      if (msg.includes('category_already_exists')) {
        setError(t('products:category.errors.duplicate'))
      } else {
        notify.error(t('products:errors.save_failed'))
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('products:category.dialog_title')}
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={submitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSubmit}
            loading={submitting}
            disabled={!trimmed}
          >
            {t('common:actions.create')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Field
          label={t('products:category.field_label')}
          error={error ?? undefined}
        >
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- modal capture-focus is the established pattern across our dialogs
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            placeholder={t('products:category.placeholder')}
          />
        </Field>
      </Stack>
    </Dialog>
  )
}
