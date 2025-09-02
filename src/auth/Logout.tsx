import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth0 } from '@auth0/auth0-react'
import { paths } from 'src/paths'
import apiClient from 'src/services/api-client'

const Logout = () => {
  const { logout } = useAuth0()
  const navigate = useNavigate()

  useEffect(() => {
    const performLogout = async () => {
      delete apiClient.defaults.headers.common.Authorization

      logout({
        logoutParams: {
          returnTo: `${window.location.origin}${paths.auth.login}`
        }
      })

      navigate(paths.auth.login, { replace: true })
    }

    performLogout()
  }, [logout, navigate])

  return null
}

export default Logout
