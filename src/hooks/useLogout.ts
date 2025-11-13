// src/hooks/useLogout.ts
import { useAuth0 } from '@auth0/auth0-react'
import { useCallback } from 'react'
import { useStore } from 'react-redux'
import { clearAll } from 'src/store/slices/processedBatchDataSlice'

export const useLogout = () => {
  const store = useStore()
  const { logout } = useAuth0()

  const handleLogout = useCallback(
    (redirectTo: string | null = null) => {
      store.dispatch(clearAll())
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
