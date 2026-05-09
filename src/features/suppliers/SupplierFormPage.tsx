import { useState } from 'react'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import { Card, Button } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import SupplierForm from './SupplierForm'
import {
  isDuplicateSupplierError,
  useCreateSupplier,
  useSupplier,
  useUpdateSupplier
} from './hooks'
import type { SupplierFormValues } from './schemas'

export default function SupplierFormPage() {
  const { t } = useTranslation(['suppliers', 'common'])
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const notify = useNotifier()

  const { data: existing, isLoading } = useSupplier(id)
  const create = useCreateSupplier()
  const update = useUpdateSupplier()
  const [topError, setTopError] = useState<string | null>(null)

  const handleSubmit = async (values: SupplierFormValues) => {
    setTopError(null)
    try {
      if (isEdit && existing) {
        await update.mutateAsync({
          id: existing.id,
          name: values.name.trim(),
          contact: values.contact?.trim() || null,
          address: values.address?.trim() || null,
          notes: values.notes?.trim() || null
        })
        notify.success(t('suppliers:messages.saved'))
      } else {
        await create.mutateAsync({
          name: values.name.trim(),
          contact: values.contact?.trim() || null,
          address: values.address?.trim() || null,
          notes: values.notes?.trim() || null
        })
        notify.success(t('suppliers:messages.created'))
      }
      navigate(paths.suppliers)
    } catch (err) {
      if (isDuplicateSupplierError(err)) {
        setTopError(t('suppliers:errors.duplicate_name'))
      } else {
        setTopError(t('suppliers:errors.save_failed'))
      }
    }
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
      <Button
        variant='ghost'
        onClick={() => navigate(paths.suppliers)}
        sx={{ mb: 1 }}
      >
        {t('common:actions.back')}
      </Button>

      <PageHeader
        title={
          isEdit
            ? t('suppliers:actions.edit_supplier')
            : t('suppliers:actions.new_supplier')
        }
      />

      <Card>
        {isEdit && isLoading ? null : (
          <SupplierForm
            mode={isEdit ? 'edit' : 'create'}
            initial={
              isEdit && existing
                ? {
                    name: existing.name,
                    contact: existing.contact ?? '',
                    address: existing.address ?? '',
                    notes: existing.notes ?? ''
                  }
                : undefined
            }
            submitting={create.isPending || update.isPending}
            topError={topError}
            onSubmit={handleSubmit}
            onCancel={() => navigate(paths.suppliers)}
          />
        )}
      </Card>
    </Box>
  )
}
