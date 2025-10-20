// src/pages/MemberRolesAndPermission/utils/permissionsUtils.ts
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { notify } from 'src/components/notistack/NotificationProvider'
import { PermissionObject } from './hook/useMemberRolesAndPermissions'

export type PermissionChangedMinimal = {
  id: string
  is_active: boolean
}

/**
 * Compare updatedPermissions with original permissions
 * and return only changed ones.
 */
export const buildChangedList = (
  updatedPermissions: Record<string, PermissionObject[]>,
  rolePermissions: Record<string, PermissionObject[]>
): PermissionChangedMinimal[] => {
  const changed: PermissionChangedMinimal[] = []

  for (const [groupKey, updatedList] of Object.entries(updatedPermissions)) {
    const originalList: PermissionObject[] = rolePermissions[groupKey] || []
    const originalMap = new Map(originalList.map((p) => [p.id, p]))

    for (const updatedPerm of updatedList) {
      const originalPerm = originalMap.get(updatedPerm.id)
      if (!originalPerm || originalPerm.is_active !== updatedPerm.is_active) {
        changed.push({ id: updatedPerm.id, is_active: updatedPerm.is_active })
      }
    }
  }

  return changed
}

/**
 * Check if any permission has changed from the original.
 */
export const hasPermissionChanges = (
  updatedPermissions: Record<string, PermissionObject[]>,
  rolePermissions: Record<string, PermissionObject[]>
): boolean => {
  if (!updatedPermissions || Object.keys(updatedPermissions).length === 0)
    return false

  for (const [groupKey, updatedList] of Object.entries(updatedPermissions)) {
    const originalList: PermissionObject[] = rolePermissions[groupKey] || []
    const originalMap = new Map(originalList.map((p) => [p.id, p]))

    for (const updatedPerm of updatedList) {
      const originalPerm = originalMap.get(updatedPerm.id)
      if (!originalPerm || originalPerm.is_active !== updatedPerm.is_active) {
        return true
      }
    }
  }

  return false
}

/**
 * Call API to update user permissions.
 */
export const updateUserPermission = async (
  orgUuid: string | null,
  userId: string | undefined,
  roleId: string | undefined,
  changed: PermissionChangedMinimal[],
  refetch: () => Promise<unknown>
): Promise<void> => {
  if (!orgUuid || !userId) {
    notify.error('Missing organisation or user id')
    return
  }

  if (!roleId) {
    notify.error('Missing role id to update')
    return
  }

  try {
    await apiClient.put(endpoints.getUserRolesAndPermission(orgUuid, userId), {
      functional_role_id: roleId,
      user_functional_role_permissions: changed
    })

    notify.success('Roles & permissions updated successfully')
    await refetch()
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const apiError = err as { error?: string[] }
      const errMsg = apiError.error?.[0]
      if (errMsg) {
        notify.error(errMsg)
        return
      }
    }

    notify.error('Something went wrong. Please try again later.')
    console.error(err)
  }
}

export const specificMembersBreadCrumbs = [
  { label: 'Team management', to: '/team-management' },
  { label: 'Team members', to: '/team-management' },
  { label: 'View user' }
]
