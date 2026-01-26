import { z } from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { nameRegex } from 'src/const'

export const SignupStepOneSchema = z.object({
  firstName: z
    .string()
    .nonempty('First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be under 50 characters')
    .regex(nameRegex, 'First name contains invalid characters'),

  lastName: z
    .string()
    .nonempty('Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be under 50 characters')
    .regex(nameRegex, 'Last name contains invalid characters'),

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
      { message: 'Please enter a valid phone number' }
    ),

  isPracticeOwnerOrDirector: z.boolean().refine((val) => val === true, {
    message: 'Please confirm to continue'
  })
})

export type SignupStepOneFormValues = z.infer<typeof SignupStepOneSchema>
