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

export type PermissionsMap = Record<
  string,
  Array<{ name: string; key: string; is_active: boolean | null }>
>
type UserPermissionByName = { name: string; is_active: boolean }[]

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
  'help-support': 'Feedback & Support',
  expenses: 'expenses',
  'non-pandl': 'non PandL',
  'bank-integrator': ['Integrations & Finance', 'Integrations & finance']
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
  userPermissions: UserPermissionByName = []
): PermissionsMap {
  const userMap = new Map<string, boolean>(
    userPermissions.map((p) => [p.name, p.is_active])
  )

  const mergedEntries = Object.entries(allPermissions).map(
    ([moduleName, perms]) => {
      const updatedPerms = perms.map((p) => {
        const userValue = userMap.get(p.name)
        // if userValue is undefined -> permission not assigned -> false
        const isActive = typeof userValue === 'boolean' ? userValue : false
        return { ...p, is_active: isActive }
      })
      return [moduleName, updatedPerms] as const
    }
  )

  return Object.fromEntries(mergedEntries)
}
