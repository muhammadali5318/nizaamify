// src/store/slices/processedBatchSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

interface DocumentData {
  document_id: string
  file_name: string
  status: string
  document_type?: string
  document_subtype?: string
  document_category?: string
  document_date?: string
  amount?: string
  error_message?: string | null
  status_url?: string
}

interface BatchData {
  batch_id: string
  created_at?: string
  total_files?: number
  processed_success?: number
  processed_failed?: number
  email_sent?: boolean
  callback_task_id?: string | null
  documents: DocumentData[]
  originalDocuments?: DocumentData[]
}

interface ProcessedBatchState {
  batches: Record<string, BatchData>
}

const initialState: ProcessedBatchState = {
  batches: {}
}

const processedBatchSlice = createSlice({
  name: 'processed',
  initialState,
  reducers: {
    addOrUpdateProcessedBatchStatus: (
      state,
      action: PayloadAction<BatchData>
    ) => {
      const { batch_id } = action.payload
      const existing = state.batches[batch_id]

      state.batches[batch_id] = {
        ...action.payload,
        originalDocuments:
          existing?.originalDocuments ||
          JSON.parse(JSON.stringify(action.payload.documents))
      }
    },

    updateDocumentFields: (
      state,
      action: PayloadAction<{
        document_id: string
        updates: Partial<DocumentData>
      }>
    ) => {
      for (const batch of Object.values(state.batches)) {
        const doc = batch.documents.find(
          (d) => d.document_id === action.payload.document_id
        )
        if (doc) {
          Object.assign(doc, action.payload.updates)
          break
        }
      }
    },

    updateDocumentStatus: (
      state,
      action: PayloadAction<{
        batch_id: string
        document_id: string
        status: string
      }>
    ) => {
      const { batch_id, document_id, status } = action.payload
      const batch = state.batches[batch_id]
      if (batch) {
        const doc = batch.documents.find((d) => d.document_id === document_id)
        if (doc) doc.status = status
      }
    },

    removeBatch: (state, action: PayloadAction<string>) => {
      delete state.batches[action.payload]
    },

    clearAll: (state) => {
      state.batches = {}
    }
  }
})

export const {
  addOrUpdateProcessedBatchStatus,
  updateDocumentFields,
  updateDocumentStatus,
  removeBatch,
  clearAll
} = processedBatchSlice.actions

export const selectAllBatches = (state: RootState) => state.processed.batches
export const selectBatchById = (batchId: string) => (state: RootState) =>
  state.processed.batches[batchId]

export default processedBatchSlice.reducer
