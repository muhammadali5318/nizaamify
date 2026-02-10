// src/services/api/deleteBatchDocuments.ts
import apiClient from '../api-client'

export const deleteBatchDocuments = async (
  practiceId: string,
  batchId: string,
  documentIds: string[],
  userDeletedDocmentIds: string[]
) => {
  if (!practiceId) throw new Error('practiceId required')
  if (!batchId) throw new Error('batchId required')

  const payload = {
    documents: documentIds,
    user_delete_documents: userDeletedDocmentIds
  }

  try {
    const response = await apiClient.delete(
      `/docs/v1/practices/${practiceId}/batch/${batchId}/`,
      { data: payload } // ✅ Correct way
    )
    return response.data
  } catch (err: any) {
    const message =
      err?.response?.data?.message ||
      err?.message ||
      'Delete batch documents failed'
    const error = new Error(message)
    ;(error as any).original = err
    throw error
  }
}
