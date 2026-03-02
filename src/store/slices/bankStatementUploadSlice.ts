import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type BankStatementUploadStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'error'

export interface BankStatementFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  progress?: number
  status?: BankStatementUploadStatus
}

interface BankStatementUploadState {
  bankStatements: BankStatementFile[]
  completedBankStatements: BankStatementFile[]
}

const initialState: BankStatementUploadState = {
  bankStatements: [],
  completedBankStatements: []
}

const bankStatementUploadSlice = createSlice({
  name: 'bankStatementUploads',
  initialState,
  reducers: {
    addBankStatements: (state, action: PayloadAction<BankStatementFile[]>) => {
      const newStatements = action.payload.map((statement) => ({
        ...statement,
        progress: 0,
        status: 'queued' as BankStatementUploadStatus
      }))

      const totalStatements = [...state.bankStatements, ...newStatements]

      // limit to max 5 queued statements
      state.bankStatements = totalStatements.slice(0, 5)
    },

    removeBankStatement: (state, action: PayloadAction<string>) => {
      state.bankStatements = state.bankStatements.filter(
        (statement) => statement.id !== action.payload
      )
    },

    clearAllBankStatements: (state) => {
      state.bankStatements = []
      state.completedBankStatements = []
    },

    updateBankStatementProgress: (
      state,
      action: PayloadAction<{ id: string; progress: number }>
    ) => {
      const statement = state.bankStatements.find(
        (s) => s.id === action.payload.id
      )

      if (statement) {
        statement.progress = action.payload.progress
      }
    },

    updateBankStatementStatus: (
      state,
      action: PayloadAction<{
        id: string
        status: BankStatementUploadStatus
      }>
    ) => {
      const statement = state.bankStatements.find(
        (s) => s.id === action.payload.id
      )

      if (statement) {
        statement.status = action.payload.status
      }
    },

    moveBankStatementToCompleted: (state, action: PayloadAction<string>) => {
      const statement = state.bankStatements.find(
        (s) => s.id === action.payload
      )

      if (statement) {
        statement.status = 'completed'
        state.completedBankStatements.push(statement)

        state.bankStatements = state.bankStatements.filter(
          (s) => s.id !== action.payload
        )
      }
    }
  }
})

export const {
  addBankStatements,
  removeBankStatement,
  clearAllBankStatements,
  updateBankStatementProgress,
  updateBankStatementStatus,
  moveBankStatementToCompleted
} = bankStatementUploadSlice.actions

export default bankStatementUploadSlice.reducer
