// FILE: src/hooks/useUpdateStepFive.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export type StepFivePayload = {
  accounting_basis: string // expected values: "ACCRUAL" | "CASH" (server-side may expect uppercase)
}

export const useUpdateStepFive = (practiceId?: string) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StepFivePayload) => {
      if (!practiceId) throw new Error('Missing practiceId for step 5 update')
      const { data } = await apiClient.patch(
        endpoints.practiceOnboarding.stepFive(practiceId),
        payload
      )
      return data
    },
    onSuccess: () => {
      // invalidate initial data so UI picks up the updated onboarding state
      qc.invalidateQueries({ queryKey: ['initialData'] })
      qc.invalidateQueries({ queryKey: ['UserWithActivePracticeData'] })
    }
  })
}

export default useUpdateStepFive
