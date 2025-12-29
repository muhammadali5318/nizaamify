import { PermissionsMap } from 'src/config/module-permissions'

export interface UserContext {
  onboardingCompleted?: boolean
  role?: string
  permissions?: unknown
  [key: string]: unknown
}

export type ModuleId =
  | 'dashboard'
  | 'documents'
  | 'reports'
  | 'benchmarks'
  | 'team-management'
  | 'practice-settings'
  | 'billing'
  | 'settings'
  | 'help-support'
  | 'nomination-flow'
  | 'bank-integrator'
  | 'expenses'
  | 'audit-logs'

export type FeatureRuleId = string

export type FeatureRule = {
  id: FeatureRuleId
  description: string
  evaluate: (context: UserContext | boolean) => boolean
}

export type ModuleConfig = {
  id: ModuleId
  name: string
  requiredRules?: FeatureRuleId[]
  disabledMessage?: string
  isEnabled?: (permissions: PermissionsMap, moduleId: string) => boolean
}

export type FeatureFlagConfig = {
  rules: FeatureRule[]
  modules: ModuleConfig[]
}

export type ModulePermission = {
  moduleId: ModuleId
  isEnabled: boolean
  disabledReason?: string
}
