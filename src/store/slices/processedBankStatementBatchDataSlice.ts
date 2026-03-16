import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

export interface DocumentData {
  id: string
  file_name: string
  status: string
  document_type?: string
  document_subtype?: string
  document_category?: string
  document_date?: string
  amount?: string
  expense_category?: string
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
  // ✅ Separate variable for timed out docs
  deletedDocumentsDueToTimeout: DocumentData[]
}

const initialState: ProcessedBatchState = {
  batches: {},
  deletedDocumentsDueToTimeout: []
}

const processedBatchSlice = createSlice({
  name: 'processedBankStatements',
  initialState,
  reducers: {
    addOrUpdateProcessedBatchStatus: (
      state,
      action: PayloadAction<BatchData>
    ) => {
      const { batch_id, documents } = action.payload
      const existing = state.batches[batch_id]

      const updatedOriginals = [...(existing?.originalDocuments || [])]
      documents.forEach((doc) => {
        const isNotPending = doc.status?.toUpperCase() !== 'PENDING'
        const alreadyOriginal = updatedOriginals.some((o) => o.id === doc.id)
        if (isNotPending && !alreadyOriginal) {
          updatedOriginals.push(JSON.parse(JSON.stringify(doc)))
        }
      })

      state.batches[batch_id] = {
        ...action.payload,
        originalDocuments: updatedOriginals
      }
    },

    // ✅ New Reducer to push all stuck docs into the separate array at once
    addDeletedDocsDueToTimeout: (
      state,
      action: PayloadAction<DocumentData[]>
    ) => {
      const newDocs = action.payload.filter(
        (newDoc) =>
          !state.deletedDocumentsDueToTimeout.some(
            (existing) => existing.id === newDoc.id
          )
      )
      state.deletedDocumentsDueToTimeout = [
        ...state.deletedDocumentsDueToTimeout,
        ...newDocs
      ]
    },

    updateDocumentFields: (
      state,
      action: PayloadAction<{
        id: string
        updates: Partial<DocumentData>
      }>
    ) => {
      for (const batch of Object.values(state.batches)) {
        const doc = batch.documents.find((d) => d.id === action.payload.id)
        if (doc) {
          Object.assign(doc, action.payload.updates)
          break
        }
      }
    },

    removeBatch: (state, action: PayloadAction<string>) => {
      delete state.batches[action.payload]
    },

    clearAll: (state) => {
      state.batches = {}
      state.deletedDocumentsDueToTimeout = []
    },

    removeDocumentsFromBatch: (
      state,
      action: PayloadAction<{ batchId: string; documentIds: string[] }>
    ) => {
      const { batchId, documentIds } = action.payload

      const batch = state.batches[batchId]
      if (!batch) return

      batch.documents = batch.documents.filter(
        (doc) => !documentIds.includes(doc.id)
      )

      // Optional: keep originalDocuments in sync
      if (batch.originalDocuments) {
        batch.originalDocuments = batch.originalDocuments.filter(
          (doc) => !documentIds.includes(doc.id)
        )
      }
    }
  }
})

export const {
  addOrUpdateProcessedBatchStatus,
  addDeletedDocsDueToTimeout,
  updateDocumentFields,
  removeBatch,
  removeDocumentsFromBatch,
  clearAll
} = processedBatchSlice.actions

export const selectAllBatches = (state: RootState) => state.processed.batches
export const selectDeletedDocs = (state: RootState) =>
  state.processed.deletedDocumentsDueToTimeout

export default processedBatchSlice.reducer
