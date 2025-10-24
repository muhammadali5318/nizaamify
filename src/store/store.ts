import { configureStore, combineReducers } from '@reduxjs/toolkit'
import storage from 'redux-persist/lib/storage'
import { persistReducer, persistStore } from 'redux-persist'
import uploadReducer from './slices/uploadSlice'
import presignReducer from './slices/presignedSlice'
import processingReducer from './slices/processingSlice'
import processedReducer from './slices/processedBatchDataSlice'

const rootReducer = combineReducers({
  uploads: uploadReducer,
  presign: presignReducer,
  processing: processingReducer,
  processed: processedReducer // ✅ add here
})

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['processed'] // ✅ persist processed batches
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
