import { z } from 'zod/v3'

export const SignupStepTwoSchema = z.object({
  practiceName: z.string().nonempty('Practice name is required'),
  street: z.string().nonempty('Street is required'),
  city: z.string().nonempty('City is required'),
  country: z.string().nonempty('Country is required'),
  postcode: z.string().nonempty('Postcode is required'),
  practiceEmail: z
    .string()
    .email('Please enter a valid email')
    .optional()
    .or(z.literal(''))
})

export type SignupFormValues = z.infer<typeof SignupStepTwoSchema>
