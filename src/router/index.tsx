import { Navigate, RouteObject, useRoutes } from 'react-router'
import { authRoutes } from './auth-routes'
import AppLayout from 'src/layouts/applayout/AppLayout'
import AgreementContent from 'src/components/agreements-content'
import { paths } from 'src/paths'
import NotFound from 'src/pages/NotFound'
import AuditLogs from 'src/pages/audit-logs'
import BankingAggregator from 'src/pages/bank-integrator'
import UploadBankStatement from 'src/pages/bank-integrator/UploadBankStatement'
import Benchmarks from 'src/pages/benchmarks'
import Billing from 'src/pages/billing'
import Dashboard from 'src/pages/dashboard'
import Documents from 'src/pages/documents'
import ManualEntryPage from 'src/pages/documents/manual-entry/ManualEntryPage'
import ExpenseBreakdown from 'src/pages/expense-breakdown'
import HelpAndSupport from 'src/pages/HelpAndSupport'
import MonaiAgent from 'src/pages/monai-agent'
import NominationFlow from 'src/pages/practice-onboarding/NominationFlow'
import PracticeOnboardingFlow from 'src/pages/practice-onboarding/PracticeOnboardingFlow'
import PracticeSettings from 'src/pages/practice-settings'
import Reports from 'src/pages/reports'
import Settings from 'src/pages/settings'
import AccountingBasisFlow from 'src/pages/settings/AccountingBasisFlow'
import TeamManagement from 'src/pages/team-management'
import MemberRolesAndPermission from 'src/pages/team-management/specific-team-member'

export function Router() {
  const routes: RouteObject[] = [
    {
      path: paths.agreements,
      element: <AgreementContent />
    },
    {
      path: paths.practiceOnboarding,
      element: <NominationFlow />
    },
    {
      path: paths.practiceOnboardingStepper,
      element: <PracticeOnboardingFlow />
    },
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to={paths.dashboard} replace /> },
        { path: 'dashboard', element: <Dashboard /> },
        { path: 'documents', element: <Documents /> },
        { path: 'documents/manual-entry', element: <ManualEntryPage /> },
        { path: 'reports', element: <Reports /> },
        { path: 'benchmarks', element: <Benchmarks /> },
        { path: 'team-management', element: <TeamManagement /> },
        {
          path: 'team-management/members/:id',
          element: <MemberRolesAndPermission />
        },
        { path: 'practice-settings', element: <PracticeSettings /> },
        { path: 'billing', element: <Billing /> },
        { path: 'bank-integrator', element: <BankingAggregator /> },
        {
          path: 'bank-integrator/upload-bank-statement',
          element: <UploadBankStatement />
        },
        { path: 'expense-breakdown', element: <ExpenseBreakdown /> },
        { path: 'monai-agent', element: <MonaiAgent /> },
        { path: 'settings', element: <Settings /> },
        { path: 'settings/:tabId', element: <Settings /> },
        {
          path: 'settings/accounting-basis',
          element: <AccountingBasisFlow />
        },
        { path: 'help-and-support', element: <HelpAndSupport /> },
        { path: 'audit-logs', element: <AuditLogs /> }
      ]
    },
    ...authRoutes,
    { path: '*', element: <NotFound /> }
  ]

  return useRoutes(routes)
}
