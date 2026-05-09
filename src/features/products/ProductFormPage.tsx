import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  createProductSchema,
  editProductSchema,
  type CreateProductValues,
  type EditProductValues
} from './schemas'
import {
  useCreateProduct,
  useExistingProductTypes,
  useProduct,
  useUpdateProduct
} from './hooks'
import { paths } from 'src/paths'
import { formatPKR } from 'src/features/subscription/env'

type SupabaseLikeError = {
  code?: string
  message?: string
  details?: string | null
}

function isDuplicateNameTypeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as SupabaseLikeError
  if (e.code === '23505') return true
  const haystack = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase()
  return haystack.includes('uq_products_shop_name_type')
}

export default function ProductFormPage() {
  const { t, i18n } = useTranslation(['products', 'common'])
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const notify = useNotifier()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const { data: existing } = useProduct(isNew ? undefined : id)
  const { data: existingTypes } = useExistingProductTypes()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const [duplicateError, setDuplicateError] = useState(false)

  if (isNew) {
    return (
      <CreateForm
        existingTypes={existingTypes ?? []}
        duplicateError={duplicateError}
        onSubmit={async (values) => {
          setDuplicateError(false)
          try {
            await create.mutateAsync({
              name: values.name,
              type: values.type,
              description: values.description?.trim()
                ? values.description
                : null,
              price: values.price,
              opening_stock: values.opening_stock,
              opening_cost: values.opening_cost
            })
            notify.success(t('products:messages.saved'))
            navigate(paths.products)
          } catch (err: unknown) {
            if (isDuplicateNameTypeError(err)) {
              setDuplicateError(true)
            } else {
              notify.error(t('products:errors.save_failed'))
            }
          }
        }}
      />
    )
  }

  return (
    <EditForm
      key={existing?.id ?? 'edit'}
      existing={existing}
      existingTypes={existingTypes ?? []}
      duplicateError={duplicateError}
      locale={locale}
      onSubmit={async (values) => {
        if (!existing) return
        setDuplicateError(false)
        try {
          await update.mutateAsync({
            id: existing.id,
            name: values.name,
            type: values.type,
            description: values.description?.trim() ? values.description : null,
            price: values.price,
            is_active: values.is_active
          })
          notify.success(t('products:messages.saved'))
          navigate(paths.products)
        } catch (err: unknown) {
          if (isDuplicateNameTypeError(err)) {
            setDuplicateError(true)
          } else {
            notify.error(t('products:errors.save_failed'))
          }
        }
      }}
    />
  )
}

type CreateFormProps = {
  existingTypes: string[]
  duplicateError: boolean
  onSubmit: (values: CreateProductValues) => Promise<void>
}

function CreateForm({
  existingTypes,
  duplicateError,
  onSubmit
}: CreateFormProps) {
  const { t } = useTranslation(['products', 'common'])
  const navigate = useNavigate()

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema(t)),
    defaultValues: {
      name: '',
      type: '',
      description: '',
      price: 0,
      opening_stock: 0,
      opening_cost: 0
    }
  })

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, maxWidth: 720 }}>
        <Typography variant='h5' fontWeight={700} mb={3}>
          {t('products:add_product')}
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2}>
            {duplicateError && (
              <Alert severity='error'>
                {t('products:errors.duplicate_name_type')}
              </Alert>
            )}

            <TextField
              label={t('products:fields.name')}
              fullWidth
              {...register('name')}
              error={!!errors.name}
              helperText={
                errors.name?.message ?? t('products:helpers.name_normalized')
              }
            />

            <Controller
              control={control}
              name='type'
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  options={existingTypes}
                  value={field.value}
                  inputValue={field.value}
                  onInputChange={(_, v) => field.onChange(v)}
                  onChange={(_, v) => field.onChange(v ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('products:fields.type')}
                      placeholder={t('products:fields.type_placeholder')}
                      error={!!errors.type}
                      helperText={
                        errors.type?.message ?? t('products:fields.type_hint')
                      }
                    />
                  )}
                />
              )}
            />

            <TextField
              label={t('products:fields.description_optional')}
              placeholder={t('products:fields.description_placeholder')}
              fullWidth
              multiline
              minRows={2}
              inputProps={{ maxLength: 1000 }}
              {...register('description')}
            />

            <TextField
              label={t('products:fields.selling_price')}
              fullWidth
              type='number'
              inputProps={{ step: '0.01', min: 0 }}
              {...register('price', { valueAsNumber: true })}
              error={!!errors.price}
              helperText={errors.price?.message}
            />

            <Divider textAlign='left'>
              <Typography variant='caption' color='text.secondary'>
                {t('products:fields.opening_stock')}
              </Typography>
            </Divider>

            <Typography variant='caption' color='text.secondary'>
              {t('products:fields.opening_help')}
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('products:fields.opening_qty')}
                fullWidth
                type='number'
                inputProps={{ step: '1', min: 0 }}
                {...register('opening_stock', { valueAsNumber: true })}
                error={!!errors.opening_stock}
                helperText={errors.opening_stock?.message}
              />
              <TextField
                label={t('products:fields.opening_cost')}
                fullWidth
                type='number'
                inputProps={{ step: '0.01', min: 0 }}
                {...register('opening_cost', { valueAsNumber: true })}
                error={!!errors.opening_cost}
                helperText={errors.opening_cost?.message}
              />
            </Stack>

            <Stack direction='row' spacing={1} justifyContent='flex-end'>
              <Button
                variant='outlined'
                onClick={() => navigate(paths.products)}
              >
                {t('products:actions.back')}
              </Button>
              <Button type='submit' variant='contained' disabled={isSubmitting}>
                {t('products:actions.save')}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}

type EditFormProps = {
  existing:
    | {
        id: string
        name: string
        type: string
        description: string | null
        price: number
        is_active: boolean
        avg_cost: number
        last_purchase_cost: number | null
      }
    | null
    | undefined
  existingTypes: string[]
  duplicateError: boolean
  locale: string
  onSubmit: (values: EditProductValues) => Promise<void>
}

function EditForm({
  existing,
  existingTypes,
  duplicateError,
  locale,
  onSubmit
}: EditFormProps) {
  const { t } = useTranslation(['products', 'common'])
  const navigate = useNavigate()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<EditProductValues>({
    resolver: zodResolver(editProductSchema(t)),
    defaultValues: {
      name: '',
      type: '',
      description: '',
      price: 0,
      is_active: true
    }
  })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        type: existing.type,
        description: existing.description ?? '',
        price: Number(existing.price),
        is_active: existing.is_active
      })
    }
  }, [existing, reset])

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, maxWidth: 720 }}>
        <Typography variant='h5' fontWeight={700} mb={3}>
          {t('products:edit_product')}
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2}>
            {duplicateError && (
              <Alert severity='error'>
                {t('products:errors.duplicate_name_type')}
              </Alert>
            )}

            <TextField
              label={t('products:fields.name')}
              fullWidth
              {...register('name')}
              error={!!errors.name}
              helperText={
                errors.name?.message ?? t('products:helpers.name_normalized')
              }
            />

            <Controller
              control={control}
              name='type'
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  options={existingTypes}
                  value={field.value}
                  inputValue={field.value}
                  onInputChange={(_, v) => field.onChange(v)}
                  onChange={(_, v) => field.onChange(v ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('products:fields.type')}
                      placeholder={t('products:fields.type_placeholder')}
                      error={!!errors.type}
                      helperText={
                        errors.type?.message ?? t('products:fields.type_hint')
                      }
                    />
                  )}
                />
              )}
            />

            <TextField
              label={t('products:fields.description_optional')}
              placeholder={t('products:fields.description_placeholder')}
              fullWidth
              multiline
              minRows={2}
              inputProps={{ maxLength: 1000 }}
              {...register('description')}
            />

            <TextField
              label={t('products:fields.selling_price')}
              fullWidth
              type='number'
              inputProps={{ step: '0.01', min: 0 }}
              {...register('price', { valueAsNumber: true })}
              error={!!errors.price}
              helperText={errors.price?.message}
            />

            {existing && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
              >
                <Box sx={{ flex: 1 }}>
                  <Stack direction='row' spacing={0.5} alignItems='center'>
                    <Typography variant='caption' color='text.secondary'>
                      {t('products:fields.avg_cost')}
                    </Typography>
                    <Tooltip title={t('products:tooltip.avg_cost_explainer')}>
                      <InfoOutlinedIcon
                        sx={{ fontSize: 14, color: 'text.secondary' }}
                      />
                    </Tooltip>
                  </Stack>
                  <Typography variant='body1' fontWeight={700}>
                    {formatPKR(existing.avg_cost, locale)}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {t('products:fields.last_purchase_cost')}
                  </Typography>
                  <Typography variant='body1'>
                    {existing.last_purchase_cost === null ||
                    existing.last_purchase_cost === undefined
                      ? '—'
                      : formatPKR(existing.last_purchase_cost, locale)}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {t('products:fields.stock')}
                  </Typography>
                  <Typography variant='body1' fontWeight={700}>
                    {(existing as { stock?: number }).stock ?? '—'}
                  </Typography>
                </Box>
              </Stack>
            )}

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

            <Stack direction='row' spacing={1} justifyContent='flex-end'>
              <Button
                variant='outlined'
                onClick={() => navigate(paths.products)}
              >
                {t('products:actions.back')}
              </Button>
              <Button type='submit' variant='contained' disabled={isSubmitting}>
                {t('products:actions.save')}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}
