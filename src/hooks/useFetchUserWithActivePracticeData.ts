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
import { useDispatch } from 'react-redux'
import { setUserDetailsInActivePractice } from 'src/store/slices/userDetailsInActivePracticeSlice'
import { useActivePractice } from './useActivePractice'

export const useFetchUserWithActivePracticeData = (enabled: boolean) => {
  const { user } = useAuth0()
  const { updateUserContext } = useFeatureFlagContext()
  const { activePracticeId } = useActivePractice()

  const dispatch = useDispatch()

  const userId = getUserId(user)

  return useQuery({
    queryKey: ['UserWithActivePracticeData', userId, activePracticeId],
    queryFn: async ({ queryKey }) => {
      const [, _userId, practiceIdFromKey] = queryKey

      const { data } = await apiClient.get(
        endpoints.userWithActivePractices(_userId ?? '')
      )

      const practices = data?.data?.active_practices ?? []
      const activePracticeObj =
        practices.find((p: any) => p.practice_id === practiceIdFromKey) ?? null

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { roles_and_permissions, ...userDetailsInPractice } =
        activePracticeObj
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { active_practices, ...userDetails } = data.data

      dispatch(
        setUserDetailsInActivePractice({
          ...userDetailsInPractice,
          ...userDetails
        })
      )

      const mergedPermissions = mergePermissions(
        ALL_PERMISSIONS,
        activePracticeObj?.roles_and_permissions?.[0]?.permissions
      )

      updateUserContext({ permissions: mergedPermissions })

      return data?.data
    },
    enabled: Boolean(enabled && userId)
  })
}
