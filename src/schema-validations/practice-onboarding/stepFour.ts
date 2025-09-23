// FILE: src/schema-validations/stepFour.ts
import { z } from 'zod'

export const StepFourSchema = z.object({
  frequencyOfFinancialReview: z.enum(['', 'MONTHLY', 'YEARLY', 'RARELY']),
  primaryReasons: z
    .array(z.string())
    .min(1, 'Please select at least one reason'),
  confidenceReadingReports: z.enum([
    '',
    'VERY CONFIDENT',
    'CONFIDENT',
    'NOT CONFIDENT'
  ]),
  preferredInsightsFormat: z.enum([
    '',
    'VISUAL DASHBOARDS',
    'BULLET-POINT SUMMARIES',
    'DETAILED REPORTS'
  ])
})

export type StepFourFormValues = z.infer<typeof StepFourSchema>
