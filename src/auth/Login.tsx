import { useAuth0 } from '@auth0/auth0-react'
import React, { useEffect } from 'react'
import { paths } from 'src/paths'

const LoginButton: React.FC = () => {
  const { loginWithRedirect, isLoading, isAuthenticated } = useAuth0()
  const audience = import.meta.env.VITE_APP_AUTH0_AUDIENCE

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) return
    const redirectToLogin = async () => {
      try {
        await loginWithRedirect({
          appState: {
            returnTo: paths.root
          },
          authorizationParams: {
            audience: audience
          }
        })
      } catch (error) {
        console.error('Error during login redirection:', error)
      }
    }

    redirectToLogin()
  }, [loginWithRedirect, audience, isLoading, isAuthenticated])

  return null
}

export default LoginButton
