import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useSession } from 'src/features/auth/AuthProvider'
import { useEffectiveSubscription, useProfile } from 'src/features/auth/hooks'
import { useMyPendingInvitation } from 'src/features/team/hooks'
import { paths } from 'src/paths'
import { FullPageSpinner } from 'src/components/common/FullPageSpinner'
import {
  type PermissionKey,
  useIsOwner,
  usePermission,
  usePermissions,
  useSelfPermissions
} from 'src/lib/permissions'

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
  const { data: profile, isLoading: profileLoading } = useProfile()
  // v2.9.1 hot-patch (mig 0090) — before sending a not-yet-onboarded user
  // to the owner onboarding wizard, check if they have a pending invitation
  // for their email. If yes, route them to /invite/accept instead so they
  // become staff at the inviter's shop rather than owner of a new one.
  // Only fires when !onboarding_completed (enabled flag) — onboarded users
  // pay no cost.
  const { data: pendingInv, isLoading: invLoading } = useMyPendingInvitation({
    enabled: !!profile && !profile.onboarding_completed
  })
  if (profileLoading) return <FullPageSpinner />
  if (!profile?.onboarding_completed) {
    if (invLoading) return <FullPageSpinner />
    if (pendingInv) {
      return <Navigate to={paths.gotoAcceptInvitation(pendingInv.id)} replace />
    }
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

// =====================================================================
// v2.9.1 Phase C — Permission-aware guards
// =====================================================================

/**
 * Renders children only when the current user has the given permission
 * for the active shop. Owners auto-pass via implicit shortcut.
 *
 * Default fallback: redirects to /dashboard. Override with `fallback`.
 */
export function RequirePermission({
  permission,
  children,
  fallback = 'redirect'
}: {
  permission: PermissionKey
  children: ReactNode
  fallback?: 'redirect' | 'render-empty'
}) {
  const { isLoading } = useSelfPermissions()
  const hasPermission = usePermission(permission)
  if (isLoading) return <FullPageSpinner />
  if (!hasPermission) {
    if (fallback === 'render-empty') return null
    return <Navigate to={paths.dashboard} replace />
  }
  return <>{children}</>
}

/**
 * Renders children when the user has at least one of the given
 * permissions (OR semantics). Useful for routes like /sales which
 * are reachable with record_sale OR view_all_sales.
 */
export function RequireAnyPermission({
  permissions,
  children,
  fallback = 'redirect'
}: {
  permissions: readonly PermissionKey[]
  children: ReactNode
  fallback?: 'redirect' | 'render-empty'
}) {
  const { isLoading } = useSelfPermissions()
  const granted = usePermissions(permissions)
  if (isLoading) return <FullPageSpinner />
  const hasAny = permissions.some((k) => granted[k])
  if (!hasAny) {
    if (fallback === 'render-empty') return null
    return <Navigate to={paths.dashboard} replace />
  }
  return <>{children}</>
}

/**
 * Renders children only when the current user is the owner of the
 * active shop. Reserved for owner-only sub-flows (currently unused;
 * minted for v2.10+ team-management features like ownership transfer).
 */
export function RequireOwner({
  children,
  fallback = 'redirect'
}: {
  children: ReactNode
  fallback?: 'redirect' | 'render-empty'
}) {
  const { isLoading } = useSelfPermissions()
  const isOwner = useIsOwner()
  if (isLoading) return <FullPageSpinner />
  if (!isOwner) {
    if (fallback === 'render-empty') return null
    return <Navigate to={paths.dashboard} replace />
  }
  return <>{children}</>
}
