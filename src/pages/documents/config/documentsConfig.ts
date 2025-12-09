import { FilterState } from '../components/documents-list/FilterBar.'

export const documentCategories = [
  {
    title: 'Income & revenue',
    examples: [
      'Practice management reports (e.g., Dentally, EXACT rep)',
      'Bank statements',
      'Capitation scheme statements (e.g., Practice Plan)',
      'Subletting or rental income evidence'
    ],
    icon: 'income.svg'
  },
  {
    title: 'Staff costs',
    examples: [
      'PAYE payslips',
      'Associate invoices',
      'Hygienist/Therapist invoices',
      'Locum invoices (dentist, therapist, nurse)'
    ],
    icon: 'staff.svg'
  },
  {
    title: 'Dental labs & materials',
    examples: [
      'Dental lab invoices',
      'Supplier invoices (consumables, materials)',
      'Manufacturer receipts'
    ],
    icon: 'dental.svg'
  },
  {
    title: 'Business operations',
    examples: [
      'Marketing invoices',
      'Software subscriptions',
      'Legal/accountancy fees',
      'Professional indemnity certificates'
    ],
    icon: 'business.svg'
  },
  {
    title: 'Premises & equipment',
    examples: [
      'Lease/rent documents',
      'Utilities bills',
      'Repairs or maintenance bills',
      'Equipment purchases/leasing'
    ],
    icon: 'premises.svg'
  },
  {
    title: 'Tax documents',
    examples: [
      'Corporation tax statements',
      'VAT returns',
      'HMRC communications',
      'Accountant summaries or filings'
    ],
    icon: 'tax.svg'
  }
]

// documents-tab-config
export const documentsTabsData = [
  {
    key: 0,
    label: 'Upload Documents',
    activeIcon: '/assets/active-document.svg',
    inactiveIcon: '/assets/inactive-document.svg'
  },
  {
    key: 1,
    label: 'Pending Documents',
    activeIcon: '/assets/active-union.svg',
    inactiveIcon: '/assets/in-active-union.svg',
    count: 44
  },
  {
    key: 2,
    label: 'Upload History',
    activeIcon: '/assets/history.svg',
    inactiveIcon: '/assets/history-icon.svg'
  }
]

export const CATEGORY_OPTIONS = [
  { value: 'Revenue', label: 'Income & revenue' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Unknown', label: 'Unknown' }
]

export const DOCUMENT_SUBTYPE_MAP: Record<string, string[]> = {
  'Income & Revenue': [
    'Bank statements',
    'Practice management reports',
    'Capitation scheme statements',
    'Subletting or rental income evidence'
  ],
  'Staff Costs': ['PAYE payslips', 'Staff Training', 'Locum invoices'],
  'Clinician Costs': ['Associate invoices', 'Hygienist/Therapist invoices'],
  Materials: ['Supplier invoices', 'Manufacturer receipts'],
  'Lab Fees': ['Dental lab invoices'],
  'Premises & Equipment': [
    'Cleaning',
    'Utility Bills',
    'Lease/rent documents',
    'Business rates invoices',
    'Repairs or building maintenance bills',
    'Equipment purchases or leasing agreements'
  ],
  'Business Operations': [
    'IT',
    'Bank Charges',
    'Clinical Waste',
    'Marketing invoices',
    'Printing and Postage',
    'CQC/GDC-related fees',
    'Card Merchant Charges',
    'Software subscriptions',
    'Legal or accountancy fees',
    'Professional indemnity certificates',
    'Compliance-related invoices or documentation'
  ],
  'Tax Documents': [
    'VAT returns',
    'HMRC communications',
    'Corporation tax statements',
    'Accountant summaries or filings'
  ]
}

export const DOCUMENT_TYPE_OPTIONS = Object.keys(DOCUMENT_SUBTYPE_MAP).map(
  (k) => ({
    value: k,
    label: k
  })
)

export const defaultFinancialDocumentsListFilters: FilterState = {
  searchKey: '',
  categories: [],
  uploadedBy: [],
  dateRange: { start: null, end: null },
  docType: null,
  docSubtype: []
}

export const documentsModuleBreadCrumbs = [
  { label: 'Documents', to: '/documents' },
  { label: 'Doc upload' }
]
export const CATEGORY_TYPE_MAP: Record<string, string[]> = {
  Revenue: ['Income & Revenue'],
  Expense: Object.keys(DOCUMENT_SUBTYPE_MAP).filter(
    (type) => type !== 'Income & Revenue'
  ),
  Unknown: Object.keys(DOCUMENT_SUBTYPE_MAP)
}
