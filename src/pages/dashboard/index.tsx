import Placeholder from 'src/components/common/Placeholder'
import FeatureBanner from 'src/components/dashboard/FeatureBanner'

const Dashboard = () => {
  const bannerConfigs = [
    {
      id: 'onboarding-required',
      title:
        'Practice onboarding required to access Financial Insights, Benchmarking and Document Analysis.',
      message: '',
      requiredFeatureRule: 'onboarding-completed',
      invertRule: true, // Show banner when onboarding is NOT completed
      variant: 'warning' as const,
      secondaryAction: {
        label: 'Nominate manager',
        onClick: () => console.warn('Nominate manager clicked')
      },
      primaryAction: {
        label: 'Complete onboarding',
        onClick: () => console.warn('Complete onboarding clicked')
      }
    }
  ]

  return (
    <div>
      <FeatureBanner banners={bannerConfigs} />
      <Placeholder title='Dashboard' />
    </div>
  )
}

export default Dashboard
