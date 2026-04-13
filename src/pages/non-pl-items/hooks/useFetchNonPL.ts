import { useQuery } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

type Params = {
  enabled: boolean
  startDate: string | null
  endDate: string | null
}

export const useFetchNonPL = ({ enabled, startDate, endDate }: Params) => {
  const { activePracticeId } = useActivePractice()

  return useQuery({
    queryKey: ['useFetchNonPL', startDate, endDate],
    queryFn: async () => {
      const { data } = await apiClient.get(
        endpoints.documents.nonPLBreakDown(activePracticeId ?? ''),
        {
          params: {
            start_date: startDate,
            end_date: endDate
          }
        }
      )

      return data?.data
    },
    enabled: enabled && !!startDate && !!endDate,
    refetchOnMount: 'always',
    staleTime: 0
  })
}
