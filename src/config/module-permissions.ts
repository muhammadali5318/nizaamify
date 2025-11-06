import React from 'react'
import { useSelector } from 'react-redux'
import { selectPermissionsByCategory } from 'src/store/slices/userDetailsInActivePracticeSlice'
import { UserContext } from 'src/types/feature-flags'

export type PermissionItem = {
  id: string
  name: string
  description?: string
  key: string
  is_active: boolean | null
}

export type PermissionsMap = Record<string, PermissionItem[]>

type UserPermission = {
  id: string
  name?: string
  is_active: boolean
  key?: string
}

export type Permission = {
  id: string
  name: string
  description?: string
  is_active: boolean
}

// ---------------- CHECK PERMISSION BY KEY ----------------
export const checkPermission = (
  permissionsByCategory: UserContext | null | undefined,
  permissionKey: string
): boolean => {
  if (!permissionsByCategory || !permissionKey) return false

  const perms = Object.values(
    permissionsByCategory
  ).flat() as unknown as UserPermission[]
  return perms.some((p) => p.key === permissionKey && p.is_active === true)
}

export const hasPermission = (permissionKey: string): boolean => {
  const permissionsByCategory = useSelector(selectPermissionsByCategory)
  return checkPermission(permissionsByCategory, permissionKey)
}

export const useHasPermission = (permissionKey: string): boolean => {
  const permissionsByCategory = useSelector(selectPermissionsByCategory)

  return React.useMemo(() => {
    return checkPermission(permissionsByCategory, permissionKey)
  }, [permissionsByCategory, permissionKey])
}

// ---------- CORE: evaluateIsModuleEnabled ----------
export const MODULE_PERMISSION_MAP: Record<string, string | string[]> = {
  dashboard: 'Dashboards & Insights',
  documents: 'Data Access & Management',
  reports: 'Dashboards & Insights',
  benchmarks: 'Benchmarking',
  'team-management': 'User & Account Management',
  'practice-settings': 'Practice Management',
  billing: ['Subscriptions & Billing', 'Payments'],
  settings: 'User & Account Management',
  'help-support': 'Feedback & Support'
}

export const evaluateIsModuleEnabled = (
  permissions: PermissionsMap,
  moduleId?: string
): boolean => {
  if (!moduleId) return false

  const mapped = MODULE_PERMISSION_MAP[moduleId]
  if (!mapped) return false

  const groups = Array.isArray(mapped) ? mapped : [mapped]

  for (const groupName of groups) {
    const groupPermissions = permissions[groupName]
    if (
      Array.isArray(groupPermissions) &&
      groupPermissions.some((p) => p?.is_active === true)
    ) {
      return true
    }
  }
  return false
}

export function mergePermissions(
  allPermissions: PermissionsMap,
  userPermissions: UserPermission[] = []
): PermissionsMap {
  const userMap = new Map(userPermissions.map((p) => [p.id, p.is_active]))

  const mergedEntries = Object.entries(allPermissions).map(
    ([moduleName, perms]) => {
      const updatedPerms = perms.map((p) => {
        const userValue = userMap.get(p.id)
        // if userValue is undefined -> permission not assigned -> false
        const isActive = typeof userValue === 'boolean' ? userValue : false
        return { ...p, is_active: isActive }
      })
      return [moduleName, updatedPerms] as const
    }
  )

  return Object.fromEntries(mergedEntries)
}

export const ALL_PERMISSIONS = {
  'AI Assistant': [
    {
      id: '163de937-2fc5-49b5-8f02-09449566ddc3',
      key: 'ai.ask',
      name: 'AI Assistant - Ask Questions from AI Assistant',
      is_active: null
    }
  ],
  'Audit Logs': [
    {
      id: '1662a78e-5af9-46d8-bd4d-296de6be0b5a',
      key: 'audit.manage',
      name: 'Audit Logs - Manage Audit Logs',
      is_active: null
    },
    {
      id: '7d7875cb-dff2-4a1c-8ad1-58ef9c25663e',
      key: 'audit.view',
      name: 'Audit Logs - View Audit Logs',
      is_active: null
    }
  ],
  Benchmarking: [
    {
      id: 'a9d4d11a-aebc-4861-ba64-3accc65019e8',
      key: 'benchmark.manage_national',
      name: 'Benchmarking - Manage National Benchmarking',
      is_active: null
    },
    {
      id: 'b0c90cc4-2112-4e5d-aabd-d4189b41d978',
      key: 'benchmark.view_monai',
      name: 'Benchmarking - View Monai Benchmarking (Aggregated from practices)',
      is_active: null
    },
    {
      id: '99fce253-2ebb-486d-b824-7bdac23131cf',
      key: 'benchmark.view_national',
      name: 'Benchmarking - View National Benchmarking',
      is_active: null
    }
  ],
  'Dashboards & Insights': [
    {
      id: '03b2a9f1-34cd-408c-9992-c9f22ef9724c',
      key: 'dash.download_reports',
      name: 'Dashboards & Insights - Download Summary Reports',
      is_active: null
    },
    {
      id: '79065692-3158-4ffe-affa-2caa8e41f924',
      key: 'dash.view_all',
      name: 'Dashboards & Insights - View All Insights',
      is_active: null
    },
    {
      id: '2c8d69af-908f-40f1-a05c-aa4f5bc4add7',
      key: 'dash.view_benchmark_comparison',
      name: 'Dashboards & Insights - View Benchmark Comparison (Aggregated + NHS)',
      is_active: null
    },
    {
      id: '99b0f510-7d41-46ac-85f0-9cbe80af3e87',
      key: 'dash.view_expense_breakdown',
      name: 'Dashboards & Insights - View Expense Breakdown',
      is_active: null
    },
    {
      id: '6cf5356a-ceae-42ab-a9f5-1e3f1918280e',
      key: 'dash.view_loss',
      name: 'Dashboards & Insights - View Loss Dashboard',
      is_active: null
    },
    {
      id: 'df551b43-ae22-45f3-a91d-ccac2a5c7924',
      key: 'dash.view_revenue',
      name: 'Dashboards & Insights - View Revenue Dashboard',
      is_active: null
    }
  ],
  'Data Access & Management': [
    {
      id: 'cf9171fc-09c9-4916-8fd3-5614de0bb8b5',
      key: 'data.export_all',
      name: 'Data Access & Management - Export All Data',
      is_active: null
    },
    {
      id: '44dec614-cf33-408e-92c5-f9daad639c59',
      key: 'data.delete_permanent',
      name: 'Data Access & Management - Permanently Delete Data',
      is_active: null
    },
    {
      id: 'dc2d5fb0-6181-4f70-a2f9-8132572a38a3',
      key: 'data.upload_archive',
      name: 'Data Access & Management - Upload/Archive Documents',
      is_active: null
    }
  ],
  'Feedback & Support': [
    {
      id: 'f84d64ed-c93a-4574-81c4-6a055fd15fba',
      key: 'feedback.add',
      name: 'Feedback & Support - Add Feedback',
      is_active: null
    },
    {
      id: 'f19469eb-d20b-4064-916c-18bd5748d661',
      key: 'feedback.report_issue',
      name: 'Feedback & Support - Report technical issue',
      is_active: null
    },
    {
      id: '43443426-60e8-48b8-850f-0af2716c1fb2',
      key: 'feedback.ticket_view',
      name: 'Feedback & Support - Support ticket visibility',
      is_active: null
    },
    {
      id: '4b9a3d2d-ff52-470e-9c0f-746867af4761',
      key: 'feedback.view_all',
      name: 'Feedback & Support - View User Feedback',
      is_active: null
    }
  ],
  'Integrations & Finance': [
    {
      id: '75f3fec7-f818-4212-9579-e232ba911b36',
      key: 'integrations.raw_banking',
      name: 'Integrations & Finance - Access Raw Banking Data',
      is_active: null
    },
    {
      id: 'e4e2db3f-7206-4cc0-b68c-9849ee5c626e',
      key: 'integrations.manage',
      name: 'Integrations & Finance - Integrations with Aggregator/Quickbook/Xero',
      is_active: null
    }
  ],
  'Legal & Compliance': [
    {
      id: '2df29b27-9248-4bfd-a499-7b3c3b3b4851',
      key: 'legal.accept_revoke',
      name: 'Legal & Compliance - Accept/Revoke Legal Agreements',
      is_active: null
    }
  ],
  Payments: [
    {
      id: '538c83d7-4f90-4fd0-a42b-285a80af8c58',
      key: 'payments.notify_failed',
      name: 'Payments - Notifications for Failed Payments',
      is_active: null
    },
    {
      id: '028d9124-2637-4a98-a08b-40fad6de223e',
      key: 'payments.view_failed',
      name: 'Payments - Payment Failed',
      is_active: null
    },
    {
      id: 'ad47a2d9-0bd5-4546-bcfe-886560c2ec9e',
      key: 'payments.view_success',
      name: 'Payments - Payment Successful',
      is_active: null
    },
    {
      id: '879c25ee-154e-4e2c-bca9-e23cd188fd96',
      key: 'payments.retry_update',
      name: 'Payments - Retry Payment/Update Billing Method',
      is_active: null
    }
  ],
  'Practice Management': [
    {
      id: '5e3fb116-bb68-45ee-aa7d-77c1c145cdef',
      key: 'practice.add',
      name: 'Practice Management - Add Practice',
      is_active: null
    },
    {
      id: '5edafee5-3d11-4204-9e8f-55101b14ea2b',
      key: 'practice.archive_unarchive',
      name: 'Practice Management - Archive/Unarchive Practice',
      is_active: null
    },
    {
      id: '2a02841b-1838-47ce-a9c9-54b898930d2a',
      key: 'practice.switch',
      name: 'Practice Management - Switch Practice',
      is_active: null
    },
    {
      id: '9bdefdac-da75-4001-abb7-d97e620b34ee',
      key: 'practice.view',
      name: 'Practice Management - View Practice',
      is_active: null
    }
  ],
  'Subscriptions & Billing': [
    {
      id: '1d776c82-8406-4b15-9d1a-cefecc269e02',
      key: 'subs.manage_plan',
      name: 'Subscriptions & Billing - Manage Subscription Plan',
      is_active: null
    },
    {
      id: 'ba033a61-0ba9-4a90-af1a-cade35645b63',
      key: 'subs.receive_alerts',
      name: 'Subscriptions & Billing - Receive Subscription Alerts',
      is_active: null
    },
    {
      id: 'd3a61119-305a-4aea-863b-1a66c9d8782e',
      key: 'subs.view_invoices',
      name: 'Subscriptions & Billing - View Invoice & Payment History',
      is_active: null
    },
    {
      id: 'c76b40e9-8520-4836-891a-ef2cf4418336',
      key: 'subs.view_status',
      name: 'Subscriptions & Billing - View Subscription Status',
      is_active: null
    }
  ],
  'User & Account Management': [
    {
      id: '90145e85-6243-4dcb-b415-4e6d01aeaaca',
      key: 'user.deactivate',
      name: 'User & Account Management - Deactivate Account',
      is_active: null
    },
    {
      id: 'a39d146e-f747-4259-869d-8b2245a0eedb',
      key: 'user.edit_practice_profile',
      name: 'User & Account Management - Edit Practice Profile',
      is_active: null
    },
    {
      id: 'c2151acf-5343-49b7-83fe-da03e20a4382',
      key: 'user.enable_security',
      name: 'User & Account Management - Enable Account Security',
      is_active: null
    },
    {
      id: 'b0963542-14f7-4ffd-ab5b-ab4915bf1f18',
      key: 'user.manage_users_roles',
      name: 'User & Account Management - Manage Users & Roles',
      is_active: null
    },
    {
      id: '564fa839-2fba-438b-ad55-341a3513255f',
      key: 'user.update_profile',
      name: 'User & Account Management - Update Profile',
      is_active: null
    },
    {
      id: 'c349392f-e6d2-44f6-a989-7c17577d6dd8',
      key: 'user.settings',
      name: 'User & Account Management - User Settings',
      is_active: null
    }
  ]
}
