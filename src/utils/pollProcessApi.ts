// src/services/apis/pollBatchStatusUntilComplete.ts
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
import { deleteBatchDocuments } from 'src/services/apis/deleteBatchDocuments'

const activeJobs = new Set<string>()
const DOC_TIMEOUT_MS = 5000

export const pollBatchStatusUntilComplete = async (
  batchId: string,
  key: string,
  filename: string,
  userId: string,
  practiceId: string,
  maxAttempts: number = 550,
  pollInterval: number = 3000
) => {
  const jobId = `${batchId}-${key}`

  if (activeJobs.has(jobId)) {
    console.warn(`Polling job already active for ${jobId}`)
    return
  }

  activeJobs.add(jobId)

  // Track which documents have already been deleted to avoid duplicate calls
  const deletedTimedOutDocs = new Set<string>()

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

  const docFirstSeenAt: Record<string, number> = {}

  try {
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

    const batchStatusUrl =
      data.batch_status_url?.replace(/^http:\/\//i, 'https://') ||
      data.batch_status_url
    if (!batchStatusUrl) throw new Error('No batch_status_url found')

    // 🔵 Initial processing state
    store.dispatch(
      addOrUpdateBatchStatus({
        batch_id: data.batch_id,
        practice_id: document.practice_id,
        batch_status_url: batchStatusUrl,
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

    let attempt = 0

    while (attempt < maxAttempts) {
      attempt++

      const res = await apiClient.get(batchStatusUrl)
      const batchData = res?.data?.data ?? res?.data
      const now = Date.now()

      // Track documents and calculate TIMED_OUT
      let documents = batchData.documents.map((doc: any) => {
        if (!docFirstSeenAt[doc.document_id])
          docFirstSeenAt[doc.document_id] = now
        const elapsed = now - docFirstSeenAt[doc.document_id]

        if (doc.status === 'PENDING' && elapsed > DOC_TIMEOUT_MS) {
          return { ...doc, ui_status: 'TIMED_OUT' }
        }

        return { ...doc, ui_status: doc.status }
      })

      // 🔴 Delete TIMED_OUT documents from backend
      const timedOutIdsToDelete = documents
        .filter(
          (d: any) =>
            d.ui_status === 'TIMED_OUT' &&
            !deletedTimedOutDocs.has(d.document_id)
        )
        .map((d: any) => d.document_id)

      if (timedOutIdsToDelete.length > 0) {
        try {
          await deleteBatchDocuments(practiceId, batchId, timedOutIdsToDelete)
          timedOutIdsToDelete.forEach((id) => deletedTimedOutDocs.add(id))

          // mark deleted locally so UI updates immediately
          documents = documents.map((doc: any) =>
            timedOutIdsToDelete.includes(doc.document_id)
              ? { ...doc, status: 'DELETED', ui_status: 'DELETED' }
              : doc
          )
        } catch (deleteErr) {
          console.error('Failed to delete timed out documents:', deleteErr)
          notify.error(
            'Unable to remove stalled documents. You can retry or skip them manually.'
          )
        }
      }

      // Update Redux state
      store.dispatch(
        addOrUpdateProcessedBatchStatus({ ...batchData, documents })
      )

      // Check if all done
      const allDone = documents.every(
        (d: any) => !['PENDING', 'TIMED_OUT'].includes(d.ui_status)
      )
      if (allDone) {
        store.dispatch(removePollingJob(batchId))
        return batchData
      }

      await new Promise((r) => setTimeout(r, pollInterval))
    }

    notify.error(
      `Processing stopped for ${filename}: exceeded maximum wait time`
    )
    throw new Error('Polling timeout exceeded')
  } catch (err) {
    console.error(`Polling failed for ${filename}`, err)
    throw err
  } finally {
    activeJobs.delete(jobId)
    store.dispatch(removePollingJob(batchId))
  }
}
