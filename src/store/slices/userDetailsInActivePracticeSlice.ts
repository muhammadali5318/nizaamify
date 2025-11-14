import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'

// --- Types ---
export interface Permission {
  id: string | number
  name: string
  is_active: boolean | null
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
  merged_permissions_by_category?: Record<string, Permission[]>
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
    setUserDetailsInActivePractice(
      state,
      action: PayloadAction<PracticeUserDetails | null>
    ) {
      state.data = action.payload
    },

    setMergedPermissionsByCategory(
      state,
      action: PayloadAction<Record<string, Permission[]> | undefined>
    ) {
      if (!state.data) return
      state.data.merged_permissions_by_category = action.payload
    },

    clearUserDetailsInActivePractice(state) {
      state.data = null
    }
  }
})

export const {
  setUserDetailsInActivePractice,
  setMergedPermissionsByCategory,
  clearUserDetailsInActivePractice
} = userDetailsInActivePracticeSlice.actions

export default userDetailsInActivePracticeSlice.reducer

// --- Selectors ---
export const selectUserDetailsInActivePractice = (state: RootState) =>
  state.userDetailsInActivePractice.data

// roles as originally
export const selectPermissionsInActivePractice = (state: RootState) =>
  state.userDetailsInActivePractice.data?.roles_and_permissions ?? []

// ✅ new selector for grouped permissions
export const selectPermissionsByCategory = (state: RootState) =>
  state.userDetailsInActivePractice.data?.merged_permissions_by_category ?? {}
