import apiClient from '../api-client'

export const createManualEntry = async ({
  practiceId,
  payload
}: {
  practiceId: string
  payload: any
}) => {
  const url = `/docs/v1/practices/${practiceId}/manual-entry/`

  const response = await apiClient.post(url, payload)
  return response.data
}
