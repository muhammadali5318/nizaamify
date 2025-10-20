import React from 'react'
import PermissionsContainer from 'src/components/permission-container/PermissionsContainer'
import {
  PERMISSION_ICON_MAP,
  DEFAULT_PERMISSION_ICON
} from '../../team-management-config'

type PermissionObject = {
  id: string
  name: string
  description?: string
  is_active: boolean
}

type MemberRoleAndPermissionsListProps = {
  data: any
  isEditing: boolean
  permissionGroups: string[]
  onPermissionChange: (groupKey: string, updated: PermissionObject[]) => void
}

const MemberRoleAndPermissionsList: React.FC<
  MemberRoleAndPermissionsListProps
> = ({ data, isEditing, permissionGroups, onPermissionChange }) => {
  return (
    <>
      {permissionGroups.map((groupKey, idx) => {
        const permissions: PermissionObject[] =
          data?.roles?.[0]?.permissions?.[groupKey] || []

        const item = {
          path: PERMISSION_ICON_MAP[groupKey] || DEFAULT_PERMISSION_ICON,
          title: groupKey
        }

        return (
          <PermissionsContainer
            key={`${groupKey}-${idx}`}
            item={item}
            permissions={permissions}
            isEditing={isEditing}
            // call parent on every toggle with the group's latest permissions array
            onChange={(updated) => onPermissionChange(groupKey, updated)}
          />
        )
      })}
    </>
  )
}

export default MemberRoleAndPermissionsList
