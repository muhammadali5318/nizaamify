import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from 'src/context/AuthProvider'

const useRedirectLoggedInToHome = () => {
  const { authenticated, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (
      authenticated &&
      !loading &&
      location.pathname !== '/auth/email-not-verified'
    ) {
      navigate('/')
    }
  }, [authenticated, loading, navigate])
}

export default useRedirectLoggedInToHome
