import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'

// =============================
// Types
// =============================

export type PresignFileData = {
  s3Url: string
  key: string
  fileName: string
  fileType: string
  fileSize: number
}

type ReconciliationTabPresignDataState = {
  presignFiles: Record<string, PresignFileData>

  // NEW: uploading state per row
  uploadingFiles: Record<string, boolean>
}

// =============================
// Initial State
// =============================

const initialState: ReconciliationTabPresignDataState = {
  presignFiles: {},
  uploadingFiles: {}
}

// =============================
// Slice
// =============================

const ReconciliationTabPresignDataSlice = createSlice({
  name: 'ReconciliationTabPresignData',
  initialState,
  reducers: {
    // =============================
    // Presign file data
    // =============================

    setPresignFileData: (
      state,
      action: PayloadAction<{
        id: string
        data: PresignFileData
      }>
    ) => {
      const { id, data } = action.payload
      state.presignFiles[id] = data
    },

    removePresignFileData: (state, action: PayloadAction<string>) => {
      delete state.presignFiles[action.payload]
    },

    clearAllPresignFileData: (state) => {
      state.presignFiles = {}
    },

    // =============================
    // Uploading state (NEW)
    // =============================

    setUploadingFile: (state, action: PayloadAction<string>) => {
      state.uploadingFiles[action.payload] = true
    },

    clearUploadingFile: (state, action: PayloadAction<string>) => {
      delete state.uploadingFiles[action.payload]
    },

    clearAllUploadingFiles: (state) => {
      state.uploadingFiles = {}
    }
  }
})

// =============================
// Actions
// =============================

export const {
  setPresignFileData,
  removePresignFileData,
  clearAllPresignFileData,

  // NEW
  setUploadingFile,
  clearUploadingFile,
  clearAllUploadingFiles
} = ReconciliationTabPresignDataSlice.actions

// =============================
// Selectors
// =============================

// Get presign file by ID
export const selectPresignFileById =
  (id: string) =>
  (state: RootState): PresignFileData | undefined =>
    state.ReconciliationTabPresignData.presignFiles[id]

// Get uploading state by ID
export const selectUploadingFileById =
  (id: string) =>
  (state: RootState): boolean =>
    Boolean(state.ReconciliationTabPresignData.uploadingFiles[id])

// Get all presign files
export const selectAllPresignFiles = (
  state: RootState
): Record<string, PresignFileData> =>
  state.ReconciliationTabPresignData.presignFiles

// Get all uploading files
export const selectAllUploadingFiles = (
  state: RootState
): Record<string, boolean> => state.ReconciliationTabPresignData.uploadingFiles

// =============================
// Reducer
// =============================

export default ReconciliationTabPresignDataSlice.reducer
