// Renders permission-conditional content per the Phase B.2 hybrid rule:
//   - mode='hide'      → POS internals; renders nothing when missing perm
//   - mode='grey-out'  → CRUD/management; renders disabled children + tooltip
//
// The disabled state must be visually consistent with MUI's `disabled` prop.
// PermissionTooltip wraps the children when grey-out mode is active.

import type { ReactNode } from 'react'
import { type PermissionKey, usePermission } from 'src/lib/permissions'
import { PermissionTooltip } from './PermissionTooltip'

export type PermissionGateMode = 'hide' | 'grey-out'

interface PermissionGatedProps {
  permission: PermissionKey
  mode?: PermissionGateMode
  children: ReactNode
  /**
   * When the user lacks the permission AND mode is 'grey-out', pointer
   * events are blocked on the children and opacity is reduced. The
   * tooltip surfaces the standard "Requires permission: {key}" message.
   *
   * When mode is 'hide', returns null.
   */
}

export function PermissionGated({
  permission,
  mode = 'grey-out',
  children
}: PermissionGatedProps) {
  const allowed = usePermission(permission)

  if (allowed) return <>{children}</>
  if (mode === 'hide') return null

  // grey-out: wrap in tooltip + disabled visual
  return (
    <PermissionTooltip permission={permission}>
      <span
        aria-disabled='true'
        style={{
          display: 'inline-block',
          pointerEvents: 'none',
          opacity: 0.45,
          filter: 'grayscale(60%)',
          cursor: 'not-allowed'
        }}
      >
        {children}
      </span>
    </PermissionTooltip>
  )
}
