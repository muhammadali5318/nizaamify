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
import { useInitialData } from 'src/hooks/useFetchInitialData'
import apiClient from 'src/services/api-client'

/* ---------------------- Types ---------------------- */

type Props = { children: React.ReactNode }

type AppUser = {
  id?: string
  displayName?: string | null
  role?: string
  raw?: any
}

type AuthContextType = {
  user: AppUser | null
  loading: boolean
  authenticated: boolean
  accessToken: string | null
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
  console.error((e as Error).message)
}

/* ---------------------- Context ---------------------- */

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/* ---------------------- Top-level AuthProvider (wraps Auth0Provider) ---------------------- */

export function AuthProvider({ children }: Props) {
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
        scope: 'openid profile email offline_access'
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
      cacheLocation='memory'
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
  const [isInfoLoading, setIsInfoLoading] = useState<boolean>(true)

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    setTokenLoading(true)
    try {
      if (!isAuthenticated) {
        setAccessToken(null)
        delete apiClient.defaults.headers.common.Authorization
        return null
      }
      const token = await getAccessTokenSilently()
      if (token) {
        setAccessToken(token)
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
        // optionally fetch user info here
        setIsInfoLoading(false)
        return token
      } else {
        setAccessToken(null)
        delete apiClient.defaults.headers.common.Authorization
        setIsInfoLoading(false)
        return null
      }
    } catch (error) {
      console.error('Error fetching access token:', error)
      setAccessToken(null)
      delete apiClient.defaults.headers.common.Authorization
      setIsInfoLoading(false)
      return null
    } finally {
      setTokenLoading(false)
    }
  }, [getAccessTokenSilently, isAuthenticated])

  // fetch token when authentication state changes
  useEffect(() => {
    // Only fetch when isAuthenticated changes to true
    if (isAuthenticated) {
      void getAccessToken()
    } else {
      // not authenticated -> clear token
      setAccessToken(null)
      delete apiClient.defaults.headers.common.Authorization
      setTokenLoading(false)
      setIsInfoLoading(false)
    }
  }, [isAuthenticated, getAccessToken])

  // load initial app data when accessToken becomes available (or not)
  useInitialData(!!accessToken)

  const isFullyAuthenticated =
    isAuthenticated && !tokenLoading && accessToken !== null

  const status =
    isLoading || tokenLoading || isInfoLoading
      ? 'loading'
      : isFullyAuthenticated
        ? 'authenticated'
        : 'unauthenticated'

  const memoizedValue = useMemo<AuthContextType>(
    () => ({
      user: user
        ? {
            id: (user as any).sub,
            displayName: (user as any).name || (user as any).nickname || null,
            raw: user
          }
        : null,
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      accessToken,
      getAccessToken
    }),
    [user, status, accessToken, getAccessToken]
  )

  if (status === 'loading') {
    return <PageLoader />
  }

  return (
    <AuthContext.Provider value={memoizedValue}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
