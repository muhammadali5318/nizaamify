import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'

export const useInitialData = (enabled: boolean) => {
  const { user } = useAuth0()
  const orgUuid = getUserOrgUuid(user)

  return useQuery({
    queryKey: ['initialData'],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `user-workstation/v1/practices/${orgUuid}/`
      )
      return data?.data
    },
    staleTime: 1000 * 60,
    enabled
  })
}
