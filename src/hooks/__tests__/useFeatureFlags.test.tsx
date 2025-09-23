import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFeatureFlags } from '../useFeatureFlags'

// Mock the feature flag config
vi.mock('../../config/feature-flag-config', () => ({
  featureFlagConfig: {
    rules: [
      {
        id: 'premium-required',
        description: 'Premium subscription required',
        evaluate: (context: any) => context.subscriptionTier === 'premium'
      },
      {
        id: 'onboarding-completed',
        description: 'Onboarding completed',
        evaluate: (context: any) => context.onboardingCompleted === true
      }
    ],
    modules: [
      {
        id: 'dashboard',
        name: 'Dashboard'
      },
      {
        id: 'reports',
        name: 'Reports',
        requiredRules: ['onboarding-completed']
      },
      {
        id: 'premium-features',
        name: 'Premium Features',
        requiredRules: ['premium-required'],
        disabledMessage: 'Upgrade to premium to access this feature'
      },
      {
        id: 'admin-panel',
        name: 'Admin Panel',
        isEnabled: (context: any) => context.userRole === 'admin'
      }
    ]
  }
}))

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('module permissions', () => {
    it('enables module with no requirements', () => {
      const { result } = renderHook(() =>
        useFeatureFlags({ subscriptionTier: 'basic' })
      )

      expect(result.current.isModuleEnabled('dashboard')).toBe(true)
      expect(result.current.getDisabledReason('dashboard')).toBeUndefined()
    })

    it('enables module when required rules are met', () => {
      const { result } = renderHook(() =>
        useFeatureFlags({ onboardingCompleted: true })
      )

      expect(result.current.isModuleEnabled('reports')).toBe(true)
      expect(result.current.getDisabledReason('reports')).toBeUndefined()
    })

    it('disables module when required rules are not met', () => {
      const { result } = renderHook(() =>
        useFeatureFlags({ onboardingCompleted: false })
      )

      expect(result.current.isModuleEnabled('reports')).toBe(false)
      expect(result.current.getDisabledReason('reports')).toBe(
        'Onboarding completed'
      )
    })
  })

  describe('helper functions', () => {
    it('returns enabled modules correctly', () => {
      const { result } = renderHook(() =>
        useFeatureFlags({
          onboardingCompleted: true,
          subscriptionTier: 'premium',
          userRole: 'admin'
        })
      )

      const enabledModules = result.current.getEnabledModules()
      expect(enabledModules).toContain('dashboard')
      expect(enabledModules).toContain('reports')
      expect(enabledModules).toContain('premium-features')
      expect(enabledModules).toContain('admin-panel')
    })

    it('returns disabled modules correctly', () => {
      const { result } = renderHook(() =>
        useFeatureFlags({
          onboardingCompleted: false,
          subscriptionTier: 'basic',
          userRole: 'user'
        })
      )

      const disabledModules = result.current.getDisabledModules()
      const disabledModuleIds = disabledModules.map((m) => m.moduleId)

      expect(disabledModuleIds).toContain('reports')
      expect(disabledModuleIds).toContain('premium-features')
      expect(disabledModuleIds).toContain('admin-panel')
      expect(disabledModuleIds).not.toContain('dashboard')
    })

    it('handles unknown module gracefully', () => {
      const { result } = renderHook(() =>
        useFeatureFlags({ subscriptionTier: 'basic' })
      )

      expect(result.current.isModuleEnabled('unknown-module' as any)).toBe(true)
      expect(
        result.current.getDisabledReason('unknown-module' as any)
      ).toBeUndefined()
    })
  })

  describe('context updates', () => {
    it('updates permissions when context changes', () => {
      let context = { onboardingCompleted: false }
      const { result, rerender } = renderHook(() => useFeatureFlags(context))

      // Initially disabled
      expect(result.current.isModuleEnabled('reports')).toBe(false)

      // Update context
      context = { onboardingCompleted: true }
      rerender()

      // Now enabled
      expect(result.current.isModuleEnabled('reports')).toBe(true)
    })
  })
})
