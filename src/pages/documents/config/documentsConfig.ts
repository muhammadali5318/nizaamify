import { documentMapping } from 'src/utils/documentMapping'
import { FilterState } from '../components/documents-list/FilterBar'

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
