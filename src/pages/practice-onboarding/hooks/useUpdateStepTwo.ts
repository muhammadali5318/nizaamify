// FILE: src/hooks/useUpdateStepTwo.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

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
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StepTwoPayload) => {
      const { data } = await apiClient.patch(
        endpoints.practiceOnboarding.stepTwo(practiceId),
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
