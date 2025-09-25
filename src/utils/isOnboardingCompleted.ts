// src/utils/isOnboardingCompleted.ts
import { featureFlagConfig } from 'src/config/feature-flag-config'

export const isOnboardingCompleted = (userContext) => {
  const onboardingRule = featureFlagConfig.rules.find(
    (r) => r.id === 'onboarding-completed'
  )

  return onboardingRule ? onboardingRule.evaluate(userContext) : false
}
