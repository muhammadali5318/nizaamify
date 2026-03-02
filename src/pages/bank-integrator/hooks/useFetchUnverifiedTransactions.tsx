// src/hooks/useFetchUnverifiedTransations.ts
import { useMemo } from 'react'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import qs from 'qs'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'

export type UnverifiedTransactionItem = {
  id: string
  amount?: number | string
  date?: string
  status?: string
  description?: string
  reference?: string
  [key: string]: any
}

export type UseUnverifiedTransactionsParams = {
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

function buildParams(p: UseUnverifiedTransactionsParams) {
  const params: Record<string, any> = {}
  if (p.page !== undefined) params.page = p.page + 1 // backend expects 1-based page
  if (p.pageSize !== undefined) params.page_size = p.pageSize
  if (p.search) params.search = p.search
  if (p.ordering) params.ordering = p.ordering
  if (p.start_date) params.start_date = p.start_date
  if (p.end_date) params.end_date = p.end_date
  return params
}

export function useFetchUnverifiedTransations(
  params: UseUnverifiedTransactionsParams,
  options?: Omit<
    UseQueryOptions<{
      items: UnverifiedTransactionItem[]
      total: number
      rawData?: any
    }>,
    'queryKey' | 'queryFn'
  >
) {
  const { activePracticeId } = useActivePractice()
  const endpoint = endpoints.bankIntegrator.unverifiedTransations(
    activePracticeId ?? ''
  )

  const queryKey = useMemo(
    () => [
      'unverifiedTransactionsListApi',
      {
        page: params.page ?? 0,
        pageSize: params.pageSize ?? 10,
        search: params.search ?? '',
        ordering: params.ordering ?? null,
        start_date: params.start_date ?? null,
        end_date: params.end_date ?? null,
        endpoint
      }
    ],
    [
      params.page,
      params.pageSize,
      params.search,
      params.ordering,
      params.start_date,
      params.end_date,
      endpoint
    ]
  )

  const queryFn = async (): Promise<{
    items: UnverifiedTransactionItem[]
    total: number
    rawData?: any
  }> => {
    const queryParams = buildParams(params)
    const { data } = await apiClient.get<ApiResponse>(endpoint, {
      params: queryParams,
      paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'comma' })
    })

    return data?.data
  }

  const sanitizedOptions = useMemo(() => {
    if (!options) return {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { queryKey: _qk, queryFn: _qf, ...rest } = options as any
    return rest as UseQueryOptions<{
      items: UnverifiedTransactionItem[]
      total: number
      rawData?: any
    }>
  }, [options])

  const query = useQuery<{
    items: UnverifiedTransactionItem[]
    total: number
    rawData?: any
  }>({
    queryKey,
    queryFn,
    keepPreviousData: true,
    ...(sanitizedOptions as any)
  })

  return {
    ...query,
    items: (query.data?.items ?? []) as UnverifiedTransactionItem[],
    total: query.data?.total ?? 0,
    rawData: query.data?.rawData
  }
}

export default useFetchUnverifiedTransations
