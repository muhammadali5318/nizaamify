// FILE: src/schema-validations/stepFour.ts
import { z } from 'zod'

export const StepFourSchema = z.object({
  frequencyOfFinancialReview: z.enum(['Monthly', 'Quarterly', 'Rarely']),
  primaryReasons: z
    .array(z.string())
    .min(1, 'Please select at least one reason'),
  confidenceReadingReports: z.enum([
    'Confident',
    'Not Confident',
    'Very Confident'
  ]),
  preferredInsightsFormat: z.enum([
    'Visual Dashboards',
    'Bullet-point summaries',
    'Detailed Reports'
  ])
})

export type StepFourFormValues = z.infer<typeof StepFourSchema>
