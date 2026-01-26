import { useQuery } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import dayjs from 'dayjs'

type Params = {
  enabled: boolean
  startDate: string | null
  endDate: string | null
}

export const toApiDate = (date: string | null) =>
  date ? dayjs(date).format('YYYY-MM-DD') : null

export const useFetchExpenseBreakdown = ({
  enabled,
  startDate,
  endDate
}: Params) => {
  const { activePracticeId } = useActivePractice()

  const formattedStart = toApiDate(startDate)
  const formattedEnd = toApiDate(endDate)

  return useQuery({
    queryKey: ['allExpenseBreakDown', formattedStart, formattedEnd],
    queryFn: async () => {
      const { data } = await apiClient.get(
        endpoints.documents.expenseBreakdown(activePracticeId ?? ''),
        {
          params: {
            start_date: formattedStart,
            end_date: formattedEnd
          }
        }
      )

      return data?.data
    },
    enabled: enabled && !!formattedStart && !!formattedEnd,
    refetchOnMount: 'always',
    staleTime: 0
  })
}
