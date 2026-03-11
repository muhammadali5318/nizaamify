import { useMemo } from 'react'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import qs from 'qs'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useAuth } from 'src/context/AuthProvider'

export type transactionsHistoryItem = {
  id: string
  amount?: number | string
  date?: string
  status?: string
  description?: string
  reference?: string
  [key: string]: any
}

export type transactionsHistoryParams = {
  page?: number
  pageSize?: number
  search?: string
  ordering?: string | null
  start_date?: string | null
  end_date?: string | null
  endpoint?: string
}

type ApiResponse = {
  status?: boolean
  message?: string
  data?: {
    results?: any[]
    count?: number
    [key: string]: any
  }
  error?: any
}

function buildParams(p: transactionsHistoryParams) {
  return {
    page: (p.page ?? 0) + 1,
    page_size: p.pageSize ?? 10,
    search: p.search ?? '',
    ordering: p.ordering ?? null,
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null
  }
}

export function useFetchTransactionsHistory(
  params: transactionsHistoryParams = {},
  options?: Omit<
    UseQueryOptions<{
      items: transactionsHistoryItem[]
      total: number
      rawData?: any
    }>,
    'queryKey' | 'queryFn'
  >
) {
  const { accessToken } = useAuth()
  const { activePracticeId } = useActivePractice()

  const mergedParams = {
    page: 0,
    pageSize: 10,
    search: '',
    ordering: null,
    start_date: null,
    end_date: null,
    ...params
  }

  const queryKey = useMemo(
    () => [
      'transactionHistoryListApi',
      {
        ...mergedParams
      }
    ],
    [mergedParams]
  )

  const queryFn = async (): Promise<{
    items: transactionsHistoryItem[]
    total: number
    rawData?: any
  }> => {
    const queryParams = buildParams(mergedParams)
    const { data } = await apiClient.get<ApiResponse>(
      endpoints.bankIntegrator.transactionsHistory(activePracticeId ?? ''),
      {
        params: queryParams,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'comma' })
      }
    )

    return data?.data
  }

  const sanitizedOptions = useMemo(() => {
    if (!options) return {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { queryKey: _qk, queryFn: _qf, ...rest } = options as any
    return rest as UseQueryOptions<{
      items: transactionsHistoryItem[]
      total: number
      rawData?: any
    }>
  }, [options])

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: !!accessToken,
    keepPreviousData: true,
    ...(sanitizedOptions as any)
  })

  return {
    ...query,
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    rawData: query.data?.rawData
  }
}

export default useFetchTransactionsHistory
