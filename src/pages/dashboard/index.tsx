import PendingOnboardingBanner from 'src/components/dashboard/PendingOnboardingBanner'
import { useFeatureFlagContext } from 'src/context/FeatureFlagProvider'
import { isOnboardingCompleted } from 'src/utils/isOnboardingCompleted'

const Dashboard = () => {
  const { userContext } = useFeatureFlagContext()

  const completed = isOnboardingCompleted(userContext)

  return <>{!completed && <PendingOnboardingBanner />}</>
}

export default Dashboard
