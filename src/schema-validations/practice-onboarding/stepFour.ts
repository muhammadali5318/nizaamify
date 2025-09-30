// src/schema-validations/stepFour.ts
import { z } from 'zod'

const FrequencyEnum = z.enum(['MONTHLY', 'YEARLY', 'RARELY'])
const ConfidenceEnum = z.enum(['VERY CONFIDENT', 'CONFIDENT', 'NOT CONFIDENT'])
const InsightsEnum = z.enum([
  'VISUAL DASHBOARDS',
  'BULLET-POINT SUMMARIES',
  'DETAILED REPORTS'
])

export const StepFourSchema = z.object({
  frequencyOfFinancialReview: z
    .union([FrequencyEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Frequency of financial review is required'
    }),

  primaryReasons: z
    .array(z.string())
    .min(1, 'Please select at least one reason'),

  confidenceReadingReports: z
    .union([ConfidenceEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Please select your confidence reading reports'
    }),

  preferredInsightsFormat: z
    .union([InsightsEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Please select a preferred insights format'
    })
})

export type StepFourFormValues = z.infer<typeof StepFourSchema>
