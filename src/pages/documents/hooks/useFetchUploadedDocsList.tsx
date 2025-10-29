import { useMemo } from 'react'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import qs from 'qs'
import { endpoints } from 'src/services/backendUrl'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useAuth0 } from '@auth0/auth0-react'
import dayjs from 'dayjs'

export type UploadedDocItem = {
  id: string
  file_name?: string
  document_type?: string | null
  document_subtype?: string | null
  upload_timestamp?: string
  status?: string
  user_name?: string
  requires_review?: boolean
  file_size?: number
  [key: string]: any
}

export type UseUploadedDocsParams = {
  page?: number
  pageSize?: number
  search?: string
  /** maps to BE param: document_category */
  document_category?: string[]
  /** maps to BE param: document_type */
  document_type?: string[]
  /** maps to BE param: document_subtype */
  document_subtype?: string[]
  /** maps to BE param: user_name */
  user_name?: string[]
  dateRange?:
    | [string | undefined | null, string | undefined | null]
    | { from?: string | null; to?: string | null }
    | null
  ordering?: string | null
  sortOrder?: 'asc' | 'desc' | null
  endpoint?: string
  requires_review?: boolean
}

type ApiResponse = {
  status?: boolean
  message?: string
  data?: {
    documents?: {
      count?: number
      results?: UploadedDocItem[]
    }
  }
  error?: any
}

function buildParams(p: UseUploadedDocsParams) {
  const params: Record<string, any> = {}

  if (p.page !== undefined) params.page = p.page + 1
  if (p.pageSize !== undefined) params.page_size = p.pageSize
  if (p.search) params.search = p.search

  if (p.document_category?.length)
    params.document_category = p.document_category
  if (p.document_type?.length) params.document_type = p.document_type
  if (p.document_subtype?.length) params.document_subtype = p.document_subtype
  if (p.user_name?.length) params.user_name = p.user_name

  if (p.dateRange) {
    let from: string | undefined | null
    let to: string | undefined | null

    if (Array.isArray(p.dateRange)) {
      ;[from, to] = p.dateRange
    } else if (typeof p.dateRange === 'object' && p.dateRange !== null) {
      from = p.dateRange.from ?? (p.dateRange as any).start ?? null
      to = p.dateRange.to ?? (p.dateRange as any).end ?? null
    }

    // Format to YYYY-MM-DD and use backend param names requested
    if (from) params.upload_timestamp_after = dayjs(from).format('YYYY-MM-DD')
    if (to) params.upload_timestamp_before = dayjs(to).format('YYYY-MM-DD')
  }

  if (p.ordering) {
    params.ordering = p.sortOrder === 'desc' ? `-${p.ordering}` : p.ordering
  }

  if (p.requires_review === true) {
    params.requires_review = true
  }

  return params
}

export function useFetchUploadedDocsList(
  params: UseUploadedDocsParams,
  options?: UseQueryOptions<{ items: UploadedDocItem[]; total: number }>
) {
  const { user } = useAuth0()
  const endpoint =
    params.endpoint ?? endpoints.uploadedDocumentList(getUserOrgUuid(user))

  // update queryKey to include date strings so caching behaves correctly:
  const queryKey = useMemo(() => {
    let dateFrom = ''
    let dateTo = ''
    if (params.dateRange) {
      if (Array.isArray(params.dateRange)) {
        dateFrom = params.dateRange[0] ?? ''
        dateTo = params.dateRange[1] ?? ''
      } else if (
        typeof params.dateRange === 'object' &&
        params.dateRange !== null
      ) {
        dateFrom =
          (params.dateRange as any).from ??
          (params.dateRange as any).start ??
          ''
        dateTo =
          (params.dateRange as any).to ?? (params.dateRange as any).end ?? ''
      }
    }

    return [
      'uploadedDocumentListApi',
      {
        page: params.page ?? 0,
        pageSize: params.pageSize ?? 10,
        search: params.search ?? '',
        document_category: (params.document_category ?? []).join(','),
        document_type: (params.document_type ?? []).join(','),
        document_subtype: (params.document_subtype ?? []).join(','),
        user_name: (params.user_name ?? []).join(','),
        upload_timestamp_after: dateFrom,
        upload_timestamp_before: dateTo,
        ordering: params.ordering ?? null,
        sortOrder: params.sortOrder ?? null,
        endpoint,
        requires_review: params.requires_review ?? false
      }
    ]
  }, [
    params.page,
    params.pageSize,
    params.search,
    (params.document_category ?? []).join(','),
    (params.document_type ?? []).join(','),
    (params.document_subtype ?? []).join(','),
    (params.user_name ?? []).join(','),
    params.dateRange
      ? Array.isArray(params.dateRange)
        ? params.dateRange.join(',')
        : `${(params.dateRange as any).from ?? ''},${(params.dateRange as any).to ?? ''}`
      : '',
    params.ordering,
    params.sortOrder,
    endpoint,
    params.requires_review
  ])

  const queryFn = async (): Promise<{
    items: UploadedDocItem[]
    total: number
  }> => {
    const queryParams = buildParams(params)
    const { data } = await apiClient.get<ApiResponse>(endpoint, {
      params: queryParams,
      paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'comma' })
    })

    const docs = data?.data?.documents
    return {
      items: docs?.results ?? [],
      total: Number(docs?.count ?? 0)
    }
  }

  const sanitizedOptions = useMemo(() => {
    if (!options) return {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { queryKey, queryFn, ...rest } = options
    return rest
  }, [options])

  const query = useQuery<{ items: UploadedDocItem[]; total: number }>({
    queryKey,
    queryFn,
    keepPreviousData: true,
    ...(sanitizedOptions as any)
  })

  return {
    ...query,
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0
  }
}

export default useFetchUploadedDocsList
