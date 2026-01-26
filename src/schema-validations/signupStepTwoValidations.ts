import { ukPostcodeRegex } from 'src/const'
import { z } from 'zod/v3'

export const SignupStepTwoSchema = z.object({
  practiceName: z
    .string()
    .nonempty('Practice name is required')
    .max(40, 'Practice name must not exceed 40 characters'),
  street: z.string().nonempty('Street is required'),
  city: z.string().nonempty('City is required'),
  postcode: z
    .string()
    .nonempty('Postcode is required')
    .refine(
      (v) => {
        return ukPostcodeRegex.test(v.trim())
      },
      { message: 'Enter a valid UK postcode' }
    ),
  practiceEmail: z
    .string()
    .nonempty('Practice email is required')
    .email('Please enter a valid email')
})

export type SignupFormValues = z.infer<typeof SignupStepTwoSchema>
