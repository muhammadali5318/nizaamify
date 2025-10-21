import { configureStore } from '@reduxjs/toolkit'
import uploadReducer from './slices/uploadSlice'
import presignReducer from './slices/presignedSlice'

export const store = configureStore({
  reducer: {
    uploads: uploadReducer,
    presign: presignReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
