// src/services/api/deleteBatchDocuments.ts
import apiClient from '../api-client'

export const deleteBatchDocuments = async (
  practiceId: string,
  batchId: string,
  documentIds: string[]
) => {
  if (!practiceId) throw new Error('practiceId required')
  if (!batchId) throw new Error('batchId required')
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return null // nothing to do
  }

  const payload = { documents: documentIds }

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
