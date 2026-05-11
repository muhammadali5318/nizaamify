import { z } from 'zod'
import type { TFunction } from 'i18next'

/** v2.8: alert window values are positive ints or null (use shop default). */
const optionalPositiveInt = z
  .union([z.number().int().positive(), z.null()])
  .nullable()

export const createProductSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('products:errors.name_required')).max(200),
    category_id: z
      .string()
      .uuid({ message: t('products:errors.category_required') }),
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
    is_scan_only: z.boolean(),
    has_batches: z.boolean(),
    expiry_alert_days: optionalPositiveInt,
    warranty_alert_days: optionalPositiveInt
  })

export const editProductSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('products:errors.name_required')).max(200),
    category_id: z
      .string()
      .uuid({ message: t('products:errors.category_required') }),
    description: z.string().max(1000).nullable(),
    price: z
      .number({ invalid_type_error: t('products:errors.price_invalid') })
      .nonnegative(t('products:errors.price_invalid')),
    is_active: z.boolean(),
    is_scan_only: z.boolean(),
    has_batches: z.boolean(),
    expiry_alert_days: optionalPositiveInt,
    warranty_alert_days: optionalPositiveInt
  })

export type CreateProductValues = z.infer<
  ReturnType<typeof createProductSchema>
>
export type EditProductValues = z.infer<ReturnType<typeof editProductSchema>>
