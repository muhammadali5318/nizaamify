import parsePhoneNumberFromString from 'libphonenumber-js'
import { z } from 'zod'

const ManagementEnum = z.enum([
  'EXACT',
  'DENTALLY',
  'R4',
  'CARESTREAM',
  'OTHER'
])
const AccountingEnum = z.enum(['XERO', 'QUICKBOOKS', 'NONE', 'OTHER'])
const UseEnum = z.enum(['INTERNAL', 'EXTERNAL', 'NONE'])
const FrequencyEnum = z.enum(['MONTHLY', 'YEARLY', 'RARELY'])
const ConfidenceEnum = z.enum(['VERY CONFIDENT', 'CONFIDENT', 'NOT CONFIDENT'])
const InsightsEnum = z.enum([
  'VISUAL DASHBOARDS',
  'BULLET-POINT SUMMARIES',
  'DETAILED REPORTS'
])

export const PracticeSchema = z.object({
  practiceName: z.string().min(1, 'Practice name is required'),
  principalName: z.string().min(1, 'Principal name is required'),
  practiceManagerName: z.string().min(1, 'Practice manager name is required'),
  practiceAddress: z
    .string()
    .min(1, 'Practice address is required')
    .max(300, 'Practice address must be 300 characters or less'),
  phone: z
    .string()
    .nonempty('Phone is required')
    .refine((val) => {
      const phoneNumber = parsePhoneNumberFromString(val || '')
      return phoneNumber?.isValid() ?? false
    }, 'Please enter a valid phone number'),
  email: z
    .string()
    .min(1, 'Email is required')
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Enter a valid email'
    }),

  practiceType: z.string().min(1, 'Practice type is required'),
  yearsTrading: z.coerce
    .number()
    .int('Years trading must be a whole number')
    .min(0, 'Years trading must be 0 or more')
    .max(100, 'Years trading looks too large'),
  numberOfSurgeries: z.coerce
    .number()
    .int('Number of surgeries must be a whole number')
    .min(0, 'Number of surgeries must be 0 or more'),
  numberOfAssociates: z.coerce
    .number()
    .int('Number of associates must be a whole number')
    .min(0, 'Number of associates must be 0 or more'),
  numberOfHygienistsTherapists: z.coerce
    .number()
    .int('Number of hygienists/therapists must be a whole number')
    .min(0, 'Number of hygienists/therapists must be 0 or more'),
  numberOfSpecialists: z.coerce
    .number()
    .int('Number of specialists must be a whole number')
    .min(0, 'Number of specialists must be 0 or more'),
  premisesOwnership: z.string().min(1, 'Premises ownership is required'),
  practiceManagementSoftware: z
    .union([ManagementEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Practice management software is required'
    }),
  accountingSoftware: z
    .union([AccountingEnum, z.literal('')])
    .refine((v) => v !== '', { message: 'Accounting software is required' }),
  useOfAccountantBookkeeper: z
    .union([UseEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Please select accountant/bookkeeper usage'
    }),

  frequencyOfFinancialReview: z
    .union([FrequencyEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Frequency of financial review is required'
    }),
  primaryReasons: z
    .array(z.string())
    .min(1, 'Please select at least one reason'),
  confidenceReadingReports: z
    .union([ConfidenceEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Please select your confidence reading reports'
    }),
  preferredInsightsFormat: z
    .union([InsightsEnum, z.literal('')])
    .refine((v) => v !== '', {
      message: 'Please select a preferred insights format'
    })
})

export type PracticeFormValues = z.infer<typeof PracticeSchema>
