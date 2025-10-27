import { store } from '../../store/store'
import { notify } from '../../components/notistack/NotificationProvider'
import {
  updateProgress,
  updateStatus,
  moveToCompleted
} from '../../store/slices/uploadSlice'
import { addOrUpdateBatchStatus } from 'src/store/slices/processingSlice'
import { pollBatchStatusUntilComplete } from 'src/utils/pollProcessApi'

export const uploadFilesToS3 = async (
  items: any[],
  files: any[],
  batchId: string,
  userId: string,
  practiceId: string
) => {
  for (let i = 0; i < items.length; i++) {
    const { url, key, headers, filename } = items[i] as {
      url: string
      key: string
      headers: Record<string, string>
      filename: string
    }

    const file = files.find((f) => f.name === filename)
    if (!file) continue

    const fileId = file.id
    store.dispatch(updateStatus({ id: fileId, status: 'uploading' }))

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', url)

        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            store.dispatch(updateProgress({ id: fileId, progress }))
          }
        }

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            store.dispatch(updateProgress({ id: fileId, progress: 100 }))
            store.dispatch(updateStatus({ id: fileId, status: 'processing' }))
            notify.success(`${filename} uploaded successfully!`)

            try {
              const finalProcessRes = await pollBatchStatusUntilComplete(
                batchId,
                key,
                filename,
                userId,
                practiceId
              )

              const processData = finalProcessRes?.data ?? finalProcessRes
              const document = processData?.document
              const batch_status_url = processData?.batch_status_url

              if (document) {
                store.dispatch(
                  addOrUpdateBatchStatus({
                    batch_id: processData.batch_id || batchId,
                    practice_id: document.practice_id || practiceId,
                    batch_status_url: batch_status_url || null,
                    documents: [
                      {
                        document_id: document.document_id,
                        file_name: document.file_name,
                        status: document.status,
                        status_url: document.status_url ?? null
                      }
                    ]
                  })
                )
              }

              store.dispatch(updateStatus({ id: fileId, status: 'completed' }))
              store.dispatch(moveToCompleted(fileId))
              notify.success(`${filename} processed successfully`)
            } catch (processError) {
              console.error('Processing error:', processError)
              store.dispatch(updateStatus({ id: fileId, status: 'error' }))
              notify.error(`Processing failed for ${filename}`)
            }
            resolve()
          } else {
            store.dispatch(updateStatus({ id: fileId, status: 'error' }))
            notify.error(`Failed to upload ${filename}`)
            reject(new Error(`Upload failed for ${filename}`))
          }
        }

        xhr.onerror = () => {
          store.dispatch(updateStatus({ id: fileId, status: 'error' }))
          notify.error(`Error uploading ${filename}`)
          reject(new Error(`Network error for ${filename}`))
        }

        xhr.send(file.file)
      })
    } catch (error) {
      console.error('S3 upload error:', error)
    }
  }
}
