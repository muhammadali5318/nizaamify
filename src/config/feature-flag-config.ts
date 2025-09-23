import {
  FeatureFlagConfig,
  FeatureRule,
  ModuleConfig
} from '../types/feature-flags'

const rules: FeatureRule[] = [
  {
    id: 'onboarding-completed',
    description: 'Practice onboarding has been completed',
    evaluate: (context) => {
      return context.onboardingCompleted
    }
  }
]

const modules: ModuleConfig[] = [
  {
    id: 'dashboard',
    name: 'Dashboard'
  },
  {
    id: 'documents',
    name: 'Documents'
  },
  {
    id: 'reports',
    name: 'Reports',
    requiredRules: ['onboarding-completed']
  },
  {
    id: 'benchmarks',
    name: 'Benchmarks'
  },
  {
    id: 'team-management',
    name: 'Team Management'
  },
  {
    id: 'practice-settings',
    name: 'Practice Settings'
  },
  {
    id: 'billing',
    name: 'Billing'
  },
  {
    id: 'settings',
    name: 'Settings'
  },
  {
    id: 'help-support',
    name: 'Help & Support'
  }
]

export const featureFlagConfig: FeatureFlagConfig = {
  rules,
  modules
}
