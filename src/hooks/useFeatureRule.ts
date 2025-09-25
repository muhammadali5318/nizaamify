import { useMemo } from 'react'
import { useFeatureFlagContext } from '../context/FeatureFlagProvider'
import { FeatureFlagService } from '../services/FeatureFlagService'
import { FeatureRuleId } from '../types/feature-flags'

export interface UseFeatureRuleResult {
  isEnabled: boolean
  loading: boolean
  error?: string
}

export function useFeatureRule(ruleId: FeatureRuleId): UseFeatureRuleResult {
  const { userContext } = useFeatureFlagContext()

  const result = useMemo(() => {
    try {
      const isEnabled = FeatureFlagService.evaluateRule(ruleId, userContext)
      return {
        isEnabled,
        loading: false
      }
    } catch (error) {
      return {
        isEnabled: false,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error evaluating feature rule'
      }
    }
  }, [ruleId, userContext])

  return result
}
