import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { getUserId } from 'src/utils/helper'

export const useFetchUserWithActivePracticeData = (enabled: boolean) => {
  const { user } = useAuth0()

  return useQuery({
    queryKey: ['UserWithActivePracticeData', getUserId(user)],
    queryFn: async () => {
      const { data } = await apiClient.get(
        endpoints.userWithActivePractices(getUserId(user))
      )
      return data?.data
    },
    enabled
  })
}
