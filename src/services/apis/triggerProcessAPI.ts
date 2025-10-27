import { notify } from 'src/components/notistack/NotificationProvider'
import apiClient from '../api-client'

export const triggerProcessAPI = async (
  batchId: string,
  key: string,
  name: string,
  userId: string,
  practiceId: string
) => {
  const payload = {
    batch_id: batchId,
    key,
    name,
    user_id: userId,
    practice_id: practiceId
  }

  try {
    const response = await apiClient.post(
      `/docs/v1/practices/${practiceId}/process/`,
      payload
    )
    console.warn('Process API response:', response.data)
    return response.data
  } catch (error: any) {
    console.error('Error processing document:', error)
    notify.error(`Failed to process ${name}`)
  }
}
