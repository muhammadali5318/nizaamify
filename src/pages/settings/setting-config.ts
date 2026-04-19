// src/config/settingsMenu.ts

import ArchivedDataSet from './component/ArchivedDataSet'
import PracticeInformation from './component/PracticeInformation'
import ProfileInformation from './component/ProfileInformation'
import Security from './component/Security'
import { UserApiProfile, MenuItem, UserProfileForm } from './type'

export const SETTINGS_MENU: MenuItem[] = [
  {
    id: 'profile',
    label: 'Profile information',
    title: 'Profile information',
    description:
      'Manage your personal details and keep your account information up to date.',
    logo: '/assets/profile.svg',
    component: ProfileInformation
  },
  {
    id: 'practice',
    label: 'Practice information',
    title: 'Practice information',
    description: 'Update your practice details and settings.',
    logo: '/assets/practice-settings.svg',
    component: PracticeInformation
  },
  {
    id: 'archivedDataSet',
    label: 'Archived Data Set',
    title: 'Archived Data Set',
    description:
      'Download your archived data set generated during the accounting basis switch.',
    logo: '/assets/archive.svg',
    component: ArchivedDataSet
  },
  {
    id: 'security',
    label: 'Security',
    title: 'Security',
    description: 'Manage your password and account protection settings.',
    logo: '/assets/security.svg',
    component: Security
  }
]

export const mapUserApiToForm = (
  api?: UserApiProfile | null
): UserProfileForm => ({
  firstName: api?.first_name ?? '',
  lastName: api?.last_name ?? '',
  email: api?.email ?? '',
  role: api?.role ?? '',
  phone: api?.contact_number ?? ''
})

export const mapUserFormToApi = (
  form: UserProfileForm
): Partial<UserApiProfile> => ({
  first_name: form.firstName,
  last_name: form.lastName,
  contact_number: form.phone
})

export type PracticeApi = {
  id: string
  practice_name?: string | null
  auth0_id?: string | null
  address?: string | null
  postcode?: string | null
  email?: string | null
  url?: string | null
  contact_number?: string | null
  principal_name?: string | null
  practice_manager_name?: string | null
  practice_type?: string | null
  years_of_trading?: number | string | null
  number_of_surgeries?: number | string | null
  number_of_associates?: number | string | null
  number_of_hygienists_therapists?: number | string | null
  number_of_specialists?: number | string | null
  premises_ownership?: string | null
  management_software?: string | null
  accounting_software?: string | null
  accountant_bookkeeper_use?: string | null
  financial_review_frequency?: string | null
  primary_reasons?: string[] | null
  confidence_reading_reports?: string | null
  insights_format?: string | null
  onboarding_status?: string | null
  onboarding_step?: number | null
  onboarding_completed_at?: string | null
  accounting_basis: string
}

export type PracticeFormValues = {
  practiceName: string
  principalName: string
  practiceManagerName: string
  practiceAddress: string
  phone: string
  email?: string
  practiceType: string
  yearsTrading: number
  numberOfSurgeries: number
  numberOfAssociates: number
  numberOfHygienistsTherapists: number
  numberOfSpecialists: number
  premisesOwnership: string
  practiceManagementSoftware: string
  accountingSoftware: string
  useOfAccountantBookkeeper: string
  frequencyOfFinancialReview: string
  primaryReasons: string[]
  confidenceReadingReports: string
  preferredInsightsFormat: string
  accountingBasis: string
}

const UI_TO_API_REASON_MAP: Record<string, string> = {
  'Track Profit': 'Track Profit',
  'Save Time': 'Save Time',
  'Understand Performance': 'Understand Performance',
  'Reduce Cost': 'Reduce costs',
  'Meet NHS Targets': 'Meet NHS Targets',
  Other: 'Other'
}

const normalizePrimaryReasonsForApi = (arr?: string[] | null) => {
  if (!Array.isArray(arr)) return []
  return arr.map((r) => UI_TO_API_REASON_MAP[r] ?? r)
}

/* --- map helper --- */
export const mapFormToApiPayload = (
  values: PracticeFormValues | Record<string, any>
) => {
  // if it's already shaped like API (has practice_name) assume it's ready
  if ('practice_name' in values) return values

  const v = values as PracticeFormValues
  return {
    practice_name: v.practiceName ?? '',
    address: v.practiceAddress ?? '',
    postcode: (v as any).postcode ?? '',
    email: v.email ?? '',
    contact_number: v.phone ?? '',
    principal_name: v.principalName ?? '',
    practice_manager_name: v.practiceManagerName ?? '',
    practice_type: v.practiceType ?? '',
    years_of_trading: Number(v.yearsTrading ?? 0),
    number_of_surgeries: Number(v.numberOfSurgeries ?? 0),
    number_of_associates: Number(v.numberOfAssociates ?? 0),
    number_of_hygienists_therapists: Number(
      v.numberOfHygienistsTherapists ?? 0
    ),
    number_of_specialists: Number(v.numberOfSpecialists ?? 0),
    premises_ownership: v.premisesOwnership ?? '',
    management_software: v.practiceManagementSoftware ?? '',
    accounting_software: v.accountingSoftware ?? '',
    accountant_bookkeeper_use: v.useOfAccountantBookkeeper ?? '',
    financial_review_frequency: v.frequencyOfFinancialReview ?? '',
    primary_reasons: normalizePrimaryReasonsForApi(
      Array.isArray((v as any).primaryReasons) ? (v as any).primaryReasons : []
    ),
    confidence_reading_reports: v.confidenceReadingReports ?? '',
    insights_format: v.preferredInsightsFormat ?? '',
    accounting_basis: v.accountingBasis ?? ''
  }
}

const MANAGEMENT_OPTIONS = ['EXACT', 'DENTALLY', 'R4', 'CARESTREAM', 'OTHER']
const ACCOUNTING_OPTIONS = ['XERO', 'QUICKBOOKS', 'NONE', 'OTHER']
const USE_OPTIONS = ['INTERNAL', 'EXTERNAL', 'NONE']
const FREQUENCY_OPTIONS = ['MONTHLY', 'YEARLY', 'RARELY']
const CONFIDENCE_OPTIONS = ['VERY CONFIDENT', 'CONFIDENT', 'NOT CONFIDENT']
const INSIGHTS_OPTIONS = [
  'VISUAL DASHBOARDS',
  'BULLET-POINT SUMMARIES',
  'DETAILED REPORTS'
]

const CANONICAL_REASONS = [
  'Track Profit',
  'Save Time',
  'Understand Performance',
  'Reduce Cost',
  'Meet NHS Targets',
  'Other'
]

export const LEFT_REASONS = [
  'Track Profit',
  'Save Time',
  'Understand Performance'
]
export const RIGHT_REASONS = ['Reduce Cost', 'Meet NHS Targets', 'Other']

const findCanonicalReason = (apiReason?: string | null) => {
  if (!apiReason) return null
  const s = String(apiReason).trim().toLowerCase()

  // direct match to one of our canonical labels
  const direct = CANONICAL_REASONS.find((r) => r.toLowerCase() === s)
  if (direct) return direct

  // fuzzy rules for likely variations -> map into our 6 choices
  if (s.includes('profit')) return 'Track Profit'
  if (s.includes('save') || s.includes('time')) return 'Save Time'
  if (s.includes('performance') || s.includes('understand'))
    return 'Understand Performance'
  if (s.includes('reduce cost') || s.includes('reduce') || s.includes('cost'))
    return 'Reduce Cost'
  if (s.includes('nhs') || s.includes('target')) return 'Meet NHS Targets'

  // Unknown / miscellaneous answers map to 'Other'
  return 'Other'
}

export const mapPracticeApiToForm = (api: PracticeApi): PracticeFormValues => {
  // helper to normalise / validate against known options
  const pickOrEmpty = (val: any, allowed: string[] | null = null) => {
    if (val == null || val === '') return ''
    const asStr = String(val).toUpperCase()
    if (!allowed) return asStr
    return allowed.includes(asStr) ? (asStr as any) : ''
  }

  return {
    practiceName: api.practice_name ?? '',
    principalName: api.principal_name ?? '',
    practiceManagerName: api.practice_manager_name ?? '',
    practiceAddress: api.address ?? '',
    phone: api.contact_number ?? '',
    email: api.email ?? '',
    practiceType: api.practice_type ?? '',
    yearsTrading:
      api.years_of_trading == null ? 0 : Number(api.years_of_trading) || 0,
    numberOfSurgeries:
      api.number_of_surgeries == null
        ? 0
        : Number(api.number_of_surgeries) || 0,
    numberOfAssociates:
      api.number_of_associates == null
        ? 0
        : Number(api.number_of_associates) || 0,
    numberOfHygienistsTherapists:
      api.number_of_hygienists_therapists == null
        ? 0
        : Number(api.number_of_hygienists_therapists) || 0,
    numberOfSpecialists:
      api.number_of_specialists == null
        ? 0
        : Number(api.number_of_specialists) || 0,
    premisesOwnership: api.premises_ownership ?? '',
    practiceManagementSoftware: pickOrEmpty(
      api.management_software,
      MANAGEMENT_OPTIONS
    ),
    accountingSoftware: pickOrEmpty(
      api.accounting_software,
      ACCOUNTING_OPTIONS
    ),
    useOfAccountantBookkeeper: pickOrEmpty(
      api.accountant_bookkeeper_use,
      USE_OPTIONS
    ),

    frequencyOfFinancialReview: pickOrEmpty(
      api.financial_review_frequency,
      FREQUENCY_OPTIONS
    ),
    primaryReasons: Array.isArray(api.primary_reasons)
      ? (api.primary_reasons
          .map(findCanonicalReason)
          .filter(Boolean) as string[])
      : [],
    confidenceReadingReports: pickOrEmpty(
      api.confidence_reading_reports,
      CONFIDENCE_OPTIONS
    ),
    preferredInsightsFormat: pickOrEmpty(api.insights_format, INSIGHTS_OPTIONS),
    accountingBasis: api?.accounting_basis
  }
}

export const steps = [
  { heading: 'Review & Confirm' },
  { heading: 'Verify Credentials' },
  { heading: '2FA Verification' },
  { heading: 'Export Data' },
  { heading: 'Apply Changes' }
]

export const accountingBasisBreadCrumbs = [
  { label: 'Account Settings', to: '/settings' },
  { label: 'Switch Accounting Basis' }
]
