export const documentMapping: Record<string, string[]> = {
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

export const getDocumentTypes = (): string[] => Object.keys(documentMapping)

export const getDocumentSubtypes = (type: string): string[] =>
  documentMapping[type] || []

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
    return allTypes.filter((t) => t !== 'Income & Revenue')
  }

  return allTypes // Unknown → ALL
}
