import { useQuery } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useFetchLogsCategory = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()

  return useQuery({
    queryKey: ['fetch-logs-categories', activePracticeId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        endpoints.audit.appAuditLogsCategories(activePracticeId ?? '')
      )
      return data?.data ?? null
    },
    enabled: enabled && !!activePracticeId
  })
}
