import { Suspense } from 'react'
import { Navigate, useRoutes } from 'react-router'
import { authRoutes } from './auth-routes'
import AppLayout from 'src/layouts/applayout/AppLayout'
import NotFound from 'src/pages/NotFound'
import { ProtectedRoute } from 'src/auth/ProtectedRoute'
import { useAuth } from 'src/context/AuthProvider'
import { paths } from 'src/paths'
import Documents from 'src/pages/documents'
import Reports from 'src/pages/reports'
import Benchmarks from 'src/pages/benchmarks'
import TeamManagement from 'src/pages/team-management'
import PracticeSettings from 'src/pages/practice-settings'
import Billing from 'src/pages/billing'
import Settings from 'src/pages/settings'
import HelpAndSupport from 'src/pages/HelpAndSupport'
import Dashboard from 'src/pages/dashboard'

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
        { path: paths.documents, element: <Documents /> },
        { path: paths.reports, element: <Reports /> },
        { path: paths.benchmarks, element: <Benchmarks /> },
        { path: paths.teamManagement, element: <TeamManagement /> },
        { path: paths.practiceSettings, element: <PracticeSettings /> },
        { path: paths.billing, element: <Billing /> },
        { path: paths.settings, element: <Settings /> },
        { path: paths.helpAndSupport, element: <HelpAndSupport /> }
      ]
    },
    ...authRoutes,
    { path: '*', element: <NotFound /> }
  ]

  return (
    <Suspense fallback={<div>Loading...</div>}>{useRoutes(routes)}</Suspense>
  )
}
