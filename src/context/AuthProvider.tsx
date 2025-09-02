import { AppState, Auth0Provider, useAuth0 } from '@auth0/auth0-react'
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useNavigate } from 'react-router'
import { CONFIG } from 'src/config-global'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

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
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true'

  if (bypassAuth) {
    return (
      <AuthContext.Provider
        value={{
          user: {
            id: 'dev-user',
            displayName: 'Dev User',
            role: 'admin',
            raw: { mock: true },
            accessToken: 'fake-token'
          },
          loading: false,
          authenticated: true,
          getAccessToken: async () => 'fake-token'
        }}
      >
        {children}
      </AuthContext.Provider>
    )
  }

  // 🔐 otherwise, run the real Auth0Provider flow
  const { domain, clientId, callbackUrl, audience } = CONFIG.auth
  const navigate = useNavigate()

  const onRedirectCallback = (appState?: AppState) => {
    const target = appState?.returnTo || '/'
    navigate(target, { replace: true })
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: callbackUrl,
        audience,
        scope: 'openid profile email'
        // remove `prompt: 'login'` unless you explicitly want to force re-login
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <AuthProviderContainer>{children}</AuthProviderContainer>
    </Auth0Provider>
  )
}

/* ---------------------- Container (implements token logic) ---------------------- */

function AuthProviderContainer({ children }: Props) {
  const {
    user: auth0User,
    isAuthenticated,
    isLoading: auth0IsLoading,
    getAccessTokenSilently
  } = useAuth0()

  // simple typed local state
  const [user, setUser] = useState<AppUser | null>(null)
  const [internalLoading, setInternalLoading] = useState<boolean>(true)

  // token lives here (ref so interceptor always sees latest)
  const tokenRef = useRef<string | null>(null)
  const axiosInterceptorId = useRef<number | null>(null)

  // register an axios interceptor once to attach token from tokenRef
  useEffect(() => {
    const id = apiClient.interceptors.request.use((config) => {
      if (tokenRef.current) {
        // ensure headers object exists

        config.headers = config.headers ?? {}
        // attach bearer token
        config.headers.Authorization = `Bearer ${tokenRef.current}`
      }
      return config
    })
    axiosInterceptorId.current = id
    return () => {
      if (axiosInterceptorId.current !== null) {
        apiClient.interceptors.request.eject(axiosInterceptorId.current)
      }
    }
  }, [])

  // helper to safely fetch user info from backend
  const fetchUserInfo = async (mountedRef: { current: boolean }) => {
    try {
      setInternalLoading(true)
      const res = await apiClient.get(endpoints?.userInfo)
      if (!mountedRef.current) return
      if (res?.data?.status) {
        const data = res.data.data
        const appUser: AppUser = {
          id: auth0User?.sub,
          displayName: data?.user_data?.name ?? auth0User?.name ?? null,
          role: data?.user_data?.roles ?? 'admin',
          raw: data
        }
        setUser((prev) => ({ ...prev, ...appUser }))
      }
    } catch (err) {
      // handle errors gracefully
    } finally {
      if (mountedRef.current) setInternalLoading(false)
    }
  }

  // central function to get token and fetch user info
  const getAccessToken = async (): Promise<string | null> => {
    try {
      // ask auth0 for a token (silently)
      const token = await getAccessTokenSilently({
        audience: CONFIG.auth.audience
      })
      tokenRef.current = token
      return token
    } catch (err) {
      // on failure clear token
      tokenRef.current = null
      return null
    }
  }

  // Effect: whenever auth0 state changes, ensure token + user info are in sync
  useEffect(() => {
    const mountedRef = { current: true }
    const sync = async () => {
      // if not authenticated, clear everything
      if (!isAuthenticated) {
        tokenRef.current = null
        setUser(null)
        setInternalLoading(false)
        return
      }

      // get token
      try {
        setInternalLoading(true)
        const token = await getAccessToken()
        if (!mountedRef.current) return

        if (token) {
          // fetch user info from backend which relies on axios interceptor attaching token
          await fetchUserInfo(mountedRef)
          // keep token on user object for convenience
          setUser((prev) => ({ ...(prev ?? {}), accessToken: token }))
        } else {
          setUser(null)
        }
      } finally {
        if (mountedRef.current) setInternalLoading(false)
      }
    }

    sync()

    return () => {
      mountedRef.current = false
    }
    // intentionally only depend on these few values so we run on auth state changes
  }, [isAuthenticated, getAccessTokenSilently, auth0IsLoading, auth0User])

  const loading = auth0IsLoading || internalLoading
  const authenticated = isAuthenticated && !!tokenRef.current

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      authenticated,
      getAccessToken
    }),
    // list deps minimally
    [user, loading, authenticated]
  )

  if (loading) return <h2>Loading new</h2>

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
