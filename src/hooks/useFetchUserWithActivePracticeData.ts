// src/hooks/useFetchUserWithActivePracticeData.ts
import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'
import {
  mergePermissions,
  ALL_PERMISSIONS
} from 'src/config/module-permissions'
import { useFeatureFlagContext } from 'src/context/FeatureFlagProvider'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { getUserId } from 'src/utils/helper'

export const useFetchUserWithActivePracticeData = (enabled: boolean) => {
  const { user } = useAuth0()
  const { updateUserContext } = useFeatureFlagContext()

  return useQuery({
    queryKey: ['UserWithActivePracticeData', getUserId(user)],
    queryFn: async () => {
      const { data } = await apiClient.get(
        endpoints.userWithActivePractices(getUserId(user))
      )

      const practices = data?.data?.active_practices ?? []
      const activePractice = practices.length > 0 ? practices[0] : undefined
      const userPermissions =
        activePractice?.roles_and_permissions?.[0]?.permissions ?? []

      // Merge and set correct is_active values
      const mergedPermissions = mergePermissions(
        ALL_PERMISSIONS,
        userPermissions
      )

      updateUserContext({
        permissions: mergedPermissions
      })

      // return whatever payload you need
      return data?.data
    },
    enabled
  })
}
