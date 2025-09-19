// FILE: src/schema-validations/stepOne.ts
import { z } from 'zod'

export const StepOneSchema = z.object({
  practiceName: z.string().min(1, 'Practice name is required'),
  principalName: z.string().min(1, 'Principal name is required'),
  practiceManagerName: z.string().min(1, 'Practice manager name is required'),
  practiceAddress: z
    .string()
    .min(1, 'Practice address is required')
    .max(300, 'Practice address must be 300 characters or less'),
  phone: z.string().min(1, 'Contact number is required'),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Enter a valid email'
    })
})

export type StepOneFormValues = z.infer<typeof StepOneSchema>
