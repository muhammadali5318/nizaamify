// FILE: src/hooks/useUpdateStepOne.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

type StepOnePayload = {
  practice_name: string
  principal_name: string
  practice_manager_name: string
  address: string
  contact_number: string
  email: string
}

export const useUpdateStepOne = (practiceId: string) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StepOnePayload) => {
      const { data } = await apiClient.patch(
        endpoints.practiceOnboarding.stepOne(practiceId),
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
