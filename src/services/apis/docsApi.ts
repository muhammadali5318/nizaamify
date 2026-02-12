import { notify } from 'src/components/notistack/NotificationProvider'
import apiClient from '../api-client'

export const presignDocuments = async (
  userId: string,
  files: any[],
  org_id: string
) => {
  try {
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
  } catch (error: any) {
    console.error('Error presigning documents:', error)

    const errorData = error

    let message = ''
    if (errorData) {
      // Handle nested validation errors like files -> 0 -> filename -> [msg]
      if (errorData.files) {
        const firstFileError = Object.values(errorData.files)[0] as any
        message = firstFileError
      } else if (errorData.detail) {
        message = errorData.detail
      } else if (typeof errorData === 'string') {
        message = errorData
      }
    }

    notify.error(message)
    throw new Error(message)
  }
}
