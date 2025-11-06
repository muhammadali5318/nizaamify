import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from 'src/store/store'

export interface SelectedUserType {
  id: string
  user_id: string
  user_name: string
  email: string
  user_practice_status: string
  user_role: string
  is_nominated: boolean
  created_at: string
  access_request_reason: string | null
  invitation_created_at: string
  invitation_expired_at: string
  has_other_active_practices: boolean
}

interface SelectedUserState {
  selectedUser: SelectedUserType
}

const initialState: SelectedUserState = {
  selectedUser: {
    id: '',
    user_id: '',
    user_name: '',
    email: '',
    user_practice_status: '',
    user_role: '',
    is_nominated: false,
    created_at: '',
    access_request_reason: '',
    invitation_created_at: '',
    invitation_expired_at: '',
    has_other_active_practices: false
  }
}

export const selectedUserSlice = createSlice({
  name: 'selectedUser',
  initialState,
  reducers: {
    setSelectedUser: (state, action: PayloadAction<SelectedUserType>) => {
      state.selectedUser = action.payload
    },
    clearSelectedUser: (state) => {
      state.selectedUser = {
        id: '',
        user_id: '',
        user_name: '',
        email: '',
        user_practice_status: '',
        user_role: '',
        is_nominated: false,
        created_at: '',
        access_request_reason: '',
        invitation_created_at: '',
        invitation_expired_at: '',
        has_other_active_practices: false
      }
    }
  }
})

export const { setSelectedUser, clearSelectedUser } = selectedUserSlice.actions

// --- Selectors ---
export const selectSelectedUser = (state: RootState) =>
  state.selectedUser.selectedUser
export const selectSelectedUserId = (state: RootState) =>
  state.selectedUser.selectedUser?.id

export default selectedUserSlice.reducer
