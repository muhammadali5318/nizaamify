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
  }
]

export const dummyTransactions = [
  {
    id: 'txn_001',
    created_at: '2026-02-19 10:15:23',
    actor_type: '£2450.00',
    event_feature: 'credit',
    event_description: 'Dental Supplies Ltd - Equipment Purchase'
  },
  {
    id: 'txn_002',
    created_at: '2026-02-18 15:42:10',
    actor_type: '£120.50',
    event_feature: 'credit',
    event_description: 'Staff Salary - Dr. Smith'
  },
  {
    id: 'txn_003',
    created_at: '2026-02-17 09:12:55',
    actor_type: '£875.25',
    event_feature: 'debit',
    event_description: 'Electricity Bill - Monthly'
  },
  {
    id: 'txn_004',
    created_at: '2026-02-16 11:33:47',
    actor_type: '£49.99',
    event_feature: 'debit',
    event_description: 'Patient Payment - Private Treatment'
  },
  {
    id: 'txn_005',
    created_at: '2026-02-15 17:20:05',
    actor_type: '£300.00',
    event_feature: 'debit',
    event_description: 'Patient Payment - Private Treatment'
  },
  {
    id: 'txn_006',
    created_at: '2026-02-14 13:05:39',
    actor_type: '£1520.75',
    event_feature: 'credit',
    event_description: 'Patient Payment - Private Treatment'
  },
  {
    id: 'txn_007',
    created_at: '2026-02-13 08:55:14',
    actor_type: '£640.40',
    event_feature: 'credit',
    event_description: 'Electricity Bill - Monthly'
  },
  {
    id: 'txn_008',
    created_at: '2026-02-12 19:41:22',
    actor_type: '£25.00',
    event_feature: 'debit',
    event_description: 'Electricity Bill - Monthly'
  }
]

export const uploadCsvBreads = [
  { label: 'Bank integrator', to: paths.bankIntegrator },
  { label: 'Upload Bank Statement' }
]
