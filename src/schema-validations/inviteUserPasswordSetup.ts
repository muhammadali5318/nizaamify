import { z } from 'zod'

export const inviteUserPasswordSetupSchema = z
  .object({
    password: z
      .string()
      .min(
        8,
        'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.'
      )
      .max(50, 'Password must not exceed 50 characters')
      .refine((val) => /[A-Z]/.test(val), {
        message: 'Password must contain at least one uppercase letter'
      })
      .refine((val) => /\d/.test(val), {
        message: 'Password must contain at least one number'
      })
      .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
        message: 'Password must contain at least one special character'
      }),
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  })

export type inviteUserPasswordSetupSchemaFormValues = z.infer<
  typeof inviteUserPasswordSetupSchema
>
