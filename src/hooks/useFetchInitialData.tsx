import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useFeatureFlagContext } from 'src/context/FeatureFlagProvider'
import { getUserRole } from 'src/utils/helper'
import { useActivePractice } from './useActivePractice'

export const useInitialData = (enabled: boolean) => {
  const { user } = useAuth0()
  const { activePracticeId } = useActivePractice()
  const { updateUserContext } = useFeatureFlagContext()

  return useQuery({
    queryKey: ['initialData', activePracticeId],
    queryFn: async ({ queryKey }) => {
      const [, practiceIdFromKey] = queryKey

      const { data } = await apiClient.get(
        endpoints.currentPractice(practiceIdFromKey ?? '')
      )
      const onboardingCompleted = data?.data?.onboarding_status === 'COMPLETED'
      updateUserContext({ onboardingCompleted })
      updateUserContext({ role: getUserRole(user) })

      return data?.data
    },
    staleTime: 1000 * 60,
    enabled
  })
}
