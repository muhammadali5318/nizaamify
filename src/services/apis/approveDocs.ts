import apiClient from '../api-client'

export const approveDocuments = async (
  practiceId: string,
  batchId: string,
  documents?: any[]
) => {
  const payload: any = { batch_id: batchId }
  if (documents && documents.length > 0) payload.documents = documents

  const response = await apiClient.post(
    `/docs/v1/practices/${practiceId}/review-update/`,
    payload
  )
  return response.data
}
