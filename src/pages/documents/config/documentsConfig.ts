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
    label: 'Upload documents',
    activeIcon: '/assets/active-document.svg',
    inactiveIcon: '/assets/inactive-document.svg'
  },
  {
    key: 1,
    label: 'Pending documents',
    activeIcon: '/assets/active-union.svg',
    inactiveIcon: '/assets/in-active-union.svg',
    count: 44
  },
  {
    key: 2,
    label: 'Upload history',
    activeIcon: '/assets/history.svg',
    inactiveIcon: '/assets/history-icon.svg'
  }
]
