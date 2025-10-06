export type TabKey = 0 | 1 | 2

export const tabsData: {
  key: TabKey
  label: string
  activeIcon: string
  inactiveIcon: string
}[] = [
  {
    key: 0,
    label: 'Team members',
    activeIcon: '/assets/active-team-member-tab-icon.svg',
    inactiveIcon: '/assets/inactive-team-member-tab.svg'
  },
  {
    key: 1,
    label: 'Sent invitations',
    activeIcon: '/assets/active-history-icon.svg',
    inactiveIcon: '/assets/history-icon.svg'
  },
  {
    key: 2,
    label: 'Roles & permissions',
    activeIcon: '/assets/active-notification.svg',
    inactiveIcon: '/assets/notification-icon.svg'
  }
]
