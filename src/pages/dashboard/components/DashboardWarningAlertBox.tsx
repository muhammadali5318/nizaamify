import PendingOnboardingBanner from 'src/components/dashboard/PendingOnboardingBanner'
import PendingOnboardingForManager from 'src/components/dashboard/PendingOnboardingForManager'
import PendingSubscription from 'src/components/dashboard/PendingSubscription'
import WarningAlertWrapper from 'src/components/dashboard/WarningAlertWrapper'
import { useActivePractice } from 'src/hooks/useActivePractice'
import useUserDetails from 'src/hooks/useUserDetails'

const DashboardWarningAlertBox = () => {
  const {
    isOnboardingCompleted,
    isActivePracticeSubscribed,
    isPracticeSubscribedAndOnboardingIsCompleted
  } = useActivePractice()
  const { isUserNominated, isUserOwnerOrDirector, isUserManager } =
    useUserDetails()

  if (isPracticeSubscribedAndOnboardingIsCompleted) {
    return
  }

  return (
    <WarningAlertWrapper>
      {!isOnboardingCompleted && isUserOwnerOrDirector && (
        <PendingOnboardingBanner />
      )}
      {!isOnboardingCompleted && isUserNominated && isUserManager && (
        <PendingOnboardingForManager />
      )}
      {!isActivePracticeSubscribed && isUserOwnerOrDirector && (
        <PendingSubscription />
      )}
    </WarningAlertWrapper>
  )
}

export default DashboardWarningAlertBox
