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
    // v2.8.1: price is optional at create time. null means "set later via
    // the product detail page" — POS hides the product until set.
    price: z
      .union([
        z
          .number({ invalid_type_error: t('products:errors.price_invalid') })
          .nonnegative(t('products:errors.price_invalid')),
        z.null()
      ])
      .nullable()
      .optional(),
    is_scan_only: z.boolean().default(false),
    has_batches: z.boolean().default(false),
    expiry_alert_days: optionalPositiveInt.optional(),
    warranty_alert_days: optionalPositiveInt.optional()
  })

export const editProductSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('products:errors.name_required')).max(200),
    category_id: z
      .string()
      .uuid({ message: t('products:errors.category_required') }),
    description: z.string().max(1000).nullable(),
    // v2.8.1: same — price is optional. Saving a blank price clears it
    // (sets variant.price = null), surfacing the "Set selling price"
    // banner on the product detail page.
    price: z
      .union([
        z
          .number({ invalid_type_error: t('products:errors.price_invalid') })
          .nonnegative(t('products:errors.price_invalid')),
        z.null()
      ])
      .nullable()
      .optional(),
    is_active: z.boolean(),
    is_scan_only: z.boolean().default(false),
    has_batches: z.boolean().default(false),
    expiry_alert_days: optionalPositiveInt.optional(),
    warranty_alert_days: optionalPositiveInt.optional()
  })

export type CreateProductValues = z.infer<
  ReturnType<typeof createProductSchema>
>
export type EditProductValues = z.infer<ReturnType<typeof editProductSchema>>
