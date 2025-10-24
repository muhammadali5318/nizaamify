import { triggerProcessAPI } from '../services/apis/triggerProcessAPI'
import apiClient from '../services/api-client'
import { store } from '../store/store'
import { addOrUpdateProcessedBatchStatus } from '../store/slices/processedBatchDataSlice'
import { notify } from '../components/notistack/NotificationProvider'
import { addOrUpdateBatchStatus } from 'src/store/slices/processingSlice'

export const pollProcessApiUntilReady = async (
  batchId: string,
  key: string,
  filename: string,
  userId: string,
  practiceId: string,
  intervalMs = 3000,
  maxAttempts = 20
) => {
  let attempt = 0

  while (true) {
    attempt++
    try {
      const res = await triggerProcessAPI(
        batchId,
        key,
        filename,
        userId,
        practiceId
      )

      const data = res?.data ?? res
      const document = data?.document
      if (!document) return res

      const status = document.status?.toUpperCase() ?? 'UNKNOWN'

      const secureStatusUrl =
        document.status_url?.replace(/^http:\/\//i, 'https://') ||
        document.status_url
      const secureBatchStatusUrl =
        data.batch_status_url?.replace(/^http:\/\//i, 'https://') ||
        data.batch_status_url

      store.dispatch(
        addOrUpdateBatchStatus({
          batch_id: data.batch_id,
          practice_id: document.practice_id,
          batch_status_url: secureBatchStatusUrl,
          documents: [
            {
              document_id: document.document_id,
              file_name: document.file_name,
              status: status,
              status_url: secureStatusUrl
            }
          ]
        })
      )

      console.log(`Process attempt ${attempt}: ${filename} = ${status}`)

      if (status !== 'PENDING') {
        if (secureBatchStatusUrl) {
          try {
            const batchRes = await apiClient.get(secureBatchStatusUrl)
            const batchData = batchRes?.data?.data ?? batchRes?.data

            if (batchData) {
              store.dispatch(
                addOrUpdateProcessedBatchStatus({
                  batch_id: batchData.batch_id,
                  created_at: batchData.created_at,
                  total_files: batchData.total_files,
                  processed_success: batchData.processed_success,
                  processed_failed: batchData.processed_failed,
                  email_sent: batchData.email_sent,
                  callback_task_id: batchData.callback_task_id,
                  documents:
                    batchData.documents?.map((doc: any) => ({
                      document_id: doc.document_id,
                      file_name: doc.file_name,
                      status: doc.status,
                      document_type: doc.document_type,
                      document_subtype: doc.document_subtype,
                      document_category: doc.document_category,
                      document_date: doc.document_date,
                      amount: doc.amount,
                      error_message: doc.error_message,
                      status_url: doc.status_url?.replace(
                        /^http:\/\//i,
                        'https://'
                      )
                    })) || []
                })
              )

              console.log(`✅ Processed batch stored: ${batchData.batch_id}`)
            }
          } catch (batchErr) {
            console.error('Error fetching batch status:', batchErr)
            notify.error(`Failed to fetch batch status for ${filename}`)
          }
        }

        return res
      }

      if (maxAttempts > 0 && attempt >= maxAttempts) {
        notify.error(`${filename} still pending after ${attempt} attempts`)
        return res
      }

      await new Promise((r) => setTimeout(r, intervalMs))
    } catch (err) {
      console.error(`Error polling process API for ${filename}:`, err)
      throw err
    }
  }
}
