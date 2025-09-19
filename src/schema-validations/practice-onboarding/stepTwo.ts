// FILE: src/schema-validations/stepTwo.ts
import { z } from 'zod'

export const StepTwoSchema = z.object({
  practiceType: z.string().min(1, 'Practice type is required'),
  yearsTrading: z.coerce
    .number()
    .int('Years trading must be a whole number')
    .min(0, 'Years trading must be 0 or more')
    .max(100, 'Years trading looks too large')
    .refine((n) => !Number.isNaN(n), { message: 'Years trading is required' }),
  numberOfSurgeries: z.coerce
    .number()
    .int('Number of surgeries must be a whole number')
    .min(0, 'Number of surgeries must be 0 or more')
    .refine((n) => !Number.isNaN(n), {
      message: 'Number of surgeries is required'
    }),
  numberOfAssociates: z.coerce
    .number()
    .int('Number of associates must be a whole number')
    .min(0, 'Number of associates must be 0 or more')
    .refine((n) => !Number.isNaN(n), {
      message: 'Number of associates is required'
    }),
  numberOfHygienistsTherapists: z.coerce
    .number()
    .int('Number of hygienists/therapists must be a whole number')
    .min(0, 'Number of hygienists/therapists must be 0 or more')
    .refine((n) => !Number.isNaN(n), {
      message: 'Number of hygienists/therapists is required'
    }),
  numberOfSpecialists: z.coerce
    .number()
    .int('Number of specialists must be a whole number')
    .min(0, 'Number of specialists must be 0 or more')
    .refine((n) => !Number.isNaN(n), {
      message: 'Number of specialists is required'
    }),
  premisesOwnership: z.string().min(1, 'Premises ownership is required')
})

export type StepTwoFormValues = z.infer<typeof StepTwoSchema>
