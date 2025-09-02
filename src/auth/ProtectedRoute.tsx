// src/auth/ProtectedRoute.tsx
import React from 'react'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from 'src/context/AuthProvider' // <- uses your app-level hook
import { paths } from 'src/paths'

type Props = {
  children?: React.ReactNode
}

/**
 * ProtectedRoute
 * - shows a Spinner while auth is loading
 * - redirects to login if not authenticated
 * - renders children or <Outlet /> when authenticated
 */
export function ProtectedRoute({ children }: Props) {
  const { loading, authenticated } = useAuth()

  if (loading) {
    return <h1>Loading</h1>
  }

  if (!authenticated) {
    // replace with paths.auth.login if you have it in your paths object
    const loginPath = paths?.auth?.login ?? '/login'
    return <Navigate to={loginPath} replace />
  }

  // If caller passed children, render them. Otherwise render nested routes via Outlet.
  return children ? <>{children}</> : <Outlet />
}
