import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useFetchAIInsights = (
  enabled: boolean,
  month?: number | null,
  year?: number,
  granularity?: string
) => {
  const { activePracticeId } = useActivePractice()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['AIInsightsSummary', activePracticeId, month, year, granularity],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(
          endpoints.documents.dashboardAiSummary(activePracticeId ?? ''),
          {
            params: { month, year, granularity }
          }
        )

        return data?.data ?? null
      } catch (error: any) {
        queryClient.setQueryData(
          ['AIInsightsSummary', activePracticeId, month, year, granularity],
          null
        )

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
