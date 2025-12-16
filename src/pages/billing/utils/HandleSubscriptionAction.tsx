import { createCheckoutSession } from '../../../services/apis/subscriptionApi'

export const handleSubscriptionAction = async ({
  practiceId,
  title
}: {
  practiceId: string
  title: string
}) => {
  let planType = title.toUpperCase()

  if (title === 'Professional Plan') {
    planType = 'PROFESSIONAL'
  }

  return await createCheckoutSession(practiceId, planType)
}
