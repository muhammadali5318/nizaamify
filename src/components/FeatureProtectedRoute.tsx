import React from 'react'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { useFeatureFlagContext } from '../context/FeatureFlagProvider'
import { ModuleId } from '../types/feature-flags'

type FeatureProtectedRouteProps = {
  children: React.ReactNode
  moduleId: ModuleId
}

export function FeatureProtectedRoute({
  children,
  moduleId
}: FeatureProtectedRouteProps) {
  const { userContext } = useFeatureFlagContext()
  const { isModuleEnabled } = useFeatureFlags(userContext)

  if (!isModuleEnabled(moduleId)) {
    return
  }

  return <>{children}</>
}
