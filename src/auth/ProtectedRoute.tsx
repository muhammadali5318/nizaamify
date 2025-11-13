// File: src/auth/ProtectedRoute.tsx
import { withAuthenticationRequired } from '@auth0/auth0-react'
import { CircularProgress } from '@mui/material'
import { FC, ComponentType, ReactNode } from 'react'
import useAuthErrorRedirect from 'src/hooks/useHandleAuth0ErrorRedirect'
import { useLogout } from 'src/hooks/useLogout'

interface ProtectedRouteProps {
  component?: ComponentType<any>
  children?: ReactNode
}

export const ProtectedRoute: FC<ProtectedRouteProps> = function ProtectedRoute({
  component,
  children
}) {
  const { handleLogout } = useLogout()

  const redirectTo = useAuthErrorRedirect()

  if (redirectTo) {
    handleLogout(redirectTo)
    return null
  }

  let InnerComponent: ComponentType<any> | null = null

  if (children) {
    InnerComponent = function ProtectedRouteInner() {
      return <>{children}</>
    }
  } else if (component) {
    InnerComponent = component
  }

  if (!InnerComponent) {
    return null
  }

  const AuthenticatedComponent = withAuthenticationRequired(InnerComponent, {
    onRedirecting: () => (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100vw',
          height: '100vh',
          backgroundColor: '#fff'
        }}
      >
        <CircularProgress sx={{ color: 'black' }} size={30} thickness={4} />
      </div>
    )
  })

  // Give the HOC-returned component a displayName for clearer DevTools & to satisfy eslint.
  ;(AuthenticatedComponent as any).displayName =
    (AuthenticatedComponent as any).displayName ||
    'ProtectedRoute.Authenticated'

  return <AuthenticatedComponent />
}
;(ProtectedRoute as any).displayName = 'ProtectedRoute'

export default ProtectedRoute
