import { z } from 'zod'

export const stepFiveSchema = z.object({
  accountingBasis: z
    .union([z.enum(['accrual', 'cash']), z.literal('')]) // <-- removed z.null()
    .transform((val) => (val === '' ? '' : val))
    .refine((val) => val === 'accrual' || val === 'cash', {
      message: 'Please select an accounting basis'
    })
})

export type StepFiveFormValues = z.infer<typeof stepFiveSchema>
