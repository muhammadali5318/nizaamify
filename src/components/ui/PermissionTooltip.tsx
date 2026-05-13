// Standard tooltip for grey-out permission gates per Phase B.2.
//
// Renders: "Requires permission: {key}. Contact your shop owner."
// Localized via the `common:permission_tooltip` i18n key with the
// permission name as an interpolation.

import { Tooltip } from '@mui/material'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PermissionKey } from 'src/lib/permissions'

interface PermissionTooltipProps {
  permission: PermissionKey
  children: ReactNode
}

export function PermissionTooltip({
  permission,
  children
}: PermissionTooltipProps) {
  const { t } = useTranslation('common')
  return (
    <Tooltip
      title={t('permission_tooltip', { permission })}
      arrow
      enterDelay={150}
    >
      {/* Tooltip needs a single child that can receive a ref; the span
          wrapper in PermissionGated provides one. When used standalone,
          callers should pass a single ref-bearing child. */}
      <span>{children}</span>
    </Tooltip>
  )
}
