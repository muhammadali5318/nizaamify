import { StepFiveFormValues } from './schema-validations/practice-onboarding/stepFive'

export const ukPostcodeRegex =
  /^(GIR ?0AA|[A-PR-UWYZ]([0-9][0-9A-HJKPS-UW]?|[A-HK-Y][0-9][0-9ABEHMNPRV-Y]?) ?[0-9][ABD-HJLNP-UW-Z]{2})$/i

export const nameRegex = /^[\p{L}][\p{L}\p{M}\s'-]{1,49}$/u

export const USER_ROLES = [
  { value: 'PRACTICE OWNER', label: 'Practice Owner' },
  { value: 'PRACTICE MANAGER', label: 'Practice Manager' },
  { value: 'COMPANY DIRECTOR', label: 'Company Director' },
  { value: 'PRACTICE USER', label: 'Practice User' }
] as const

export const OWNER_ROLES = [
  { value: 'PRACTICE OWNER', label: 'Practice Owner' },
  { value: 'COMPANY DIRECTOR', label: 'Company Director' }
] as const

export type AccountingBasisType = StepFiveFormValues['accountingBasis']

export interface AccountingBasisInfo {
  value: AccountingBasisType
  iconPath: string
  header: string
  description: string
  pros: string[]
  cons: string[]
  alertText: string
  testId: string
}

export const CASH_BASIS_INFO: AccountingBasisInfo = {
  value: 'cash',
  iconPath: 'coin-pound.svg',
  header: 'Cash basis',
  description:
    'Income and expenses are recorded when cash actually moves — when you receive or make payments. Ideal for smaller or newer practices that want simple real-time cash tracking.',

  pros: [
    'Can be easier to understand',
    'Matches cash in the bank',
    'Good for basic cash-flow visibility'
  ],

  cons: [
    'Can distort monthly profit',
    'Harder to benchmark against other practices',
    'Big bills or late payments cause misleading swings'
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

  pros: [
    'More accurate profit and KPI tracking',
    'Matches industry benchmarks for comparison',
    'Better for planning, valuations, and decision-making'
  ],

  cons: [
    'Slightly more complex to understand',
    'Requires cleaner bookkeeping',
    'Doesn’t always match what’s in the bank'
  ],

  alertText:
    'Your practice tracks invoices and bills at the time they’re issued, not when cash is received or paid.',
  testId: 'radio-card-accrual'
}

export const ALL_PERMISSIONS = {
  'AI Assistant': [
    {
      id: 1,
      key: 'ai.ask',
      name: 'AI Assistant - Ask Questions from AI Assistant',
      is_active: null
    }
  ],
  'Audit Logs': [
    {
      id: 2,
      key: 'audit.manage',
      name: 'Audit Logs - Manage Audit Logs',
      is_active: null
    },
    {
      id: 3,
      key: 'audit.view',
      name: 'Audit Logs - View Audit Logs',
      is_active: null
    }
  ],
  Benchmarking: [
    {
      id: 4,
      key: 'benchmark.manage_national',
      name: 'Benchmarking - Manage National Benchmarking',
      is_active: null
    },
    {
      id: 5,
      key: 'benchmark.view_monai',
      name: 'Benchmarking - View Monai Benchmarking (Aggregated from practices)',
      is_active: null
    },
    {
      id: 6,
      key: 'benchmark.view_national',
      name: 'Benchmarking - View National Benchmarking',
      is_active: null
    }
  ],
  'Dashboards & Insights': [
    {
      id: 7,
      key: 'dash.download_reports',
      name: 'Dashboards & Insights - Download Summary Reports',
      is_active: null
    },
    {
      id: 8,
      key: 'dash.view_all',
      name: 'Dashboards & Insights - View All Insights',
      is_active: null
    },
    {
      id: 9,
      key: 'dash.view_benchmark_comparison',
      name: 'Dashboards & Insights - View Benchmark Comparison (Aggregated + NHS)',
      is_active: null
    },
    {
      id: 10,
      key: 'dash.view_expense_breakdown',
      name: 'Dashboards & Insights - View Expense Breakdown',
      is_active: null
    },
    {
      id: 11,
      key: 'dash.view_loss',
      name: 'Dashboards & Insights - View Loss Dashboard',
      is_active: null
    },
    {
      id: 12,
      key: 'dash.view_revenue',
      name: 'Dashboards & Insights - View Revenue Dashboard',
      is_active: null
    }
  ],
  'Data Access & Management': [
    {
      id: 13,
      key: 'data.export_all',
      name: 'Data Access & Management - Export All Data',
      is_active: null
    },
    {
      id: 14,
      key: 'data.delete_permanent',
      name: 'Data Access & Management - Permanently Delete Data',
      is_active: null
    },
    {
      id: 15,
      key: 'data.upload_archive',
      name: 'Data Access & Management - Upload/Archive Documents',
      is_active: null
    }
  ],
  'Feedback & Support': [
    {
      id: 16,
      key: 'feedback.add',
      name: 'Feedback & Support - Add Feedback',
      is_active: null
    },
    {
      id: 17,
      key: 'feedback.report_issue',
      name: 'Feedback & Support - Report technical issue',
      is_active: null
    },
    {
      id: 18,
      key: 'feedback.ticket_view',
      name: 'Feedback & Support - Support ticket visibility',
      is_active: null
    },
    {
      id: 19,
      key: 'feedback.view_all',
      name: 'Feedback & Support - View User Feedback',
      is_active: null
    }
  ],
  'Integrations & Finance': [
    {
      id: 20,
      key: 'integrations.raw_banking',
      name: 'Integrations & Finance - Access Raw Banking Data',
      is_active: null
    },
    {
      id: 21,
      key: 'integrations.manage',
      name: 'Integrations & Finance - Integrations with Aggregator/Quickbook/Xero',
      is_active: null
    }
  ],
  'Legal & Compliance': [
    {
      id: 22,
      key: 'legal.accept_revoke',
      name: 'Legal & Compliance - Accept/Revoke Legal Agreements',
      is_active: null
    }
  ],
  Payments: [
    {
      id: 23,
      key: 'payments.notify_failed',
      name: 'Payments - Notifications for Failed Payments',
      is_active: null
    },
    {
      id: 24,
      key: 'payments.view_failed',
      name: 'Payments - Payment Failed',
      is_active: null
    },
    {
      id: 25,
      key: 'payments.view_success',
      name: 'Payments - Payment Successful',
      is_active: null
    },
    {
      id: 26,
      key: 'payments.retry_update',
      name: 'Payments - Retry Payment/Update Billing Method',
      is_active: null
    }
  ],
  'Practice Management': [
    {
      id: 27,
      key: 'practice.add',
      name: 'Practice Management - Add Practice',
      is_active: null
    },
    {
      id: 28,
      key: 'practice.archive_unarchive',
      name: 'Practice Management - Archive/Unarchive Practice',
      is_active: null
    },
    {
      id: 29,
      key: 'practice.switch',
      name: 'Practice Management - Switch Practice',
      is_active: null
    },
    {
      id: 30,
      key: 'practice.view',
      name: 'Practice Management - View Practice',
      is_active: null
    }
  ],
  'Subscriptions & Billing': [
    {
      id: 31,
      key: 'subs.manage_plan',
      name: 'Subscriptions & Billing - Manage Subscription Plan',
      is_active: null
    },
    {
      id: 32,
      key: 'subs.receive_alerts',
      name: 'Subscriptions & Billing - Receive Subscription Alerts',
      is_active: null
    },
    {
      id: 33,
      key: 'subs.view_invoices',
      name: 'Subscriptions & Billing - View Invoice & Payment History',
      is_active: null
    },
    {
      id: 34,
      key: 'subs.view_status',
      name: 'Subscriptions & Billing - View Subscription Status',
      is_active: null
    }
  ],
  'User & Account Management': [
    {
      id: 35,
      key: 'user.deactivate',
      name: 'User & Account Management - Deactivate Account',
      is_active: null
    },
    {
      id: 36,
      key: 'user.edit_practice_profile',
      name: 'User & Account Management - Edit Practice Profile',
      is_active: null
    },
    {
      id: 37,
      key: 'user.enable_security',
      name: 'User & Account Management - Enable Account Security',
      is_active: null
    },
    {
      id: 38,
      key: 'user.manage_users_roles',
      name: 'User & Account Management - Manage Users & Roles',
      is_active: null
    },
    {
      id: 39,
      key: 'user.update_profile',
      name: 'User & Account Management - Update Profile',
      is_active: null
    },
    {
      id: 40,
      key: 'user.settings',
      name: 'User & Account Management - User Settings',
      is_active: null
    }
  ]
}

export const PRACTICE_TYPE = {
  'NHS-DOMINANT': 'Predominantly NHS',
  PRIVATE: 'Private',
  MIXED: 'Mixed',
  SQUAT: 'Squat'
} as const
