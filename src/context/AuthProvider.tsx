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
import { SplashScreen } from 'src/components/common/SplashScreen'
import { CONFIG } from 'src/config-global'
import { useFetchAllPracticesData } from 'src/hooks/useFetchAllPracticesData'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { useFetchUserWithActivePracticeData } from 'src/hooks/useFetchUserWithActivePracticeData'
import apiClient from 'src/services/api-client'

const TOKEN_REFRESH_TIME = 10 * 60 * 1000

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

  const clearToken = useCallback(() => {
    setAccessToken(null)
    delete apiClient.defaults.headers.common.Authorization
  }, [])

  const applyToken = useCallback((token: string) => {
    setAccessToken(token)
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
  }, [])

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    setTokenLoading(true)
    try {
      if (!isAuthenticated) {
        clearToken()
        setIsInfoLoading(false)
        return null
      }

      const token = await getAccessTokenSilently()

      if (token) {
        applyToken(token)
        setIsInfoLoading(false)
        return token
      }

      clearToken()
      setIsInfoLoading(false)
      return null
    } catch (error) {
      console.error('Error fetching access token:', error)
      clearToken()
      setIsInfoLoading(false)
      return null
    } finally {
      setTokenLoading(false)
    }
  }, [applyToken, clearToken, getAccessTokenSilently, isAuthenticated])

  const refreshAccessToken = useCallback(async () => {
    try {
      if (!isAuthenticated) {
        clearToken()
        return
      }

      const token = await getAccessTokenSilently({ cacheMode: 'off' })

      if (token) {
        applyToken(token)
      }
    } catch (error) {
      console.warn('Error refreshing token:', error)
      clearToken()
    }
  }, [applyToken, clearToken, getAccessTokenSilently, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      void getAccessToken()
    } else {
      clearToken()
      setTokenLoading(false)
      setIsInfoLoading(false)
    }
  }, [clearToken, getAccessToken, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      void refreshAccessToken()
    }, TOKEN_REFRESH_TIME)

    return () => clearInterval(interval)
  }, [isAuthenticated, refreshAccessToken])

  const { isPending: isLoading1 } = useFetchAllPracticesData(!!accessToken)
  const { isPending: isLoading2 } =
    useFetchUserWithActivePracticeData(!!accessToken)
  useInitialData(!!accessToken)

  const isFetching = !!accessToken && (isLoading1 || isLoading2)

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

  if (isFetching) {
    return <SplashScreen />
  }

  return (
    <AuthContext.Provider value={memoizedValue}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
