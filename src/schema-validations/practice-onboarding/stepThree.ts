// src/schema-validations/stepThree.ts
import { z } from 'zod'

const ManagementEnum = z.enum([
  'EXACT',
  'DENTALLY',
  'R4',
  'CARESTREAM',
  'OTHER'
])
const AccountingEnum = z.enum(['XERO', 'QUICKBOOKS', 'NONE', 'OTHER'])
const UseEnum = z.enum(['INTERNAL', 'EXTERNAL', 'NONE'])

export const StepThreeSchema = z.object({
  // allow '' at runtime but refine to reject it as "required"
  practiceManagementSoftware: z
    .union([ManagementEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Practice management software is required'
    }),

  accountingSoftware: z
    .union([AccountingEnum, z.literal('')])
    .refine((v) => v !== '', { message: 'Accounting software is required' }),

  useOfAccountantBookkeeper: z
    .union([UseEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Please select accountant/bookkeeper usage'
    })
})

export type StepThreeFormValues = z.infer<typeof StepThreeSchema>
