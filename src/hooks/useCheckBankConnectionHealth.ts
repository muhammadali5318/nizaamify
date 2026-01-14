import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHasPermission } from 'src/config/module-permissions'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useCheckBankConnectionHealth = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()
  const canViewAndEditTeamMembers = useHasPermission('integrations.manage')
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['checkBankConnectionHealth', activePracticeId],
    queryFn: async () => {
      if (!canViewAndEditTeamMembers) return null
      try {
        const { data } = await apiClient.get(
          endpoints.bankIntegrator.connectionHealth(activePracticeId ?? '')
        )
        return data?.data ?? null
      } catch (error: any) {
        queryClient.setQueryData(
          ['checkBankConnectionHealth', activePracticeId],
          null
        )

        if (error.response?.status === 404) {
          return null
        }

        throw error
      }
    },
    enabled: enabled && !!activePracticeId && canViewAndEditTeamMembers,
    refetchOnMount: 'always',
    staleTime: 0
  })
}
