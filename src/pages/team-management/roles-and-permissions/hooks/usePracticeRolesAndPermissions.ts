// src/hooks/usePracticeRolesAndPermissions.ts
import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'

export interface RolePermission {
  id: string
  name: string
  description?: string
  permissions?: Record<string, any>
}

export const usePracticeRolesAndPermissions = (enabled: boolean) => {
  const { user } = useAuth0()
  const orgUuid = user ? getUserOrgUuid(user) : null

  return useQuery<RolePermission[]>({
    queryKey: ['practiceRolesAndPermissions', orgUuid],
    queryFn: async () => {
      if (!orgUuid) return []
      const { data } = await apiClient.get(
        endpoints.practiceRolesAndPermission(orgUuid)
      )
      return data?.data || []
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!orgUuid && enabled
  })
}
