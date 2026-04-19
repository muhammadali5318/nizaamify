import { configureStore, combineReducers } from '@reduxjs/toolkit'
import storage from 'redux-persist/lib/storage'
import { persistReducer, persistStore } from 'redux-persist'

import uploadReducer from './slices/uploadSlice'
import ReconciliationTabPresignData from './slices/reconciliationTabPresignDataSlice'

import presignReducer from './slices/presignedSlice'
import bankStatementPresignReducer from './slices/presignedBankstatementsSlice'
import processingReducer from './slices/processingSlice'
import bankStatementProcessingReducer from './slices/bankstatementProcessingSlice'
import processedReducer from './slices/processedBatchDataSlice'
import processedBankStatementReducer from './slices/processedBankStatementBatchDataSlice'
import { activePracticeReducer } from './slices/activePracticeSlice'
import userDetailsInActivePracticeReducer from './slices/userDetailsInActivePracticeSlice'
import selectedUserReducer from './slices/team-management/selectedUserSlice'
import pollingJobsReducer from './slices/pollingJobSlice'
import pollingBankStatementJobsReducer from './slices/pollingJobBankStatementSlice'
import manualEntryQueueReducer from './slices/manualEntryQueueSlice'
import manualEntryFileReducer from './slices/manualEntryFilesSlice'
import selectedInstitutionReducer from './slices/selectedInstitution'
import bankConnectionReducer from './slices/bankConnectionSlice'
import chatReducer from './slices/chatSlice'
import bankStatementUploadReducer from './slices/bankStatementUploadSlice'
import bankIntegratorTabReducer from './slices/bankIntegratorTabSlice'
import transactionsTableReducer from './slices/transactionsTableSlice'
import expenseBreakdownReducer from './slices/expenseBreakdownSlice'
import practiceAccountingBasisReducer from './slices/practiceAccountingBasisSlice'
import accountingBasisSwitchReducer from './slices/accountingBasisSwitchSlice'

const rootReducer = combineReducers({
  uploads: uploadReducer,
  bankStatementUploads: bankStatementUploadReducer,
  presign: presignReducer,
  bankStatementPresighn: bankStatementPresignReducer,
  processing: processingReducer,
  bankStatementProcessing: bankStatementProcessingReducer,
  processed: processedReducer,
  processedBankStatement: processedBankStatementReducer,
  activePractice: activePracticeReducer,
  userDetailsInActivePractice: userDetailsInActivePracticeReducer,
  selectedUser: selectedUserReducer,
  pollingJobs: pollingJobsReducer,
  pollingBankStatementsJobs: pollingBankStatementJobsReducer,
  manualEntryQueue: manualEntryQueueReducer,
  manualEntryFiles: manualEntryFileReducer,
  selectedInstitution: selectedInstitutionReducer,
  bankConnection: bankConnectionReducer,
  chat: chatReducer,
  bankIntegratorTab: bankIntegratorTabReducer,
  ReconciliationTabPresignData: ReconciliationTabPresignData,
  transactionsTable: transactionsTableReducer,
  expenseBreakdown: expenseBreakdownReducer,
  practiceAccountingBasis: practiceAccountingBasisReducer,
  accountingBasisSwitch: accountingBasisSwitchReducer
})

const persistConfig = {
  key: 'root',
  storage,
  whitelist: [
    'processed',
    'processedBankStatement',
    'activePractice',
    'selectedUser',
    'processing',
    'bankStatementProcessing',
    'pollingJobs',
    'pollingBankStatementsJobs',
    'manualEntryFiles',
    'chat'
  ]
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }),
  devTools: process.env.NODE_ENV !== 'production'
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
