// src/hooks/useDocumentCounts.ts
import { useQuery } from '@tanstack/react-query'
import apiClient from 'src/services/api-client'

export interface DocumentCounts {
  all: number
  uploaded: number
  review: number
}

export const useDocumentCounts = (
  practiceId?: string | null,
  enabled = false
) => {
  return useQuery<DocumentCounts, Error>({
    queryKey: ['docs', 'counts', practiceId],
    queryFn: async () => {
      if (!practiceId) {
        throw new Error('No practice id provided')
      }

      const response = await apiClient.get(
        `/docs/v1/practices/${practiceId}/document-counts/`
      )

      if (!response?.data?.status || !response?.data?.data) {
        throw new Error('Invalid response from document-counts endpoint')
      }

      const {
        user_documents_count,
        practice_documents_count,
        practice_documents_review_count
      } = response.data.data

      return {
        all: Number(practice_documents_count ?? 0),
        uploaded: Number(user_documents_count ?? 0),
        review: Number(practice_documents_review_count ?? 0)
      }
    },
    enabled: Boolean(practiceId) && enabled,
    staleTime: 1000 * 60 * 30
  })
}

export default useDocumentCounts
