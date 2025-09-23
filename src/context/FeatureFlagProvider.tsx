import React, { createContext, useContext, useState, ReactNode } from 'react'
import { UserContext } from '../types/feature-flags'

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
