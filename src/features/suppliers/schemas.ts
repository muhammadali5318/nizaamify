import { z } from 'zod'
import { PK_PHONE_RE } from 'src/lib/phone'

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'name_required').max(120),
  // Supplier contact is optional but, when filled, must follow the same
  // PK phone format used elsewhere in the app (0XXXXXXXXXX).
  contact: z
    .string()
    .trim()
    .max(60)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || PK_PHONE_RE.test(v), { message: 'contact_invalid' }),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal(''))
})

export type SupplierFormValues = z.infer<typeof supplierSchema>
