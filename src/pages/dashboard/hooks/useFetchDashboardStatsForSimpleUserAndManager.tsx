import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import useUserDetails from 'src/hooks/useUserDetails'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useFetchDashboardStatsForSimpleUserAndManager = (
  enabled: boolean
) => {
  const { activePracticeId } = useActivePractice()
  const { isUserManageOrSimpleUser } = useUserDetails()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['dashboard-stats-for-manager-and-user', activePracticeId],
    queryFn: async () => {
      if (!isUserManageOrSimpleUser) return null
      try {
        const { data } = await apiClient.get(
          endpoints.dashboardStatsForManager(activePracticeId ?? '')
        )
        return data?.data ?? null
      } catch (error: any) {
        queryClient.setQueryData(
          ['dashboard-stats-for-manager-and-user', activePracticeId],
          null
        )

        if (error.response?.status === 404) {
          return null
        }

        throw error
      }
    },
    enabled: enabled && !!activePracticeId && isUserManageOrSimpleUser
  })
}
