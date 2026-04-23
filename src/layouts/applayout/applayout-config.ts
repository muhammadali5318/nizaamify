import MuiDrawer from '@mui/material/Drawer'
import { styled } from '@mui/material/styles'
import { paths } from 'src/paths'

export interface MenuItemData {
  text: string
  to: string
  activeIcon: string
  inactiveIcon: string
  tooltipContent?: string
  moduleId: string
}

export const menuSections: { title: string; items: MenuItemData[] }[] = [
  {
    title: 'Main Menu',
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
        text: 'Bank Connector',
        to: paths.bankIntegrator,
        activeIcon: 'bank-active.svg',
        inactiveIcon: 'bank-inactive.svg',
        moduleId: 'bank-integrator'
      },
      {
        text: 'P&L',
        to: paths.expense,
        activeIcon: 'active-wallet.svg',
        inactiveIcon: 'expense-inactive.svg',
        moduleId: 'expenses'
      },
      {
        text: 'Monai Agent',
        to: paths.monaiAgent,
        activeIcon: 'agent-active.svg',
        inactiveIcon: 'agent-inactive.svg',
        tooltipContent:
          'Monai Agent uses guardrails to answer practice finance questions using only your real data in Monai. If the data is not available, it will not guess.',
        moduleId: 'monai-agent'
      }
    ]
  },
  {
    title: 'Settings',
    items: [
      {
        text: 'User Settings',
        to: paths.settings,
        activeIcon: 'active-settings.svg',
        inactiveIcon: 'inactive-settings.svg',
        moduleId: 'settings'
      },
      {
        text: 'Practice Settings',
        to: paths.practiceSettings,
        activeIcon: 'active-practice-management.svg',
        inactiveIcon: 'inactive-practice-management.svg',
        moduleId: 'practice-settings'
      },
      {
        text: 'Team Management',
        to: paths.teamManagement.root,
        activeIcon: 'active-team-management.svg',
        inactiveIcon: 'inactive-team-management.svg',
        moduleId: 'team-management'
      },
      {
        text: 'Billing',
        to: paths.billing,
        activeIcon: 'active-billing.svg',
        inactiveIcon: 'inactive-billing.svg',
        moduleId: 'billing'
      }
    ]
  },
  {
    title: 'Support',
    items: [
      {
        text: 'Help & Support',
        to: paths.helpAndSupport,
        activeIcon: 'active-help-support.svg',
        inactiveIcon: 'inactive-help-support.svg',
        moduleId: 'help-support'
      },
      {
        text: 'Audit logs',
        to: paths.auditLogs,
        activeIcon: 'audit-active.svg',
        inactiveIcon: 'audit-inactive.svg',
        moduleId: 'audit-logs'
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
