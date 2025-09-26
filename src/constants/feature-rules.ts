export const FEATURE_RULE_IDS = {
  ONBOARDING_COMPLETED: 'onboarding-completed',
  NOT_MANAGER: 'not-manager' // 👈 new rule
} as const

export type FeatureRuleId =
  (typeof FEATURE_RULE_IDS)[keyof typeof FEATURE_RULE_IDS]
