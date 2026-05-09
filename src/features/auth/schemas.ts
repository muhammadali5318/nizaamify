import { z } from 'zod'
import type { TFunction } from 'i18next'

export const emailSchema = (t: TFunction) =>
  z
    .string({ required_error: t('auth:errors.email_required') })
    .min(1, t('auth:errors.email_required'))
    .email(t('auth:errors.email_invalid'))

export const passwordSchema = (t: TFunction) =>
  z
    .string({ required_error: t('auth:errors.password_required') })
    .min(8, t('auth:errors.password_min'))

export const loginSchema = (t: TFunction) =>
  z.object({
    email: emailSchema(t),
    password: passwordSchema(t)
  })

export const signupSchema = (t: TFunction) =>
  z
    .object({
      email: emailSchema(t),
      password: passwordSchema(t),
      confirmPassword: passwordSchema(t)
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      message: t('auth:errors.password_mismatch')
    })

export const forgotSchema = (t: TFunction) =>
  z.object({
    email: emailSchema(t)
  })

export const resetSchema = (t: TFunction) =>
  z
    .object({
      password: passwordSchema(t),
      confirmPassword: passwordSchema(t)
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      message: t('auth:errors.password_mismatch')
    })

export type LoginValues = z.infer<ReturnType<typeof loginSchema>>
export type SignupValues = z.infer<ReturnType<typeof signupSchema>>
export type ForgotValues = z.infer<ReturnType<typeof forgotSchema>>
export type ResetValues = z.infer<ReturnType<typeof resetSchema>>
