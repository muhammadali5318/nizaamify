import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from 'src/lib/supabase'

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return null
      setSession(data.session)
      setIsLoading(false)
      return null
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setIsLoading(false)
      }
    )

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading
    }),
    [session, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useSession(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useSession must be used inside <AuthProvider>')
  }
  return ctx
}
