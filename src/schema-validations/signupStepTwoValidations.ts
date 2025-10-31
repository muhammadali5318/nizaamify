import { z } from 'zod/v3'

const ukPostcodeRegex =
  /^(GIR ?0AA|[A-PR-UWYZ]([0-9][0-9A-HJKPS-UW]?|[A-HK-Y][0-9][0-9ABEHMNPRV-Y]?) ?[0-9][ABD-HJLNP-UW-Z]{2})$/i

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
