import React from 'react'
import { Navigate } from 'react-router'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { useFeatureFlagContext } from '../context/FeatureFlagProvider'
import { ModuleId } from '../types/feature-flags'
import { paths } from '../paths'

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
    return <Navigate to={paths.dashboard} replace />
  }

  return <>{children}</>
}
