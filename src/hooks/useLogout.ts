// src/hooks/useLogout.ts
import { useAuth0 } from '@auth0/auth0-react'
import { useCallback } from 'react'
import { useStore } from 'react-redux'
import { clearChatStorage } from 'src/store/slices/chatSlice'
import { clearAll } from 'src/store/slices/processedBatchDataSlice'
import { clearProcessing } from 'src/store/slices/processingSlice'
import { clearFiles } from 'src/store/slices/uploadSlice'
import { clearAll as clearAllProcessedBankStatements } from 'src/store/slices/processedBankStatementBatchDataSlice'
import { clearAllBankStatements } from 'src/store/slices/bankStatementUploadSlice'
import { clearProcessing as clearBankStatementProcessing } from 'src/store/slices/bankstatementProcessingSlice'
import { clearPresignStatementsData } from 'src/store/slices/presignedBankstatementsSlice'
import { resetPresignResponse } from 'src/store/slices/manualEntryFilesSlice'
import { clearAccountingBasisSwitchData } from 'src/store/slices/accountingBasisSwitchSlice'
import { clearPendingPracticePayload } from 'src/store/slices/practiceAccountingBasisSlice'

export const useLogout = () => {
  const store = useStore()
  const { logout } = useAuth0()

  const handleLogout = useCallback(
    (redirectTo: string | null = null) => {
      store.dispatch(clearAll())
      store.dispatch(clearProcessing())
      store.dispatch(clearFiles())
      store.dispatch(clearChatStorage())

      store.dispatch(clearAllProcessedBankStatements())
      store.dispatch(clearAllBankStatements())
      store.dispatch(clearBankStatementProcessing())
      store.dispatch(clearPresignStatementsData())
      store.dispatch(resetPresignResponse())
      store.dispatch(clearPendingPracticePayload())
      store.dispatch(clearAccountingBasisSwitchData())
      logout({
        logoutParams: {
          returnTo: redirectTo ?? window.location.origin
        }
      })
    },
    [store, logout]
  )

  return { handleLogout }
}
