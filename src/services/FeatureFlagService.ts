import { featureFlagConfig } from '../config/feature-flag-config'
import { UserContext, FeatureRule, FeatureRuleId } from '../types/feature-flags'

export class FeatureFlagService {
  private static evaluationCache = new Map<string, boolean>()
  private static cacheTimeout = 5000 // 5 seconds

  private static createCacheKey(
    ruleId: FeatureRuleId,
    context: UserContext
  ): string {
    // Sort context keys for consistent cache keys
    const sortedContext = Object.keys(context)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = context[key]
        return sorted
      }, {} as UserContext)

    return `${ruleId}:${JSON.stringify(sortedContext)}`
  }

  static evaluateRule(
    ruleId: FeatureRuleId,
    context: UserContext | boolean
  ): boolean {
    try {
      const rule = this.findRule(ruleId)
      if (!rule) {
        console.warn(`Feature rule '${ruleId}' not found. Defaulting to false.`)
        return false
      }

      const cacheKey = this.createCacheKey(ruleId, context)

      // Check cache first
      if (this.evaluationCache.has(cacheKey)) {
        return this.evaluationCache.get(cacheKey)!
      }

      const result = rule.evaluate(context)

      // Cache result
      this.evaluationCache.set(cacheKey, result)
      setTimeout(() => this.evaluationCache.delete(cacheKey), this.cacheTimeout)

      return result
    } catch (error) {
      console.error(`Error evaluating feature rule '${ruleId}':`, error)
      return false
    }
  }

  static findRule(ruleId: FeatureRuleId): FeatureRule | undefined {
    return featureFlagConfig.rules.find((rule) => rule.id === ruleId)
  }

  static validateRule(rule: FeatureRule): boolean {
    if (!rule.id || !rule.description || typeof rule.evaluate !== 'function') {
      return false
    }
    return true
  }

  static validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate rules
    featureFlagConfig.rules.forEach((rule) => {
      if (!this.validateRule(rule)) {
        errors.push(`Invalid rule configuration: ${rule.id}`)
      }
    })

    // Validate module references to rules
    featureFlagConfig.modules.forEach((module) => {
      if (module.requiredRules) {
        module.requiredRules.forEach((ruleId) => {
          if (!this.findRule(ruleId)) {
            errors.push(
              `Module '${module.id}' references non-existent rule: ${ruleId}`
            )
          }
        })
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  static clearCache(): void {
    this.evaluationCache.clear()
  }
}
