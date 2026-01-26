// src/hooks/useUpdateStepThree.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

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
        endpoints.practiceOnboarding.stepThree(practiceId),
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
