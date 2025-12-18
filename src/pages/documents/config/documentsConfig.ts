import { FilterState } from '../components/documents-list/FilterBar'

/* -------------------------------------------------------------------------- */
/*                             DOCUMENT MAPPING                               */
/* -------------------------------------------------------------------------- */

export const documentMapping: Record<string, Record<string, string[]>> = {
  /* --------------------------- Income & Revenue ---------------------------- */
  'Income & Revenue': {
    'Practice management reports': [],
    'Bank statements': [],
    'Capitation scheme statements': [],
    'Subletting or rental income evidence': []
  },

  /* ------------------------------ Staff Costs ------------------------------- */
  'Staff Costs': {
    PAYE: ['Staff Cost'],
    'Locum/Agency Fees': ['Locum Agency Fees'],
    'Staff training & CPD': ['Staff Training'],
    'Recruitment costs': ['Recruitment Cost'],
    'HR services': ['HR Services'],
    Other: ['Staff Cost']
  },

  /* ---------------------------- Clinician Costs ----------------------------- */
  'Clinician Costs': {
    'Dentist Pay': ['Dentist Pay'],
    'Hyg/Therapy Pay': ['Hyg/Therapist Pay']
  },

  /* ------------------------- Materials & Equipment -------------------------- */
  'Materials & Equipment': {
    Materials: ['Materials'],
    Equipment: [
      'Equipment purchases',
      'Equipment leasing',
      'Equipment repairs/servicing'
    ]
  },

  /* -------------------------------- Lab Fees -------------------------------- */
  'Lab Fees': {
    'Lab Fees': ['Lab Fees']
  },

  /* -------------------------------- Premises -------------------------------- */
  Premises: {
    'Lease/Mortgage Payments': ['Lease/Mortgage Payments'],
    'Business Rates': ['Business Rates'],
    Utilities: ['Utilities'],
    'Premises Insurance': ['Premises Insurance'],
    'Repairs/Maintenance (building)': ['Repairs/Maintenance (building)'],
    'Cleaning Services': ['Cleaning Services'],
    'Security & Alarm Contracts': ['Security & Alarm Contracts'],
    'Waste disposal': ['Waste disposal'],
    Other: ['Premises']
  },

  /* --------------------------- Business Operations --------------------------- */
  'Business Operations': {
    Marketing: [
      'Paid Advertising',
      'Agency/Service Fees',
      'Website & Digital Assets',
      'Offline Marketing',
      'Other – Marketing'
    ],
    Subscriptions: ['PMS', 'AI tools', 'Other – Subscriptions'],
    Compliance: ['Compliance'],
    'Legal / Accounting': ['Accountant/Bookkeeping', 'Legal Fees'],
    IT: ['IT support contracts', 'Hardware', 'Cloud storage', 'Other – IT'],
    Communications: ['Communications'],
    'Finance Fees': ['Finance Fees'],
    'Miscellaneous Ops': ['Miscellaneous Ops']
  }
}

/* -------------------------------------------------------------------------- */
/*                         DOCUMENT CATEGORY CARDS                             */
/* -------------------------------------------------------------------------- */

export const documentCategories = [
  {
    title: 'Income & revenue',
    examples: Object.keys(documentMapping['Income & Revenue']),
    icon: 'income.svg'
  },
  {
    title: 'Staff costs',
    examples: Object.keys(documentMapping['Staff Costs']),
    icon: 'staff.svg'
  },
  {
    title: 'Clinician costs',
    examples: Object.keys(documentMapping['Clinician Costs']),
    icon: 'staff.svg'
  },
  {
    title: 'Dental labs & materials',
    examples: [
      ...Object.keys(documentMapping['Lab Fees']),
      ...Object.keys(documentMapping['Materials & Equipment'])
    ],
    icon: 'dental.svg'
  },
  {
    title: 'Business operations',
    examples: Object.keys(documentMapping['Business Operations']),
    icon: 'business.svg'
  },
  {
    title: 'Premises & equipment',
    examples: Object.keys(documentMapping.Premises),
    icon: 'premises.svg'
  }
]

/* -------------------------------------------------------------------------- */
/*                              DOCUMENT TABS                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                           CATEGORY OPTIONS                                  */
/* -------------------------------------------------------------------------- */

export const CATEGORY_OPTIONS = [
  { value: 'Revenue', label: 'Income & revenue' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Unknown', label: 'Unknown' }
]

/* -------------------------------------------------------------------------- */
/*                       TYPE / SUBTYPE / SUBCATEGORY                          */
/* -------------------------------------------------------------------------- */

/* Level 1 */
export const getDocumentTypes = (): string[] => Object.keys(documentMapping)

/* Level 2 */
export const getDocumentSubtypes = (type: string): string[] =>
  documentMapping[type] ? Object.keys(documentMapping[type]) : []

/* Level 3 */
export const getExpenseSubcategories = (
  type: string,
  subtype: string
): string[] => documentMapping[type]?.[subtype] ?? []

/* Dropdown Options */
export const DOCUMENT_TYPE_OPTIONS = getDocumentTypes().map((t) => ({
  value: t,
  label: t
}))

/* -------------------------------------------------------------------------- */
/*                                 FILTERS                                    */
/* -------------------------------------------------------------------------- */

export const defaultFinancialDocumentsListFilters: FilterState = {
  searchKey: '',
  categories: [],
  uploadedBy: [],
  dateRange: { start: null, end: null },
  docType: null,
  docSubtype: []
}

/* -------------------------------------------------------------------------- */
/*                              BREADCRUMBS                                   */
/* -------------------------------------------------------------------------- */

export const documentsModuleBreadCrumbs = [
  { label: 'Documents', to: '/documents' },
  { label: 'Doc upload' }
]

/* -------------------------------------------------------------------------- */
/*                       CATEGORY → TYPE FILTERING                             */
/* -------------------------------------------------------------------------- */

export const CATEGORY_TYPE_MAP: Record<string, string[]> = {
  Revenue: ['Income & Revenue'],
  Expense: Object.keys(documentMapping).filter(
    (type) => type !== 'Income & Revenue'
  ),
  Unknown: Object.keys(documentMapping)
}
