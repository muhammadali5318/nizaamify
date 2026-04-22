import { useMemo } from 'react'
import { UserContext, ModulePermission, ModuleId } from '../types/feature-flags'
import { featureFlagConfig } from '../config/feature-flag-config'
import { FeatureFlagService } from '../services/FeatureFlagService'
import { useSelector } from 'react-redux'
import { selectPermissionsByCategory } from 'src/store/slices/userDetailsInActivePracticeSlice'
import { useActivePractice } from './useActivePractice'
import { useUserDetailsInActivePractice } from './useUserDetailsInActivePractice'

export function useFeatureFlags(userContext: UserContext) {
  const permissionsByCategory = useSelector(selectPermissionsByCategory)
  const {
    isOnboardingCompleted,
    isActivePracticeSubscribed,
    hasActivePracticeType
  } = useActivePractice()
  const { userDetails } = useUserDetailsInActivePractice()
  const userRole = userDetails?.user_role
  const modulePermissions = useMemo(() => {
    const permissions: ModulePermission[] = []

    // Normalize permissionsByCategory so each permission item contains a 'key' property
    const permissionsMap = Object.keys(permissionsByCategory || {}).reduce(
      (acc, cat) => {
        acc[cat] = (permissionsByCategory[cat] || []).map((perm: any) =>
          perm && perm.key !== undefined
            ? perm
            : { ...(perm || {}), key: perm?.id ?? perm?.name ?? '' }
        )
        return acc
      },
      {} as Record<string, any[]>
    )

    featureFlagConfig.modules.forEach((moduleConfig) => {
      let isEnabled = true
      let disabledReason: string | undefined

      if (moduleConfig?.isEnabled) {
        try {
          // pass the normalized map to satisfy the expected shape
          isEnabled = moduleConfig?.isEnabled?.(
            permissionsMap as any,
            moduleConfig?.id
          )
        } catch (error) {
          console.error(
            `Error evaluating isEnabled for module ${moduleConfig.id}:`,
            error
          )

          isEnabled = false
        }

        if (!isEnabled) {
          disabledReason =
            moduleConfig.disabledMessage ||
            `Module ${moduleConfig.name} is not available`
        }
      }

      if (isEnabled && moduleConfig.requiredRules?.length) {
        const featureContext: UserContext = {
          onboardingCompleted: isOnboardingCompleted,
          subscriptionActive: isActivePracticeSubscribed,
          role: userRole,
          hasActivePracticeType: hasActivePracticeType
        }

        for (const ruleId of moduleConfig.requiredRules) {
          const rule = FeatureFlagService.findRule(ruleId)

          if (
            rule &&
            !FeatureFlagService.evaluateRule(ruleId, featureContext)
          ) {
            isEnabled = false
            disabledReason = moduleConfig.disabledMessage || rule.description
            break
          }
        }
      }

      permissions.push({
        moduleId: moduleConfig.id,
        isEnabled,
        disabledReason
      })
    })

    return permissions
  }, [
    userContext,
    permissionsByCategory,
    isOnboardingCompleted,
    isActivePracticeSubscribed
  ])

  const isModuleEnabled = (moduleId: ModuleId): boolean => {
    const permission = modulePermissions.find((p) => p.moduleId === moduleId)
    return permission?.isEnabled ?? true
  }

  const getDisabledReason = (moduleId: ModuleId): string | undefined => {
    const permission = modulePermissions.find((p) => p.moduleId === moduleId)
    return permission?.disabledReason
  }

  const getEnabledModules = (): ModuleId[] => {
    return modulePermissions.filter((p) => p.isEnabled).map((p) => p.moduleId)
  }

  const getDisabledModules = (): ModulePermission[] => {
    return modulePermissions.filter((p) => !p.isEnabled)
  }

  return {
    modulePermissions,
    isModuleEnabled,
    getDisabledReason,
    getEnabledModules,
    getDisabledModules
  }
}
