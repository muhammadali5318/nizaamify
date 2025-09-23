// FILE: src/hooks/useUpdateStepTwo.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'

type StepTwoPayload = {
  practice_type: string
  years_of_trading: number
  number_of_surgeries: number
  number_of_associates: number
  number_of_hygienists_therapists: number
  number_of_specialists: number
  premises_ownership: string
}

export const useUpdateStepTwo = (practiceId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StepTwoPayload) => {
      const { data } = await apiClient.patch(
        `user-workstation/v1/practices/${practiceId}/onboarding/steps/2/`,
        payload
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initialData'] })
    }
  })
}
