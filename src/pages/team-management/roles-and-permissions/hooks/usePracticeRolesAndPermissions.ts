// src/hooks/usePracticeRolesAndPermissions.ts
import { useQuery } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export interface RolePermission {
  id: string
  name: string
  description?: string
  permissions?: Record<string, any>
}

export const usePracticeRolesAndPermissions = (enabled: boolean) => {
  const { activePracticeId } = useActivePractice()

  return useQuery<RolePermission[]>({
    queryKey: ['practiceRolesAndPermissions', activePracticeId],
    queryFn: async () => {
      if (!activePracticeId) return []
      const { data } = await apiClient.get(
        endpoints.practiceRolesAndPermission(activePracticeId)
      )
      return data?.data || []
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!activePracticeId && enabled
  })
}
