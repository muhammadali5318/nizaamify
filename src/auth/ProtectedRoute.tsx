// File: src/auth/ProtectedRoute.tsx
import { withAuthenticationRequired } from '@auth0/auth0-react'
import { CircularProgress } from '@mui/material'
import { FC, ComponentType } from 'react'
import { Navigate } from 'react-router'
import useAuthErrorRedirect from 'src/hooks/useHandleAuth0ErrorRedirect'

interface ProtectedRouteProps {
  component: ComponentType
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ component }) => {
  const redirectTo = useAuthErrorRedirect()

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />
  }

  const Component = withAuthenticationRequired(component, {
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
        <CircularProgress
          sx={{
            color: 'black' // Set the spinner color to black
          }}
          size={30}
          thickness={4}
        />
      </div>
    )
  })

  return <Component />
}

export default ProtectedRoute
