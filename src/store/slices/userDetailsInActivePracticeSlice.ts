import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'

// --- Types ---
export interface Permission {
  id: string
  name: string
  is_active: boolean
}

export interface Role {
  id: string
  name: string
  is_active: boolean
  permissions: Permission[]
}

export interface PracticeUserDetails {
  practice_id: string
  practice_name: string
  user_practice_status: string
  user_role: string
  is_nominated: boolean
  roles_and_permissions: Role[]
}

interface UserDetailsInActivePracticeState {
  data: PracticeUserDetails | null
}

const initialState: UserDetailsInActivePracticeState = {
  data: null
}

// --- Slice ---
const userDetailsInActivePracticeSlice = createSlice({
  name: 'userDetailsInActivePractice',
  initialState,
  reducers: {
    // Set the filtered object directly (useful when you already have the filtered object)
    setUserDetailsInActivePractice(
      state,
      action: PayloadAction<PracticeUserDetails | null>
    ) {
      state.data = action.payload
    }
  }
})

export const { setUserDetailsInActivePractice } =
  userDetailsInActivePracticeSlice.actions

export default userDetailsInActivePracticeSlice.reducer

// --- Selectors ---
export const selectUserDetailsInActivePractice = (state: RootState) =>
  state.userDetailsInActivePractice.data

export const selectPermissionsInActivePractice = (state: RootState) =>
  state.userDetailsInActivePractice.data?.roles_and_permissions ?? []
