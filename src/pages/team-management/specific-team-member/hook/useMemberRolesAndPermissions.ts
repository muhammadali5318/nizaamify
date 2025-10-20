// src/pages/hook/useMemberRolesAndPermissions.ts
import { useAuth0 } from '@auth0/auth0-react'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'

export type PermissionObject = {
  id: string
  name: string
  description?: string
  is_active: boolean
}

export type RolePermission = {
  id: string
  name: string
  description?: string
  permissions?: Record<string, PermissionObject[]>
}

export type MemberRolesResponse = {
  user_id: string
  practice_id: string
  roles: RolePermission[]
}

export const useMemberRolesAndPermissions = (
  enabled: boolean,
  userId: string | undefined
): UseQueryResult<MemberRolesResponse, unknown> => {
  const { user } = useAuth0()
  const orgUuid = user ? getUserOrgUuid(user) : null
  const queryKey = ['membersRolesAndPermissions', orgUuid, userId]

  return useQuery<MemberRolesResponse>({
    queryKey,
    queryFn: async (): Promise<MemberRolesResponse> => {
      if (!orgUuid || !userId) {
        return {
          user_id: '',
          practice_id: '',
          roles: []
        }
      }

      const response = await apiClient.get(
        endpoints.getUserRolesAndPermission(orgUuid, userId)
      )
      return response?.data?.data as MemberRolesResponse
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!orgUuid && !!userId && enabled,
    gcTime: 0
  })
}
