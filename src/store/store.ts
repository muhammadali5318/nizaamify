import { configureStore, combineReducers } from '@reduxjs/toolkit'
import storage from 'redux-persist/lib/storage'
import { persistReducer, persistStore } from 'redux-persist'
import uploadReducer from './slices/uploadSlice'
import presignReducer from './slices/presignedSlice'
import processingReducer from './slices/processingSlice'
import processedReducer from './slices/processedBatchDataSlice'
import { activePracticeReducer } from './slices/activePracticeSlice'
import userDetailsInActivePracticeReducer from 'src/store/slices/userDetailsInActivePracticeSlice'
import selectedUserReducer from './slices/team-management/selectedUserSlice'
import pollingJobsReducer from './slices/pollingJobSlice'
import manualEntryQueueReducer from './slices/manualEntryQueueSlice'
import manualEntryFileReducer from './slices/manualEntryFilesSlice'
const rootReducer = combineReducers({
  uploads: uploadReducer,
  presign: presignReducer,
  processing: processingReducer,
  processed: processedReducer,
  activePractice: activePracticeReducer,
  userDetailsInActivePractice: userDetailsInActivePracticeReducer,
  selectedUser: selectedUserReducer,
  pollingJobs: pollingJobsReducer,
  manualEntryQueue: manualEntryQueueReducer,
  manualEntryFiles: manualEntryFileReducer
})

const persistConfig = {
  key: 'root',
  storage,
  whitelist: [
    'processed',
    'activePractice',
    'selectedUser',
    'processing',
    // 'uploads',
    'pollingJobs'
  ]
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
