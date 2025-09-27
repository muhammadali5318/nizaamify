export interface UserContext {
  onboardingCompleted?: boolean
  role?: string
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

export type FeatureRuleId = string

export type FeatureRule = {
  id: FeatureRuleId
  description: string
  evaluate: (context: UserContext) => boolean
}

export type ModuleConfig = {
  id: ModuleId
  name: string
  requiredRules?: FeatureRuleId[]
  disabledMessage?: string
  isEnabled?: (context: UserContext) => boolean
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
