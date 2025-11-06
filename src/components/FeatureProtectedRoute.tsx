import React from 'react'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { useFeatureFlagContext } from '../context/FeatureFlagProvider'
import { ModuleId } from '../types/feature-flags'
import { useSelector } from 'react-redux'
import { selectPermissionsByCategory } from 'src/store/slices/userDetailsInActivePracticeSlice'

type FeatureProtectedRouteProps = {
  children: React.ReactNode
  moduleId: ModuleId
}

export function FeatureProtectedRoute({
  children,
  moduleId
}: FeatureProtectedRouteProps) {
  const permissionsByCategory = useSelector(selectPermissionsByCategory)

  const { userContext } = useFeatureFlagContext()
  const { isModuleEnabled } = useFeatureFlags(
    userContext,
    permissionsByCategory
  )

  if (!isModuleEnabled(moduleId)) {
    return
  }

  return <>{children}</>
}
