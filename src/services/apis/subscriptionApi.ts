import apiClient from '../api-client'

export const createCheckoutSession = async (
  practiceId: string,
  planType: string
) => {
  const res = await apiClient.post(
    `/subscription/v1/practices/${practiceId}/checkout-session/`,
    { plan_type: planType }
  )
  return res.data
}

export const switchPlan = async (practiceId: string, planType: string) => {
  const res = await apiClient.post(
    `/subscription/v1/practices/${practiceId}/switch-plan/`,
    { plan_type: planType }
  )
  return res.data
}
