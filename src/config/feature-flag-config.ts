import {
  FeatureFlagConfig,
  FeatureRule,
  ModuleConfig
} from '../types/feature-flags'
import { FEATURE_RULE_IDS } from '../constants/feature-rules'
import { evaluateIsModuleEnabled } from './module-permissions'

// ---------- RULES ----------
const rules: FeatureRule[] = [
  {
    id: FEATURE_RULE_IDS.ONBOARDING_COMPLETED,
    description: 'Practice onboarding has been completed',
    evaluate: (context) => !!context
  }
]

// ---------- MODULES CONFIG ----------
const modules: ModuleConfig[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    isEnabled: evaluateIsModuleEnabled
  },
  {
    id: 'documents',
    name: 'Documents',
    isEnabled: evaluateIsModuleEnabled,
    requiredRules: [FEATURE_RULE_IDS.ONBOARDING_COMPLETED]
  },
  {
    id: 'reports',
    name: 'Reports',
    isEnabled: evaluateIsModuleEnabled,
    requiredRules: [FEATURE_RULE_IDS.ONBOARDING_COMPLETED]
  },
  {
    id: 'benchmarks',
    name: 'Benchmarks',
    isEnabled: evaluateIsModuleEnabled,
    requiredRules: [FEATURE_RULE_IDS.ONBOARDING_COMPLETED]
  },
  {
    id: 'team-management',
    name: 'Team Management',
    isEnabled: evaluateIsModuleEnabled
  },
  {
    id: 'practice-settings',
    name: 'Practice Settings',
    isEnabled: evaluateIsModuleEnabled
  },
  {
    id: 'billing',
    name: 'Billing',
    isEnabled: evaluateIsModuleEnabled
  },
  {
    id: 'settings',
    name: 'Settings',
    isEnabled: evaluateIsModuleEnabled
  },
  {
    id: 'help-support',
    name: 'Help & Support',
    isEnabled: evaluateIsModuleEnabled
  },
  {
    id: 'nomination-flow',
    name: 'nomination flow'
  },
  {
    id: 'non-pandl',
    name: 'non PandL'
  },
  {
    id: 'monai-agent',
    name: 'monai agent'
  }
]

export const featureFlagConfig: FeatureFlagConfig = {
  rules,
  modules
}
