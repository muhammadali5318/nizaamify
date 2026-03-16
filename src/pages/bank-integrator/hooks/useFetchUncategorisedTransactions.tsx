// hooks/useFetchAuditLogsList.ts
import { useQuery } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

/* =======================
   Helpers
   ====================== */

export type uncategorisedTransationsParams = {
  page?: number
  page_size?: number
  ordering?: string
  sortOrder?: 'asc' | 'desc'
  start_date?: string | null
  end_date?: string | null
  is_paginated?: boolean
}

/* =======================
   Params Builder
   ====================== */

function buildUncategorisedTransationsParamsParams(
  p: Partial<uncategorisedTransationsParams>
): Record<string, any> {
  const params: Record<string, any> = {}

  // pagination (0-based → 1-based)
  if (p.page !== undefined) params.page = p.page + 1
  if (p.page_size !== undefined) params.page_size = p.page_size

  // ordering
  if (p.ordering) {
    params.ordering = p.sortOrder === 'desc' ? `-${p.ordering}` : p.ordering
  }

  if (p.is_paginated !== undefined) {
    params.is_paginated = p.is_paginated
  }

  return params
}

/* =======================
   Hook
   ====================== */

export const useFetchUncategorisedTransactions = (
  params: uncategorisedTransationsParams,
  options?: { enabled?: boolean }
) => {
  const cleanedParams = buildUncategorisedTransationsParamsParams(params)
  const { activePracticeId } = useActivePractice()
  return useQuery({
    queryKey: ['uncategorisedTransactions', cleanedParams],
    queryFn: async () => {
      const res = await apiClient.get(
        endpoints.bankIntegrator.uncategorisedTransactions(
          activePracticeId ?? ''
        ),
        {
          params: cleanedParams
        }
      )
      return res?.data?.data ?? res?.data
    },
    enabled: options?.enabled ?? true
  })
}
