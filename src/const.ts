import { StepFiveFormValues } from './schema-validations/practice-onboarding/stepFive'

export const USER_ROLES = [
  { value: 'PRACTICE OWNER', label: 'Practice Owner' },
  { value: 'PRACTICE MANAGER', label: 'Practice Manager' },
  { value: 'COMPANY DIRECTOR', label: 'Company Director' },
  { value: 'PRACTICE USER', label: 'Practice User' }
] as const

export type AccountingBasisType = StepFiveFormValues['accountingBasis']

interface AccountingBasisInfo {
  value: AccountingBasisType
  iconPath: string
  header: string
  description: string
  bullets: string[]
  alertText: string
  testId: string
}

export const CASH_BASIS_INFO: AccountingBasisInfo = {
  value: 'cash',
  iconPath: 'coin-pound.svg',
  header: 'Cash basis',
  description:
    'Income and expenses are recorded when cash actually moves, that is, when you receive or make payments. Ideal for smaller or newer practices that want to track real-time cash flow and keep things simple.',
  bullets: [
    'A real-time view of your actual cash position',
    'Easier reconciliation with bank statements',
    'Simpler tax reporting and bookkeeping',
    'AI processing based on paid invoices only'
  ],
  alertText:
    'Your practice records revenue only when payment is received and expenses only when bills are paid.',
  testId: 'radio-card-cash'
}

export const ACCRUAL_BASIS_INFO: AccountingBasisInfo = {
  value: 'accrual',
  iconPath: 'accrual-icon.svg',
  header: 'Accrual basis',
  description:
    'Income and expenses are recorded when they’re earned or incurred, even if the payment hasn’t been made yet. Ideal for established practices that want deeper financial insights and long-term performance tracking.',
  bullets: [
    'A full picture of expected income and liabilities',
    'Advanced trend analysis and AI forecasting',
    'Benchmarking accuracy aligned with NHS and Monai averages',
    'AI processing for both paid and unpaid invoices'
  ],
  alertText:
    'Your practice tracks invoices and bills at the time they’re issued, not when cash is received or paid.',
  testId: 'radio-card-accrual'
}
