import { useEffect, useState } from 'react'
import Stack from '@mui/material/Stack'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  Banner,
  Button,
  Dialog,
  Field,
  Input,
  Textarea
} from 'src/components/ui'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { editProductSchema, type EditProductValues } from './schemas'
import { useUpdateProduct, type Product } from './hooks'
import { useShopAlertDefaults } from 'src/features/batches/hooks'
import CategoryCombobox from './CategoryCombobox'

type SupabaseLikeError = {
  code?: string
  message?: string
  details?: string | null
}

function isDuplicate(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as SupabaseLikeError
  if (e.code === '23505') return true
  const h = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase()
  return h.includes('uq_products_shop_name_category')
}

type Props = {
  open: boolean
  onClose: () => void
  product: Product | null | undefined
  onSaved?: () => void
}

export default function ProductEditDialog({
  open,
  onClose,
  product,
  onSaved
}: Props) {
  const { t } = useTranslation(['products', 'common', 'batches'])
  const notify = useNotifier()
  const update = useUpdateProduct()
  const { data: shopDefaults } = useShopAlertDefaults()
  const [duplicateError, setDuplicateError] = useState(false)
  const [batchToggleError, setBatchToggleError] = useState<string | null>(null)

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<EditProductValues>({
    resolver: zodResolver(editProductSchema(t)),
    defaultValues: {
      name: '',
      category_id: '',
      description: '',
      price: 0,
      is_active: true,
      is_scan_only: false,
      has_batches: false,
      expiry_alert_days: null,
      warranty_alert_days: null
    }
  })

  const hasBatches = watch('has_batches')

  useEffect(() => {
    if (open && product) {
      reset({
        name: product.name,
        category_id: product.category_id ?? '',
        description: product.description ?? '',
        price: Number(product.price ?? 0),
        is_active: product.is_active,
        is_scan_only: product.is_scan_only ?? false,
        has_batches: product.has_batches ?? false,
        expiry_alert_days: product.expiry_alert_days ?? null,
        warranty_alert_days: product.warranty_alert_days ?? null
      })
      setDuplicateError(false)
      setBatchToggleError(null)
    }
  }, [open, product, reset])

  const onSubmit = async (values: EditProductValues) => {
    if (!product) return
    setDuplicateError(false)
    setBatchToggleError(null)
    try {
      await update.mutateAsync({
        id: product.id,
        name: values.name,
        category_id: values.category_id,
        description: values.description?.trim() ? values.description : null,
        price: values.price,
        is_active: values.is_active,
        is_scan_only: values.is_scan_only,
        has_batches: values.has_batches,
        expiry_alert_days: values.expiry_alert_days,
        warranty_alert_days: values.warranty_alert_days
      })
      notify.success(t('products:messages.saved'))
      onSaved?.()
      onClose()
    } catch (err) {
      const msg = (err as Error)?.message ?? ''
      if (msg === 'cannot_enable_batches_with_stock') {
        setBatchToggleError(
          t('batches:errors.cannot_enable_batches_with_stock')
        )
      } else if (msg === 'cannot_disable_batches_with_active_batches') {
        setBatchToggleError(
          t('batches:errors.cannot_disable_batches_with_active_batches')
        )
      } else if (isDuplicate(err)) {
        setDuplicateError(true)
      } else {
        notify.error(t('products:errors.save_failed'))
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isSubmitting) onClose()
      }}
      title={t('products:detail.edit_dialog_title')}
      maxWidth='sm'
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
          >
            {t('products:actions.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {duplicateError && (
            <Banner variant='error'>
              {t('products:errors.duplicate_name_category')}
            </Banner>
          )}

          <Field
            label={t('products:fields.name')}
            hint={t('products:helpers.name_normalized')}
            error={errors.name?.message}
          >
            <Input {...register('name')} />
          </Field>

          <Controller
            control={control}
            name='category_id'
            render={({ field }) => (
              <CategoryCombobox
                value={field.value || null}
                onChange={(id) => field.onChange(id ?? '')}
                required
                errorText={errors.category_id?.message}
              />
            )}
          />

          <Field
            label={t('products:fields.selling_price')}
            error={errors.price?.message}
          >
            <Input
              type='number'
              inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
              {...register('price', { valueAsNumber: true })}
            />
          </Field>

          <Field label={t('products:fields.description_optional')}>
            <Textarea
              placeholder={t('products:fields.description_placeholder')}
              inputProps={{ maxLength: 1000 }}
              {...register('description')}
            />
          </Field>

          <Controller
            control={control}
            name='is_active'
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label={t('products:fields.active')}
              />
            )}
          />

          <Divider sx={{ borderColor: 'var(--border-subtle)' }} />

          <Stack spacing={1.5}>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('products:inventory_behavior.section_title')}
            </Typography>

            {batchToggleError && (
              <Banner variant='error'>{batchToggleError}</Banner>
            )}

            <Controller
              control={control}
              name='has_batches'
              render={({ field }) => (
                <Field hint={t('products:inventory_behavior.has_batches_help')}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label={t('products:inventory_behavior.has_batches_toggle')}
                  />
                </Field>
              )}
            />

            {hasBatches && (
              <Stack spacing={2}>
                <Controller
                  control={control}
                  name='expiry_alert_days'
                  render={({ field }) => (
                    <Field
                      label={t(
                        'products:inventory_behavior.expiry_alert_days_label'
                      )}
                      hint={t(
                        'products:inventory_behavior.expiry_alert_days_help',
                        {
                          default: shopDefaults?.default_expiry_alert_days ?? 30
                        }
                      )}
                    >
                      <Input
                        type='number'
                        inputProps={{ min: 1, step: 1 }}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : Number(e.target.value)
                          )
                        }
                      />
                    </Field>
                  )}
                />

                <Controller
                  control={control}
                  name='warranty_alert_days'
                  render={({ field }) => (
                    <Field
                      label={t(
                        'products:inventory_behavior.warranty_alert_days_label'
                      )}
                      hint={t(
                        'products:inventory_behavior.warranty_alert_days_help',
                        {
                          default:
                            shopDefaults?.default_warranty_alert_days ?? 30
                        }
                      )}
                    >
                      <Input
                        type='number'
                        inputProps={{ min: 1, step: 1 }}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : Number(e.target.value)
                          )
                        }
                      />
                    </Field>
                  )}
                />
              </Stack>
            )}
          </Stack>
        </Stack>
      </form>
    </Dialog>
  )
}
