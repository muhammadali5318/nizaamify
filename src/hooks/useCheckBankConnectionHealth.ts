import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useCheckBankConnectionHealth = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['checkBankConnectionHealth', activePracticeId],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(
          endpoints.bankIntegrator.connectionHealth(activePracticeId ?? '')
        )
        return data?.data ?? null
      } catch (error: any) {
        // If API fails, remove cached old data
        queryClient.setQueryData(
          ['checkBankConnectionHealth', activePracticeId],
          null
        )

        // If 404, return null instead of throwing error
        if (error.response?.status === 404) {
          return null
        }

        // Otherwise, propagate error
        throw error
      }
    },
    enabled: enabled && !!activePracticeId,
    refetchOnMount: 'always',
    staleTime: 0
  })
}
