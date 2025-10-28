export const documentMapping: Record<string, string[]> = {
  'Income & Revenue': [
    'Practice management reports',
    'Bank statements',
    'Capitation scheme statements',
    'Subletting or rental income evidence'
  ],
  'Staff Costs': [
    'PAYE payslips',
    'Associate invoices',
    'Hygienist/Therapist invoices',
    'Locum invoices'
  ],
  'Dental Labs & Materials': [
    'Dental lab invoices',
    'Supplier invoices',
    'Manufacturer receipts'
  ],
  'Premises & Equipment': [
    'Lease/rent documents',
    'Business rates invoices',
    'Utility Bills',
    'Repairs or maintenance bills',
    'Equipment purchases or leasing agreements'
  ],
  'Business Operations': [
    'Marketing invoices',
    'Software subscriptions',
    'Legal or accountancy fees',
    'Professional indemnity certificates',
    'CQC/GDC-related fees',
    'Compliance-related invoices or documentation'
  ],
  'Tax Documents': [
    'Corporation tax statements',
    'VAT returns',
    'HMRC communications',
    'Accountant summaries or filings'
  ]
}

export const getDocumentTypes = (): string[] => Object.keys(documentMapping)

export const getDocumentSubtypes = (type: string): string[] =>
  documentMapping[type] || []
