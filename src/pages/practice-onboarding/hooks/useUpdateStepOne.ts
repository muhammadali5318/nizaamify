// FILE: src/hooks/useUpdateStepOne.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'

type StepOnePayload = {
  practice_name: string
  principal_name: string
  practice_manager_name: string
  address: string
  contact_number: string
  email: string
}

export const useUpdateStepOne = (practiceId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StepOnePayload) => {
      const { data } = await apiClient.patch(
        `user-workstation/v1/practices/${practiceId}/onboarding/steps/1/`,
        payload
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initialData'] })
    }
  })
}
