import apiClient from '../api-client'

export const presignDocuments = async (
  userId: string,
  files: any[],
  org_id: string
) => {
  const payload = {
    user_id: userId,
    files: files.map((file) => ({
      filename: file.name,
      content_type: file.type || 'application/octet-stream'
    }))
  }

  const response = await apiClient.post(
    `/docs/v1/practices/${org_id}/presign/`,
    payload
  )

  return response.data
}
