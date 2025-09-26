import PendingOnboardingBanner from 'src/components/dashboard/PendingOnboardingBanner'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import WelcomeCard from 'src/components/dashboard/WelcomeCard'
import { Stack } from '@mui/material'

const Dashboard = () => {
  const { isEnabled: onboardingCompleted } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )

  return (
    <Stack spacing={2}>
      {!onboardingCompleted && <PendingOnboardingBanner />}
      <WelcomeCard />
    </Stack>
  )
}

export default Dashboard
