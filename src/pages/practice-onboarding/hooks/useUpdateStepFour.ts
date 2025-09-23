// src/hooks/useUpdateStepFour.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'

export type StepFourPayload = {
  financial_review_frequency: string
  primary_reasons: string[]
  confidence_reading_reports: string
  insights_format: string
}

export const useUpdateStepFour = (practiceId?: string) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StepFourPayload) => {
      if (!practiceId) throw new Error('Missing practiceId for step 4 update')
      const { data } = await apiClient.patch(
        `user-workstation/v1/practices/${practiceId}/onboarding/steps/4/`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initialData'] })
    }
  })
}
