import PendingOnboardingBanner from 'src/components/dashboard/PendingOnboardingBanner'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'

const Dashboard = () => {
  const { isEnabled: onboardingCompleted } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )

  return <>{!onboardingCompleted && <PendingOnboardingBanner />}</>
}

export default Dashboard
