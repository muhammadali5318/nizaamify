import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from 'src/context/AuthProvider'

const useRedirectLoggedInToHome = () => {
  const { authenticated, loading } = useAuth()
  const navigate = useNavigate()
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true'

  useEffect(() => {
    if (!bypassAuth && authenticated && !loading) {
      navigate('/')
    }
  }, [authenticated, loading, bypassAuth, navigate])
}

export default useRedirectLoggedInToHome
