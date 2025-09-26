import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useFeatureFlagContext } from 'src/context/FeatureFlagProvider'
import { getUserRole } from 'src/utils/helper'

export const useInitialData = (enabled: boolean) => {
  const { user } = useAuth0()
  const orgUuid = getUserOrgUuid(user)
  const { updateUserContext } = useFeatureFlagContext()

  return useQuery({
    queryKey: ['initialData'],
    queryFn: async () => {
      const { data } = await apiClient.get(endpoints.currentPractice(orgUuid))
      const onboardingCompleted = data?.data?.onboarding_status === 'COMPLETED'
      updateUserContext({ onboardingCompleted })
      updateUserContext({ role: getUserRole(user) })

      return data?.data
    },
    staleTime: 1000 * 60,
    enabled
  })
}
