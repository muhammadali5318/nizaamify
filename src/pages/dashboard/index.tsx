import PendingOnboardingBanner from 'src/components/dashboard/PendingOnboardingBanner'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import WelcomeCard from 'src/components/dashboard/WelcomeCard'
import { Stack } from '@mui/material'
import { useAuth } from 'src/context/AuthProvider'
import { useFetchUserWithActivePracticeData } from 'src/hooks/useFetchUserWithActivePracticeData'
import { isPracticeOwner } from 'src/utils/helper'
import { useAuth0 } from '@auth0/auth0-react'
import PendingOnboardingForManager from 'src/components/dashboard/PendingOnboardingForManager'
// import { useInitialData } from 'src/hooks/useFetchInitialData'

const Dashboard = () => {
  const { isEnabled: onboardingCompleted } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )
  const { accessToken } = useAuth()
  const { user } = useAuth0()
  const { data: userData } = useFetchUserWithActivePracticeData(!!accessToken)
  // const { data: pd } = useInitialData(!!accessToken)
  const pendingOnboardinByNominatedManager =
    !onboardingCompleted &&
    userData?.active_practices[0].is_nominated &&
    userData?.active_practices[0].user_role.toLowerCase().includes('manager')

  return (
    <Stack spacing={2}>
      {!onboardingCompleted && isPracticeOwner(user) && (
        <PendingOnboardingBanner />
      )}
      {pendingOnboardinByNominatedManager && <PendingOnboardingForManager />}
      <WelcomeCard />
    </Stack>
  )
}

export default Dashboard
