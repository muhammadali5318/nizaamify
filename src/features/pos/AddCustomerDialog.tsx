import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useCreateCustomer } from 'src/features/customers/hooks'
import CustomerForm, {
  isPhoneDuplicateError,
  type CustomerFormValues
} from 'src/features/customers/CustomerForm'
import { useNotifier } from 'src/components/notistack/NotificationProvider'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}

export default function AddCustomerDialog({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation(['customers', 'common'])
  const create = useCreateCustomer()
  const notify = useNotifier()
  const [topError, setTopError] = useState<string | null>(null)

  const handleSubmit = async (values: CustomerFormValues) => {
    setTopError(null)
    try {
      const c = await create.mutateAsync({
        name: values.name.trim(),
        phone: values.phone,
        address: values.address.trim() || null,
        notes: values.notes.trim() || null
      })
      notify.success(t('customers:messages.saved'))
      onCreated(c.id)
      onClose()
    } catch (e) {
      if (isPhoneDuplicateError(e)) {
        setTopError(t('customers:errors.phone_duplicate'))
      } else {
        setTopError(t('customers:errors.save_failed'))
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
      fullWidth
      maxWidth='xs'
    >
      <DialogTitle>{t('customers:add_customer')}</DialogTitle>
      <DialogContent>
        <CustomerForm
          mode='create'
          compact
          submitting={create.isPending}
          onSubmit={handleSubmit}
          onCancel={() => {
            setTopError(null)
            onClose()
          }}
          topError={topError}
        />
      </DialogContent>
    </Dialog>
  )
}
