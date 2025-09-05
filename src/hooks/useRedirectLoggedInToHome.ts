import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from 'src/context/AuthProvider'

const useRedirectLoggedInToHome = () => {
  const { authenticated, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (authenticated && !loading) {
      navigate('/')
    }
  }, [authenticated, loading, navigate])
}

export default useRedirectLoggedInToHome
