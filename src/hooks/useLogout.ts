// src/hooks/useLogout.ts
import { useAuth0 } from '@auth0/auth0-react'
import { useCallback } from 'react'
import { useStore } from 'react-redux'
import { clearChatStorage } from 'src/store/slices/chatSlice'
import { clearAll } from 'src/store/slices/processedBatchDataSlice'
import { clearProcessing } from 'src/store/slices/processingSlice'
import { clearFiles } from 'src/store/slices/uploadSlice'

export const useLogout = () => {
  const store = useStore()
  const { logout } = useAuth0()

  const handleLogout = useCallback(
    (redirectTo: string | null = null) => {
      store.dispatch(clearAll())
      store.dispatch(clearProcessing())
      store.dispatch(clearFiles())
      store.dispatch(clearChatStorage())
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
