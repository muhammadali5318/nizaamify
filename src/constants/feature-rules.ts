export const FEATURE_RULE_IDS = {
  ONBOARDING_COMPLETED: 'onboarding-completed'
} as const

export type FeatureRuleId =
  (typeof FEATURE_RULE_IDS)[keyof typeof FEATURE_RULE_IDS]
