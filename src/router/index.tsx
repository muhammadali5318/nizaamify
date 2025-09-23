import { Suspense } from 'react'
import { Navigate, useRoutes } from 'react-router'
import { authRoutes } from './auth-routes'
import AppLayout from 'src/layouts/applayout/AppLayout'
import NotFound from 'src/pages/NotFound'
import { ProtectedRoute } from 'src/auth/ProtectedRoute'
import { FeatureProtectedRoute } from 'src/components/FeatureProtectedRoute'
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
import NominationFlow from 'src/pages/practice-onboarding/NominationFlow'
import PracticeOnboardingFlow from 'src/pages/practice-onboarding/PracticeOnboardingFlow'

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
      path: paths.practiceOnboarding,
      element: <ProtectedRoute component={NominationFlow} />
    },
    {
      path: paths.practiceOnboardingStepper,
      element: <ProtectedRoute component={PracticeOnboardingFlow} />
    },
    {
      path: paths.root,
      element: <ProtectedRoute component={AppLayout} />,
      children: [
        { index: true, element: <Navigate to={paths.dashboard} /> },
        {
          path: paths.dashboard,
          element: (
            <FeatureProtectedRoute moduleId='dashboard'>
              <Dashboard />
            </FeatureProtectedRoute>
          )
        },
        {
          path: paths.documents,
          element: (
            <FeatureProtectedRoute moduleId='documents'>
              <Documents />
            </FeatureProtectedRoute>
          )
        },
        {
          path: paths.reports,
          element: (
            <FeatureProtectedRoute moduleId='reports'>
              <Reports />
            </FeatureProtectedRoute>
          )
        },
        {
          path: paths.benchmarks,
          element: (
            <FeatureProtectedRoute moduleId='benchmarks'>
              <Benchmarks />
            </FeatureProtectedRoute>
          )
        },
        {
          path: paths.teamManagement,
          element: (
            <FeatureProtectedRoute moduleId='team-management'>
              <TeamManagement />
            </FeatureProtectedRoute>
          )
        },
        {
          path: paths.practiceSettings,
          element: (
            <FeatureProtectedRoute moduleId='practice-settings'>
              <PracticeSettings />
            </FeatureProtectedRoute>
          )
        },
        {
          path: paths.billing,
          element: (
            <FeatureProtectedRoute moduleId='billing'>
              <Billing />
            </FeatureProtectedRoute>
          )
        },
        {
          path: paths.settings,
          element: (
            <FeatureProtectedRoute moduleId='settings'>
              <Settings />
            </FeatureProtectedRoute>
          )
        },
        {
          path: paths.helpAndSupport,
          element: (
            <FeatureProtectedRoute moduleId='help-support'>
              <HelpAndSupport />
            </FeatureProtectedRoute>
          )
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
