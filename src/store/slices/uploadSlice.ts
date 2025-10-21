import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  file: File
}

interface UploadState {
  files: UploadedFile[]
}

const initialState: UploadState = {
  files: []
}

const uploadSlice = createSlice({
  name: 'uploads',
  initialState,
  reducers: {
    addFiles: (state, action: PayloadAction<UploadedFile[]>) => {
      const totalFiles = [...state.files, ...action.payload]
      state.files = totalFiles.slice(0, 5) // limit 5
    },
    removeFile: (state, action: PayloadAction<string>) => {
      state.files = state.files.filter((f) => f.id !== action.payload)
    },
    clearFiles: (state) => {
      state.files = []
    }
  }
})

export const { addFiles, removeFile, clearFiles } = uploadSlice.actions
export default uploadSlice.reducer
