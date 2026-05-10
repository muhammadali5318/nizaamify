import { z } from 'zod'

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'name_required').max(120),
  contact: z.string().trim().max(60).optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal(''))
})

export type SupplierFormValues = z.infer<typeof supplierSchema>
