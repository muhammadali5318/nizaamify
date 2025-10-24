import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'error'

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  progress?: number
  status?: UploadStatus
}

interface UploadState {
  files: UploadedFile[]
  completedFiles: UploadedFile[]
}

const initialState: UploadState = {
  files: [],
  completedFiles: []
}

const uploadSlice = createSlice({
  name: 'uploads',
  initialState,
  reducers: {
    addFiles: (state, action: PayloadAction<UploadedFile[]>) => {
      const newFiles = action.payload.map((f) => ({
        ...f,
        progress: 0,
        status: 'queued' as UploadStatus
      }))
      const totalFiles = [...state.files, ...newFiles]
      state.files = totalFiles.slice(0, 5)
    },

    removeFile: (state, action: PayloadAction<string>) => {
      state.files = state.files.filter((f) => f.id !== action.payload)
    },

    clearFiles: (state) => {
      state.files = []
      state.completedFiles = []
    },

    updateProgress: (
      state,
      action: PayloadAction<{ id: string; progress: number }>
    ) => {
      const file = state.files.find((f) => f.id === action.payload.id)
      if (file) file.progress = action.payload.progress
    },

    updateStatus: (
      state,
      action: PayloadAction<{ id: string; status: UploadStatus }>
    ) => {
      const file = state.files.find((f) => f.id === action.payload.id)
      if (file) file.status = action.payload.status
    },

    moveToCompleted: (state, action: PayloadAction<string>) => {
      const file = state.files.find((f) => f.id === action.payload)
      if (file) {
        file.status = 'completed'
        state.completedFiles.push(file)
        state.files = state.files.filter((f) => f.id !== action.payload)
      }
    }
  }
})

export const {
  addFiles,
  removeFile,
  clearFiles,
  updateProgress,
  updateStatus,
  moveToCompleted
} = uploadSlice.actions

export default uploadSlice.reducer
