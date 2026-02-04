import { styled } from '@mui/material/styles'
import MuiDrawer from '@mui/material/Drawer'
import { paths } from 'src/paths'

import { ModuleId, UserContext } from '../../types/feature-flags'
import { featureFlagConfig } from 'src/config/feature-flag-config'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { FeatureFlagService } from 'src/services/FeatureFlagService'
import { CONFIG } from 'src/config-global'

export interface MenuItemData {
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
        text: 'Expenses',
        to: paths.expense,
        activeIcon: 'active-wallet.svg',
        inactiveIcon: 'expense-inactive.svg',
        moduleId: 'expenses'
      },
      {
        text: 'Non P&L Items',
        to: paths.nonPandL,
        activeIcon: 'pl-Icon-active.svg',
        inactiveIcon: 'pl-Icon-inactive.svg',
        moduleId: 'non-pandl'
      },
      {
        text: 'Monai Agent',
        to: paths.monaiAgent,
        activeIcon: 'agent-active.svg',
        inactiveIcon: 'agent-inactive.svg',
        moduleId: 'monai-agent'
      }
    ]
  },
  {
    title: 'Management',
    items: [
      {
        text: 'Team Management',
        to: paths.teamManagement.root,
        activeIcon: 'active-team-management.svg',
        inactiveIcon: 'inactive-team-management.svg',
        moduleId: 'team-management'
      },
      {
        text: 'Practice Settings',
        to: paths.practiceSettings,
        activeIcon: 'active-practice-management.svg',
        inactiveIcon: 'inactive-practice-management.svg',
        moduleId: 'practice-settings'
      },
      {
        text: 'Subscription & Billing',
        to: paths.billing,
        activeIcon: 'active-billing.svg',
        inactiveIcon: 'inactive-billing.svg',
        moduleId: 'billing'
      },
      {
        text: 'Audit logs',
        to: paths.auditLogs,
        activeIcon: 'audit-active.svg',
        inactiveIcon: 'audit-inactive.svg',
        moduleId: 'audit-logs'
      }
    ]
  },
  {
    title: 'Account',
    items: [
      {
        text: 'Settings',
        to: paths.settings,
        activeIcon: 'active-settings.svg',
        inactiveIcon: 'inactive-settings.svg',
        moduleId: 'settings'
      },
      ...(CONFIG.envName === 'dev'
        ? ([
            {
              text: 'Bank Integrator',
              to: paths.bankIntegrator,
              activeIcon: 'bank-active.svg',
              inactiveIcon: 'bank-inactive.svg',
              moduleId: 'bank-integrator'
            }
          ] as MenuItemData[])
        : [])
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

type ModuleRenderState = 'hidden' | 'disabled' | 'enabled'

export function evaluateModuleStateWithReason(
  moduleId: string,
  permissions: Record<string, any>,
  context: UserContext
): { state: ModuleRenderState; reason?: string } {
  const moduleConfig = featureFlagConfig.modules.find(
    (m) => m.id === (moduleId as any)
  )
  if (!moduleConfig) return { state: 'enabled' }

  const requiredRules = moduleConfig.requiredRules || []
  let sawDisable = false
  let reason: string | undefined

  // If there are no rules, still honor moduleConfig.isEnabled()
  if (requiredRules.length === 0) {
    if (typeof moduleConfig.isEnabled === 'function') {
      try {
        const enabled = moduleConfig.isEnabled(permissions, moduleConfig?.id)
        if (!enabled) {
          reason =
            moduleConfig.disabledMessage ||
            `${moduleConfig.name} is not available`
          return { state: 'hidden', reason }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        reason =
          moduleConfig.disabledMessage ||
          `${moduleConfig.name} is not available`
        return { state: 'hidden', reason }
      }
    }
    return { state: 'enabled' }
  }

  for (const ruleId of requiredRules) {
    const rule = FeatureFlagService.findRule(ruleId)

    if (!rule) {
      // Helpful to surface missing rules while debugging
      // You can remove this console.warn in production if you want.
      console.warn(`Feature rule not found: ${ruleId} for module ${moduleId}`)
      continue
    }

    const ruleOk = FeatureFlagService.evaluateRule(ruleId, context)

    if (ruleOk) {
      // Rule passed → check module-level isEnabled (if provided).
      if (typeof moduleConfig.isEnabled === 'function') {
        try {
          const enabled = moduleConfig.isEnabled(permissions, moduleConfig?.id)
          if (!enabled) {
            reason =
              moduleConfig.disabledMessage ||
              rule.description ||
              `${moduleConfig.name} is not available`
            return { state: 'hidden', reason }
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          reason =
            moduleConfig.disabledMessage ||
            rule.description ||
            `${moduleConfig.name} is not available`
          return { state: 'hidden', reason }
        }
      }
      // rule passed and module enabled (or no isEnabled) → continue to next rule
      continue
    } else {
      // Rule failed → disable the module (don't hide)
      if (ruleId === FEATURE_RULE_IDS.ONBOARDING_COMPLETED) {
        reason = 'Complete onboarding to access this module'
      } else if (ruleId === FEATURE_RULE_IDS.IS_OWNER_OR_DIRECTOR) {
        return { state: 'hidden', reason: 'Unauthorized role' }
      } else {
        reason =
          moduleConfig.disabledMessage ||
          rule.description ||
          `${moduleConfig.name} is disabled`
      }
      sawDisable = true
      continue
    }
  }

  return { state: sawDisable ? 'disabled' : 'enabled', reason }
}

// src/utils/practiceSelector.ts
export interface Practice {
  practice_name: string
  address?: string
  contact_number?: string | null
  email?: string | null
  practice_type?: string
  premises_ownership?: string
  accounting_basis?: string
  created_at?: string
  // optional future fields
  uuid?: string
}

export interface PracticeOption {
  value: string // unique value used by the <Select>
  label: string // display label (practice_name)
  subLabel?: string // e.g. email
  meta: Practice // original object for future use
}

/**
 * Convert raw practice array coming from backend into stable options for Select.
 * Uses uuid if present, otherwise falls back to email, then created_at+name to ensure uniqueness.
 */
export const mapPracticesToOptions = (
  practices: Practice[] | undefined
): PracticeOption[] => {
  if (!practices || !Array.isArray(practices)) return []

  return practices.map((p) => {
    const value =
      (p as any).uuid ??
      p.email ??
      (p.created_at ? `${p.practice_name}_${p.created_at}` : p.practice_name)

    return {
      value,
      label: p.practice_name,
      subLabel: p.email ?? '',
      meta: p
    }
  })
}

/**
 * Get the display label for a selected value (safely).
 */
export const getOptionLabel = (
  value: string | undefined,
  options: PracticeOption[]
) => options.find((o) => o.value === value)?.label ?? ''

/**
 * Get the full Practice object for a selected value.
 */
export const getOptionMeta = (
  value: string | undefined,
  options: PracticeOption[]
) => options.find((o) => o.value === value)?.meta
