// FILE: src/schema-validations/stepThree.ts
import { z } from 'zod'

export const StepThreeSchema = z.object({
  practiceManagementSoftware: z.enum([
    '',
    'EXACT',
    'DENTALLY',
    'R4',
    'CARESTREAM',
    'OTHER'
  ]),
  accountingSoftware: z.enum(['', 'XERO', 'QUICKBOOKS', 'NONE', 'OTHER']),
  useOfAccountantBookkeeper: z.enum(['', 'INTERNAL', 'EXTERNAL', 'NONE'])
})

export type StepThreeFormValues = z.infer<typeof StepThreeSchema>
