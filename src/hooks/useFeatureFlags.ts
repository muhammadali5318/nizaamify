import { useMemo } from 'react'
import { UserContext, ModulePermission, ModuleId } from '../types/feature-flags'
import { featureFlagConfig } from '../config/feature-flag-config'
import { FeatureFlagService } from '../services/FeatureFlagService'

export function useFeatureFlags(userContext: UserContext) {
  const modulePermissions = useMemo(() => {
    const permissions: ModulePermission[] = []

    featureFlagConfig.modules.forEach((moduleConfig) => {
      let isEnabled = true
      let disabledReason: string | undefined

      if (moduleConfig.isEnabled) {
        isEnabled = moduleConfig.isEnabled(userContext)
        if (!isEnabled) {
          disabledReason =
            moduleConfig.disabledMessage ||
            `Module ${moduleConfig.name} is not available`
        }
      }

      if (isEnabled && moduleConfig.requiredRules?.length) {
        for (const ruleId of moduleConfig.requiredRules) {
          const rule = FeatureFlagService.findRule(ruleId)

          if (rule && !FeatureFlagService.evaluateRule(ruleId, userContext)) {
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
  }, [userContext])

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
