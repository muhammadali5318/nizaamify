import { useState } from 'react'
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { useCreateCustomer, useCustomer, useUpdateCustomer } from './hooks'
import CustomerForm, {
  isPhoneDuplicateError,
  type CustomerFormValues
} from './CustomerForm'

export default function CustomerFormPage() {
  const { t } = useTranslation(['customers', 'common'])
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const notify = useNotifier()
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const { data: existing, isLoading } = useCustomer(isNew ? undefined : id)
  const [topError, setTopError] = useState<string | null>(null)

  if (!isNew && isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (!isNew && !existing) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant='body1'>
          {t('customers:errors.not_found')}
        </Typography>
        <Button onClick={() => navigate(paths.customers)} sx={{ mt: 2 }}>
          {t('customers:actions.back')}
        </Button>
      </Box>
    )
  }

  const onSubmit = async (values: CustomerFormValues) => {
    setTopError(null)
    try {
      if (isNew) {
        const c = await create.mutateAsync({
          name: values.name.trim(),
          phone: values.phone,
          address: values.address.trim() || null,
          notes: values.notes.trim() || null
        })
        notify.success(t('customers:messages.saved'))
        navigate(paths.gotoCustomer(c.id))
      } else if (id) {
        await update.mutateAsync({
          id,
          name: values.name.trim(),
          phone: values.phone,
          address: values.address.trim() || null,
          notes: values.notes.trim() || null
        })
        notify.success(t('customers:messages.saved'))
        navigate(paths.gotoCustomer(id))
      }
    } catch (e) {
      if (isPhoneDuplicateError(e)) {
        setTopError(t('customers:errors.phone_duplicate'))
      } else {
        setTopError(t('customers:errors.save_failed'))
      }
    }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, maxWidth: 640 }}>
        <Typography variant='h5' fontWeight={700} mb={3}>
          {isNew ? t('customers:add_customer') : t('customers:edit_customer')}
        </Typography>

        <CustomerForm
          mode={isNew ? 'create' : 'edit'}
          defaultValues={
            existing
              ? {
                  name: existing.name,
                  phone: existing.phone,
                  address: existing.address ?? '',
                  notes: existing.notes ?? ''
                }
              : undefined
          }
          submitting={create.isPending || update.isPending}
          onSubmit={onSubmit}
          onCancel={() => navigate(paths.customers)}
          topError={topError}
        />
      </Paper>
    </Box>
  )
}
