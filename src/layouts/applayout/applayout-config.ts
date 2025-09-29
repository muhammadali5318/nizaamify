import { styled } from '@mui/material/styles'
import MuiDrawer from '@mui/material/Drawer'
import { paths } from 'src/paths'

import { ModuleId } from '../../types/feature-flags'

export type MenuItemData = {
  text: string
  to: string
  activeIcon: string
  inactiveIcon: string
  moduleId: ModuleId
}

export const menuSections: { title: string; items: MenuItemData[] }[] = [
  {
    title: 'Main menu',
    items: [
      {
        text: 'Dashboard',
        to: paths.dashboard,
        activeIcon: 'active-dashboard.svg',
        inactiveIcon: 'inactive-dashboard.svg',
        moduleId: 'dashboard'
      },
      {
        text: 'Documents',
        to: paths.documents,
        activeIcon: 'active-document.svg',
        inactiveIcon: 'inactive-document.svg',
        moduleId: 'documents'
      },
      {
        text: 'Reports',
        to: paths.reports,
        activeIcon: 'active-reports.svg',
        inactiveIcon: 'inactive-reports.svg',
        moduleId: 'reports'
      },
      {
        text: 'Benchmarks',
        to: paths.benchmarks,
        activeIcon: 'active-benchmarks.svg',
        inactiveIcon: 'inactive-benchmarks.svg',
        moduleId: 'benchmarks'
      }
    ]
  },
  {
    title: 'Management',
    items: [
      {
        text: 'Team management',
        to: paths.teamManagement,
        activeIcon: 'active-team-management.svg',
        inactiveIcon: 'inactive-team-management.svg',
        moduleId: 'team-management'
      },
      {
        text: 'Practice settings',
        to: paths.practiceSettings,
        activeIcon: 'active-practice-management.svg',
        inactiveIcon: 'inactive-practice-management.svg',
        moduleId: 'practice-settings'
      }
    ]
  },
  {
    title: 'Account',
    items: [
      {
        text: 'Billing',
        to: paths.billing,
        activeIcon: 'active-billing.svg',
        inactiveIcon: 'inactive-billing.svg',
        moduleId: 'billing'
      },
      {
        text: 'Settings',
        to: paths.settings,
        activeIcon: 'active-settings.svg',
        inactiveIcon: 'inactive-settings.svg',
        moduleId: 'settings'
      }
    ]
  },
  {
    title: 'Support',
    items: [
      {
        text: 'Help & support',
        to: paths.helpAndSupport,
        activeIcon: 'active-help-support.svg',
        inactiveIcon: 'inactive-help-support.svg',
        moduleId: 'help-support'
      }
    ]
  }
]

const drawerWidth = 292

export const openedMixin = (theme: any) => ({
  width: drawerWidth,
  padding: '0px 16px',
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen
  }),
  overflowX: 'hidden'
})

export const closedMixin = (theme: any) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  }),
  overflowX: 'hidden',
  width: '116px',
  padding: '0px 16px',
  [theme.breakpoints.up('sm')]: {
    width: '116px'
  }
})

export const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open'
})(({ theme, open }: any) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': {
      ...openedMixin(theme),
      border: 'none',
      boxShadow: 'none',
      backgroundColor: 'var(--grey-100)'
    }
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': {
      ...closedMixin(theme),
      border: 'none',
      boxShadow: 'none',
      backgroundColor: 'var(--grey-100)'
    }
  })
}))
