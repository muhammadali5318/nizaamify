export type UserContext = {
  [key: string]: any
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

export type FeatureRule = {
  id: string
  description: string
  evaluate: (context: UserContext) => boolean
}

export type ModuleConfig = {
  id: ModuleId
  name: string
  requiredRules?: string[]
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
