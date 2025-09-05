import { AppState, Auth0Provider, useAuth0 } from '@auth0/auth0-react'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { useNavigate } from 'react-router'
import PageLoader from 'src/components/common/page-loader'
import { CONFIG } from 'src/config-global'
import apiClient from 'src/services/api-client'

/* ---------------------- Types ---------------------- */

type Props = { children: React.ReactNode }

type AppUser = {
  id?: string
  displayName?: string | null
  role?: string
  raw?: any
  accessToken?: string | null
}

type AuthContextType = {
  user: AppUser | null
  loading: boolean
  authenticated: boolean
  getAccessToken: () => Promise<string | null>
}

/* ---------------------- Config validation ---------------------- */

function validateAuthConfig(config: Record<string, any>) {
  const requiredKeys = ['domain', 'clientId', 'callbackUrl', 'audience']
  const missing = requiredKeys.filter((k) => !config?.[k])
  if (missing.length) {
    throw new Error(`Auth0 configuration missing keys: ${missing.join(', ')}`)
  }
}

try {
  validateAuthConfig(CONFIG.auth)
} catch (e) {
  // Dev-time visibility. In production you might want to fail faster.
  // Keep the app from crashing immediately though.

  console.error((e as Error).message)
}

/* ---------------------- Context ---------------------- */

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/* ---------------------- High level AuthProvider (wraps Auth0Provider) ---------------------- */

export function AuthProvider({ children }: Props) {
  // 🔐 otherwise, run the real Auth0Provider flow
  const { domain, clientId, callbackUrl, audience } = CONFIG.auth
  const navigate = useNavigate()

  const onRedirectCallback = (appState?: AppState) => {
    const target = appState?.returnTo || '/'
    navigate(target, { replace: true })
  }

  if (!(domain && clientId && callbackUrl && audience)) {
    return <span>.env file or Auth0 configuration missing</span>
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: callbackUrl,
        audience,
        scope: 'openid profile email',
        prompt: 'login'
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
      cacheLocation='localstorage'
    >
      <AuthProviderContainer>{children}</AuthProviderContainer>
    </Auth0Provider>
  )
}

/* ---------------------- Container (implements token logic) ---------------------- */

function AuthProviderContainer({ children }: Props) {
  const { user, isLoading, isAuthenticated, getAccessTokenSilently } =
    useAuth0()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState<boolean>(true)
  const [userInfo, setUserInfo] = useState()
  const [isInfoLoading, setIsInfoLoading] = useState<boolean>(true)
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      let token: string | null = null
      if (isAuthenticated) {
        token = await getAccessTokenSilently()
        setAccessToken(token)
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
      } else {
        setAccessToken(null)
        delete apiClient.defaults.headers.common.Authorization
      }
      if (token) {
        // getUserInfo()
      } else {
        setIsInfoLoading(false)
      }
      return token
    } catch (error) {
      console.error('Error fetching access token:', error)
      setAccessToken(null)
      delete apiClient.defaults.headers.common.Authorization
      return null
    } finally {
      setTokenLoading(false)
    }
  }, [getAccessTokenSilently, isAuthenticated])

  useEffect(() => {
    getAccessToken()
  }, [getAccessToken])

  const isFullyAuthenticated =
    isAuthenticated && !tokenLoading && accessToken !== null

  const status =
    isLoading || tokenLoading
      ? 'loading'
      : isFullyAuthenticated
        ? 'authenticated'
        : 'unauthenticated'

  const memoizedValue = useMemo(
    () => ({
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
      getAccessToken
    }),
    [
      accessToken,
      userInfo,
      tokenLoading,
      isInfoLoading,
      status,
      user?.name,
      user?.sub
    ]
  )

  if (isLoading || tokenLoading || isInfoLoading) {
    return <PageLoader />
  }

  return (
    <AuthContext.Provider value={memoizedValue}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
