import apiClient from '../api-client'
import { setPresignResponse } from 'src/store/slices/manualEntryFilesSlice'
import { clearQueue } from 'src/store/slices/manualEntryQueueSlice'
import { notify } from 'src/components/notistack/NotificationProvider'

export const handleConfirmUploadUtil = async ({
  queue,
  userId,
  org_id,
  dispatch
}: {
  queue: any[]
  userId: string
  dispatch: any
  org_id: string
}) => {
  try {
    const payload = {
      user_id: userId,
      files: queue.map((item) => ({
        filename: item.file.name,
        content_type: item.file.type || 'application/octet-stream'
      }))
    }

    const res = await apiClient.post(
      `/docs/v1/practices/${org_id}/presign/`,
      payload
    )
    const data = res.data.data
    console.warn('Presign response data:', res.data)
    dispatch(
      setPresignResponse({
        batchId: data.batch_id,
        expiresIn: data.expires_in,
        items: data.items
      })
    )

    dispatch(clearQueue())
    notify.success('File(s) uploaded successfully!')
  } catch (err: any) {
    notify.error(err?.message || 'Failed to upload file(s)')
  }
}
