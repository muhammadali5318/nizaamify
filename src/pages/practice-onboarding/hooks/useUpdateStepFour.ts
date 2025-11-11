// src/hooks/useUpdateStepFour.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

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
        endpoints.practiceOnboarding.stepFour(practiceId),
        payload
      )
      return data
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['listAllPracticesData'] }),
        qc.invalidateQueries({ queryKey: ['UserWithActivePracticeData'] }),
        qc.invalidateQueries({ queryKey: ['initialData'] })
      ])
    }
  })
}
