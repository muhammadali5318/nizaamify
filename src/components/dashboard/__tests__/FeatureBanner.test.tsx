import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FeatureFlagProvider } from '../../../context/FeatureFlagProvider'
import FeatureBanner from '../FeatureBanner'

// Mock the feature flag config
vi.mock('../../../config/feature-flag-config', () => ({
  featureFlagConfig: {
    rules: [
      {
        id: 'test-rule',
        description: 'Test rule',
        evaluate: (context: any) => context.testFlag === true
      },
      {
        id: 'onboarding-completed',
        description: 'Onboarding completed',
        evaluate: (context: any) => context.onboardingCompleted === true
      }
    ],
    modules: []
  }
}))

describe('FeatureBanner', () => {
  const mockPrimaryAction = vi.fn()
  const mockSecondaryAction = vi.fn()

  const bannerConfigs = [
    {
      id: 'test-banner',
      title: 'Test Banner Title',
      message: 'Test banner message',
      requiredFeatureRule: 'test-rule',
      variant: 'warning' as const,
      primaryAction: {
        label: 'Primary Action',
        onClick: mockPrimaryAction
      },
      secondaryAction: {
        label: 'Secondary Action',
        onClick: mockSecondaryAction
      }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders banner when feature rule evaluates to true', () => {
    render(
      <FeatureFlagProvider initialContext={{ testFlag: true }}>
        <FeatureBanner banners={bannerConfigs} />
      </FeatureFlagProvider>
    )

    expect(screen.getByText('Test Banner Title')).toBeInTheDocument()
    expect(screen.getByText('Test banner message')).toBeInTheDocument()
    expect(screen.getByText('Primary Action')).toBeInTheDocument()
    expect(screen.getByText('Secondary Action')).toBeInTheDocument()
  })

  it('does not render banner when feature rule evaluates to false', () => {
    render(
      <FeatureFlagProvider initialContext={{ testFlag: false }}>
        <FeatureBanner banners={bannerConfigs} />
      </FeatureFlagProvider>
    )

    expect(screen.queryByText('Test Banner Title')).not.toBeInTheDocument()
  })

  it('renders banner with invertRule when rule is false', () => {
    const invertedBannerConfigs = [
      {
        ...bannerConfigs[0],
        requiredFeatureRule: 'onboarding-completed',
        invertRule: true,
        title: 'Onboarding Required'
      }
    ]

    render(
      <FeatureFlagProvider initialContext={{ onboardingCompleted: false }}>
        <FeatureBanner banners={invertedBannerConfigs} />
      </FeatureFlagProvider>
    )

    expect(screen.getByText('Onboarding Required')).toBeInTheDocument()
  })

  it('does not render banner with invertRule when rule is true', () => {
    const invertedBannerConfigs = [
      {
        ...bannerConfigs[0],
        requiredFeatureRule: 'onboarding-completed',
        invertRule: true
      }
    ]

    render(
      <FeatureFlagProvider initialContext={{ onboardingCompleted: true }}>
        <FeatureBanner banners={invertedBannerConfigs} />
      </FeatureFlagProvider>
    )

    expect(screen.queryByText('Test Banner Title')).not.toBeInTheDocument()
  })

  it('calls primary action when primary button is clicked', () => {
    render(
      <FeatureFlagProvider initialContext={{ testFlag: true }}>
        <FeatureBanner banners={bannerConfigs} />
      </FeatureFlagProvider>
    )

    fireEvent.click(screen.getByText('Primary Action'))
    expect(mockPrimaryAction).toHaveBeenCalledTimes(1)
  })

  it('calls secondary action when secondary button is clicked', () => {
    render(
      <FeatureFlagProvider initialContext={{ testFlag: true }}>
        <FeatureBanner banners={bannerConfigs} />
      </FeatureFlagProvider>
    )

    fireEvent.click(screen.getByText('Secondary Action'))
    expect(mockSecondaryAction).toHaveBeenCalledTimes(1)
  })

  it('renders banner without actions when no actions provided', () => {
    const bannerWithoutActions = [
      {
        id: 'simple-banner',
        title: 'Simple Banner',
        message: 'No actions here',
        requiredFeatureRule: 'test-rule',
        variant: 'info' as const
      }
    ]

    render(
      <FeatureFlagProvider initialContext={{ testFlag: true }}>
        <FeatureBanner banners={bannerWithoutActions} />
      </FeatureFlagProvider>
    )

    expect(screen.getByText('Simple Banner')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders first matching banner when multiple banners match', () => {
    const multipleBanners = [
      {
        id: 'first-banner',
        title: 'First Banner',
        message: 'First message',
        requiredFeatureRule: 'test-rule',
        variant: 'info' as const
      },
      {
        id: 'second-banner',
        title: 'Second Banner',
        message: 'Second message',
        requiredFeatureRule: 'test-rule',
        variant: 'warning' as const
      }
    ]

    render(
      <FeatureFlagProvider initialContext={{ testFlag: true }}>
        <FeatureBanner banners={multipleBanners} />
      </FeatureFlagProvider>
    )

    expect(screen.getByText('First Banner')).toBeInTheDocument()
    expect(screen.queryByText('Second Banner')).not.toBeInTheDocument()
  })
})
