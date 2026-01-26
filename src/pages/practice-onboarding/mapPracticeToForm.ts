import { StepFiveFormValues } from 'src/schema-validations/practice-onboarding/stepFive'
import { StepFourFormValues } from 'src/schema-validations/practice-onboarding/stepFour'
import { StepOneFormValues } from 'src/schema-validations/practice-onboarding/stepOne'
import { StepThreeFormValues } from 'src/schema-validations/practice-onboarding/stepThree'
import { StepTwoFormValues } from 'src/schema-validations/practice-onboarding/stepTwo'

type ApiPractice = {
  id: string
  practice_name?: string | null
  address?: string | null
  postcode?: string | null
  email?: string | null
  contact_number?: string | null
  principal_name?: string | null
  practice_manager_name?: string | null
  practice_type?: string | null
  years_of_trading?: number | null
  number_of_surgeries?: number | null
  number_of_associates?: number | null
  number_of_hygienists_therapists?: number | null
  number_of_specialists?: number | null
  premises_ownership?: string | null
  management_software?: string | null
  accounting_software?: string | null
  accountant_bookkeeper_use?: string | null
  financial_review_frequency?: string | null
  primary_reasons?: string[] | null
  confidence_reading_reports?: string | null
  insights_format?: string | null
  onboarding_step: number
  accounting_basis: string | ''
}

const normalizeString = (v?: string | null, fallback = '') =>
  v == null ? fallback : String(v)

const toNumberOrZero = (v?: number | null) =>
  typeof v === 'number' && !Number.isNaN(v) ? v : 0

type ManagementSoftware =
  | ''
  | 'EXACT'
  | 'DENTALLY'
  | 'R4'
  | 'CARESTREAM'
  | 'OTHER'
type AccountingSoftware = '' | 'XERO' | 'QUICKBOOKS' | 'OTHER' | 'NONE'
type AccountantBookkeeperUse = '' | 'INTERNAL' | 'EXTERNAL' | 'NONE'

const mapManagementSoftware = (v?: string | null): ManagementSoftware => {
  if (!v) return ''
  const n = v.toUpperCase()
  if (['EXACT', 'DENTALLY', 'R4', 'CARESTREAM', 'OTHER'].includes(n)) {
    return n as ManagementSoftware
  }
  return 'OTHER'
}

const mapAccountingSoftware = (v?: string | null): AccountingSoftware => {
  if (!v) return ''
  const n = v.toUpperCase()
  if (['XERO', 'QUICKBOOKS', 'OTHER', 'NONE'].includes(n)) {
    return n as AccountingSoftware
  }
  return 'OTHER'
}

const mapAccountantBookkeeperUse = (
  v?: string | null
): AccountantBookkeeperUse => {
  if (!v) return ''
  const n = v.toUpperCase()
  if (['INTERNAL', 'EXTERNAL', 'NONE'].includes(n)) {
    return n as AccountantBookkeeperUse
  }
  return 'NONE'
}

type FinancialReviewFrequency = '' | 'MONTHLY' | 'YEARLY' | 'RARELY'
type ConfidenceReadingReports =
  | ''
  | 'VERY CONFIDENT'
  | 'CONFIDENT'
  | 'NOT CONFIDENT'

const mapFinancialReviewFrequency = (
  v?: string | null
): FinancialReviewFrequency => {
  if (!v) return ''
  const n = v.toUpperCase()
  return (
    ['MONTHLY', 'YEARLY', 'RARELY'].includes(n) ? n : ''
  ) as FinancialReviewFrequency
}

const mapConfidenceReadingReports = (
  v?: string | null
): ConfidenceReadingReports => {
  if (!v) return ''
  const n = v.toUpperCase()
  return (
    ['CONFIDENT', 'NOT CONFIDENT', 'VERY CONFIDENT'].includes(n) ? n : ''
  ) as ConfidenceReadingReports
}

const mapInsightsFormat = (v?: string | null) => {
  if (!v) return ''
  const n = v.toUpperCase()
  if (n.includes('VISUAL')) return 'VISUAL DASHBOARDS'
  if (n.includes('PDF') || n.includes('REPORT')) return 'DETAILED REPORTS'
  if (n.includes('BULLET')) return 'BULLET-POINT SUMMARIES'
  return ''
}

/**
 * Main mapper
 */
export function mapPracticeApiToForm(api: ApiPractice) {
  // Step 1
  const stepOne: StepOneFormValues = {
    practiceName: normalizeString(api.practice_name, ''),
    principalName: normalizeString(api.principal_name, ''),
    practiceManagerName: normalizeString(api.practice_manager_name, ''),
    practiceAddress: normalizeString(api.address, ''),
    email: normalizeString(api.email, ''),
    phone: normalizeString(api.contact_number, '')
  }

  // Step 2
  const stepTwo: StepTwoFormValues = {
    practiceType: normalizeString(api.practice_type, ''),
    yearsTrading: toNumberOrZero(api.years_of_trading),
    numberOfSurgeries: toNumberOrZero(api.number_of_surgeries),
    numberOfAssociates: toNumberOrZero(api.number_of_associates),
    numberOfHygienistsTherapists: toNumberOrZero(
      api.number_of_hygienists_therapists
    ),
    numberOfSpecialists: toNumberOrZero(api.number_of_specialists),
    premisesOwnership: normalizeString(api.premises_ownership, '')
  }

  // Step 3
  const stepThree: StepThreeFormValues = {
    practiceManagementSoftware: mapManagementSoftware(api.management_software),
    accountingSoftware: mapAccountingSoftware(api.accounting_software),
    useOfAccountantBookkeeper: mapAccountantBookkeeperUse(
      api.accountant_bookkeeper_use
    )
  }

  // Step 4
  const stepFour: StepFourFormValues = {
    frequencyOfFinancialReview: mapFinancialReviewFrequency(
      api.financial_review_frequency
    ),
    primaryReasons: Array.isArray(api.primary_reasons)
      ? api.primary_reasons
      : [],
    confidenceReadingReports: mapConfidenceReadingReports(
      api.confidence_reading_reports
    ),
    preferredInsightsFormat: mapInsightsFormat(api.insights_format)
  }

  const stepFive: StepFiveFormValues = {
    accountingBasis:
      api.accounting_basis?.toLowerCase() === 'accrual'
        ? 'accrual'
        : api.accounting_basis?.toLowerCase() === 'cash'
          ? 'cash'
          : ''
  }

  const activeStep = api.onboarding_step

  return {
    id: api.id,
    stepOne,
    stepTwo,
    stepThree,
    stepFour,
    stepFive,
    activeStep
  }
}
