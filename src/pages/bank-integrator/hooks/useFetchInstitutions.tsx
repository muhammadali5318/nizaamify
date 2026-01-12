import { useQuery } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useFetchAllInstitutionsData = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()

  return useQuery({
    queryKey: ['listAllInstitutionsData'],
    queryFn: async () => {
      const { data } = await apiClient.get(
        endpoints.bankIntegrator.list(activePracticeId ?? '')
      )

      return data?.data
    },
    enabled
  })
}
