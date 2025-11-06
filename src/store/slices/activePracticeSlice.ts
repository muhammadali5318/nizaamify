import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type AllPracticesDataObject = {
  id: string
  practice_name: string
  email?: string | null
  practice_type?: string
  address?: string | null
  contact_number?: string | null
  premises_ownership?: string
  accounting_basis?: string
  created_at?: string
}

type ActivePracticeState = AllPracticesDataObject | null

const initialState = null as ActivePracticeState

const slice = createSlice({
  name: 'activePractice',
  initialState,
  reducers: {
    setActivePractice(
      state,
      action: PayloadAction<AllPracticesDataObject | null>
    ) {
      return action.payload
    },

    setActivePracticeById(
      state,
      action: PayloadAction<{
        id: string
        allPractices: AllPracticesDataObject[]
      }>
    ) {
      const { id, allPractices } = action.payload
      return allPractices.find((p) => p.id === id) ?? null
    }
  }
})

export const { setActivePractice, setActivePracticeById } = slice.actions
export const activePracticeReducer = slice.reducer

export const selectActivePractice = (state: any) =>
  state.activePractice as ActivePracticeState

export const selectActivePracticeId = (state: any) =>
  (state.activePractice as AllPracticesDataObject | null)?.id ?? null

export default activePracticeReducer
