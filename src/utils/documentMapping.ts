export const documentMapping: Record<string, Record<string, string[]>> = {
  // --- Income & Revenue (Not in the Expense table, keeping original flat structure for this non-expense category) ---
  'Income & Revenue': {
    'Practice management reports': [],
    'Bank statements': [],
    'Capitation scheme statements': [],
    'Subletting or rental income evidence': []
  },

  // --- Staff Costs ---
  'Staff Costs': {
    PAYE: ['Staff Cost'],
    'Locum/Agency Fees': ['Locum Agency Fees'],
    'Staff training & CPD': ['Staff Training'],
    'Recruitment costs': ['Recruitment Cost'],
    'HR services': ['HR Services'],
    Other: ['Staff Cost']
  },

  // --- Clinician Costs ---
  'Clinician Costs': {
    'Dentist Pay': ['Dentist Pay'],
    'Hyg/Therapy Pay': ['Hyg/Therapist Pay']
  },

  // --- Materials & Equipment ---
  'Materials & Equipment': {
    Materials: [
      'Materials' // As pointed out in your example
    ],
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
    Other: ['Premises']
  },

  // --- Business Operations ---
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

export const getDocumentTypes = (): string[] => Object.keys(documentMapping)

// Updated: Now returns Subtypes (keys of the nested object)
export const getDocumentSubtypes = (type: string): string[] =>
  documentMapping[type] ? Object.keys(documentMapping[type]) : []

// New Function: To retrieve the third level (Expense Sub-categories)
export const getExpenseSubcategories = (
  type: string,
  subtype: string
): string[] =>
  documentMapping[type] && documentMapping[type][subtype]
    ? documentMapping[type][subtype]
    : []

export const category = {
  expense: 'Expense',
  revenue: 'Revenue',
  unknown: 'Unknown'
}

export const getFilteredDocumentTypes = (category: string): string[] => {
  const allTypes = Object.keys(documentMapping)

  if (category === 'Revenue') {
    return ['Income & Revenue']
  }

  if (category === 'Expense') {
    // Filter out non-expense types
    return allTypes.filter(
      (t) => t !== 'Income & Revenue' && t !== 'Tax Documents'
    )
  }

  return allTypes // Unknown → ALL
}
