export type TabKey = 0 | 1 | 2

export const tabsData: {
  key: TabKey
  label: string
  activeIcon: string
  inactiveIcon: string
}[] = [
  {
    key: 0,
    label: 'Team Members',
    activeIcon: '/assets/active-team-member-tab-icon.svg',
    inactiveIcon: '/assets/inactive-team-member-tab.svg'
  },
  {
    key: 1,
    label: 'Sent Invitations',
    activeIcon: '/assets/active-history-icon.svg',
    inactiveIcon: '/assets/history-icon.svg'
  },
  {
    key: 2,
    label: 'Roles & Permissions',
    activeIcon: '/assets/active-notification.svg',
    inactiveIcon: '/assets/notification-icon.svg'
  }
]

export const teamMembersSx = {
  border: 'none',
  borderBottom: '1px solid var(--divider, rgba(0, 0, 0, 0.12))',
  '& .MuiDataGrid-columnSeparator': { display: 'none' },

  // vertically center headers & cells
  '& .MuiDataGrid-columnHeader, & .MuiDataGrid-cell': {
    display: 'flex',
    alignItems: 'center'
  },

  // remove visual header/cell right borders
  '& .MuiDataGrid-cell': { borderRight: 'none', outline: 'none' },

  // header background
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: 'var(--grey-100, #F5F5F5)',
    color: 'inherit',
    minHeight: 56
  },

  '& .MuiDataGrid-columnHeader': {
    borderRight: 'none',
    backgroundColor: 'transparent',
    borderBottom: '1px solid rgba(0,0,0,0.04)'
  },

  '& .MuiDataGrid-columnHeader .MuiCheckbox-root': {
    backgroundColor: 'transparent'
  }
}

export const PERMISSION_ICON_MAP: Record<string, string> = {
  'Dashboards & Insights': '/assets/roles-dashboard.svg',
  Benchmarking: '/assets/roles-bench-marking.svg',
  'Subscriptions & Billing': '/assets/roles-subscription.svg',
  Payments: '/assets/roles-payments.svg',
  'Data Access & Management': '/assets/roles-audiance.svg',
  'User & Account Management': '/assets/roles-settings.svg',
  'Legal & Compliance': '/assets/roles-audiance.svg',
  'Feedback & Support': '/assets/roles-question-mark.svg',
  'AI Assistant': '/assets/spark.svg',
  'Audit Logs': '/assets/roles-audiance.svg',
  'Integrations & Finance': '/assets/roles-payments.svg'
}

export const DEFAULT_PERMISSION_ICON = '/assets/roles-audiance.svg'
