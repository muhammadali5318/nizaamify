import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface TempFileItem {
  id: string
  file: File
}

interface TempFileState {
  queue: TempFileItem[]
}

const initialState: TempFileState = {
  queue: []
}

export const manualEntryQueueSlice = createSlice({
  name: 'manualEntryQueue',
  initialState,
  reducers: {
    addFilesToQueue: (state, action: PayloadAction<File[]>) => {
      const mapped = action.payload.map((file) => ({
        id: crypto.randomUUID(),
        file
      }))
      state.queue.push(...mapped)
    },
    clearQueue: (state) => {
      state.queue = []
    },
    removeFileFromQueue: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter((f) => f.id !== action.payload)
    }
  }
})

export const { addFilesToQueue, clearQueue, removeFileFromQueue } =
  manualEntryQueueSlice.actions

export default manualEntryQueueSlice.reducer
