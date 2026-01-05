// hooks/useFetchAuditLogsList.ts
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

/* =======================
   Helpers
   ====================== */

const toCommaSeparated = (
  value?: string | string[] | null
): string | undefined => {
  if (!value) return undefined

  if (Array.isArray(value)) {
    const cleaned = value.map((v) => v.trim()).filter(Boolean)
    return cleaned.length ? cleaned.join(',') : undefined
  }

  return value.trim() || undefined
}

/* =======================
   Types
   ====================== */

export type AuditLogsParams = {
  page?: number
  page_size?: number
  search?: string

  actor_type?: string | string[] | { value: string }

  ordering?: string
  sortOrder?: 'asc' | 'desc'
  start_date?: string | null
  end_date?: string | null
  is_paginated?: boolean

  event_feature?: string | string[] | null
  event_type?: string | string[] | null

  // aliases from UI
  logsCategory?: string | string[] | null
  actionType?: string | string[] | null
}

/* =======================
   Params Builder
   ====================== */

function buildAuditLogsParams(
  p: Partial<AuditLogsParams>
): Record<string, any> {
  const params: Record<string, any> = {}

  // pagination (0-based → 1-based)
  if (p.page !== undefined) params.page = p.page + 1
  if (p.page_size !== undefined) params.page_size = p.page_size

  if (p.search?.trim()) params.search = p.search.trim()

  // actor_type (string | array | { value })
  if (p.actor_type) {
    if (typeof p.actor_type === 'string' || Array.isArray(p.actor_type)) {
      const value = toCommaSeparated(p.actor_type)
      if (value) params.actor_type = value
    } else if ((p.actor_type as any).value) {
      params.actor_type = String((p.actor_type as any).value)
    }
  }

  // ordering
  if (p.ordering) {
    params.ordering = p.sortOrder === 'desc' ? `-${p.ordering}` : p.ordering
  }

  // dates (DD-MM-YYYY)
  if (p.start_date && dayjs(p.start_date).isValid()) {
    params.start_date = dayjs(p.start_date).format('DD-MM-YYYY')
  }

  if (p.end_date && dayjs(p.end_date).isValid()) {
    params.end_date = dayjs(p.end_date).format('DD-MM-YYYY')
  }

  if (p.is_paginated !== undefined) {
    params.is_paginated = p.is_paginated
  }

  // event_feature (supports multi-select + alias)
  const feature = p.event_feature ?? p.logsCategory
  const featureValue = toCommaSeparated(feature)
  if (featureValue) params.event_feature = featureValue

  // event_type (supports multi-select + alias)
  const evtType = p.event_type ?? p.actionType
  const evtValue = toCommaSeparated(evtType)
  if (evtValue) params.event_type = evtValue

  return params
}

/* =======================
   Hook
   ====================== */

export const useFetchAuditLogsList = (
  params: AuditLogsParams,
  options?: { enabled?: boolean }
) => {
  const cleanedParams = buildAuditLogsParams(params)
  const { activePracticeId } = useActivePractice()
  return useQuery({
    queryKey: ['audit-logs-list', cleanedParams],
    queryFn: async () => {
      const res = await apiClient.get(
        endpoints.audit.appAuditLogs(activePracticeId ?? ''),
        {
          params: cleanedParams
        }
      )
      return res?.data?.data ?? res?.data
    },
    enabled: options?.enabled ?? true
  })
}
