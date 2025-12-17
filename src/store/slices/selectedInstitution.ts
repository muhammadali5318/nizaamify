import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'

/* ---------- Types ---------- */

export interface SelectedInstitution {
  id: string
  name: string
  full_name: string
  country_code2: string
  environment_type: 'SANDBOX' | 'PRODUCTION'
  icon_url: string
  logo_url: string
  features: string[]
}

interface SelectedInstitutionState {
  data: SelectedInstitution | null
}

/* ---------- Initial State ---------- */

const initialState: SelectedInstitutionState = {
  data: null
}

/* ---------- Slice ---------- */

const selectedInstitutionSlice = createSlice({
  name: 'selectedInstitution',
  initialState,
  reducers: {
    setSelectedInstitution(state, action: PayloadAction<SelectedInstitution>) {
      state.data = action.payload
    },
    clearSelectedInstitution(state) {
      state.data = null
    }
  }
})

/* ---------- Actions ---------- */

export const { setSelectedInstitution, clearSelectedInstitution } =
  selectedInstitutionSlice.actions

/* ---------- Selectors (Getters) ---------- */

export const selectSelectedInstitution = (state: RootState) =>
  state.selectedInstitution.data

export const selectSelectedInstitutionFeatures = (state: RootState) =>
  state.selectedInstitution.data?.features ?? []

/* ---------- Reducer ---------- */

export default selectedInstitutionSlice.reducer
