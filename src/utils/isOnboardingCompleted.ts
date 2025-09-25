// src/utils/isOnboardingCompleted.ts
import { FeatureFlagService } from 'src/services/FeatureFlagService'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { UserContext } from 'src/types/feature-flags'

export const isOnboardingCompleted = (userContext: UserContext) => {
  return FeatureFlagService.evaluateRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED,
    userContext
  )
}
