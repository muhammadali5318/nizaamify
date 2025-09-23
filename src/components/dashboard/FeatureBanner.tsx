import { useFeatureFlagContext } from '../../context/FeatureFlagProvider'
import { featureFlagConfig } from '../../config/feature-flag-config'
import { Alert, AlertTitle, Button, Box } from '@mui/material'

type BannerConfig = {
  id: string
  title: string
  message: string
  primaryAction?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  requiredFeatureRule: string
  invertRule?: boolean
  variant?: 'info' | 'warning' | 'success' | 'error'
}

type FeatureBannerProps = {
  banners: BannerConfig[]
}

export function FeatureBanner({ banners }: FeatureBannerProps) {
  const { userContext } = useFeatureFlagContext()

  const getActiveBanner = (): BannerConfig | null => {
    for (const banner of banners) {
      const rule = featureFlagConfig.rules.find(
        (r) => r.id === banner.requiredFeatureRule
      )
      if (rule) {
        const ruleResult = rule.evaluate(userContext)
        const shouldShow = banner.invertRule ? !ruleResult : ruleResult
        if (shouldShow) {
          return banner
        }
      }
    }
    return null
  }

  const activeBanner = getActiveBanner()

  if (!activeBanner) {
    return null
  }

  const getMuiSeverity = (variant: string = 'info') => {
    const severityMap = {
      info: 'info',
      warning: 'warning',
      success: 'success',
      error: 'error'
    }
    return severityMap[variant as keyof typeof severityMap] || 'info'
  }

  return (
    <Box sx={{ margin: '16px 0' }}>
      <Alert
        severity={getMuiSeverity(activeBanner.variant) as any}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {activeBanner.secondaryAction && (
              <Button
                variant='outlined'
                size='small'
                onClick={activeBanner.secondaryAction.onClick}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {activeBanner.secondaryAction.label}
              </Button>
            )}
            {activeBanner.primaryAction && (
              <Button
                variant='contained'
                size='small'
                onClick={activeBanner.primaryAction.onClick}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {activeBanner.primaryAction.label}
              </Button>
            )}
          </Box>
        }
      >
        <AlertTitle>{activeBanner.title}</AlertTitle>
        {activeBanner.message && activeBanner.message}
      </Alert>
    </Box>
  )
}

export default FeatureBanner
