import { useQuery } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from './useActivePractice'

export const useInitialData = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()

  return useQuery({
    queryKey: ['initialData', activePracticeId],
    queryFn: async ({ queryKey }) => {
      const [, practiceIdFromKey] = queryKey

      const { data } = await apiClient.get(
        endpoints.currentPractice(practiceIdFromKey!)
      )

      return data?.data
    },
    staleTime: 1000 * 60,
    enabled: enabled && Boolean(activePracticeId)
  })
}
