import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useSession } from 'src/features/auth/AuthProvider'
import { useEffectiveSubscription, useProfile } from 'src/features/auth/hooks'
import { paths } from 'src/paths'
import { FullPageSpinner } from 'src/components/common/FullPageSpinner'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSession()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!session) {
    return (
      <Navigate to={paths.login} replace state={{ from: location.pathname }} />
    )
  }
  return <>{children}</>
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSession()
  if (isLoading) return <FullPageSpinner />
  if (session) return <Navigate to={paths.dashboard} replace />
  return <>{children}</>
}

export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return <FullPageSpinner />
  if (!profile?.onboarding_completed) {
    return <Navigate to={paths.onboarding} replace />
  }
  return <>{children}</>
}

export function RequireActiveSubscription({
  children
}: {
  children: ReactNode
}) {
  const { data, isLoading } = useEffectiveSubscription()
  if (isLoading) return <FullPageSpinner />
  if (
    !data ||
    data.effective_status === 'expired' ||
    data.effective_status === 'suspended'
  ) {
    return <Navigate to={paths.subscriptionExpired} replace />
  }
  return <>{children}</>
}

export function RedirectIfOnboarded({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return <FullPageSpinner />
  if (profile?.onboarding_completed) {
    return <Navigate to={paths.dashboard} replace />
  }
  return <>{children}</>
}

export function RedirectIfActiveSubscription({
  children
}: {
  children: ReactNode
}) {
  const { data, isLoading } = useEffectiveSubscription()
  if (isLoading) return <FullPageSpinner />
  if (
    data &&
    (data.effective_status === 'trial' || data.effective_status === 'active')
  ) {
    return <Navigate to={paths.dashboard} replace />
  }
  return <>{children}</>
}
