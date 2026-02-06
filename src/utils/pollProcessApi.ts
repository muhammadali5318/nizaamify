/* eslint-disable no-console */
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
const DOC_TIMEOUT_MS = 5000 // Total time allowed for polling before we force delete

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

    // Initial processing state sync
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

    const startTime = Date.now()
    let lastKnownBatchData: any = null
    let attempt = 0

    // --- PHASE 1: ACTIVE POLLING ---
    while (attempt < maxAttempts) {
      attempt++
      const res = await apiClient.get(batchStatusUrl)
      lastKnownBatchData = res?.data?.data ?? res?.data

      const now = Date.now()
      const elapsed = now - startTime

      // Update Redux with current backend state
      store.dispatch(addOrUpdateProcessedBatchStatus(lastKnownBatchData))

      // Check if everything finished naturally (SUCCESS or FAILED)
      const allFinished = lastKnownBatchData.documents.every(
        (doc: any) => doc.status !== 'PENDING'
      )

      if (allFinished) {
        return lastKnownBatchData
      }

      // Check if we have hit the global timeout for this batch
      if (elapsed >= DOC_TIMEOUT_MS) {
        console.log(
          `Global timeout reached after ${elapsed}ms. Stopping polling for cleanup.`
        )
        break // Exit loop to move to Phase 2
      }

      // eslint-disable-next-line promise/param-names
      await new Promise((r) => setTimeout(r, pollInterval))
    }

    // --- PHASE 2: BULK DELETE STUCK DOCUMENTS ---
    // Extract docs that are still 'PENDING'
    const stuckDocIds = lastKnownBatchData.documents
      .filter((doc: any) => doc.status === 'PENDING')
      .map((doc: any) => doc.document_id)

    if (stuckDocIds.length > 0) {
      try {
        await deleteBatchDocuments(practiceId, batchId, stuckDocIds)
        console.log(
          `Successfully deleted ${stuckDocIds.length} stuck documents.`
        )
      } catch (deleteErr) {
        console.error('Failed to delete stuck documents:', deleteErr)
        notify.error('Cleanup failed. Some documents may still be processing.')
      }
    }

    // --- PHASE 3: FINAL REFRESH ---
    // Call the status API one last time to get the final clean state
    const finalRes = await apiClient.get(batchStatusUrl)
    const finalData = finalRes?.data?.data ?? finalRes?.data

    store.dispatch(addOrUpdateProcessedBatchStatus(finalData))
    return finalData
  } catch (err) {
    console.error(`Polling failed for ${filename}`, err)
    throw err
  } finally {
    activeJobs.delete(jobId)
    store.dispatch(removePollingJob(batchId))
  }
}
