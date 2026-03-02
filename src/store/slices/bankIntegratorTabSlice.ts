// src/store/slices/bankIntegratorTabSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface BankIntegratorTabState {
  activeTab: number
}

const initialState: BankIntegratorTabState = {
  activeTab: 0 // default tab index
}

const bankIntegratorTabSlice = createSlice({
  name: 'bankIntegratorTab',
  initialState,
  reducers: {
    // Setter
    setActiveTab: (state, action: PayloadAction<number>) => {
      state.activeTab = action.payload
    }
  }
})

// Selector (getter)
export const selectActiveTab = (state: {
  bankIntegratorTab: BankIntegratorTabState
}) => state.bankIntegratorTab.activeTab

export const { setActiveTab } = bankIntegratorTabSlice.actions
export default bankIntegratorTabSlice.reducer
