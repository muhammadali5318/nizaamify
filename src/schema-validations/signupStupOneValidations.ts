import { z } from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

export const SignupStepOneSchema = z.object({
  firstName: z.string().nonempty('First name is required'),
  lastName: z.string().nonempty('Last name is required'),
  role: z.string().nonempty('Role is required'),
  email: z
    .string()
    .nonempty('Email is required')
    .pipe(z.email('Please enter a valid email')),
  phone: z
    .string()
    .nonempty('Phone is required')
    .refine(
      (val) => {
        const phoneNumber = parsePhoneNumberFromString(val || '')
        return phoneNumber?.isValid() ?? false
      },
      {
        message: 'Please enter a valid phone number'
      }
    ),
  isPracticeOwnerOrDirector: z.boolean().refine((val) => val === true, {
    message: 'Please confirm to continue'
  })
})

export type SignupStepOneFormValues = z.infer<typeof SignupStepOneSchema>
