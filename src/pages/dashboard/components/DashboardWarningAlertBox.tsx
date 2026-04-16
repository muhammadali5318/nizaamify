import PendingOnboardingBanner from 'src/components/dashboard/PendingOnboardingBanner'
import PendingOnboardingForManager from 'src/components/dashboard/PendingOnboardingForManager'
import PendingSubscription from 'src/components/dashboard/PendingSubscription'
import WarningAlertWrapper from 'src/components/dashboard/WarningAlertWrapper'
import { useActivePractice } from 'src/hooks/useActivePractice'
// import { useCheckBankConnectionHealth } from 'src/hooks/useCheckBankConnectionHealth'
import useUserDetails from 'src/hooks/useUserDetails'
import { paths } from 'src/paths'

interface DashboardWarningAlertBoxProps {
  title: string
  renderDetail?: string
}

const DashboardWarningAlertBox = ({
  title
  // renderDetail
}: DashboardWarningAlertBoxProps) => {
  const {
    isOnboardingCompleted,
    // isActivePracticeSubscribed,
    isPracticeSubscribedAndOnboardingIsCompleted
  } = useActivePractice()
  const {
    isUserNominated,
    isUserOwnerOrDirector,
    isUserManager,
    isUserManageOrSimpleUser
  } = useUserDetails()
  // const shouldFetch = Boolean(accessToken) && isUserOwnerOrDirector === true
  const { hasActivePracticeType } = useActivePractice()

  if (!hasActivePracticeType) {
    return (
      <WarningAlertWrapper title={title}>
        <PendingSubscription
          message={
            <>
              Your practice type is currently not configured. Please update it
              in Practice Settings to unlock the full functionality of the
              application and gain access to all features.
            </>
          }
          actionLabel='View Details'
          actionPath={paths.settings}
        />
      </WarningAlertWrapper>
    )
  }
  if (isOnboardingCompleted) return null

  // if (renderDetail === 'bankAlert') {
  //   return (
  //     <WarningAlertWrapper title={title}>
  //       <PendingSubscription
  //         message={
  //           <>
  //             Renew your consent to continue accessing your bank data, or
  //             disconnect the bank if you no longer need this integration.
  //           </>
  //         }
  //         actionLabel='View Details'
  //         actionPath={
  //           paths.bankIntegrator +
  //           `?reconfirm-connection=true&institution-id=${data?.institution_id}`
  //         }
  //       />{' '}
  //     </WarningAlertWrapper>
  //   )
  // }

  const shouldRenderForCompletedOnboardnig =
    isUserManageOrSimpleUser && isOnboardingCompleted

  const shouldRenderWarning =
    !isPracticeSubscribedAndOnboardingIsCompleted &&
    (isUserOwnerOrDirector || isUserNominated)

  if (shouldRenderForCompletedOnboardnig) return null
  if (!shouldRenderWarning) return null

  return (
    <WarningAlertWrapper title={title}>
      {!isOnboardingCompleted && isUserOwnerOrDirector && (
        <PendingOnboardingBanner />
      )}
      {!isOnboardingCompleted && isUserNominated && isUserManager && (
        <PendingOnboardingForManager />
      )}
      {/* {!isActivePracticeSubscribed && isUserOwnerOrDirector && (
        <PendingSubscription
          message={
            <>
              You need to select a <strong>subscription plan</strong> to
              completely unlock the MonAI platform and access all features.
            </>
          }
          actionLabel='Choose plan'
          actionPath={paths.billing}
        />
      )} */}
    </WarningAlertWrapper>
  )
}

export default DashboardWarningAlertBox
