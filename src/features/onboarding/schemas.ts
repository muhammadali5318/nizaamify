import { z } from 'zod'
import type { TFunction } from 'i18next'
import { PK_PHONE_RE } from 'src/lib/phone'

const CNIC_RE = /^[0-9]{5}-[0-9]{7}-[0-9]$/

export const shopStepSchema = (t: TFunction) =>
  z.object({
    shop_name: z
      .string()
      .min(2, t('onboarding:errors.name_min'))
      .max(100, t('onboarding:errors.name_max')),
    shop_address: z
      .string()
      .min(5, t('onboarding:errors.address_min'))
      .max(250, t('onboarding:errors.address_max')),
    shop_phone: z
      .string()
      .min(1, t('onboarding:errors.phone_required'))
      .regex(PK_PHONE_RE, t('onboarding:errors.phone_invalid')),
    shop_type: z.string().max(100).optional().or(z.literal(''))
  })

export const ownerStepSchema = (t: TFunction) =>
  z.object({
    owner_name: z
      .string()
      .min(2, t('onboarding:errors.name_min'))
      .max(100, t('onboarding:errors.name_max')),
    owner_phone: z
      .string()
      .min(1, t('onboarding:errors.phone_required'))
      .regex(PK_PHONE_RE, t('onboarding:errors.phone_invalid')),
    owner_cnic: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((v) => !v || CNIC_RE.test(v), {
        message: 'cnic_invalid'
      }),
    owner_address: z
      .string()
      .min(5, t('onboarding:errors.address_min'))
      .max(250, t('onboarding:errors.address_max'))
  })

export const onboardingSchema = (t: TFunction) =>
  shopStepSchema(t).merge(ownerStepSchema(t))

export type OnboardingValues = z.infer<ReturnType<typeof onboardingSchema>>
export type ShopStepValues = z.infer<ReturnType<typeof shopStepSchema>>
export type OwnerStepValues = z.infer<ReturnType<typeof ownerStepSchema>>
