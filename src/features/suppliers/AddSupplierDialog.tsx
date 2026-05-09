import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from 'src/components/ui'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import SupplierForm from './SupplierForm'
import { isDuplicateSupplierError, useCreateSupplier } from './hooks'
import type { SupplierFormValues } from './schemas'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}

export default function AddSupplierDialog({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation(['suppliers', 'common'])
  const create = useCreateSupplier()
  const notify = useNotifier()
  const [topError, setTopError] = useState<string | null>(null)

  const handleSubmit = async (values: SupplierFormValues) => {
    setTopError(null)
    try {
      const id = await create.mutateAsync({
        name: values.name.trim(),
        contact: values.contact?.trim() || null,
        address: values.address?.trim() || null,
        notes: values.notes?.trim() || null
      })
      notify.success(t('suppliers:messages.created'))
      onCreated(id)
      onClose()
    } catch (err) {
      if (isDuplicateSupplierError(err)) {
        setTopError(t('suppliers:errors.duplicate_name'))
      } else {
        setTopError(t('suppliers:errors.save_failed'))
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!create.isPending) {
          setTopError(null)
          onClose()
        }
      }}
      title={t('suppliers:actions.new_supplier')}
    >
      <SupplierForm
        mode='create'
        compact
        submitting={create.isPending}
        topError={topError}
        onSubmit={handleSubmit}
        onCancel={() => {
          setTopError(null)
          onClose()
        }}
      />
    </Dialog>
  )
}
