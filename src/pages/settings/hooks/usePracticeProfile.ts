// src/hooks/usePracticeApi.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'
import {
  mapFormToApiPayload,
  PracticeApi,
  PracticeFormValues
} from '../setting-config'

/* --- GET hook (v5-style single object) --- */
export const usePractice = (practiceId?: string) => {
  return useQuery<PracticeApi>({
    queryKey: ['practice', practiceId],
    queryFn: async () => {
      if (!practiceId) throw new Error('Missing practiceId')
      const resp = await apiClient.get(
        `user-workstation/v1/practices/${practiceId}/profile/`
      )
      return resp?.data?.data
    },
    enabled: Boolean(practiceId),
    staleTime: 1000 * 60 * 2
  })
}

export const useUpdatePractice = (practiceId?: string) => {
  const qc = useQueryClient()

  const mutation = useMutation<
    PracticeApi,
    unknown,
    PracticeFormValues | Record<string, any>,
    unknown
  >({
    mutationFn: async (payload) => {
      if (!practiceId) throw new Error('Missing practiceId')
      const body = mapFormToApiPayload(payload)
      const resp = await apiClient.put(
        `user-workstation/v1/practices/${practiceId}/profile/`,
        body
      )
      return resp?.data?.data
    },
    onSuccess: (data) => {
      if (!practiceId) return
      qc.setQueryData(['practice', practiceId], data)
      qc.invalidateQueries({ queryKey: ['practice', practiceId] })
    }
  })

  return mutation
}
