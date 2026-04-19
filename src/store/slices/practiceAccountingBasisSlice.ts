// src/store/slices/practiceAccountingBasisSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { PracticeFormValues } from 'src/schema-validations/practice-profile'

type PracticeAccountingBasisState = {
  pendingPayload: PracticeFormValues | null
}

const initialState: PracticeAccountingBasisState = {
  pendingPayload: null
}

const practiceAccountingBasisSlice = createSlice({
  name: 'practiceAccountingBasis',
  initialState,
  reducers: {
    setPendingPracticePayload: (
      state,
      action: PayloadAction<PracticeFormValues>
    ) => {
      state.pendingPayload = action.payload
    },
    clearPendingPracticePayload: (state) => {
      state.pendingPayload = null
    }
  }
})

export const { setPendingPracticePayload, clearPendingPracticePayload } =
  practiceAccountingBasisSlice.actions

export default practiceAccountingBasisSlice.reducer
