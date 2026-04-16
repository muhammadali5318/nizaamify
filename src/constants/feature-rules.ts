export const FEATURE_RULE_IDS = {
  ONBOARDING_COMPLETED: 'onboarding-completed',
  HAS_ACTIVE_PRACTICE_TYPE: 'HAS_ACTIVE_PRACTICE_TYPE',
  SUBSCRIPTION_ACTIVE: 'subscription-active',
  IS_OWNER_OR_DIRECTOR: 'is-owner-or-director'
} as const

export type FeatureRuleId =
  (typeof FEATURE_RULE_IDS)[keyof typeof FEATURE_RULE_IDS]
