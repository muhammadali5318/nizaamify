// FILE: src/schema-validations/stepThree.ts
import { z } from 'zod'

export const StepThreeSchema = z.object({
  practiceManagementSoftware: z.enum([
    'EXACT',
    'Dentally',
    'R4',
    'careStream',
    'Other'
  ]),
  accountingSoftware: z.enum(['Xero', 'QuickBooks', 'Other', 'None']),
  useOfAccountantBookkeeper: z.enum(['internal', 'external', 'None'])
})

export type StepThreeFormValues = z.infer<typeof StepThreeSchema>
