export type TabKey = 0 | 1 | 2

export const tabsData: {
  key: TabKey
  label: string
  activeIcon: string
  inactiveIcon: string
}[] = [
  {
    key: 0,
    label: 'Table View',
    activeIcon: '/assets/table.svg',
    inactiveIcon: '/assets/inactive-table.svg'
  },
  {
    key: 1,
    label: 'Visual Breakdown',
    activeIcon: '/assets/active-chart.svg',
    inactiveIcon: '/assets/inactive-chart.svg'
  }
]
