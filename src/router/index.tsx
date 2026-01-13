// Router.tsx
import { Suspense, lazy, useMemo } from 'react'
import { Navigate, useRoutes, RouteObject } from 'react-router'
import { authRoutes } from './auth-routes'
import AppLayout from 'src/layouts/applayout/AppLayout'
import NotFound from 'src/pages/NotFound'
import { ProtectedRoute } from 'src/auth/ProtectedRoute'
import { FeatureProtectedRoute } from 'src/components/FeatureProtectedRoute'
import { useAuth } from 'src/context/AuthProvider'
import { paths } from 'src/paths'
import ErrorBoundary from 'src/components/common/error-boundary'
import { SplashScreen } from 'src/components/common/SplashScreen'

import ManualEntryPage from 'src/pages/documents/manual-entry/ManualEntryPage'

// lazy pages
const Dashboard = lazy(() => import('src/pages/dashboard'))
const Documents = lazy(() => import('src/pages/documents'))
const Reports = lazy(() => import('src/pages/reports'))
const AgreementContent = lazy(() => import('src/components/agreements-content'))
const Benchmarks = lazy(() => import('src/pages/benchmarks'))
const TeamManagement = lazy(() => import('src/pages/team-management'))
const MemberRolesAndPermission = lazy(
  () => import('src/pages/team-management/specific-team-member')
)
const PracticeSettings = lazy(() => import('src/pages/practice-settings'))
const BankIntegrator = lazy(() => import('src/pages/bank-integrator'))
const ExpenseBreakdown = lazy(() => import('src/pages/expense-breakdown'))
const NonPLItems = lazy(() => import('src/pages/non-pl-items'))

const Billing = lazy(() => import('src/pages/billing'))
const Settings = lazy(() => import('src/pages/settings'))
const HelpAndSupport = lazy(() => import('src/pages/HelpAndSupport'))
const AuditLogs = lazy(() => import('src/pages/audit-logs'))
const NominationFlow = lazy(
  () => import('src/pages/practice-onboarding/NominationFlow')
)
const PracticeOnboardingFlow = lazy(
  () => import('src/pages/practice-onboarding/PracticeOnboardingFlow')
)

function RedirectComponent() {
  const { loading, authenticated } = useAuth()
  if (loading) return <SplashScreen />
  return authenticated ? (
    <Navigate to={paths.dashboard} replace />
  ) : (
    <Navigate to={paths.auth.login} replace />
  )
}

export function Router() {
  // memoize to avoid re-creating route objects on every render
  const routes: RouteObject[] = useMemo(
    () => [
      { path: paths.root, element: <RedirectComponent /> },

      // practice onboarding routes (can be outside layout)
      {
        path: paths.agreements,
        element: (
          <ProtectedRoute>
            <AgreementContent />
          </ProtectedRoute>
        )
      },
      {
        path: paths.practiceOnboarding,
        element: (
          <FeatureProtectedRoute moduleId='nomination-flow'>
            <ProtectedRoute>
              <NominationFlow />
            </ProtectedRoute>
          </FeatureProtectedRoute>
        )
      },
      {
        path: paths.practiceOnboardingStepper,
        element: (
          <ProtectedRoute>
            <PracticeOnboardingFlow />
          </ProtectedRoute>
        )
      },

      {
        path: '/',
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to={paths.dashboard} replace /> },
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
            ),
            children: [
              {
                path: 'manual-entry',
                element: (
                  <FeatureProtectedRoute moduleId='documents'>
                    <ManualEntryPage />
                  </FeatureProtectedRoute>
                )
              }
            ]
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
            path: paths.teamManagement.specificTeamMember,
            element: (
              <FeatureProtectedRoute moduleId='team-management'>
                <MemberRolesAndPermission />
              </FeatureProtectedRoute>
            )
          },
          {
            path: paths.teamManagement.root,
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
            path: paths.bankIntegrator,
            element: (
              <FeatureProtectedRoute moduleId='bank-integrator'>
                <BankIntegrator />
              </FeatureProtectedRoute>
            )
          },
          {
            path: paths.expense,
            element: (
              <FeatureProtectedRoute moduleId='expenses'>
                <ExpenseBreakdown />
              </FeatureProtectedRoute>
            )
          },
          {
            path: paths.nonPandL,
            element: (
              <FeatureProtectedRoute moduleId='non-pandl'>
                <NonPLItems />
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
          },
          {
            path: paths.auditLogs,
            element: (
              <FeatureProtectedRoute moduleId='audit-logs'>
                <AuditLogs />
              </FeatureProtectedRoute>
            )
          }
        ]
      },

      // auth routes spread
      ...authRoutes,

      // final fallback
      { path: '*', element: <NotFound /> }
    ],
    []
  )

  return (
    <ErrorBoundary>
      <Suspense fallback={<SplashScreen />}>{useRoutes(routes)}</Suspense>
    </ErrorBoundary>
  )
}
