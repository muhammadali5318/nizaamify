import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface PresignItem {
  filename: string
  key: string
  url: string
  headers: Record<string, string>
}

interface ManualEntryFilesState {
  batchId: string | null
  expiresIn: number | null
  items: PresignItem[]
}

const initialState: ManualEntryFilesState = {
  batchId: null,
  expiresIn: null,
  items: []
}

export const manualEntryFilesSlice = createSlice({
  name: 'manualEntryFiles',
  initialState,
  reducers: {
    setPresignResponse: (
      state,
      action: PayloadAction<ManualEntryFilesState>
    ) => {
      state.batchId = action.payload.batchId
      state.expiresIn = action.payload.expiresIn

      state.items = [...state.items, ...action.payload.items]
    },

    resetPresignResponse: (state) => {
      state.batchId = null
      state.expiresIn = null
      state.items = []
    }
  }
})

export const { setPresignResponse, resetPresignResponse } =
  manualEntryFilesSlice.actions

export default manualEntryFilesSlice.reducer
