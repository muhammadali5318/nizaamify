import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useFetchAIInsights = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()
  //   const canViewAndEditTeamMembers = useHasPermission('integrations.manage')
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['AIInsightsSummary', activePracticeId],
    queryFn: async () => {
      //   if (!canViewAndEditTeamMembers) return null
      try {
        const { data } = await apiClient.get(
          endpoints.documents.dashboardAiSummary(activePracticeId ?? '')
        )
        return data?.data ?? null
      } catch (error: any) {
        queryClient.setQueryData(['AIInsightsSummary', activePracticeId], null)

        if (error.response?.status === 404) {
          return null
        }

        throw error
      }
    },
    enabled: enabled && !!activePracticeId,
    refetchOnMount: 'always',
    staleTime: 0
  })
}
