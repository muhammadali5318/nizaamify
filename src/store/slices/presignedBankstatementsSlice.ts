import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface PresignItem {
  filename: string
  url: string
  key: string
  headers: Record<string, string>
}

interface PresignData {
  batch_id: string
  expires_in: number
  max_upload_mb: number
  items: PresignItem[]
}

interface PresignState {
  data: PresignData | null
  loading: boolean
  error: string | null
}

const initialState: PresignState = {
  data: null,
  loading: false,
  error: null
}

const presignSlice = createSlice({
  name: 'presign',
  initialState,
  reducers: {
    setPresignStatementsData: (state, action: PayloadAction<PresignData>) => {
      state.data = action.payload
    },
    clearPresignStatementsData: (state) => {
      state.data = null
    }
  }
})

export const { setPresignStatementsData, clearPresignStatementsData } =
  presignSlice.actions
export default presignSlice.reducer
