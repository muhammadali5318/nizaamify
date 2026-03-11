import { paths } from 'src/paths'

export const bankingTabsData = [
  {
    key: 0,
    label: 'Overview',
    activeIcon: '/assets/active-document.svg',
    inactiveIcon: '/assets/inactive-document.svg'
  },
  {
    key: 1,
    label: 'Reconciliation',
    activeIcon: '/assets/active-union.svg',
    inactiveIcon: '/assets/in-active-union.svg',
    count: 0,
    countTotal: 0
  },
  {
    key: 2,
    label: 'Transactions',
    activeIcon: '/assets/active-document.svg',
    inactiveIcon: '/assets/inactive-document.svg'
  },
  {
    key: 3,
    label: 'Transactions history',
    activeIcon: '/assets/history.svg',
    inactiveIcon: '/assets/history-icon.svg'
  }
]

export const uploadCsvBreads = [
  { label: 'Bank integrator', to: paths.bankIntegrator },
  { label: 'Upload Bank Statement' }
]
