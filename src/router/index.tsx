import { Suspense } from 'react'
import { Navigate, useRoutes } from 'react-router'
import { authRoutes } from './auth-routes'
import AppLayout from 'src/layouts/AppLayout'
import Dashboard from 'src/pages/Dashboard'
import Home from 'src/pages/Home'
import About from 'src/pages/About'
import Profile from 'src/pages/Profile'
import NotFound from 'src/pages/NotFound'
import { ProtectedRoute } from 'src/auth/ProtectedRoute'
import { useAuth } from 'src/context/AuthProvider'
import { paths } from 'src/paths'

function RedirectComponent() {
  const { loading, authenticated } = useAuth()
  if (loading) return <h1>Loading...</h1>
  return authenticated ? (
    <Navigate to={paths.dashboard} />
  ) : (
    <Navigate to={paths.auth.login} />
  )
}

export function Router() {
  const routes = [
    { path: paths.root, element: <RedirectComponent /> },
    {
      path: paths.root,
      element: <ProtectedRoute component={AppLayout} />,
      children: [
        { index: true, element: <Navigate to={paths.dashboard} /> },
        { path: paths.dashboard, element: <Dashboard /> },
        { path: paths.home, element: <Home /> },
        {
          path: paths.profile.root,
          children: [
            { index: true, element: <Profile /> },
            { path: paths.profile.detail(), element: <About /> }
          ]
        }
      ]
    },
    ...authRoutes,
    { path: '*', element: <NotFound /> }
  ]

  return (
    <Suspense fallback={<div>Loading...</div>}>{useRoutes(routes)}</Suspense>
  )
}
