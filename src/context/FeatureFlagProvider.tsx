import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect
} from 'react'
import { UserContext } from '../types/feature-flags'
import { FeatureFlagService } from '../services/FeatureFlagService'

type FeatureFlagContextType = {
  userContext: UserContext
  updateUserContext: (updates: Partial<UserContext>) => void
  setContextValue: (key: string, value: any) => void
  getContextValue: (key: string) => any
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(
  undefined
)

type FeatureFlagProviderProps = {
  children: ReactNode
  initialContext?: UserContext
}

export function FeatureFlagProvider({
  children,
  initialContext = {}
}: FeatureFlagProviderProps) {
  const [userContext, setUserContext] = useState<UserContext>(initialContext)

  // Validate feature flag configuration on provider initialization
  useEffect(() => {
    const validation = FeatureFlagService.validateConfiguration()
    if (!validation.isValid) {
      console.error(
        'Feature flag configuration validation failed:',
        validation.errors
      )
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'Feature flag configuration issues detected. Please fix the following:'
        )
        validation.errors.forEach((error) => console.warn('- ' + error))
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('Feature flag configuration is valid')
    }
  }, [])

  const updateUserContext = (updates: Partial<UserContext>) => {
    setUserContext((prev) => ({ ...prev, ...updates }))
  }

  const setContextValue = (key: string, value: any) => {
    setUserContext((prev) => ({ ...prev, [key]: value }))
  }

  const getContextValue = (key: string) => {
    return userContext[key]
  }

  return (
    <FeatureFlagContext.Provider
      value={{
        userContext,
        updateUserContext,
        setContextValue,
        getContextValue
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  )
}

export function useFeatureFlagContext() {
  const context = useContext(FeatureFlagContext)
  if (context === undefined) {
    throw new Error(
      'useFeatureFlagContext must be used within a FeatureFlagProvider'
    )
  }
  return context
}
