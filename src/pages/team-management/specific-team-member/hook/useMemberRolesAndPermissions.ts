// src/pages/hook/useMemberRolesAndPermissions.ts
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

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
  const { activePracticeId } = useActivePractice()
  const queryKey = ['membersRolesAndPermissions', activePracticeId, userId]

  return useQuery<MemberRolesResponse>({
    queryKey,
    queryFn: async (): Promise<MemberRolesResponse> => {
      if (!activePracticeId || !userId) {
        return {
          user_id: '',
          practice_id: '',
          roles: []
        }
      }

      const response = await apiClient.get(
        endpoints.userRolesAndPermission(activePracticeId, userId)
      )
      return response?.data?.data as MemberRolesResponse
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!activePracticeId && !!userId && enabled,
    gcTime: 0
  })
}
