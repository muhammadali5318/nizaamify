// src/hooks/useUserProfile.ts
import { useAuth0 } from '@auth0/auth0-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { getUserId } from 'src/utils/helper'
import { UserApiProfile } from '../type'

export function useUserProfile(options?: {
  enabled?: boolean
  staleTime?: number
}) {
  const { user } = useAuth0()
  const userId = getUserId(user)
  return useQuery<UserApiProfile | null, Error>({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      if (!userId) return null
      const res = await apiClient.get(endpoints.userProfile(userId))
      return (res?.data?.data as UserApiProfile) ?? null
    },
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 5 * 1000
  })
}

export function useUpdateUserProfile() {
  const qc = useQueryClient()
  const { user, getAccessTokenSilently } = useAuth0()
  const userId = getUserId(user)

  return useMutation({
    mutationFn: async (payload: Partial<UserApiProfile>) => {
      if (!userId) throw new Error('Missing userId for update')
      const res = await apiClient.patch(endpoints.userProfile(userId), payload)
      return res?.data
    },
    onSuccess: async () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: ['userProfile', userId] })
      }

      try {
        await getAccessTokenSilently({ cacheMode: 'off' })
      } catch (err) {
        console.error('Failed to refresh Auth0 token:', err)
      }
    }
  })
}
