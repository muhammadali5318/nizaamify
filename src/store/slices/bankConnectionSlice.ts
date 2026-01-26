import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'

interface BankConnectionState {
  connectionId: string | null
  status: string | null
  loading: boolean
  error: boolean
}

const initialState: BankConnectionState = {
  connectionId: null,
  status: null,
  loading: true,
  error: false
}

const bankConnectionSlice = createSlice({
  name: 'bankConnection',
  initialState,
  reducers: {
    setConnectionId(state, action: PayloadAction<string | null>) {
      state.connectionId = action.payload
    },
    setStatus(state, action: PayloadAction<string | null>) {
      state.status = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<boolean>) {
      state.error = action.payload
    },
    resetConnectionState(state) {
      state.connectionId = null
      state.status = null
      state.loading = true
      state.error = false
    }
  }
})

export const {
  setConnectionId,
  setStatus,
  setLoading,
  setError,
  resetConnectionState
} = bankConnectionSlice.actions

// Selectors
export const selectBankConnectionId = (state: RootState) =>
  state.bankConnection.connectionId
export const selectBankConnectionStatus = (state: RootState) =>
  state.bankConnection.status
export const selectBankConnectionLoading = (state: RootState) =>
  state.bankConnection.loading
export const selectBankConnectionError = (state: RootState) =>
  state.bankConnection.error

export default bankConnectionSlice.reducer
