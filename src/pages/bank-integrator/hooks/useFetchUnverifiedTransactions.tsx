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
  return {
    page: (p.page ?? 0) + 1, // backend expects 1-based page
    page_size: p.pageSize ?? 10,
    search: p.search ?? '',
    ordering: p.ordering ?? null,
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null
  }
}

export function useFetchUnverifiedTransations(
  params: UseUnverifiedTransactionsParams = {}, // default to empty object
  options?: Omit<
    UseQueryOptions<{
      items: UnverifiedTransactionItem[]
      total: number
      rawData?: any
    }>,
    'queryKey' | 'queryFn'
  >
) {
  const { activePracticeId, accountingBasis } = useActivePractice()

  // Merge defaults here too, so buildParams and queryKey get the same values
  const mergedParams = {
    page: 0,
    pageSize: 10,
    search: '',
    ordering: null,
    start_date: null,
    end_date: null,
    ...params
  }

  const endpoint = useMemo(() => {
    if (!activePracticeId) return ''

    return accountingBasis === 'CASH'
      ? endpoints.bankIntegrator.categorisedTransactions(activePracticeId)
      : endpoints.bankIntegrator.unverifiedTransations(activePracticeId)
  }, [activePracticeId, accountingBasis])

  const queryKey = useMemo(
    () => [
      'unverifiedTransactionsListApi',
      {
        ...mergedParams,
        endpoint
      }
    ],
    [mergedParams, endpoint]
  )

  const queryFn = async (): Promise<{
    items: UnverifiedTransactionItem[]
    total: number
    rawData?: any
  }> => {
    const queryParams = buildParams(mergedParams)
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
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    rawData: query.data?.rawData
  }
}

export default useFetchUnverifiedTransations
