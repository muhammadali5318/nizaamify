// src/services/apis/pollBatchStatusUntilComplete.ts
import { triggerProcessAPI } from '../services/apis/triggerProcessAPI'
import apiClient from '../services/api-client'
import { store } from '../store/store'
import {
  addOrUpdateProcessedBatchStatus,
  addDeletedDocsDueToTimeout,
  removeDocumentsFromBatch
} from '../store/slices/processedBatchDataSlice'
import { addOrUpdateBatchStatus } from 'src/store/slices/processingSlice'
import {
  addPollingJob,
  removePollingJob
} from '../store/slices/pollingJobSlice'
import { deleteBatchDocuments } from 'src/services/apis/deleteBatchDocuments'
import { endpoints } from 'src/services/backendUrl'

const activeJobs = new Set<string>()
const DOC_TIMEOUT = 2 * 60 * 1000 // 2 mins

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
  if (activeJobs.has(jobId)) return
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
  let triggerRes: any = null

  try {
    triggerRes = await triggerProcessAPI(
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

    // Register initial processing state
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

    // --- PHASE 1: POLLING ---
    while (attempt < maxAttempts) {
      attempt++
      const res = await apiClient.get(batchStatusUrl)
      lastKnownBatchData = res?.data?.data ?? res?.data

      store.dispatch(addOrUpdateProcessedBatchStatus(lastKnownBatchData))

      const allFinished = lastKnownBatchData.documents.every(
        (doc: any) => doc.status !== 'PENDING'
      )
      if (allFinished) return lastKnownBatchData

      if (Date.now() - startTime >= DOC_TIMEOUT) break

      // eslint-disable-next-line promise/param-names
      await new Promise((r) => setTimeout(r, pollInterval))
    }

    // --- PHASE 2: BULK CLEANUP ---
    const stuckDocs = lastKnownBatchData.documents.filter(
      (doc: any) => doc.status === 'PENDING'
    )

    if (stuckDocs.length > 0) {
      // ✅ Dispatch the entire objects to the separate "Deleted" array
      store.dispatch(addDeletedDocsDueToTimeout(stuckDocs))

      try {
        const stuckDocIds = stuckDocs.map((doc: any) => doc.document_id)
        await deleteBatchDocuments(practiceId, batchId, stuckDocIds, [])
      } catch (err) {
        console.error('Cleanup API failed', err)
      }
    }

    // --- PHASE 3: FINAL SYNC ---
    const finalRes = await apiClient.get(batchStatusUrl)
    const finalData = finalRes?.data?.data ?? finalRes?.data
    store.dispatch(addOrUpdateProcessedBatchStatus(finalData))

    return finalData
  } catch (err) {
    console.error(`Polling failed for ${filename}`, err)
    throw err
  } finally {
    try {
      const resp = await apiClient.get(
        endpoints.documents.documentStatus(
          practiceId ?? '',
          triggerRes.data.document.document_id
        )
      )
      if (resp?.data?.data?.document_subtype === 'Bank statements') {
        await deleteBatchDocuments(
          practiceId,
          batchId,
          [],
          [triggerRes.data.document.document_id]
        )

        store.dispatch(
          removeDocumentsFromBatch({
            batchId,
            documentIds: [triggerRes.data.document.document_id]
          })
        )
      }
    } catch (error: any) {
      if (error?.message == 'The document does not exist.') {
        await deleteBatchDocuments(
          practiceId,
          batchId,
          [],
          [triggerRes.data.document.document_id]
        )
      }
    }
    activeJobs.delete(jobId)
    store.dispatch(removePollingJob(batchId))
  }
}
