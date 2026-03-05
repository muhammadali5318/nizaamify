import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface DocumentStatus {
  document_id: string
  file_name: string
  status: string
  status_url?: string | null
}

interface BatchStatus {
  batch_id: string
  practice_id: string
  batch_status_url: string
  documents: DocumentStatus[]
}

interface ProcessingState {
  batches: BatchStatus[]
}

const initialState: ProcessingState = {
  batches: []
}

const processingSlice = createSlice({
  name: 'processingBankStatements',
  initialState,
  reducers: {
    addOrUpdateStatementBatchStatus: (
      state,
      action: PayloadAction<BatchStatus>
    ) => {
      const existing = state.batches.find(
        (b) => b.batch_id === action.payload.batch_id
      )
      if (existing) {
        Object.assign(existing, action.payload)
      } else {
        state.batches.push(action.payload)
      }
    },
    clearProcessing: (state) => {
      state.batches = []
    }
  }
})

export const { addOrUpdateStatementBatchStatus, clearProcessing } =
  processingSlice.actions
export default processingSlice.reducer
