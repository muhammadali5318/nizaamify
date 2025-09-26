import {
  FeatureFlagConfig,
  FeatureRule,
  ModuleConfig
} from '../types/feature-flags'
import { FEATURE_RULE_IDS } from '../constants/feature-rules'

const rules: FeatureRule[] = [
  {
    id: FEATURE_RULE_IDS.ONBOARDING_COMPLETED,
    description: 'Practice onboarding has been completed',
    evaluate: (context) => {
      return context.onboardingCompleted === true
    }
  },
  {
    id: FEATURE_RULE_IDS.NOT_MANAGER,
    description: 'Managers cannot access restricted modules',
    evaluate: (context) => context.role !== 'manager' // 👈 expects `role` in UserContext
  }
]

const modules: ModuleConfig[] = [
  {
    id: 'dashboard',
    name: 'Dashboard'
  },
  {
    id: 'documents',
    name: 'Documents',
    requiredRules: [FEATURE_RULE_IDS.ONBOARDING_COMPLETED]
  },
  {
    id: 'reports',
    name: 'Reports',
    requiredRules: [
      FEATURE_RULE_IDS.ONBOARDING_COMPLETED,
      FEATURE_RULE_IDS.NOT_MANAGER
    ]
  },
  {
    id: 'benchmarks',
    name: 'Benchmarks',
    requiredRules: [FEATURE_RULE_IDS.ONBOARDING_COMPLETED]
  },
  {
    id: 'team-management',
    name: 'Team Management',
    requiredRules: [FEATURE_RULE_IDS.NOT_MANAGER]
  },
  {
    id: 'practice-settings',
    name: 'Practice Settings',
    requiredRules: [
      FEATURE_RULE_IDS.ONBOARDING_COMPLETED,
      FEATURE_RULE_IDS.NOT_MANAGER
    ]
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
