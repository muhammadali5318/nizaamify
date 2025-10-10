// src/hooks/useFetchTeamMembers.ts
import { useMemo } from 'react'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import qs from 'qs'
import { endpoints } from 'src/services/backendUrl'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useAuth0 } from '@auth0/auth0-react'

export type PracticeApiItem = {
  id: string
  user_id?: string
  user_name?: string
  email?: string
  user_practice_status?: string
  user_role?: string
  is_nominated?: boolean
  created_at?: string
  invitation_created_at?: string | null
  invitation_expired_at?: string | null
  [key: string]: any
}

export type TeamUsersCounts = {
  total_users?: number
  active_users?: number
  pending_invited_users?: number
  [key: string]: any
}

export type TeamUserData = {
  count?: number
  next?: string | null
  previous?: string | null
  results?: PracticeApiItem[]
  [key: string]: any
}

export type UsePracticeSettingsParams = {
  page?: number
  pageSize?: number
  search?: string
  user_role?: string[]
  user_practice_status?: string[]
  ordering?: string | null
  sortOrder?: 'asc' | 'desc' | null
  endpoint?: string
}

type ApiResponse = {
  status?: boolean
  message?: string
  data?: any
  error?: any
}

function buildParams(p: UsePracticeSettingsParams) {
  const params: Record<string, any> = {}
  if (p.page !== undefined) params.page = p.page + 1
  if (p.pageSize !== undefined) params.page_size = p.pageSize
  if (p.search) params.search = p.search
  if (p.user_role && p.user_role.length) params.user_role = p.user_role
  if (p.user_practice_status && p.user_practice_status.length)
    params.user_practice_status = p.user_practice_status
  if (p.ordering) {
    params.ordering = p.sortOrder === 'desc' ? `-${p.ordering}` : p.ordering
  }
  return params
}

export function useFetchTeamMembers(
  params: UsePracticeSettingsParams,
  options?: UseQueryOptions<{
    items: PracticeApiItem[]
    total: number
    teamUsersCounts?: TeamUsersCounts
    teamUserData?: TeamUserData
  }>
) {
  const { user } = useAuth0()
  const endpoint = endpoints.teamMembersList(getUserOrgUuid(user))

  const queryKey = useMemo(
    () => [
      'teamMembersListApi',
      {
        page: params.page ?? 0,
        pageSize: params.pageSize ?? 10,
        search: params.search ?? '',
        user_role: (params.user_role ?? []).join(','),
        user_practice_status: (params.user_practice_status ?? []).join(','),
        ordering: params.ordering ?? null,
        sortOrder: params.sortOrder ?? null,
        endpoint
      }
    ],
    [
      params.page,
      params.pageSize,
      params.search,
      (params.user_role ?? []).join(','),
      (params.user_practice_status ?? []).join(','),
      params.ordering,
      params.sortOrder,
      endpoint
    ]
  )

  const queryFn = async (): Promise<{
    items: PracticeApiItem[]
    total: number
    teamUsersCounts?: TeamUsersCounts
    teamUserData?: TeamUserData
  }> => {
    const queryParams = buildParams(params)
    const { data } = await apiClient.get<ApiResponse>(endpoint, {
      params: queryParams,
      paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'comma' })
    })

    let items: PracticeApiItem[] = []
    let total = 0
    let teamUsersCounts: TeamUsersCounts | undefined = undefined
    let teamUserData: TeamUserData | undefined = undefined

    if (data?.data) {
      teamUsersCounts = data.data.team_users_counts
      teamUserData = data.data.team_user_data

      if (teamUserData?.results) {
        items = teamUserData.results as PracticeApiItem[]
      }

      total = Number(teamUserData?.count)
    }

    return { items, total, teamUsersCounts, teamUserData }
  }

  const sanitizedOptions = useMemo(() => {
    if (!options) return {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { queryKey: _qk, queryFn: _qf, ...rest } = options as any
    return rest as UseQueryOptions<{
      items: PracticeApiItem[]
      total: number
      teamUsersCounts?: TeamUsersCounts
      teamUserData?: TeamUserData
    }>
  }, [options])

  const query = useQuery<{
    items: PracticeApiItem[]
    total: number
    teamUsersCounts?: TeamUsersCounts
    teamUserData?: TeamUserData
  }>({
    queryKey,
    queryFn,
    keepPreviousData: true,
    // let callers override other options (enabled, staleTime, refetchOnWindowFocus, etc.)
    ...(sanitizedOptions as any)
  })

  return {
    ...query,
    items: (query.data?.items ?? []) as PracticeApiItem[],
    total: query.data?.total ?? 0,
    teamUsersCounts: query.data?.teamUsersCounts,
    teamUserData: query.data?.teamUserData
  }
}

export default useFetchTeamMembers
