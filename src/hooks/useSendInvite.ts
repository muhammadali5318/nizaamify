import { useMutation } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useSendInvite = (orgUuid: string) => {
  return useMutation({
    mutationFn: async (payload: {
      email: string
      role: string
      isNominated: boolean
    }) => {
      const { data } = await apiClient.post(endpoints.userInvitation(orgUuid), {
        invited_user_email: payload.email,
        invited_user_role: payload.role,
        is_nominated: payload?.isNominated
      })
      return data
    }
  })
}
