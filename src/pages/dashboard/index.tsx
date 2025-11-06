import { CircularProgress, Box, Stack } from '@mui/material'
import { useAuth } from 'src/context/AuthProvider'
import { useAuth0 } from '@auth0/auth0-react'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { useFetchUserWithActivePracticeData } from 'src/hooks/useFetchUserWithActivePracticeData'
import { isPracticeOwner } from 'src/utils/helper'
import PendingOnboardingBanner from 'src/components/dashboard/PendingOnboardingBanner'
import PendingOnboardingForManager from 'src/components/dashboard/PendingOnboardingForManager'
// import WelcomeCard from 'src/components/dashboard/WelcomeCard'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import MainDashboard from './sections/index'

const Dashboard = () => {
  const { accessToken } = useAuth()
  const { user } = useAuth0()

  const { isLoading: initLoading } = useInitialData(!!accessToken)

  const { isEnabled: onboardingCompleted } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )

  const { data: userData, isLoading: userLoading } =
    useFetchUserWithActivePracticeData(!!accessToken)

  if (initLoading || userLoading) {
    return (
      <Box
        display='flex'
        alignItems='center'
        justifyContent='center'
        minHeight='60vh'
      >
        <CircularProgress />
      </Box>
    )
  }

  const pendingOnboardinByNominatedManager =
    !onboardingCompleted &&
    userData?.active_practices[0].is_nominated &&
    userData?.active_practices[0].user_role.toLowerCase().includes('manager')

  return (
    <Stack spacing={2} p={3}>
      {!onboardingCompleted && isPracticeOwner(user) && (
        <PendingOnboardingBanner />
      )}
      {pendingOnboardinByNominatedManager && <PendingOnboardingForManager />}
      <MainDashboard />
    </Stack>
  )
}

export default Dashboard
