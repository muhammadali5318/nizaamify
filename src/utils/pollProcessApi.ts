import { triggerProcessAPI } from '../services/apis/triggerProcessAPI'
import apiClient from '../services/api-client'
import { store } from '../store/store'
import { notify } from '../components/notistack/NotificationProvider'
import { addOrUpdateProcessedBatchStatus } from '../store/slices/processedBatchDataSlice'
import { addOrUpdateBatchStatus } from 'src/store/slices/processingSlice'

import {
  addPollingJob,
  removePollingJob
} from '../store/slices/pollingJobSlice'

export const pollBatchStatusUntilComplete = async (
  batchId: string,
  key: string,
  filename: string,
  userId: string,
  practiceId: string,
  maxAttempts: number = 120,
  pollInterval: number = 3000
) => {
  try {
    store.dispatch(
      addPollingJob({
        batchId,
        key,
        filename,
        userId,
        practiceId,
        startedAt: Date.now()
      })
    )

    const triggerRes = await triggerProcessAPI(
      batchId,
      key,
      filename,
      userId,
      practiceId
    )

    const data = triggerRes?.data ?? triggerRes
    const document = data?.document
    if (!document) throw new Error('No document returned from process API')

    const secureBatchStatusUrl =
      data.batch_status_url?.replace(/^http:\/\//i, 'https://') ||
      data.batch_status_url

    if (!secureBatchStatusUrl)
      throw new Error('No batch_status_url found in process response')

    store.dispatch(
      addOrUpdateBatchStatus({
        batch_id: data.batch_id,
        practice_id: document.practice_id,
        batch_status_url: secureBatchStatusUrl,
        documents: [
          {
            document_id: document.document_id,
            file_name: document.file_name,
            status: document.status,
            status_url: document.status_url?.replace(/^http:\/\//i, 'https://')
          }
        ]
      })
    )

    const prevStatuses: Record<string, string> = {}
    let attempt = 0

    while (attempt < maxAttempts) {
      attempt++

      try {
        const batchRes = await apiClient.get(secureBatchStatusUrl)
        const batchData = batchRes?.data?.data ?? batchRes?.data

        if (!batchData?.documents?.length) {
          console.warn(
            `No documents found in batch response at attempt ${attempt}`
          )
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
          continue
        }

        const changedDocs = batchData.documents.filter((doc: any) => {
          const currentStatus = doc.status?.toUpperCase?.() ?? 'UNKNOWN'
          const prevStatus = prevStatuses[doc.document_id]
          prevStatuses[doc.document_id] = currentStatus
          return currentStatus !== 'PENDING' && currentStatus !== prevStatus
        })

        if (changedDocs.length > 0) {
          store.dispatch(
            addOrUpdateProcessedBatchStatus({
              batch_id: batchData.batch_id,
              created_at: batchData.created_at,
              total_files: batchData.total_files,
              processed_success: batchData.processed_success,
              processed_failed: batchData.processed_failed,
              email_sent: batchData.email_sent,
              callback_task_id: batchData.callback_task_id,
              documents: batchData.documents.map((doc: any) => ({
                document_id: doc.document_id,
                file_name: doc.file_name,
                status: doc.status,
                document_type: doc.document_type,
                document_subtype: doc.document_subtype,
                document_category: doc.document_category,
                document_date: doc.document_date,
                amount: doc.amount,
                error_message: doc.error_message,
                status_url: doc.status_url?.replace(/^http:\/\//i, 'https://')
              }))
            })
          )
        }

        const allProcessed = batchData.documents.every(
          (doc: any) => doc.status?.toUpperCase?.() !== 'PENDING'
        )

        if (allProcessed) {
          store.dispatch(removePollingJob(batchId))
          return batchData
        }
      } catch (batchErr) {
        console.error(
          `Error fetching batch status (attempt ${attempt}):`,
          batchErr
        )
        notify.error(
          `Failed to fetch batch status for ${filename} (Attempt ${attempt})`
        )
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    notify.error(
      `Polling stopped for ${filename}: exceeded ${maxAttempts} attempts without completion`
    )

    store.dispatch(removePollingJob(batchId))

    throw new Error(
      `Max polling attempts (${maxAttempts}) reached for ${filename}`
    )
  } catch (err) {
    console.error(`Error in pollBatchStatusUntilComplete for ${filename}:`, err)

    store.dispatch(removePollingJob(batchId))

    notify.error(`Processing failed for ${filename}`)
    throw err
  }
}
