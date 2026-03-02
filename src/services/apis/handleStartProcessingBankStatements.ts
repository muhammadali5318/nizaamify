import { store } from '../../store/store'
import { notify } from '../../components/notistack/NotificationProvider'
import {
  updateBankStatementProgress,
  updateBankStatementStatus,
  moveBankStatementToCompleted
} from '../../store/slices/bankStatementUploadSlice'
import { addOrUpdateStatementBatchStatus } from 'src/store/slices/bankstatementProcessingSlice'
import { pollBatchStatusUntilComplete } from 'src/utils/pollProcessBankStatementApi'

export const uploadStatementsToS3 = async (
  items: any[],
  files: any[],
  batchId: string,
  userId: string,
  practiceId: string
) => {
  const uploadPromises = items.map((item) => {
    const { url, key, headers, filename } = item as {
      url: string
      key: string
      headers: Record<string, string>
      filename: string
    }

    const file = files.find((f) => f.name === filename)
    if (!file) return Promise.resolve()

    const fileId = file.id
    store.dispatch(
      updateBankStatementStatus({ id: fileId, status: 'uploading' })
    )

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)

      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          store.dispatch(updateBankStatementProgress({ id: fileId, progress }))
        }
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          store.dispatch(
            updateBankStatementProgress({ id: fileId, progress: 100 })
          )
          store.dispatch(
            updateBankStatementStatus({ id: fileId, status: 'processing' })
          )
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
            const document = processData?.documents
            const batch_status_url = processData?.batch_status_url

            if (document.length > 0) {
              store.dispatch(
                addOrUpdateStatementBatchStatus({
                  batch_id: document.id,
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

              store.dispatch(
                updateBankStatementStatus({ id: fileId, status: 'completed' })
              )
              store.dispatch(moveBankStatementToCompleted(fileId))
            }
          } catch (processError) {
            console.error('Processing error:', processError)
            store.dispatch(
              updateBankStatementStatus({ id: fileId, status: 'error' })
            )
            console.error(`Processing failed for ${filename}`)
          }
          resolve()
        } else {
          store.dispatch(
            updateBankStatementStatus({ id: fileId, status: 'error' })
          )
          notify.error(`Failed to upload ${filename}`)
          reject(new Error(`Upload failed for ${filename}`))
        }
      }

      xhr.onerror = () => {
        store.dispatch(
          updateBankStatementStatus({ id: fileId, status: 'error' })
        )
        notify.error(`Error uploading ${filename}`)
        reject(new Error(`Network error for ${filename}`))
      }

      xhr.send(file.file)
    })
  })

  // Run all uploads simultaneously
  await Promise.allSettled(uploadPromises)
}
