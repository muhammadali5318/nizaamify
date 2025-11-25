// src/utils/handleSubscriptionAction.ts
import {
  createCheckoutSession,
  switchPlan
} from '../../../services/apis/subscriptionApi'

export const handleSubscriptionAction = async ({
  buttonLabel,
  practiceId,
  title
}: {
  buttonLabel: string
  practiceId: string
  title: string
}) => {
  let planType = title.toUpperCase()
  if (title === 'Professional Plan') {
    planType = 'PROFESSIONAL'
  }
  if (
    buttonLabel === 'Subscribe' ||
    buttonLabel === 'Subscribe to professional plan'
  ) {
    return await createCheckoutSession(practiceId, planType)
  }

  if (buttonLabel === 'Upgrade to professional plan') {
    return await switchPlan(practiceId, planType)
  }

  throw new Error('Unknown button action')
}
