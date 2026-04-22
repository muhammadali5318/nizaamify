export const documentMapping: Record<string, Record<string, string[]>> = {
  // --- Income & Revenue (Not in the Expense table, keeping original flat structure for this non-expense category) ---
  'Income & Revenue': {
    'Practice management reports': [],
    'Bank statements': [],
    'NHS BSA PAYMENT': [],
    'Subletting or rental income evidence': []
  },

  // --- Staff Costs ---
  'Staff Costs': {
    PAYE: ['Staff Cost'],
    'Locum/Agency Fees': ['Locum Agency Fees'],
    'Staff training & CPD': ['Staff Training'],
    'Recruitment costs': ['Recruitment Cost'],
    'HR Services': ['HR Services'],
    Other: ['Other - Staff Cost']
  },

  // --- Clinician Costs ---
  'Clinician Costs': {
    'Dentist Pay': ['Dentist Pay'],
    'Hyg/Therapy Pay': ['Hyg/Therapist Pay']
  },

  // --- Materials & Equipment ---
  'Materials & Equipment': {
    Materials: ['Materials'],
    Equipment: [
      'Equipment purchases',
      'Equipment leasing',
      'Equipment repairs/servicing'
    ]
  },

  // --- Lab Fees ---
  'Lab Fees': {
    'Lab Fees': ['Lab Fees']
  },

  // --- Premises ---
  Premises: {
    'Lease/Mortgage Payments': ['Lease/Mortgage Payments'],
    'Business Rates': ['Business Rates'],
    Utilities: ['Utilities'],
    'Premises Insurance': ['Premises Insurance'],
    'Repairs/Maintenance (building)': ['Repairs/Maintenance (building)'],
    'Cleaning Services': ['Cleaning Services'],
    'Security & Alarm Contracts': ['Security & Alarm Contracts'],
    'Waste disposal': ['Waste disposal'],
    Other: ['Other - Premises']
  },

  // --- Business Operations ---
  'Business Operations': {
    Marketing: [
      'Paid Advertising (SM)',
      'Paid Advertising (SE)',
      'Agency/Service Fees',
      'Website & Digital Assets',
      'Offline Marketing',
      'Other - Marketing'
    ],
    Subscriptions: ['PMS', 'AI tools', 'Other - Subscriptions'],
    Compliance: ['Compliance'],
    'Legal/Accounting': ['Accountant/Bookkeeping', 'Legal Fees'],
    IT: ['IT support contracts', 'Hardware', 'Cloud storage', 'Other - IT'],
    Communications: ['Communications'],
    'Finance Fees': ['Finance Fees'],
    'Miscellaneous Ops': ['Miscellaneous Ops']
  },

  'Owner, Tax & Capital Movement': {
    'Owner Pay & Withdrawals': [
      'Owner Salary',
      'Dividend Pay',
      'Drawings',
      'Directors Loan - Repayment',
      'Other (owner pay & withdrawals)'
    ],
    Taxes: ['Corporation Tax', 'Dividend Tax', 'Other (taxes)'],

    'Financing & Capital': [
      'Capital Introduced by Owner',
      'Directors Loan',
      'Intercompany Loan',
      'Other (financing & capital)'
    ]
  }
}

export const getDocumentTypes = (): string[] => Object.keys(documentMapping)

export const getDocumentSubtypes = (
  type: string,
  method?: string
): string[] => {
  if (!documentMapping[type]) return []

  // Special logic for Income & Revenue
  if (type === 'Income & Revenue') {
    if (method === 'CASH') {
      return ['Bank statements', 'Subletting or rental income evidence']
    }

    if (method === 'ACCRUAL') {
      return [
        'Practice management reports',
        'NHS BSA PAYMENT',
        'Subletting or rental income evidence'
      ]
    }
  }

  return Object.keys(documentMapping[type])
}

export const getExpenseSubcategories = (
  type: string,
  subtype: string
): string[] => documentMapping[type]?.[subtype] ?? []

export const getDocumentLineItems = (
  type: string,
  subtype?: string
): string[] => {
  const typeMapping = documentMapping[type]
  if (!typeMapping) return []

  // Revenue documents do not use line items
  if (type === 'Income & Revenue') return []

  if (subtype) {
    return typeMapping[subtype] ?? []
  }

  // Backward compatible behavior:
  // when only the category/type is selected, return all line items from all subcategories
  return Object.values(typeMapping).flat()
}

export const getSubtypeForLineItem = (
  type: string,
  lineItem: string
): string => {
  const typeMapping = documentMapping[type]
  if (!typeMapping) return ''

  for (const [subtype, items] of Object.entries(typeMapping)) {
    if (items.includes(lineItem)) return subtype
  }

  return ''
}

export const category = {
  expense: 'Expense',
  revenue: 'Revenue',
  unknown: 'Unknown'
}

export const getFilteredDocumentTypes = (category: string): string[] => {
  const allTypes = Object.keys(documentMapping)

  if (category === 'Revenue' || category === 'Unknown') {
    return ['Income & Revenue']
  }

  if (category === 'Expense') {
    return allTypes.filter(
      (t) => t !== 'Income & Revenue' && t !== 'Tax Documents'
    )
  }

  return allTypes
}
