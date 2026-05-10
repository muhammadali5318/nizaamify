import { z } from 'zod'
import type { TFunction } from 'i18next'

export const createProductSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('products:errors.name_required')).max(200),
    type: z.string().min(1, t('products:errors.type_required')).max(80),
    description: z.string().max(1000).nullable(),
    price: z
      .number({ invalid_type_error: t('products:errors.price_invalid') })
      .nonnegative(t('products:errors.price_invalid')),
    opening_stock: z
      .number({
        invalid_type_error: t('products:errors.opening_stock_invalid')
      })
      .int()
      .nonnegative(t('products:errors.opening_stock_invalid')),
    opening_cost: z
      .number({ invalid_type_error: t('products:errors.opening_cost_invalid') })
      .nonnegative(t('products:errors.opening_cost_invalid')),
    is_scan_only: z.boolean()
  })

export const editProductSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('products:errors.name_required')).max(200),
    type: z.string().min(1, t('products:errors.type_required')).max(80),
    description: z.string().max(1000).nullable(),
    price: z
      .number({ invalid_type_error: t('products:errors.price_invalid') })
      .nonnegative(t('products:errors.price_invalid')),
    is_active: z.boolean(),
    is_scan_only: z.boolean()
  })

export type CreateProductValues = z.infer<
  ReturnType<typeof createProductSchema>
>
export type EditProductValues = z.infer<ReturnType<typeof editProductSchema>>
