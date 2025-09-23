// src/hooks/useUpdateStepThree.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'

export type StepThreePayload = {
  management_software: string
  accounting_software: string
  accountant_bookkeeper_use: string
}

export const useUpdateStepThree = (practiceId?: string) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StepThreePayload) => {
      if (!practiceId) throw new Error('Missing practiceId for step 3 update')
      const { data } = await apiClient.patch(
        `user-workstation/v1/practices/${practiceId}/onboarding/steps/3/`,
        payload
      )
      return data
    },
    onSuccess: () => {
      // refresh initialData so local state aligns with server
      qc.invalidateQueries({ queryKey: ['initialData'] })
    }
  })
}
