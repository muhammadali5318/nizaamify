import { useMemo } from 'react'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useAuth0 } from '@auth0/auth0-react'

type ApiResponse = {
  status?: boolean
  message?: string
  data?: string[]
  error?: any
}

export function useFetchUploadedByList(
  options?: Omit<UseQueryOptions<string[]>, 'queryKey' | 'queryFn'>
) {
  const { user } = useAuth0()
  const endpoint = endpoints.uploadedByFilterList(getUserOrgUuid(user))

  const queryKey = useMemo(() => ['uploadedByListApi', endpoint], [endpoint])

  const queryFn = async (): Promise<string[]> => {
    const { data } = await apiClient.get<ApiResponse>(endpoint)
    return Array.isArray(data?.data) ? data.data : []
  }

  const query = useQuery({
    queryKey,
    queryFn,
    keepPreviousData: true,
    ...(options as any)
  })

  return {
    ...query,
    items: query.data ?? []
  }
}

export default useFetchUploadedByList
