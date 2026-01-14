import { useQuery } from '@tanstack/react-query'
import { useHasPermission } from 'src/config/module-permissions'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useFetchAllInstitutionsData = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()
  const canViewAndEditTeamMembers = useHasPermission('integrations.manage')

  return useQuery({
    queryKey: ['listAllInstitutionsData', activePracticeId],
    queryFn: async () => {
      if (!canViewAndEditTeamMembers) return null
      const { data } = await apiClient.get(
        endpoints.bankIntegrator.list(activePracticeId ?? '')
      )

      return data?.data ?? null
    },
    enabled: enabled && !!activePracticeId && canViewAndEditTeamMembers
  })
}
