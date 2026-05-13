import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
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
  useArchiveProduct,
  useCreateProduct,
  useCreateProductWithVariants,
  useProduct,
  useUpdateProduct
} from './hooks'
import PacksSection from './PacksSection'
import CategoryCombobox from './CategoryCombobox'
import VariantMatrixBuilder, {
  type VariantMatrixState
} from 'src/features/variants/VariantMatrixBuilder'
import { paths } from 'src/paths'
import { formatPKR } from 'src/features/subscription/env'
import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Tooltip
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

type SupabaseLikeError = {
  code?: string
  message?: string
  details?: string | null
}

function isDuplicateNameCategoryError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as SupabaseLikeError
  if (e.code === '23505') return true
  const haystack = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase()
  return haystack.includes('uq_products_shop_name_category')
}

export default function ProductFormPage() {
  const { t, i18n } = useTranslation(['products', 'common'])
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const notify = useNotifier()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const { data: existing } = useProduct(isNew ? undefined : id)
  const create = useCreateProduct()
  const update = useUpdateProduct()
  // v2.9.1 task #23: is_active changes route through archive_product (RPC
  // mig 0087 §2.3) which cascades to all variants. update_product no
  // longer touches is_active per the archive/edit semantic separation.
  const archive = useArchiveProduct()
  const [duplicateError, setDuplicateError] = useState(false)

  if (isNew) {
    return (
      <CreateForm
        duplicateError={duplicateError}
        onSubmit={async (values) => {
          setDuplicateError(false)
          try {
            await create.mutateAsync({
              name: values.name,
              category_id: values.category_id,
              description: values.description?.trim()
                ? values.description
                : null,
              price: values.price ?? null,
              is_scan_only: values.is_scan_only,
              has_batches: values.has_batches,
              expiry_alert_days: values.expiry_alert_days ?? null,
              warranty_alert_days: values.warranty_alert_days ?? null
            })
            notify.success(t('products:messages.saved'))
            navigate(paths.products)
          } catch (err: unknown) {
            if (isDuplicateNameCategoryError(err)) {
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
      duplicateError={duplicateError}
      locale={locale}
      onSubmit={async (values) => {
        if (!existing) return
        setDuplicateError(false)
        try {
          await update.mutateAsync({
            id: existing.id,
            name: values.name,
            category_id: values.category_id,
            description: values.description?.trim() ? values.description : null,
            price: (values.price ?? 0) as number,
            is_scan_only: values.is_scan_only,
            has_batches: values.has_batches,
            expiry_alert_days: values.expiry_alert_days ?? null,
            warranty_alert_days: values.warranty_alert_days ?? null
          })
          if (values.is_active !== existing.is_active) {
            await archive.mutateAsync({
              id: existing.id,
              isActive: values.is_active
            })
          }
          notify.success(t('products:messages.saved'))
          navigate(paths.products)
        } catch (err: unknown) {
          if (isDuplicateNameCategoryError(err)) {
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
  duplicateError: boolean
  onSubmit: (values: CreateProductValues) => Promise<void>
}

function CreateForm({ duplicateError, onSubmit }: CreateFormProps) {
  const { t } = useTranslation(['products', 'common', 'variants'])
  const navigate = useNavigate()
  const createWithVariants = useCreateProductWithVariants()
  const notify = useNotifier()

  const [hasVariants, setHasVariants] = useState(false)
  const [matrixState, setMatrixState] = useState<VariantMatrixState>({
    attributeIds: [],
    selectedValues: {},
    included: {},
    overrides: {}
  })
  const [defaultPrice, setDefaultPrice] = useState('')
  const [matrixError, setMatrixError] = useState<string | null>(null)

  const {
    control,
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema(t)),
    defaultValues: {
      name: '',
      category_id: '',
      description: '',
      price: null,
      is_scan_only: false,
      has_batches: false,
      expiry_alert_days: null,
      warranty_alert_days: null
    }
  })

  const productName = watch('name')

  const submitVariantsMode = async () => {
    setMatrixError(null)
    // Only validate the fields that the variants path actually consumes.
    const ok = await trigger(['name', 'category_id', 'is_scan_only'])
    if (!ok) return

    if (matrixState.attributeIds.length === 0) {
      setMatrixError(t('variants:errors.need_at_least_one_attribute'))
      return
    }
    // Need at least one value per attribute
    if (
      matrixState.attributeIds.some(
        (a) => (matrixState.selectedValues[a] ?? []).length === 0
      )
    ) {
      setMatrixError(t('variants:errors.need_values_for_each_attribute'))
      return
    }
    // Build the variant payload from included combos
    const included = Object.entries(matrixState.included)
      .filter(([, on]) => on)
      .map(([k]) => k)
    if (included.length === 0) {
      setMatrixError(t('variants:errors.need_at_least_one_combination'))
      return
    }

    // v2.8.1: opening stock and opening cost no longer flow through the
    // matrix builder. Variants are created without inventory; stock is
    // added later via stock-in.
    const priceNum = defaultPrice === '' ? null : Number(defaultPrice)
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) {
      setMatrixError(t('products:errors.price_invalid'))
      return
    }
    const values = getValues()

    const variantsToCreate = included.map((key) => {
      const override = matrixState.overrides[key] ?? {}
      return { key, override }
    })

    try {
      const variants = variantsToCreate.map(({ key, override }) => {
        const valueIds = key.split('|')
        const overridePrice =
          override.price !== undefined && override.price !== ''
            ? Number(override.price)
            : null
        const variantPrice =
          overridePrice !== null && Number.isFinite(overridePrice)
            ? overridePrice
            : priceNum
        return {
          attribute_value_ids: valueIds,
          sku: override.sku ?? undefined,
          price:
            variantPrice !== null && Number.isFinite(variantPrice)
              ? variantPrice
              : null
        }
      })

      const res = await createWithVariants.mutateAsync({
        name: values.name,
        category_id: values.category_id,
        default_price:
          priceNum !== null && Number.isFinite(priceNum) ? priceNum : null,
        is_scan_only: values.is_scan_only,
        attribute_ids: matrixState.attributeIds,
        variants,
        description: values.description?.trim() ? values.description : null,
        has_batches: values.has_batches,
        expiry_alert_days: values.expiry_alert_days ?? null,
        warranty_alert_days: values.warranty_alert_days ?? null
      })
      notify.success(t('products:messages.saved'))
      navigate(paths.gotoProduct(res.product_id))
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? ''
      if (msg.includes('duplicate_variant_combination')) {
        setMatrixError(t('variants:errors.duplicate_combination'))
      } else if (msg.includes('uq_products_shop_name_category')) {
        setMatrixError(t('products:errors.duplicate_name_category'))
      } else {
        notify.error(t('products:errors.save_failed'))
      }
    }
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('products:add_product')} />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
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

            <Field label={t('products:fields.description_optional')}>
              <Textarea
                placeholder={t('products:fields.description_placeholder')}
                inputProps={{ maxLength: 1000 }}
                {...register('description')}
              />
            </Field>

            {/* v2.7: has_variants toggle. When ON, the variant matrix replaces
                the single price + opening stock fields. */}
            <Field hint={t('variants:has_variants_help')}>
              <FormControlLabel
                control={
                  <Switch
                    checked={hasVariants}
                    onChange={(e) => setHasVariants(e.target.checked)}
                  />
                }
                label={t('variants:has_variants_toggle')}
              />
            </Field>

            {!hasVariants && (
              <Controller
                control={control}
                name='price'
                render={({ field }) => (
                  <Field
                    label={t('products:fields.selling_price')}
                    hint={t('products:fields.price_optional_help')}
                    error={errors.price?.message}
                  >
                    <Input
                      type='number'
                      inputProps={{
                        step: '0.01',
                        min: 0,
                        inputMode: 'numeric'
                      }}
                      placeholder={t('products:fields.price_placeholder')}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                    />
                  </Field>
                )}
              />
            )}

            {hasVariants && (
              <>
                <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
                <VariantMatrixBuilder
                  state={matrixState}
                  onChange={setMatrixState}
                  productNameForSku={productName ?? ''}
                  defaultPrice={defaultPrice}
                  onDefaultPriceChange={setDefaultPrice}
                  errorText={matrixError}
                />
              </>
            )}

            {/* v2.8.1: Inventory behavior section — batch tracking is set
             *  at create time now; stock and cost come in via stock-in. */}
            <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
            <Stack spacing={1.5}>
              <Typography
                variant='overline'
                sx={{ color: 'var(--text-muted)' }}
              >
                {t('products:inventory_behavior.section_title')}
              </Typography>
              <Controller
                control={control}
                name='has_batches'
                render={({ field }) => (
                  <Field
                    hint={t('products:inventory_behavior.has_batches_help')}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      }
                      label={t(
                        'products:inventory_behavior.has_batches_toggle'
                      )}
                    />
                  </Field>
                )}
              />
              {watch('has_batches') && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
                          { default: 30 }
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
                          { default: 30 }
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
              <Banner variant='info'>
                {t('products:inventory_behavior.stock_in_first_hint')}
              </Banner>
            </Stack>

            <Stack direction='row' spacing={1.5} justifyContent='flex-end'>
              <Button
                variant='secondary'
                onClick={() => navigate(paths.products)}
              >
                {t('products:actions.back')}
              </Button>
              {hasVariants ? (
                <Button
                  variant='primary'
                  onClick={() => void submitVariantsMode()}
                  loading={createWithVariants.isPending}
                >
                  {t('products:actions.save')}
                </Button>
              ) : (
                <Button type='submit' variant='primary' loading={isSubmitting}>
                  {t('products:actions.save')}
                </Button>
              )}
            </Stack>
          </Stack>
        </form>
      </Card>
    </Box>
  )
}

type EditFormProps = {
  existing:
    | {
        id: string
        name: string
        type: string
        category_id: string
        description: string | null
        price: number | null
        is_active: boolean
        is_scan_only: boolean
        avg_cost: number
        last_purchase_cost: number | null
        has_batches?: boolean | null
        expiry_alert_days?: number | null
        warranty_alert_days?: number | null
      }
    | null
    | undefined
  duplicateError: boolean
  locale: string
  onSubmit: (values: EditProductValues) => Promise<void>
}

function EditForm({
  existing,
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
      category_id: '',
      description: '',
      price: null,
      is_active: true,
      is_scan_only: false,
      has_batches: false,
      expiry_alert_days: null,
      warranty_alert_days: null
    }
  })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        category_id: existing.category_id,
        description: existing.description ?? '',
        price: existing.price === null ? null : Number(existing.price),
        is_active: existing.is_active,
        is_scan_only: existing.is_scan_only ?? false,
        has_batches: existing.has_batches ?? false,
        expiry_alert_days: existing.expiry_alert_days ?? null,
        warranty_alert_days: existing.warranty_alert_days ?? null
      })
    }
  }, [existing, reset])

  return (
    <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('products:edit_product')} />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
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

            <Field label={t('products:fields.description_optional')}>
              <Textarea
                placeholder={t('products:fields.description_placeholder')}
                inputProps={{ maxLength: 1000 }}
                {...register('description')}
              />
            </Field>

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

            {existing && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
              >
                <Box sx={{ flex: 1 }}>
                  <Stack direction='row' spacing={0.5} alignItems='center'>
                    <Typography
                      variant='overline'
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      {t('products:fields.avg_cost')}
                    </Typography>
                    <Tooltip title={t('products:tooltip.avg_cost_explainer')}>
                      <InfoOutlinedIcon
                        sx={{ fontSize: 14, color: 'var(--text-muted)' }}
                      />
                    </Tooltip>
                  </Stack>
                  <Typography variant='body1' sx={{ fontWeight: 600 }}>
                    {formatPKR(existing.avg_cost, locale)}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant='overline'
                    sx={{ color: 'var(--text-muted)' }}
                  >
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
                  <Typography
                    variant='overline'
                    sx={{ color: 'var(--text-muted)' }}
                  >
                    {t('products:fields.stock')}
                  </Typography>
                  <Typography variant='body1' sx={{ fontWeight: 600 }}>
                    {(existing as { stock?: number }).stock ?? '—'}
                  </Typography>
                </Box>
              </Stack>
            )}

            {existing && (
              <>
                <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
                <PacksSection
                  productId={existing.id}
                  productName={existing.name}
                />
              </>
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

            <Stack direction='row' spacing={1.5} justifyContent='flex-end'>
              <Button
                variant='secondary'
                onClick={() => navigate(paths.products)}
              >
                {t('products:actions.back')}
              </Button>
              <Button type='submit' variant='primary' loading={isSubmitting}>
                {t('products:actions.save')}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Card>
    </Box>
  )
}
