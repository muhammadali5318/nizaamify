// src/hooks/useNominateManager.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { notify } from 'src/components/notistack/NotificationProvider'

interface UseNominateManagerOptions {
  orgUuid: string
  userId: string
  onSuccess?: () => void
  onError?: () => void
}

export const useNominateExistingManager = ({
  orgUuid,
  userId,
  onSuccess,
  onError
}: UseNominateManagerOptions) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return await apiClient.patch(
        endpoints.nominateExistingManager(orgUuid, userId)
      )
    },
    onSuccess: async () => {
      notify.success('User successfully nominated!')
      await queryClient.invalidateQueries({ queryKey: ['teamMembersListApi'] })
      if (onSuccess) onSuccess()
    },
    onError: (error: any) => {
      console.error('Nomination failed:', error)
      notify.error('Failed to nominate user. Please try again.')
      if (onError) onError()
    }
  })
}
