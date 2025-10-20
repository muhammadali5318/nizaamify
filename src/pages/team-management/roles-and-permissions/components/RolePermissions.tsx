// src/config/permissions.tsx
import React from 'react'
import PermissionsContainer from 'src/components/permission-container/PermissionsContainer'
import { usePracticeRolesAndPermissions } from '../hooks/usePracticeRolesAndPermissions'
import {
  PERMISSION_ICON_MAP,
  DEFAULT_PERMISSION_ICON
} from '../../team-management-config'

const RolePermissions: React.FC<{ roleName: string }> = ({ roleName }) => {
  const { data } = usePracticeRolesAndPermissions(true)
  const role = data?.find((r) => r.name === roleName)

  if (!role) return null

  const permissionGroups = Object.keys(role.permissions || {})

  return (
    <>
      {permissionGroups.map((groupKey, idx) => {
        const permissions =
          (role.permissions && role.permissions[groupKey]) || []

        const item = {
          path: PERMISSION_ICON_MAP[groupKey] || DEFAULT_PERMISSION_ICON,
          title: groupKey
        }

        return (
          <PermissionsContainer
            key={groupKey + '-' + idx}
            item={item}
            permissions={permissions}
          />
        )
      })}
    </>
  )
}

export default RolePermissions
