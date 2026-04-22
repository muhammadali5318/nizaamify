import { paths } from 'src/paths'

export const bankingTabsData = [
  {
    key: 0,
    label: 'Upload/Connect',
    activeIcon: '/assets/active-document.svg',
    inactiveIcon: '/assets/inactive-document.svg'
  },
  {
    key: 1,
    label: 'Transactions',
    activeIcon: '/assets/active-wallet.svg',
    inactiveIcon: '/assets/expense-inactive.svg'
  },
  {
    key: 3,
    label: 'Revenue',
    activeIcon: '/assets/active-billing.svg',
    inactiveIcon: '/assets/inactive-billing.svg',
    count: 0,
    countTotal: 0
  },
  {
    key: 2,
    label: 'Reconciliation',
    activeIcon: '/assets/active-union.svg',
    inactiveIcon: '/assets/in-active-union.svg',
    count: 0,
    countTotal: 0
  }
  // {
  //   key: 3,
  //   label: 'Invoice Upload History',
  //   activeIcon: '/assets/history.svg',
  //   inactiveIcon: '/assets/history-icon.svg'
  // }
]

export const uploadCsvBreads = [
  { label: 'Bank connector', to: paths.bankIntegrator },
  { label: 'Upload Bank Statement' }
]
