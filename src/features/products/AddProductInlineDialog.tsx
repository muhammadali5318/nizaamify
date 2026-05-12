import { useState } from 'react'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { Banner, Button, Dialog, Field, Input } from 'src/components/ui'
import { useCreateProduct } from './hooks'
import CategoryCombobox from './CategoryCombobox'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}

/**
 * Inline create-product modal for the stock-in form. Calls
 * create_product_with_opening_stock with opening_stock = 0 because the
 * stock-in itself will seed the inventory. Selling price is required by the
 * RPC contract; cost defaults to 0 and is overwritten by the stock-in line.
 */
export default function AddProductInlineDialog({
  open,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation(['products', 'purchases', 'common'])
  const create = useCreateProduct()
  const notify = useNotifier()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [topError, setTopError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reset = () => {
    setName('')
    setCategoryId(null)
    setPrice('')
    setTopError(null)
    setErrors({})
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTopError(null)
    const fieldErrors: Record<string, string> = {}
    const trimmedName = name.trim()
    const priceNum = Number(price)
    if (!trimmedName)
      fieldErrors.name = t('products:errors.name_required', 'Name required')
    if (!categoryId)
      fieldErrors.category_id = t(
        'products:errors.category_required',
        'Category required'
      )
    if (!Number.isFinite(priceNum) || priceNum < 0)
      fieldErrors.price = t('products:errors.price_invalid', 'Invalid price')
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    try {
      const id = await create.mutateAsync({
        name: trimmedName,
        category_id: categoryId as string,
        description: null,
        price: priceNum,
        is_scan_only: false
      })
      notify.success(t('products:messages.created', 'Product created'))
      onCreated(id)
      reset()
    } catch (err) {
      const msg =
        typeof (err as { message?: unknown })?.message === 'string'
          ? (err as { message: string }).message
          : ''
      if (
        msg.includes('duplicate') ||
        msg.includes('uq_products_shop_name_category')
      ) {
        setTopError(t('products:errors.duplicate_name_category'))
      } else {
        setTopError(t('products:errors.save_failed', 'Could not save product'))
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!create.isPending) {
          reset()
          onClose()
        }
      }}
      title={t('purchases:form.add_new_product')}
    >
      <form onSubmit={submit} noValidate>
        <Stack spacing={2}>
          {topError && <Banner variant='error'>{topError}</Banner>}

          <Field
            label={t('products:fields.name', 'Name')}
            required
            error={errors.name}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ maxLength: 120 }}
            />
          </Field>

          <CategoryCombobox
            value={categoryId}
            onChange={setCategoryId}
            required
            errorText={errors.category_id}
          />

          <Field
            label={t('products:fields.price', 'Selling price (PKR)')}
            required
            error={errors.price}
          >
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type='number'
              inputProps={{ min: 0, step: '0.01' }}
            />
          </Field>

          <Stack direction='row' spacing={1.5} justifyContent='flex-end'>
            <Button
              variant='ghost'
              onClick={() => {
                reset()
                onClose()
              }}
              disabled={create.isPending}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button type='submit' variant='primary' loading={create.isPending}>
              {t('common:actions.save')}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Dialog>
  )
}
