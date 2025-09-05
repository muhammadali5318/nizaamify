import { withAuthenticationRequired } from '@auth0/auth0-react'
import { CircularProgress } from '@mui/material'
import { FC, ComponentType } from 'react'

interface ProtectedRouteProps {
  component: ComponentType
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ component }) => {
  const Component = withAuthenticationRequired(component, {
    onRedirecting: () => (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100vw',
          height: '100vh',
          backgroundColor: '#141a21'
        }}
      >
        <CircularProgress />
      </div>
    )
  })

  return <Component />
}
