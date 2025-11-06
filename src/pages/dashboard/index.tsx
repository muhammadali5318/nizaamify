import { Stack } from '@mui/material'
import PendingOnboardingBanner from 'src/components/dashboard/PendingOnboardingBanner'
import PendingOnboardingForManager from 'src/components/dashboard/PendingOnboardingForManager'
// import WelcomeCard from 'src/components/dashboard/WelcomeCard'
import MainDashboard from './sections/index'
import { useActivePractice } from 'src/hooks/useActivePractice'
import useUserDetails from 'src/hooks/useUserDetails'

const Dashboard = () => {
  const { isOnboardingCompleted } = useActivePractice()
  const { isUserNominated, isUserOwnerOrDirector, isUserManager } =
    useUserDetails()

  return (
    <Stack spacing={2} p={3}>
      {!isOnboardingCompleted && isUserOwnerOrDirector && (
        <PendingOnboardingBanner />
      )}
      {!isOnboardingCompleted && isUserNominated && isUserManager && (
        <PendingOnboardingForManager />
      )}
      <MainDashboard />
    </Stack>
  )
}

export default Dashboard
