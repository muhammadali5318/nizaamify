import { useState } from 'react'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { useCreateCustomer, useCustomer, useUpdateCustomer } from './hooks'
import CustomerForm, {
  isPhoneDuplicateError,
  type CustomerFormValues
} from './CustomerForm'
import { Banner, Button, Card, FullPageSpinner } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

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

  if (!isNew && isLoading) return <FullPageSpinner />

  if (!isNew && !existing) {
    return (
      <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
        <Banner variant='error'>{t('customers:errors.not_found')}</Banner>
        <Button
          variant='secondary'
          onClick={() => navigate(paths.customers)}
          sx={{ mt: 2 }}
        >
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
    <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={
          isNew ? t('customers:add_customer') : t('customers:edit_customer')
        }
      />
      <Card>
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
      </Card>
    </Box>
  )
}
