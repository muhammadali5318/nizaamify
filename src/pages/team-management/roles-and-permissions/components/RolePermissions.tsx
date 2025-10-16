// src/config/permissions.tsx
import React from 'react'
import PermissionsContainer from 'src/components/permission-container/PermissionsContainer'
import { usePracticeRolesAndPermissions } from '../hooks/usePracticeRolesAndPermissions'

export const PERMISSION_ICON_MAP: Record<string, string> = {
  'Dashboards & Insights': '/assets/roles-dashboard.svg',
  Benchmarking: '/assets/roles-bench-marking.svg',
  'Subscriptions & Billing': '/assets/roles-subscription.svg',
  Payments: '/assets/roles-payments.svg',
  'Data Access & Management': '/assets/roles-audiance.svg',
  'User & Account Management': '/assets/roles-settings.svg',
  'Legal & Compliance': '/assets/roles-audiance.svg',
  'Feedback & Support': '/assets/roles-question-mark.svg',
  'AI Assistant': '/assets/spark.svg',
  'Audit Logs': '/assets/roles-audiance.svg',
  'Integrations & Finance': '/assets/roles-payments.svg'
}

const DEFAULT_PERMISSION_ICON = '/assets/roles-audiance.svg'

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
