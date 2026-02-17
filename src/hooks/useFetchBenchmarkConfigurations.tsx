import { useQuery } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from './useActivePractice'

type BenchmarkItem = {
  id: string
  practice_type: string
  [key: string]: any
}

type BenchmarkConfigurations = {
  all: BenchmarkItem[]
  byType: Record<string, BenchmarkItem[]>
}

export const useFetchBenchmarkConfigurations = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()

  return useQuery<BenchmarkItem[], Error, BenchmarkConfigurations>({
    queryKey: ['fetch-benchmark-configurations', activePracticeId],

    queryFn: async () => {
      const { data } = await apiClient.get(
        endpoints.documents.benchmarkConfiguration(activePracticeId ?? '')
      )

      return data?.data ?? []
    },

    select: (items) => {
      if (!Array.isArray(items)) {
        return {
          all: [],
          byType: {}
        }
      }

      const byType = items.reduce(
        (acc: Record<string, BenchmarkItem[]>, item) => {
          const type = item.practice_type

          if (!acc[type]) {
            acc[type] = []
          }

          acc[type].push(item)

          return acc
        },
        {}
      )

      return {
        all: items,
        byType
      }
    },

    enabled
  })
}
